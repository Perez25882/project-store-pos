export interface User {
  id: string;
  username: string;
  name: string;
  email?: string;
  role: 'ADMIN' | 'STAFF';
  storeId: string | null;
}

export interface Store {
  id: string;
  name: string;
  address: string;
  phone: string;
  email?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: { code: string; message: string };
}
