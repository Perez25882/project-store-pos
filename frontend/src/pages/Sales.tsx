import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { ShoppingCart, Plus, Minus, Trash2 } from 'lucide-react';

interface Product {
  id: string;
  sku: string;
  name: string;
  sellingPrice: number;
  stockLevel?: { quantity: number };
}

interface Customer {
  id: string;
  name: string;
}

interface SaleItem {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
}

interface Sale {
  id: string;
  invoiceNumber: string;
  total: number;
  amountPaid: number;
  status: string;
  createdAt: string;
  customer?: { name: string };
  items: { product: { name: string; sku: string }; quantity: number; total: number }[];
}

export default function Sales() {
  const user = useAuthStore((s) => s.user);
  const currentStore = useAuthStore((s) => s.currentStore);
  const queryClient = useQueryClient();
  const [showNewSale, setShowNewSale] = useState(false);
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [qty, setQty] = useState('1');
  const [discount, setDiscount] = useState('0');
  const [tax, setTax] = useState('0');
  const [amountPaid, setAmountPaid] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [note, setNote] = useState('');

  const { data: products } = useQuery({
    queryKey: ['products', currentStore],
    queryFn: async () => {
      const res = await api.get('/products', { params: { storeId: currentStore } });
      return res.data.data as Product[];
    },
  });

  const { data: customers } = useQuery({
    queryKey: ['customers', currentStore],
    queryFn: async () => {
      const res = await api.get('/customers', { params: { storeId: currentStore } });
      return res.data.data as Customer[];
    },
  });

  const { data: sales } = useQuery({
    queryKey: ['sales', currentStore],
    queryFn: async () => {
      const res = await api.get('/sales', { params: { storeId: currentStore } });
      return res.data.data as Sale[];
    },
  });

  const createSale = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await api.post('/sales', data);
      return res.data.data;
    },
    onSuccess: () => {
      toast.success('Sale completed');
      resetForm();
      setShowNewSale(false);
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Sale failed'),
  });

  const voidSale = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.patch(`/sales/${id}/void`);
      return res.data.data;
    },
    onSuccess: () => {
      toast.success('Sale voided');
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Void failed'),
  });

  function addToCart() {
    if (!selectedProduct || !qty) return;
    const product = products?.find((p) => p.id === selectedProduct);
    if (!product) return;
    const quantity = Number(qty);
    const available = Number(product.stockLevel?.quantity ?? 0);
    if (quantity > available) {
      toast.error(`Only ${available} ${product.stockLevel ? '' : 'in stock'}`);
      return;
    }
    const existing = cart.find((i) => i.productId === selectedProduct);
    if (existing) {
      setCart(cart.map((i) =>
        i.productId === selectedProduct
          ? { ...i, quantity: i.quantity + quantity, total: (i.quantity + quantity) * i.unitPrice }
          : i
      ));
    } else {
      setCart([...cart, {
        productId: product.id,
        sku: product.sku,
        name: product.name,
        quantity,
        unitPrice: product.sellingPrice,
        discount: 0,
        total: quantity * product.sellingPrice,
      }]);
    }
    setSelectedProduct('');
    setQty('1');
  }

  function removeFromCart(productId: string) {
    setCart(cart.filter((i) => i.productId !== productId));
  }

  function updateCartQty(productId: string, delta: number) {
    setCart(cart.map((i) => {
      if (i.productId !== productId) return i;
      const newQty = Math.max(1, i.quantity + delta);
      return { ...i, quantity: newQty, total: newQty * i.unitPrice - i.discount };
    }));
  }

  const subtotal = cart.reduce((sum, i) => sum + i.total, 0);
  const totalDiscount = Number(discount);
  const totalTax = Number(tax);
  const total = Math.max(0, subtotal - totalDiscount + totalTax);

  function handleSubmit() {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }
    if (!currentStore && user?.role !== 'ADMIN') {
      toast.error('No store selected');
      return;
    }
    createSale.mutate({
      storeId: currentStore,
      customerId: customerId || undefined,
      items: cart.map((i) => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice, discount: i.discount })),
      discount: totalDiscount,
      tax: totalTax,
      amountPaid: Number(amountPaid) || 0,
      note: note || undefined,
    });
  }

  function resetForm() {
    setCart([]);
    setDiscount('0');
    setTax('0');
    setAmountPaid('');
    setCustomerId('');
    setNote('');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sales</h1>
        <button
          onClick={() => { setShowNewSale(!showNewSale); if (showNewSale) resetForm(); }}
          className="bg-primary text-white px-4 py-2 text-sm font-medium hover:opacity-90 flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          {showNewSale ? 'Cancel' : 'New Sale'}
        </button>
      </div>

      {showNewSale && (
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 bg-white border border-border p-4 space-y-4">
            <h2 className="font-semibold">Add Items</h2>
            <div className="flex gap-3">
              <select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                className="flex-1 border border-border px-3 py-2"
              >
                <option value="">Select product</option>
                {products?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.sku} — {p.name} (GHS {p.sellingPrice})
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="Qty"
                className="w-24 border border-border px-3 py-2"
                min="1"
              />
              <button onClick={addToCart} className="bg-primary text-white px-4 py-2 text-sm font-medium hover:opacity-90">
                Add
              </button>
            </div>

            {cart.length > 0 && (
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left px-3 py-2">Product</th>
                    <th className="text-right px-3 py-2">Price</th>
                    <th className="text-center px-3 py-2">Qty</th>
                    <th className="text-right px-3 py-2">Total</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item) => (
                    <tr key={item.productId} className="border-t border-border">
                      <td className="px-3 py-2">{item.name}</td>
                      <td className="px-3 py-2 text-right font-mono">GHS {item.unitPrice}</td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => updateCartQty(item.productId, -1)} className="text-muted-foreground hover:text-primary"><Minus className="h-3 w-3" /></button>
                          <span className="font-mono">{item.quantity}</span>
                          <button onClick={() => updateCartQty(item.productId, 1)} className="text-muted-foreground hover:text-primary"><Plus className="h-3 w-3" /></button>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-mono">GHS {item.total}</td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => removeFromCart(item.productId)} className="text-danger hover:opacity-70"><Trash2 className="h-4 w-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="bg-white border border-border p-4 space-y-4">
            <h2 className="font-semibold">Checkout</h2>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="w-full border border-border px-3 py-2">
              <option value="">Walk-in Customer</option>
              {customers?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-mono font-medium">GHS {subtotal.toFixed(2)}</span>
            </div>
            <div className="flex gap-2">
              <input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="Discount" className="w-full border border-border px-3 py-2 text-sm" />
              <input type="number" value={tax} onChange={(e) => setTax(e.target.value)} placeholder="Tax" className="w-full border border-border px-3 py-2 text-sm" />
            </div>
            <div className="flex justify-between text-lg font-bold border-t border-border pt-3">
              <span>Total</span>
              <span className="font-mono text-primary">GHS {total.toFixed(2)}</span>
            </div>
            <input
              type="number"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              placeholder="Amount Paid"
              className="w-full border border-border px-3 py-2"
            />
            {Number(amountPaid) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Change Due</span>
                <span className="font-mono text-success">GHS {Math.max(0, Number(amountPaid) - total).toFixed(2)}</span>
              </div>
            )}
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="w-full border border-border px-3 py-2 text-sm" />
            <button
              onClick={handleSubmit}
              disabled={createSale.isPending || cart.length === 0}
              className="w-full bg-primary text-white py-2 font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <ShoppingCart className="h-4 w-4" />
              {createSale.isPending ? 'Processing...' : 'Complete Sale'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-border overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Invoice #</th>
              <th className="text-left px-4 py-3 font-medium">Customer</th>
              <th className="text-right px-4 py-3 font-medium">Items</th>
              <th className="text-right px-4 py-3 font-medium">Total</th>
              <th className="text-right px-4 py-3 font-medium">Paid</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Date</th>
              <th className="text-right px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sales?.map((s) => (
              <tr key={s.id} className="border-t border-border">
                <td className="px-4 py-3 font-mono">{s.invoiceNumber}</td>
                <td className="px-4 py-3">{s.customer?.name || 'Walk-in'}</td>
                <td className="px-4 py-3 text-right">{s.items.length}</td>
                <td className="px-4 py-3 text-right font-mono">GHS {s.total}</td>
                <td className="px-4 py-3 text-right font-mono">GHS {s.amountPaid}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium ${s.status === 'COMPLETED' ? 'text-success' : s.status === 'VOIDED' ? 'text-danger' : 'text-warning'}`}>
                    {s.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs">{new Date(s.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-right space-x-2">
                  {s.status !== 'VOIDED' && (
                    <button onClick={() => voidSale.mutate(s.id)} className="text-danger text-xs font-medium hover:underline">Void</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!sales || sales.length === 0) && (
          <div className="p-8 text-center text-muted-foreground text-sm">No sales yet</div>
        )}
      </div>
    </div>
  );
}
