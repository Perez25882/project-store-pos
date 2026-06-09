import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import api from '@/lib/api';
import { Package, ShoppingCart, Users, TrendingUp, AlertTriangle, DollarSign, Wallet } from 'lucide-react';

export default function Dashboard() {
  const user = useAuthStore((s) => s.user);
  const currentStore = useAuthStore((s) => s.currentStore);

  const summary = useQuery({
    queryKey: ['accounting-summary', currentStore],
    queryFn: async () => {
      const res = await api.get('/accounting/summary', { params: currentStore ? { storeId: currentStore } : {} });
      return res.data.data as { revenue: number; expenses: number; netProfit: number; salesCount: number };
    },
  });

  const products = useQuery({
    queryKey: ['products', currentStore],
    queryFn: async () => {
      const res = await api.get('/products', { params: currentStore ? { storeId: currentStore } : {} });
      return res.data.data as any[];
    },
  });

  const customers = useQuery({
    queryKey: ['customers', currentStore],
    queryFn: async () => {
      const res = await api.get('/customers', { params: currentStore ? { storeId: currentStore } : {} });
      return res.data.data as any[];
    },
  });

  const lowStock = products.data?.filter((p: any) => p.stockLevel && p.stockLevel.quantity < p.reorderLevel) ?? [];

  const cards = [
    { label: 'Products', value: products.data?.length ?? 0, icon: Package, prefix: '' },
    { label: 'Sales', value: summary.data?.salesCount ?? 0, icon: ShoppingCart, prefix: '' },
    { label: 'Customers', value: customers.data?.length ?? 0, icon: Users, prefix: '' },
    { label: 'Revenue', value: summary.data?.revenue ?? 0, icon: TrendingUp, prefix: 'GHS ', isMoney: true },
    { label: 'Expenses', value: summary.data?.expenses ?? 0, icon: DollarSign, prefix: 'GHS ', isMoney: true },
    { label: 'Net Profit', value: summary.data?.netProfit ?? 0, icon: Wallet, prefix: 'GHS ', isMoney: true },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Welcome, {user?.name}</h1>
        <p className="text-muted-foreground mt-1">Here is an overview of your {user?.role === 'ADMIN' ? 'business' : 'store'}.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-white border border-border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{card.label}</p>
                <p className={`text-xl font-bold font-mono mt-1 ${card.isMoney && (card.value as number) < 0 ? 'text-danger' : ''}`}>
                  {card.prefix}{card.isMoney ? (card.value as number).toFixed(2) : card.value}
                </p>
              </div>
              <div className="bg-primary-light p-2">
                <card.icon className="h-5 w-5 text-primary" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {lowStock.length > 0 && (
        <div className="bg-red-50 border border-red-200 p-4">
          <div className="flex items-center gap-2 text-danger font-medium mb-2">
            <AlertTriangle className="h-5 w-5" />
            <h3>Low Stock Alerts ({lowStock.length})</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {lowStock.map((p: any) => (
              <div key={p.id} className="bg-white border border-red-100 p-3 text-sm">
                <span className="font-medium">{p.name}</span>
                <span className="text-muted-foreground ml-2">{p.stockLevel.quantity} / {p.reorderLevel}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!summary.data && (
        <div className="bg-white border border-border p-8 text-center text-muted-foreground">
          No activity yet. Start by creating products and making sales.
        </div>
      )}
    </div>
  );
}
