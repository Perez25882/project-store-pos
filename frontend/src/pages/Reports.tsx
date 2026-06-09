import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { BarChart3, TrendingUp, Users, Package, Building2, Warehouse } from 'lucide-react';

interface TopProduct { productId: string; name: string; sku: string; quantity: number; revenue: number }
interface TrendItem { date: string; sales: number; revenue: number }
interface EmployeePerf { employeeId: string; name: string; salesCount: number; revenue: number; itemsSold: number }
interface StoreComp { storeId: string; storeName: string; revenue: number; salesCount: number; expenses: number; stockQuantity: number; netProfit: number }
interface CategoryBreakdown { categoryId: string; name: string; quantity: number; revenue: number }

export default function Reports() {
  const currentStore = useAuthStore((s) => s.currentStore);
  const [tab, setTab] = useState<'top-products' | 'sales-trend' | 'employees' | 'stores' | 'categories' | 'inventory-valuation'>('top-products');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const params: Record<string, string> = {};
  if (fromDate) params.from = fromDate;
  if (toDate) params.to = toDate;
  if (currentStore) params.storeId = currentStore;

  const topProducts = useQuery({
    queryKey: ['reports-top-products', currentStore, fromDate, toDate],
    queryFn: async () => {
      const res = await api.get('/reports/top-products', { params });
      return res.data.data as TopProduct[];
    },
  });

  const salesTrend = useQuery({
    queryKey: ['reports-sales-trend', currentStore, fromDate, toDate],
    queryFn: async () => {
      const res = await api.get('/reports/sales-trend', { params });
      return res.data.data as TrendItem[];
    },
  });

  const employeePerf = useQuery({
    queryKey: ['reports-employee-performance', currentStore, fromDate, toDate],
    queryFn: async () => {
      const res = await api.get('/reports/employee-performance', { params });
      return res.data.data as EmployeePerf[];
    },
  });

  const storeComp = useQuery({
    queryKey: ['reports-store-comparison', fromDate, toDate],
    queryFn: async () => {
      const res = await api.get('/reports/store-comparison', { params: { from: fromDate, to: toDate } });
      return res.data.data as StoreComp[];
    },
    enabled: tab === 'stores',
  });

  const categoryBreakdown = useQuery({
    queryKey: ['reports-category-breakdown', currentStore, fromDate, toDate],
    queryFn: async () => {
      const res = await api.get('/reports/category-breakdown', { params });
      return res.data.data as CategoryBreakdown[];
    },
  });

  const inventoryValuation = useQuery({
    queryKey: ['reports-inventory-valuation', currentStore],
    queryFn: async () => {
      const res = await api.get('/reports/inventory-valuation', { params: currentStore ? { storeId: currentStore } : {} });
      return res.data.data as { items: any[]; totalValue: number; totalQuantity: number; productCount: number };
    },
    enabled: tab === 'inventory-valuation',
  });

  const tabs = [
    { id: 'top-products' as const, label: 'Top Products', icon: Package },
    { id: 'sales-trend' as const, label: 'Sales Trend', icon: TrendingUp },
    { id: 'employees' as const, label: 'Employees', icon: Users },
    { id: 'stores' as const, label: 'Store Comparison', icon: Building2 },
    { id: 'categories' as const, label: 'Categories', icon: BarChart3 },
    { id: 'inventory-valuation' as const, label: 'Inventory Valuation', icon: Warehouse },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reports</h1>
        <div className="flex gap-2">
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="border border-border px-3 py-2 text-sm" />
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="border border-border px-3 py-2 text-sm" />
        </div>
      </div>

      <div className="flex gap-2 border-b border-border">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-4 py-2 text-sm font-medium flex items-center gap-2 ${tab === t.id ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'top-products' && (
        <div className="bg-white border border-border overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr><th className="text-left px-4 py-3">#</th><th className="text-left px-4 py-3">Product</th><th className="text-left px-4 py-3">SKU</th><th className="text-right px-4 py-3">Qty Sold</th><th className="text-right px-4 py-3">Revenue</th></tr>
            </thead>
            <tbody>
              {topProducts.data?.map((p, i) => (
                <tr key={p.productId} className="border-t border-border">
                  <td className="px-4 py-3 font-mono">{i + 1}</td>
                  <td className="px-4 py-3">{p.name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{p.sku}</td>
                  <td className="px-4 py-3 text-right font-mono">{p.quantity}</td>
                  <td className="px-4 py-3 text-right font-mono">GHS {p.revenue.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(!topProducts.data || topProducts.data.length === 0) && <div className="p-8 text-center text-muted-foreground text-sm">No data</div>}
        </div>
      )}

      {tab === 'sales-trend' && (
        <div className="bg-white border border-border overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr><th className="text-left px-4 py-3">Date</th><th className="text-right px-4 py-3">Sales</th><th className="text-right px-4 py-3">Revenue</th></tr>
            </thead>
            <tbody>
              {salesTrend.data?.map((t) => (
                <tr key={t.date} className="border-t border-border">
                  <td className="px-4 py-3">{t.date}</td>
                  <td className="px-4 py-3 text-right font-mono">{t.sales}</td>
                  <td className="px-4 py-3 text-right font-mono">GHS {t.revenue.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'employees' && (
        <div className="bg-white border border-border overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr><th className="text-left px-4 py-3">Employee</th><th className="text-right px-4 py-3">Sales</th><th className="text-right px-4 py-3">Items Sold</th><th className="text-right px-4 py-3">Revenue</th></tr>
            </thead>
            <tbody>
              {employeePerf.data?.map((e) => (
                <tr key={e.employeeId} className="border-t border-border">
                  <td className="px-4 py-3">{e.name}</td>
                  <td className="px-4 py-3 text-right font-mono">{e.salesCount}</td>
                  <td className="px-4 py-3 text-right font-mono">{e.itemsSold}</td>
                  <td className="px-4 py-3 text-right font-mono">GHS {e.revenue.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(!employeePerf.data || employeePerf.data.length === 0) && <div className="p-8 text-center text-muted-foreground text-sm">No data</div>}
        </div>
      )}

      {tab === 'stores' && (
        <div className="bg-white border border-border overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr><th className="text-left px-4 py-3">Store</th><th className="text-right px-4 py-3">Sales</th><th className="text-right px-4 py-3">Revenue</th><th className="text-right px-4 py-3">Expenses</th><th className="text-right px-4 py-3">Stock</th><th className="text-right px-4 py-3">Net Profit</th></tr>
            </thead>
            <tbody>
              {storeComp.data?.map((s) => (
                <tr key={s.storeId} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{s.storeName}</td>
                  <td className="px-4 py-3 text-right font-mono">{s.salesCount}</td>
                  <td className="px-4 py-3 text-right font-mono">GHS {s.revenue.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-mono">GHS {s.expenses.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-mono">{s.stockQuantity}</td>
                  <td className={`px-4 py-3 text-right font-mono ${s.netProfit >= 0 ? 'text-success' : 'text-danger'}`}>GHS {s.netProfit.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(!storeComp.data || storeComp.data.length === 0) && <div className="p-8 text-center text-muted-foreground text-sm">No data</div>}
        </div>
      )}

      {tab === 'categories' && (
        <div className="bg-white border border-border overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr><th className="text-left px-4 py-3">Category</th><th className="text-right px-4 py-3">Qty Sold</th><th className="text-right px-4 py-3">Revenue</th></tr>
            </thead>
            <tbody>
              {categoryBreakdown.data?.map((c) => (
                <tr key={c.categoryId} className="border-t border-border">
                  <td className="px-4 py-3">{c.name}</td>
                  <td className="px-4 py-3 text-right font-mono">{c.quantity}</td>
                  <td className="px-4 py-3 text-right font-mono">GHS {c.revenue.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(!categoryBreakdown.data || categoryBreakdown.data.length === 0) && <div className="p-8 text-center text-muted-foreground text-sm">No data</div>}
        </div>
      )}

      {tab === 'inventory-valuation' && (
        <div className="space-y-4">
          {inventoryValuation.data && (
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white border border-border p-4">
                <p className="text-sm text-muted-foreground">Total Products</p>
                <p className="text-2xl font-bold font-mono">{inventoryValuation.data.productCount}</p>
              </div>
              <div className="bg-white border border-border p-4">
                <p className="text-sm text-muted-foreground">Total Quantity</p>
                <p className="text-2xl font-bold font-mono">{inventoryValuation.data.totalQuantity}</p>
              </div>
              <div className="bg-white border border-border p-4">
                <p className="text-sm text-muted-foreground">Total Value</p>
                <p className="text-2xl font-bold font-mono">GHS {inventoryValuation.data.totalValue.toFixed(2)}</p>
              </div>
            </div>
          )}
          <div className="bg-white border border-border overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr><th className="text-left px-4 py-3">Product</th><th className="text-left px-4 py-3">SKU</th><th className="text-left px-4 py-3">Category</th><th className="text-right px-4 py-3">Qty</th><th className="text-right px-4 py-3">Cost</th><th className="text-right px-4 py-3">Value</th></tr>
              </thead>
              <tbody>
                {inventoryValuation.data?.items.map((item: any) => (
                  <tr key={item.productId} className="border-t border-border">
                    <td className="px-4 py-3">{item.name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{item.sku}</td>
                    <td className="px-4 py-3 text-xs">{item.category}</td>
                    <td className="px-4 py-3 text-right font-mono">{item.quantity}</td>
                    <td className="px-4 py-3 text-right font-mono">GHS {item.costPrice.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-mono">GHS {item.value.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(!inventoryValuation.data || inventoryValuation.data.items.length === 0) && <div className="p-8 text-center text-muted-foreground text-sm">No products found</div>}
          </div>
        </div>
      )}
    </div>
  );
}
