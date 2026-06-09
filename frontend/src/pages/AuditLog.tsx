import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { Shield, FileText } from 'lucide-react';

interface AuditEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
  user: { name: string; username: string } | null;
}

const actions = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'VOID_SALE', 'RECEIVE_GOODS', 'EXPORT'];

export default function AuditLog() {
  const user = useAuthStore((s) => s.user);
  const currentStore = useAuthStore((s) => s.currentStore);
  const [filterAction, setFilterAction] = useState('');
  const [filterEntity, setFilterEntity] = useState('');

  const { data } = useQuery({
    queryKey: ['audit', currentStore, filterAction, filterEntity],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (currentStore) params.storeId = currentStore;
      if (filterAction) params.action = filterAction;
      if (filterEntity) params.entity = filterEntity;
      const res = await api.get('/audit', { params });
      return res.data.data as AuditEntry[];
    },
  });

  if (user?.role !== 'ADMIN') {
    return (
      <div className="p-8 text-center">
        <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold">Admin Only</h2>
        <p className="text-muted-foreground mt-2">You do not have permission to view the audit log.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="h-6 w-6" /> Audit Log</h1>
      </div>

      <div className="flex gap-3">
        <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)} className="border border-border px-3 py-2 text-sm">
          <option value="">All Actions</option>
          {actions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <input value={filterEntity} onChange={(e) => setFilterEntity(e.target.value)} placeholder="Filter by entity (e.g. Sale, Product)" className="border border-border px-3 py-2 text-sm w-64" />
      </div>

      <div className="bg-white border border-border overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left px-4 py-3">Time</th>
              <th className="text-left px-4 py-3">User</th>
              <th className="text-left px-4 py-3">Action</th>
              <th className="text-left px-4 py-3">Entity</th>
              <th className="text-left px-4 py-3">Details</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((entry) => (
              <tr key={entry.id} className="border-t border-border">
                <td className="px-4 py-3 text-xs">{new Date(entry.createdAt).toLocaleString()}</td>
                <td className="px-4 py-3 text-xs">{entry.user?.name || 'System'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 ${
                    entry.action === 'CREATE' ? 'bg-green-50 text-success' :
                    entry.action === 'DELETE' ? 'bg-red-50 text-danger' :
                    entry.action === 'UPDATE' ? 'bg-blue-50 text-primary' :
                    'bg-gray-100 text-muted-foreground'
                  }`}>{entry.action}</span>
                </td>
                <td className="px-4 py-3 text-xs">{entry.entity}</td>
                <td className="px-4 py-3 text-xs max-w-xs truncate">{entry.newValue || entry.oldValue || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!data || data.length === 0) && <div className="p-8 text-center text-muted-foreground text-sm">No audit entries found</div>}
      </div>
    </div>
  );
}
