import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { Package, AlertTriangle, Upload } from 'lucide-react';

interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  category: { id: string; name: string };
  unit: string;
  sellingPrice: number;
  costPrice: number;
  reorderLevel: number;
  stockLevel?: { quantity: number };
  storeId: string;
}

interface Category {
  id: string;
  name: string;
}

export default function Products() {
  const user = useAuthStore((s) => s.user);
  const currentStore = useAuthStore((s) => s.currentStore);
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [form, setForm] = useState({
    sku: '', name: '', description: '', categoryId: '', unit: '',
    sellingPrice: '', costPrice: '', reorderLevel: '10',
    storeId: currentStore || '',
  });

  const { data: products } = useQuery({
    queryKey: ['products', currentStore],
    queryFn: async () => {
      const res = await api.get('/products', { params: { storeId: currentStore } });
      return res.data.data as Product[];
    },
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await api.get('/categories');
      return res.data.data as Category[];
    },
  });

  const createProduct = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await api.post('/products', data);
      return res.data.data;
    },
    onSuccess: () => {
      toast.success('Product created');
      setShowForm(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Failed to create product'),
  });

  const updateProduct = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await api.patch(`/products/${id}`, data);
      return res.data.data;
    },
    onSuccess: () => {
      toast.success('Product updated');
      setEditingId(null);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Failed to update product'),
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/products/${id}`);
    },
    onSuccess: () => {
      toast.success('Product deactivated');
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Failed to delete product'),
  });

  const bulkImport = useMutation({
    mutationFn: async (body: { storeId: string; items: any[] }) => {
      const res = await api.post('/products/bulk-import', body);
      return res.data.data;
    },
    onSuccess: (data) => {
      toast.success(`${data.count} products imported`);
      setShowBulk(false);
      setBulkText('');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Bulk import failed'),
  });

  function resetForm() {
    setForm({ sku: '', name: '', description: '', categoryId: '', unit: '', sellingPrice: '', costPrice: '', reorderLevel: '10', storeId: currentStore || '' });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      ...form,
      sellingPrice: Number(form.sellingPrice),
      costPrice: Number(form.costPrice),
      reorderLevel: Number(form.reorderLevel),
    };
    if (editingId) {
      updateProduct.mutate({ id: editingId, data: payload });
    } else {
      createProduct.mutate(payload);
    }
  }

  function startEdit(p: Product) {
    setEditingId(p.id);
    setForm({
      sku: p.sku, name: p.name, description: p.description || '',
      categoryId: p.category.id, unit: p.unit,
      sellingPrice: String(p.sellingPrice), costPrice: String(p.costPrice),
      reorderLevel: String(p.reorderLevel), storeId: p.storeId,
    });
    setShowForm(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Package className="h-6 w-6" /> Products</h1>
        <div className="flex gap-2">
          <button onClick={() => { setShowBulk(!showBulk); setShowForm(false); }} className="border border-border px-4 py-2 text-sm font-medium hover:bg-muted flex items-center gap-2">
            <Upload className="h-4 w-4" /> Bulk Import
          </button>
          <button
            onClick={() => { setShowForm(!showForm); setShowBulk(false); if (showForm) { setEditingId(null); resetForm(); } }}
            className="bg-primary text-white px-4 py-2 text-sm font-medium hover:opacity-90"
          >
            {showForm ? 'Cancel' : 'Add Product'}
          </button>
        </div>
      </div>

      {showBulk && (
        <div className="bg-white border border-border p-4 space-y-3">
          <h3 className="font-semibold text-sm">Bulk Import Products</h3>
          <p className="text-xs text-muted-foreground">Paste CSV data (one per line): sku, name, categoryId, unit, sellingPrice, costPrice, reorderLevel, initialStock</p>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={`CMT-50,Cement 50kg,CAT_ID,bag,45.00,35.00,10,100\nIR-12,Iron Rod 12mm,CAT_ID,piece,28.00,20.00,20,50`}
            className="border border-border px-3 py-2 w-full h-32 font-mono text-xs"
          />
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (!currentStore) { toast.error('Select a store first'); return; }
                const lines = bulkText.trim().split('\n').filter((l) => l.trim());
                const items = lines.map((line) => {
                  const [sku, name, categoryId, unit, sellingPrice, costPrice, reorderLevel, initialStock] = line.split(',').map((s) => s.trim());
                  return { sku, name, categoryId, unit, sellingPrice: Number(sellingPrice), costPrice: Number(costPrice), reorderLevel: Number(reorderLevel) || 10, initialStock: Number(initialStock) || 0 };
                });
                bulkImport.mutate({ storeId: currentStore, items });
              }}
              className="bg-primary text-white px-4 py-2 text-sm font-medium hover:opacity-90"
              disabled={bulkImport.isPending}
            >
              {bulkImport.isPending ? 'Importing...' : `Import ${bulkText.trim() ? bulkText.trim().split('\n').length : 0} Products`}
            </button>
            <button onClick={() => { setShowBulk(false); setBulkText(''); }} className="border border-border px-4 py-2 text-sm font-medium hover:bg-muted">Cancel</button>
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-border p-4 grid grid-cols-2 gap-4">
          <input placeholder="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="border border-border px-3 py-2" required />
          <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="border border-border px-3 py-2" required />
          <input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="border border-border px-3 py-2" />
          <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className="border border-border px-3 py-2" required>
            <option value="">Select Category</option>
            {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input placeholder="Unit (e.g. bag, piece)" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="border border-border px-3 py-2" required />
          <input placeholder="Selling Price" type="number" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} className="border border-border px-3 py-2" required />
          <input placeholder="Cost Price" type="number" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} className="border border-border px-3 py-2" required />
          <input placeholder="Reorder Level" type="number" value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} className="border border-border px-3 py-2" required />
          {user?.role === 'ADMIN' && (
            <input placeholder="Store ID" value={form.storeId} onChange={(e) => setForm({ ...form, storeId: e.target.value })} className="border border-border px-3 py-2" required />
          )}
          <div className="col-span-2">
            <button type="submit" className="bg-primary text-white px-4 py-2 text-sm font-medium hover:opacity-90">
              {editingId ? 'Update Product' : 'Create Product'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border border-border overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left px-4 py-3 font-medium">SKU</th>
              <th className="text-left px-4 py-3 font-medium">Name</th>
              <th className="text-left px-4 py-3 font-medium">Category</th>
              <th className="text-left px-4 py-3 font-medium">Unit</th>
              <th className="text-right px-4 py-3 font-medium">Price</th>
              <th className="text-right px-4 py-3 font-medium">Stock</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-right px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products?.map((p) => {
              const qty = Number(p.stockLevel?.quantity ?? 0);
              const low = qty < p.reorderLevel;
              return (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-4 py-3 font-mono">{p.sku}</td>
                  <td className="px-4 py-3">{p.name}</td>
                  <td className="px-4 py-3">{p.category.name}</td>
                  <td className="px-4 py-3">{p.unit}</td>
                  <td className="px-4 py-3 text-right font-mono">GHS {p.sellingPrice}</td>
                  <td className="px-4 py-3 text-right font-mono">{qty}</td>
                  <td className="px-4 py-3">
                    {low ? (
                      <span className="inline-flex items-center gap-1 text-warning text-xs font-medium">
                        <AlertTriangle className="h-3 w-3" /> Low Stock
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-success text-xs font-medium">
                        <Package className="h-3 w-3" /> OK
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button onClick={() => startEdit(p)} className="text-primary text-xs font-medium hover:underline">Edit</button>
                    <button onClick={() => deleteProduct.mutate(p.id)} className="text-danger text-xs font-medium hover:underline">Delete</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {(!products || products.length === 0) && (
          <div className="p-8 text-center text-muted-foreground text-sm">No products found</div>
        )}
      </div>
    </div>
  );
}
