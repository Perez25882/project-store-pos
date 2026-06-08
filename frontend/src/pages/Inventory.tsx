import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { ArrowUpDown, History } from 'lucide-react';

interface StockItem {
  id: string;
  product: {
    id: string;
    sku: string;
    name: string;
    category: { name: string };
    unit: string;
    reorderLevel: number;
  };
  quantity: number;
  storeId: string;
}

interface Movement {
  id: string;
  type: string;
  quantity: number;
  balanceAfter: number;
  note?: string;
  createdAt: string;
  product: { sku: string; name: string };
  employee: { name: string };
}

export default function Inventory() {
  const currentStore = useAuthStore((s) => s.currentStore);
  const queryClient = useQueryClient();
  const [adjustProductId, setAdjustProductId] = useState('');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [showMovements, setShowMovements] = useState(false);

  const { data: stock } = useQuery({
    queryKey: ['inventory', currentStore],
    queryFn: async () => {
      const res = await api.get('/inventory', { params: { storeId: currentStore } });
      return res.data.data as StockItem[];
    },
  });

  const { data: movements } = useQuery({
    queryKey: ['movements', currentStore],
    queryFn: async () => {
      const res = await api.get('/inventory/movements', { params: { storeId: currentStore } });
      return res.data.data as Movement[];
    },
    enabled: showMovements,
  });

  const adjustStock = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await api.post('/inventory/adjust', data);
      return res.data.data;
    },
    onSuccess: () => {
      toast.success('Stock adjusted');
      setAdjustProductId(''); setAdjustQty(''); setAdjustNote('');
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['movements'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Adjustment failed'),
  });

  function handleAdjust(e: React.FormEvent) {
    e.preventDefault();
    adjustStock.mutate({
      productId: adjustProductId,
      quantity: Number(adjustQty),
      note: adjustNote,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inventory</h1>
        <button
          onClick={() => setShowMovements(!showMovements)}
          className="flex items-center gap-2 bg-white border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          <History className="h-4 w-4" />
          {showMovements ? 'Hide Movements' : 'View Movements'}
        </button>
      </div>

      <form onSubmit={handleAdjust} className="bg-white border border-border p-4 flex gap-4 items-end">
        <div className="flex-1">
          <label className="block text-xs font-medium mb-1">Product</label>
          <select
            value={adjustProductId}
            onChange={(e) => setAdjustProductId(e.target.value)}
            className="w-full border border-border px-3 py-2"
            required
          >
            <option value="">Select product</option>
            {stock?.map((s) => (
              <option key={s.product.id} value={s.product.id}>
                {s.product.sku} — {s.product.name} (current: {s.quantity})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Adjustment (+/-)</label>
          <input
            type="number"
            value={adjustQty}
            onChange={(e) => setAdjustQty(e.target.value)}
            placeholder="e.g. 10 or -5"
            className="w-40 border border-border px-3 py-2"
            required
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium mb-1">Note</label>
          <input
            type="text"
            value={adjustNote}
            onChange={(e) => setAdjustNote(e.target.value)}
            placeholder="Reason for adjustment"
            className="w-full border border-border px-3 py-2"
          />
        </div>
        <button
          type="submit"
          className="bg-primary text-white px-4 py-2 text-sm font-medium hover:opacity-90 flex items-center gap-2"
        >
          <ArrowUpDown className="h-4 w-4" />
          Adjust
        </button>
      </form>

      <div className="bg-white border border-border overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left px-4 py-3 font-medium">SKU</th>
              <th className="text-left px-4 py-3 font-medium">Product</th>
              <th className="text-left px-4 py-3 font-medium">Category</th>
              <th className="text-right px-4 py-3 font-medium">Quantity</th>
              <th className="text-right px-4 py-3 font-medium">Reorder Level</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {stock?.map((s) => {
              const qty = Number(s.quantity);
              const low = qty < s.product.reorderLevel;
              return (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-4 py-3 font-mono">{s.product.sku}</td>
                  <td className="px-4 py-3">{s.product.name}</td>
                  <td className="px-4 py-3">{s.product.category.name}</td>
                  <td className="px-4 py-3 text-right font-mono">{qty} {s.product.unit}</td>
                  <td className="px-4 py-3 text-right font-mono">{s.product.reorderLevel}</td>
                  <td className="px-4 py-3">
                    {low ? (
                      <span className="text-warning text-xs font-medium">Low Stock</span>
                    ) : (
                      <span className="text-success text-xs font-medium">OK</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showMovements && (
        <div className="bg-white border border-border overflow-auto">
          <h2 className="px-4 py-3 font-semibold border-b border-border">Stock Movements</h2>
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Date</th>
                <th className="text-left px-4 py-3 font-medium">Product</th>
                <th className="text-left px-4 py-3 font-medium">Type</th>
                <th className="text-right px-4 py-3 font-medium">Qty</th>
                <th className="text-right px-4 py-3 font-medium">Balance</th>
                <th className="text-left px-4 py-3 font-medium">Note</th>
                <th className="text-left px-4 py-3 font-medium">By</th>
              </tr>
            </thead>
            <tbody>
              {movements?.map((m) => (
                <tr key={m.id} className="border-t border-border">
                  <td className="px-4 py-3 text-xs">{new Date(m.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">{m.product.sku}</td>
                  <td className="px-4 py-3 text-xs">{m.type}</td>
                  <td className={`px-4 py-3 text-right font-mono ${Number(m.quantity) < 0 ? 'text-danger' : 'text-success'}`}>
                    {m.quantity > 0 ? '+' : ''}{m.quantity}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{m.balanceAfter}</td>
                  <td className="px-4 py-3 text-xs">{m.note || '-'}</td>
                  <td className="px-4 py-3 text-xs">{m.employee.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
