import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { Plus, Pencil, Trash2, Users } from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  totalSpent: number;
  createdAt: string;
}

export default function Customers() {
  const currentStore = useAuthStore((s) => s.currentStore);
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', storeId: currentStore || '' });

  const { data } = useQuery({
    queryKey: ['customers', currentStore],
    queryFn: async () => {
      const res = await api.get('/customers', { params: currentStore ? { storeId: currentStore } : {} });
      return res.data.data as Customer[];
    },
  });

  const create = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await api.post('/customers', body);
      return res.data.data;
    },
    onSuccess: () => {
      toast.success('Customer created');
      setShowForm(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Failed to create customer'),
  });

  const update = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) => {
      const res = await api.patch(`/customers/${id}`, body);
      return res.data.data;
    },
    onSuccess: () => {
      toast.success('Customer updated');
      setEditing(null);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Failed to update customer'),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/customers/${id}`);
      return res.data.data;
    },
    onSuccess: () => {
      toast.success('Customer deleted');
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Failed to delete customer'),
  });

  function resetForm() {
    setForm({ name: '', phone: '', email: '', address: '', storeId: currentStore || '' });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editing) {
      update.mutate({ id: editing.id, body: { ...form, storeId: currentStore } });
    } else {
      create.mutate({ ...form, storeId: currentStore });
    }
  }

  function startEdit(c: Customer) {
    setEditing(c);
    setForm({ name: c.name, phone: c.phone || '', email: c.email || '', address: c.address || '', storeId: currentStore || '' });
    setShowForm(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="h-6 w-6" /> Customers</h1>
        <button onClick={() => { setShowForm(!showForm); setEditing(null); resetForm(); }} className="bg-primary text-white px-4 py-2 text-sm font-medium hover:opacity-90 flex items-center gap-2">
          <Plus className="h-4 w-4" /> {showForm ? 'Cancel' : 'Add Customer'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-border p-4 grid grid-cols-4 gap-4">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" className="border border-border px-3 py-2" required />
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone" className="border border-border px-3 py-2" />
          <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" className="border border-border px-3 py-2" />
          <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Address" className="border border-border px-3 py-2" />
          <div className="col-span-4 flex gap-2">
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
              <th className="text-left px-4 py-3">Phone</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Address</th>
              <th className="text-right px-4 py-3">Total Spent</th>
              <th className="text-center px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3">{c.phone || '-'}</td>
                <td className="px-4 py-3">{c.email || '-'}</td>
                <td className="px-4 py-3">{c.address || '-'}</td>
                <td className="px-4 py-3 text-right font-mono">GHS {Number(c.totalSpent).toFixed(2)}</td>
                <td className="px-4 py-3 text-center">
                  <div className="flex justify-center gap-2">
                    <button onClick={() => startEdit(c)} className="p-1 hover:bg-muted"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => remove.mutate(c.id)} className="p-1 hover:bg-red-50 text-danger"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!data || data.length === 0) && <div className="p-8 text-center text-muted-foreground text-sm">No customers found</div>}
      </div>
    </div>
  );
}
