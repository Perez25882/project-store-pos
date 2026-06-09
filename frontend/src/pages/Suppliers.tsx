import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { Plus } from 'lucide-react';

interface Supplier {
  id: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export default function Suppliers() {
  const user = useAuthStore((s) => s.user);
  const currentStore = useAuthStore((s) => s.currentStore);
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', contactName: '', phone: '', email: '', address: '', storeId: currentStore || '' });

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers', currentStore],
    queryFn: async () => {
      const res = await api.get('/suppliers', { params: { storeId: currentStore } });
      return res.data.data as Supplier[];
    },
  });

  const createSupplier = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await api.post('/suppliers', data);
      return res.data.data;
    },
    onSuccess: () => {
      toast.success('Supplier created');
      setShowForm(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Failed to create supplier'),
  });

  const updateSupplier = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await api.patch(`/suppliers/${id}`, data);
      return res.data.data;
    },
    onSuccess: () => {
      toast.success('Supplier updated');
      setEditingId(null);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Failed to update supplier'),
  });

  const deleteSupplier = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/suppliers/${id}`); },
    onSuccess: () => {
      toast.success('Supplier deactivated');
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Failed to delete supplier'),
  });

  function resetForm() { setForm({ name: '', contactName: '', phone: '', email: '', address: '', storeId: currentStore || '' }); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingId) updateSupplier.mutate({ id: editingId, data: form });
    else createSupplier.mutate(form);
  }

  function startEdit(s: Supplier) {
    setEditingId(s.id);
    setForm({ name: s.name, contactName: s.contactName || '', phone: s.phone || '', email: s.email || '', address: s.address || '', storeId: currentStore || '' });
    setShowForm(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Suppliers</h1>
        <button onClick={() => { setShowForm(!showForm); if (showForm) { setEditingId(null); resetForm(); } }} className="bg-primary text-white px-4 py-2 text-sm font-medium hover:opacity-90 flex items-center gap-2">
          <Plus className="h-4 w-4" /> {showForm ? 'Cancel' : 'Add Supplier'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-border p-4 grid grid-cols-3 gap-4">
          <input placeholder="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="border border-border px-3 py-2" required />
          <input placeholder="Contact Name" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} className="border border-border px-3 py-2" />
          <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="border border-border px-3 py-2" />
          <input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="border border-border px-3 py-2" />
          <input placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="border border-border px-3 py-2 col-span-2" />
          {user?.role === 'ADMIN' && <input placeholder="Store ID" value={form.storeId} onChange={(e) => setForm({ ...form, storeId: e.target.value })} className="border border-border px-3 py-2" required />}
          <div className="col-span-3">
            <button type="submit" className="bg-primary text-white px-4 py-2 text-sm font-medium hover:opacity-90">{editingId ? 'Update' : 'Create'}</button>
          </div>
        </form>
      )}

      <div className="bg-white border border-border overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Name</th>
              <th className="text-left px-4 py-3 font-medium">Contact</th>
              <th className="text-left px-4 py-3 font-medium">Phone</th>
              <th className="text-left px-4 py-3 font-medium">Email</th>
              <th className="text-right px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {suppliers?.map((s) => (
              <tr key={s.id} className="border-t border-border">
                <td className="px-4 py-3">{s.name}</td>
                <td className="px-4 py-3">{s.contactName || '-'}</td>
                <td className="px-4 py-3">{s.phone || '-'}</td>
                <td className="px-4 py-3">{s.email || '-'}</td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button onClick={() => startEdit(s)} className="text-primary text-xs font-medium hover:underline">Edit</button>
                  <button onClick={() => deleteSupplier.mutate(s.id)} className="text-danger text-xs font-medium hover:underline">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!suppliers || suppliers.length === 0) && <div className="p-8 text-center text-muted-foreground text-sm">No suppliers</div>}
      </div>
    </div>
  );
}
