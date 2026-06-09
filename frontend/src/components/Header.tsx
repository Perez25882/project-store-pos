import { useAuthStore } from '@/stores/auth-store';
import StoreSwitcher from './StoreSwitcher';

export default function Header() {
  const user = useAuthStore((s) => s.user);

  return (
    <header className="bg-white border-b border-border px-6 py-3 flex items-center justify-between">
      <h1 className="text-sm font-medium text-muted-foreground">
        {user?.role === 'ADMIN' ? 'Super Admin View' : 'Store View'}
      </h1>
      <StoreSwitcher />
    </header>
  );
}
