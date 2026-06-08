import { useAuthStore } from '@/stores/auth-store';
import { LayoutDashboard, Package, ShoppingCart, Users, Truck, Calculator, BarChart3, Settings, LogOut } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const staffLinks = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard' },
  { label: 'Inventory', icon: Package, to: '/inventory' },
  { label: 'Sales', icon: ShoppingCart, to: '/sales' },
  { label: 'Customers', icon: Users, to: '/customers' },
  { label: 'Procurement', icon: Truck, to: '/procurement' },
  { label: 'Accounting', icon: Calculator, to: '/accounting' },
  { label: 'Reports', icon: BarChart3, to: '/reports' },
];

const adminLinks = [
  { label: 'Staff', icon: Users, to: '/staff' },
  { label: 'Settings', icon: Settings, to: '/settings' },
];

export default function Sidebar() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const location = useLocation();

  if (!user) return null;

  const links = [...staffLinks, ...(user.role === 'ADMIN' ? adminLinks : [])];

  return (
    <aside className="w-64 bg-white border-r border-border flex flex-col">
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-bold text-primary">BuildMat</h2>
        <p className="text-xs text-muted-foreground mt-1">{user.name} &middot; {user.role}</p>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {links.map((link) => {
          const active = location.pathname.startsWith(link.to);
          return (
            <Link
              key={link.to}
              to={link.to}
              className={`flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors ${
                active ? 'bg-primary text-white' : 'text-foreground hover:bg-muted'
              }`}
            >
              <link.icon className="h-4 w-4" />
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-border">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-danger hover:bg-red-50 w-full"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}
