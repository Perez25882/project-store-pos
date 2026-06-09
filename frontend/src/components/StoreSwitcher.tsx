import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
import api from '@/lib/api';
import { Store, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface StoreItem {
  id: string;
  name: string;
  address: string;
}

export default function StoreSwitcher() {
  const currentStore = useAuthStore((s) => s.currentStore);
  const setCurrentStore = useAuthStore((s) => s.setCurrentStore);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: stores } = useQuery({
    queryKey: ['stores'],
    queryFn: async () => {
      const res = await api.get('/stores');
      return res.data.data as StoreItem[];
    },
  });

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const active = stores?.find((s) => s.id === currentStore);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-muted border border-border">
        <Store className="h-4 w-4" />
        <span className="max-w-[120px] truncate">{active?.name || 'All Stores'}</span>
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-border shadow-lg z-50">
          <button onClick={() => { setCurrentStore(null); setOpen(false); }} className={`w-full text-left px-4 py-2 text-sm hover:bg-muted ${!currentStore ? 'bg-primary text-white hover:opacity-90' : ''}`}>
            All Stores
          </button>
          {stores?.map((s) => (
            <button key={s.id} onClick={() => { setCurrentStore(s.id); setOpen(false); }} className={`w-full text-left px-4 py-2 text-sm hover:bg-muted ${currentStore === s.id ? 'bg-primary text-white hover:opacity-90' : ''}`}>
              {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
