import { useAuthStore } from '@/stores/auth-store';
import { Store } from 'lucide-react';

export default function Header() {
  const user = useAuthStore((s) => s.user);
  const currentStore = useAuthStore((s) => s.currentStore);

  return (
    <header className="bg-white border-b border-border px-6 py-3 flex items-center justify-between">
      <h1 className="text-sm font-medium text-muted-foreground">
        {user?.role === 'ADMIN' ? 'Super Admin View' : 'Store View'}
      </h1>
      {currentStore && (
        <div className="flex items-center gap-2 text-sm text-primary font-medium">
          <Store className="h-4 w-4" />
          <span>Current Store</span>
        </div>
      )}
    </header>
  );
}
