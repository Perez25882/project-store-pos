import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  currentStore: string | null;
  setUser: (user: User | null) => void;
  setCurrentStore: (storeId: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      currentStore: null,
      setUser: (user) => set({ user, currentStore: user?.storeId ?? null }),
      setCurrentStore: (currentStore) => set({ currentStore }),
      logout: () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        set({ user: null, currentStore: null });
      },
    }),
    { name: 'auth-store' }
  )
);
