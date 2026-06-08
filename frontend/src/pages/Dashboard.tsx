import { useAuthStore } from '@/stores/auth-store';
import { Package, ShoppingCart, Users, TrendingUp } from 'lucide-react';

export default function Dashboard() {
  const user = useAuthStore((s) => s.user);

  const cards = [
    { label: 'Products', value: '0', icon: Package },
    { label: 'Sales Today', value: '0', icon: ShoppingCart },
    { label: 'Customers', value: '0', icon: Users },
    { label: 'Revenue', value: 'GHS 0.00', icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Welcome, {user?.name}
        </h1>
        <p className="text-muted-foreground mt-1">
          Here is an overview of your {user?.role === 'ADMIN' ? 'business' : 'store'}.
        </p>
      </div>

      {user?.role === 'ADMIN' && (
        <div className="bg-white border border-border p-4">
          <h2 className="font-semibold mb-3">Select a Store</h2>
          <div className="grid grid-cols-2 gap-4 max-w-lg">
            <div className="border border-border p-4 hover:border-primary cursor-pointer transition-colors">
              <p className="font-medium">Kumasi Central</p>
              <p className="text-sm text-muted-foreground">Kumasi, Ghana</p>
            </div>
            <div className="border border-border p-4 hover:border-primary cursor-pointer transition-colors">
              <p className="font-medium">Accra Branch</p>
              <p className="text-sm text-muted-foreground">Accra, Ghana</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-white border border-border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{card.label}</p>
                <p className="text-2xl font-bold font-mono mt-1">{card.value}</p>
              </div>
              <div className="bg-primary-light p-2">
                <card.icon className="h-5 w-5 text-primary" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
