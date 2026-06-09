import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { Plus, PackageCheck } from 'lucide-react';

interface Product {
  id: string;
  sku: string;
  name: string;
}

interface Supplier {
  id: string;
  name: string;
}

interface POItem {
  productId: string;
  sku: string;
  name: string;
  quantityOrdered: number;
  unitCost: number;
  total: number;
  quantityReceived?: number;
}

interface ProcurementOrder {
  id: string;
  orderNumber: string;
  supplier: { name: string };
  status: string;
  subtotal: number;
  tax: number;
  total: number;
  createdAt: string;
  expectedAt?: string;
  items: { product: { id: string; name: string }; quantityOrdered: number; quantityReceived: number }[];
}

export default function Procurement() {
  const currentStore = useAuthStore((s) => s.currentStore);
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [receiveId, setReceiveId] = useState<string | null>(null);
  const [cart, setCart] = useState<POItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [qty, setQty] = useState('');
  const [cost, setCost] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [tax, setTax] = useState('0');
  const [note, setNote] = useState('');
  const [expectedAt, setExpectedAt] = useState('');
  const [receiveQty, setReceiveQty] = useState<Record<string, string>>({});

  const { data: orders } = useQuery({
    queryKey: ['procurement', currentStore],
    queryFn: async () => {
      const res = await api.get('/procurement', { params: { storeId: currentStore } });
      return res.data.data as ProcurementOrder[];
    },
  });

  const { data: products } = useQuery({
    queryKey: ['products', currentStore],
    queryFn: async () => {
      const res = await api.get('/products', { params: { storeId: currentStore } });
      return res.data.data as Product[];
    },
  });

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers', currentStore],
    queryFn: async () => {
      const res = await api.get('/suppliers', { params: { storeId: currentStore } });
      return res.data.data as Supplier[];
    },
  });

  const createOrder = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await api.post('/procurement', data);
      return res.data.data;
    },
    onSuccess: () => {
      toast.success('Purchase order created');
      resetForm();
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['procurement'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Failed to create PO'),
  });

  const receiveOrder = useMutation({
    mutationFn: async ({ id, items }: { id: string; items: { productId: string; quantityReceived: number }[] }) => {
      const res = await api.patch(`/procurement/${id}/receive`, { items });
      return res.data.data;
    },
    onSuccess: () => {
      toast.success('Goods received and stock updated');
      setReceiveId(null);
      setReceiveQty({});
      queryClient.invalidateQueries({ queryKey: ['procurement'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Receipt failed'),
  });

  const cancelOrder = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.patch(`/procurement/${id}/cancel`);
      return res.data.data;
    },
    onSuccess: () => {
      toast.success('Order cancelled');
      queryClient.invalidateQueries({ queryKey: ['procurement'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Cancel failed'),
  });

  function addToCart() {
    if (!selectedProduct || !qty || !cost) return;
    const product = products?.find((p) => p.id === selectedProduct);
    if (!product) return;
    const quantity = Number(qty);
    const unitCost = Number(cost);
    setCart([...cart, { productId: product.id, sku: product.sku, name: product.name, quantityOrdered: quantity, unitCost, total: quantity * unitCost }]);
    setSelectedProduct('');
    setQty('');
    setCost('');
  }

  function removeFromCart(productId: string) {
    setCart(cart.filter((i) => i.productId !== productId));
  }

  const subtotal = cart.reduce((sum, i) => sum + i.total, 0);
  const totalTax = Number(tax);
  const total = subtotal + totalTax;

  function handleSubmit() {
    if (cart.length === 0) { toast.error('Cart is empty'); return; }
    if (!supplierId) { toast.error('Select a supplier'); return; }
    createOrder.mutate({
      storeId: currentStore,
      supplierId,
      items: cart.map((i) => ({ productId: i.productId, quantityOrdered: i.quantityOrdered, unitCost: i.unitCost })),
      tax: totalTax,
      note: note || undefined,
      expectedAt: expectedAt || undefined,
    });
  }

  function resetForm() {
    setCart([]);
    setSupplierId('');
    setTax('0');
    setNote('');
    setExpectedAt('');
  }

  function submitReceive(order: ProcurementOrder) {
    const items = order.items.map((item) => ({
      productId: item.product.id,
      quantityReceived: Number(receiveQty[item.product.name] || 0),
    })).filter((i) => i.quantityReceived > 0);
    if (items.length === 0) { toast.error('Enter received quantities'); return; }
    receiveOrder.mutate({ id: order.id, items });
  }

  const statusColor: Record<string, string> = {
    DRAFT: 'text-muted-foreground',
    SENT: 'text-primary',
    PARTIALLY_RECEIVED: 'text-warning',
    FULLY_RECEIVED: 'text-success',
    CANCELLED: 'text-danger',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Procurement</h1>
        <button onClick={() => { setShowForm(!showForm); if (showForm) resetForm(); }} className="bg-primary text-white px-4 py-2 text-sm font-medium hover:opacity-90 flex items-center gap-2">
          <Plus className="h-4 w-4" /> {showForm ? 'Cancel' : 'New PO'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-border p-4 space-y-4">
          <div className="flex gap-3">
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="flex-1 border border-border px-3 py-2" required>
              <option value="">Select supplier</option>
              {suppliers?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input type="date" value={expectedAt} onChange={(e) => setExpectedAt(e.target.value)} className="border border-border px-3 py-2" />
          </div>
          <div className="flex gap-3">
            <select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)} className="flex-1 border border-border px-3 py-2">
              <option value="">Select product</option>
              {products?.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
            </select>
            <input type="number" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Qty" className="w-24 border border-border px-3 py-2" />
            <input type="number" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="Unit Cost" className="w-32 border border-border px-3 py-2" />
            <button onClick={addToCart} className="bg-primary text-white px-4 py-2 text-sm font-medium hover:opacity-90">Add</button>
          </div>
          {cart.length > 0 && (
            <table className="w-full text-sm">
              <thead className="bg-muted"><tr><th className="text-left px-3 py-2">Product</th><th className="text-right px-3 py-2">Qty</th><th className="text-right px-3 py-2">Cost</th><th className="text-right px-3 py-2">Total</th><th></th></tr></thead>
              <tbody>
                {cart.map((item) => (
                  <tr key={item.productId} className="border-t border-border">
                    <td className="px-3 py-2">{item.name}</td>
                    <td className="px-3 py-2 text-right font-mono">{item.quantityOrdered}</td>
                    <td className="px-3 py-2 text-right font-mono">GHS {item.unitCost}</td>
                    <td className="px-3 py-2 text-right font-mono">GHS {item.total}</td>
                    <td className="px-3 py-2 text-right"><button onClick={() => removeFromCart(item.productId)} className="text-danger text-xs">Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="flex gap-3 items-center">
            <input type="number" value={tax} onChange={(e) => setTax(e.target.value)} placeholder="Tax" className="w-32 border border-border px-3 py-2" />
            <span className="font-bold font-mono">Total: GHS {total.toFixed(2)}</span>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note" className="flex-1 border border-border px-3 py-2" />
            <button onClick={handleSubmit} disabled={createOrder.isPending} className="bg-primary text-white px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50">Create PO</button>
          </div>
        </div>
      )}

      <div className="bg-white border border-border overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left px-4 py-3 font-medium">PO #</th>
              <th className="text-left px-4 py-3 font-medium">Supplier</th>
              <th className="text-right px-4 py-3 font-medium">Items</th>
              <th className="text-right px-4 py-3 font-medium">Total</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Date</th>
              <th className="text-right px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders?.map((o) => (
              <tr key={o.id} className="border-t border-border">
                <td className="px-4 py-3 font-mono">{o.orderNumber}</td>
                <td className="px-4 py-3">{o.supplier.name}</td>
                <td className="px-4 py-3 text-right">{o.items.length}</td>
                <td className="px-4 py-3 text-right font-mono">GHS {o.total}</td>
                <td className="px-4 py-3"><span className={`text-xs font-medium ${statusColor[o.status] || ''}`}>{o.status.replace(/_/g, ' ')}</span></td>
                <td className="px-4 py-3 text-xs">{new Date(o.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-right space-x-2">
                  {o.status !== 'CANCELLED' && o.status !== 'FULLY_RECEIVED' && (
                    <>
                      <button onClick={() => { setReceiveId(o.id); setReceiveQty({}); }} className="text-primary text-xs font-medium hover:underline">Receive</button>
                      <button onClick={() => cancelOrder.mutate(o.id)} className="text-danger text-xs font-medium hover:underline">Cancel</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!orders || orders.length === 0) && <div className="p-8 text-center text-muted-foreground text-sm">No purchase orders</div>}
      </div>

      {receiveId && (
        <div className="bg-white border border-border p-4 space-y-4">
          <h2 className="font-semibold flex items-center gap-2"><PackageCheck className="h-4 w-4" /> Goods Receipt</h2>
          {orders?.filter((o) => o.id === receiveId).map((order) => (
            <div key={order.id} className="space-y-2">
              <p className="text-sm text-muted-foreground">{order.orderNumber} — {order.supplier.name}</p>
              {order.items.map((item) => (
                <div key={item.product.name} className="flex items-center gap-3">
                  <span className="flex-1 text-sm">{item.product.name}</span>
                  <span className="text-xs text-muted-foreground">Ordered: {item.quantityOrdered}</span>
                  <span className="text-xs text-muted-foreground">Received: {item.quantityReceived}</span>
                  <input
                    type="number"
                    value={receiveQty[item.product.name] || ''}
                    onChange={(e) => setReceiveQty({ ...receiveQty, [item.product.name]: e.target.value })}
                    placeholder="Qty"
                    className="w-24 border border-border px-3 py-2 text-sm"
                  />
                </div>
              ))}
              <button onClick={() => submitReceive(order)} className="bg-primary text-white px-4 py-2 text-sm font-medium hover:opacity-90">Confirm Receipt</button>
              <button onClick={() => { setReceiveId(null); setReceiveQty({}); }} className="ml-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
