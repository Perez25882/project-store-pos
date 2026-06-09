import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { Plus, Pencil, Trash2, Shield, UserCheck } from 'lucide-react';

interface StaffUser {
  id: string;
  name: string;
  username: string;
  email: string | null;
  phone: string | null;
  role: string;
  storeId: string | null;
  isActive: boolean;
  createdAt: string;
}

export default function Staff() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<StaffUser | null>(null);
  const [form, setForm] = useState({ name: '', username: '', password: '', email: '', phone: '', role: 'STAFF' as 'ADMIN' | 'STAFF', storeId: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['staff'],
    queryFn: async () => {
      const res = await api.get('/users');
      return res.data.data as StaffUser[];
    },
  });

  const create = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await api.post('/users', body);
      return res.data.data;
    },
    onSuccess: () => {
      toast.success('Staff member created');
      setShowForm(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Failed to create staff'),
  });

  const update = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) => {
      const res = await api.patch(`/users/${id}`, body);
      return res.data.data;
    },
    onSuccess: () => {
      toast.success('Staff member updated');
      setEditing(null);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Failed to update staff'),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/users/${id}`);
      return res.data.data;
    },
    onSuccess: () => {
      toast.success('Staff member deactivated');
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Failed to deactivate staff'),
  });

  function resetForm() {
    setForm({ name: '', username: '', password: '', email: '', phone: '', role: 'STAFF', storeId: '' });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editing) {
      const body: Record<string, unknown> = { name: form.name, email: form.email || null, phone: form.phone || null, role: form.role, storeId: form.storeId || null };
      update.mutate({ id: editing.id, body });
    } else {
      create.mutate({ name: form.name, username: form.username, password: form.password, email: form.email || null, phone: form.phone || null, role: form.role, storeId: form.storeId || null });
    }
  }

  function startEdit(u: StaffUser) {
    setEditing(u);
    setForm({ name: u.name, username: u.username, password: '', email: u.email || '', phone: u.phone || '', role: u.role as 'ADMIN' | 'STAFF', storeId: u.storeId || '' });
    setShowForm(true);
  }

  if (user?.role !== 'ADMIN') {
    return (
      <div className="p-8 text-center">
        <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold">Admin Only</h2>
        <p className="text-muted-foreground mt-2">You do not have permission to access staff management.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><UserCheck className="h-6 w-6" /> Staff Management</h1>
        <button onClick={() => { setShowForm(!showForm); setEditing(null); resetForm(); }} className="bg-primary text-white px-4 py-2 text-sm font-medium hover:opacity-90 flex items-center gap-2">
          <Plus className="h-4 w-4" /> {showForm ? 'Cancel' : 'Add Staff'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-border p-4 grid grid-cols-6 gap-4">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full Name" className="border border-border px-3 py-2" required />
          <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="Username" className="border border-border px-3 py-2" required disabled={!!editing} />
          {!editing && <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Password (min 8)" type="password" className="border border-border px-3 py-2" required />}
          {editing && <div />}
          <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" className="border border-border px-3 py-2" />
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone" className="border border-border px-3 py-2" />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as 'ADMIN' | 'STAFF' })} className="border border-border px-3 py-2">
            <option value="STAFF">Staff</option>
            <option value="ADMIN">Admin</option>
          </select>
          <input value={form.storeId} onChange={(e) => setForm({ ...form, storeId: e.target.value })} placeholder="Store ID (staff only)" className="border border-border px-3 py-2" />
          <div className="col-span-6 flex gap-2">
            <button type="submit" className="bg-primary text-white px-4 py-2 text-sm font-medium hover:opacity-90">{editing ? 'Update' : 'Save'}</button>
            <button type="button" onClick={() => { setShowForm(false); setEditing(null); resetForm(); }} className="border border-border px-4 py-2 text-sm font-medium hover:bg-muted">Cancel</button>
          </div>
        </form>
      )}

      <div className="bg-white border border-border overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Username</th>
              <th className="text-left px-4 py-3">Role</th>
              <th className="text-left px-4 py-3">Store</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-center px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{u.name}</td>
                <td className="px-4 py-3 font-mono text-xs">{u.username}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 ${u.role === 'ADMIN' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-primary'}`}>{u.role}</span>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{u.storeId ? u.storeId.slice(0, 8) + '...' : '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 ${u.isActive ? 'bg-green-50 text-success' : 'bg-gray-100 text-muted-foreground'}`}>{u.isActive ? 'Active' : 'Inactive'}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex justify-center gap-2">
                    <button onClick={() => startEdit(u)} className="p-1 hover:bg-muted"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => remove.mutate(u.id)} className="p-1 hover:bg-red-50 text-danger"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!data || data.length === 0) && <div className="p-8 text-center text-muted-foreground text-sm">No staff members found</div>}
      </div>
    </div>
  );
}
