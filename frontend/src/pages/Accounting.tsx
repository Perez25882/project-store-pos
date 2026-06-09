import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { Calculator, Plus, TrendingUp, TrendingDown, Wallet, Receipt } from 'lucide-react';

interface Summary {
  revenue: number;
  costOfGoods: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
  salesCount: number;
  totalPayments: number;
}

interface DailyData {
  date: string;
  sales: { count: number; total: number; items: any[] };
  expenses: { count: number; total: number; items: any[] };
  payments: { count: number; total: number; items: any[] };
  net: number;
}

interface LedgerEntry {
  type: string;
  date: string;
  reference: string;
  amount: number;
  status: string;
  balance: number;
}

const expenseCategories = ['RENT', 'UTILITIES', 'SALARIES', 'TRANSPORT', 'MAINTENANCE', 'MARKETING', 'MISCELLANEOUS'];

export default function Accounting() {
  const user = useAuthStore((s) => s.user);
  const currentStore = useAuthStore((s) => s.currentStore);
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'summary' | 'daily' | 'ledger' | 'expenses'>('summary');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [dailyDate, setDailyDate] = useState(new Date().toISOString().split('T')[0]);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ category: '', amount: '', description: '', date: new Date().toISOString().split('T')[0], storeId: currentStore || '' });

  const summaryQuery = useQuery({
    queryKey: ['accounting-summary', currentStore, fromDate, toDate],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;
      if (currentStore) params.storeId = currentStore;
      const res = await api.get('/accounting/summary', { params });
      return res.data.data as Summary;
    },
  });

  const dailyQuery = useQuery({
    queryKey: ['accounting-daily', currentStore, dailyDate],
    queryFn: async () => {
      const res = await api.get('/accounting/daily', { params: { date: dailyDate, storeId: currentStore } });
      return res.data.data as DailyData;
    },
  });

  const ledgerQuery = useQuery({
    queryKey: ['accounting-ledger', currentStore, fromDate, toDate],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;
      if (currentStore) params.storeId = currentStore;
      const res = await api.get('/accounting/ledger', { params });
      return res.data.data as LedgerEntry[];
    },
  });

  const expensesQuery = useQuery({
    queryKey: ['expenses', currentStore, fromDate, toDate],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;
      if (currentStore) params.storeId = currentStore;
      const res = await api.get('/expenses', { params });
      return res.data as { data: any[]; meta: { total: number } };
    },
  });

  const createExpense = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await api.post('/expenses', data);
      return res.data.data;
    },
    onSuccess: () => {
      toast.success('Expense recorded');
      setShowExpenseForm(false);
      setExpenseForm({ category: '', amount: '', description: '', date: new Date().toISOString().split('T')[0], storeId: currentStore || '' });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['accounting-summary'] });
      queryClient.invalidateQueries({ queryKey: ['accounting-daily'] });
      queryClient.invalidateQueries({ queryKey: ['accounting-ledger'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Failed to record expense'),
  });

  function handleExpenseSubmit(e: React.FormEvent) {
    e.preventDefault();
    createExpense.mutate({
      storeId: currentStore,
      category: expenseForm.category,
      amount: Number(expenseForm.amount),
      description: expenseForm.description,
      date: expenseForm.date,
    });
  }

  const summary = summaryQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Accounting</h1>
        <div className="flex gap-2">
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="border border-border px-3 py-2 text-sm" placeholder="From" />
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="border border-border px-3 py-2 text-sm" placeholder="To" />
        </div>
      </div>

      <div className="flex gap-2 border-b border-border">
        {(['summary', 'daily', 'ledger', 'expenses'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium capitalize ${tab === t ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'summary' && summary && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white border border-border p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-2">
              <TrendingUp className="h-4 w-4 text-success" /> Revenue
            </div>
            <div className="text-2xl font-bold font-mono">GHS {summary.revenue.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground mt-1">{summary.salesCount} sales</div>
          </div>
          <div className="bg-white border border-border p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-2">
              <TrendingDown className="h-4 w-4 text-danger" /> Expenses
            </div>
            <div className="text-2xl font-bold font-mono">GHS {summary.expenses.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground mt-1">Total outflows</div>
          </div>
          <div className="bg-white border border-border p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-2">
              <Wallet className="h-4 w-4 text-primary" /> Net Profit
            </div>
            <div className={`text-2xl font-bold font-mono ${summary.netProfit >= 0 ? 'text-success' : 'text-danger'}`}>
              GHS {summary.netProfit.toFixed(2)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Gross: GHS {summary.grossProfit.toFixed(2)}</div>
          </div>
          <div className="bg-white border border-border p-4">
            <div className="text-muted-foreground text-xs font-medium mb-2">Total Payments</div>
            <div className="text-xl font-bold font-mono">GHS {summary.totalPayments.toFixed(2)}</div>
          </div>
          <div className="bg-white border border-border p-4">
            <div className="text-muted-foreground text-xs font-medium mb-2">Cost of Goods</div>
            <div className="text-xl font-bold font-mono">GHS {summary.costOfGoods.toFixed(2)}</div>
          </div>
          <div className="bg-white border border-border p-4">
            <div className="text-muted-foreground text-xs font-medium mb-2">Gross Profit</div>
            <div className="text-xl font-bold font-mono">GHS {summary.grossProfit.toFixed(2)}</div>
          </div>
        </div>
      )}

      {tab === 'daily' && (
        <div className="space-y-4">
          <input type="date" value={dailyDate} onChange={(e) => setDailyDate(e.target.value)} className="border border-border px-3 py-2" />
          {dailyQuery.data && (
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white border border-border p-4">
                <div className="text-muted-foreground text-xs font-medium mb-2">Sales</div>
                <div className="text-xl font-bold font-mono">GHS {dailyQuery.data.sales.total.toFixed(2)}</div>
                <div className="text-xs text-muted-foreground">{dailyQuery.data.sales.count} transactions</div>
              </div>
              <div className="bg-white border border-border p-4">
                <div className="text-muted-foreground text-xs font-medium mb-2">Expenses</div>
                <div className="text-xl font-bold font-mono">GHS {dailyQuery.data.expenses.total.toFixed(2)}</div>
                <div className="text-xs text-muted-foreground">{dailyQuery.data.expenses.count} entries</div>
              </div>
              <div className="bg-white border border-border p-4">
                <div className="text-muted-foreground text-xs font-medium mb-2">Net</div>
                <div className={`text-xl font-bold font-mono ${dailyQuery.data.net >= 0 ? 'text-success' : 'text-danger'}`}>GHS {dailyQuery.data.net.toFixed(2)}</div>
              </div>
            </div>
          )}
          {dailyQuery.data && dailyQuery.data.sales.items.length > 0 && (
            <div className="bg-white border border-border overflow-auto">
              <h3 className="px-4 py-3 font-semibold border-b border-border text-sm">Sales</h3>
              <table className="w-full text-sm">
                <thead className="bg-muted"><tr><th className="text-left px-4 py-2">Invoice</th><th className="text-left px-4 py-2">Customer</th><th className="text-right px-4 py-2">Total</th></tr></thead>
                <tbody>
                  {dailyQuery.data.sales.items.map((s: any) => (
                    <tr key={s.id} className="border-t border-border"><td className="px-4 py-2 font-mono">{s.invoiceNumber}</td><td className="px-4 py-2">{s.customer?.name || 'Walk-in'}</td><td className="px-4 py-2 text-right font-mono">GHS {s.total}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'ledger' && (
        <div className="bg-white border border-border overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Date</th>
                <th className="text-left px-4 py-3 font-medium">Type</th>
                <th className="text-left px-4 py-3 font-medium">Reference</th>
                <th className="text-right px-4 py-3 font-medium">Amount</th>
                <th className="text-right px-4 py-3 font-medium">Balance</th>
              </tr>
            </thead>
            <tbody>
              {ledgerQuery.data?.map((entry, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-4 py-3 text-xs">{new Date(entry.date).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 ${entry.type === 'SALE' ? 'bg-green-50 text-success' : entry.type === 'PURCHASE' ? 'bg-blue-50 text-primary' : 'bg-red-50 text-danger'}`}>
                      {entry.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{entry.reference}</td>
                  <td className={`px-4 py-3 text-right font-mono ${entry.amount >= 0 ? 'text-success' : 'text-danger'}`}>
                    {entry.amount > 0 ? '+' : ''}{entry.amount.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-medium">{entry.balance.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(!ledgerQuery.data || ledgerQuery.data.length === 0) && <div className="p-8 text-center text-muted-foreground text-sm">No ledger entries</div>}
        </div>
      )}

      {tab === 'expenses' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold">Expenses</h2>
            <button onClick={() => setShowExpenseForm(!showExpenseForm)} className="bg-primary text-white px-4 py-2 text-sm font-medium hover:opacity-90 flex items-center gap-2">
              <Plus className="h-4 w-4" /> {showExpenseForm ? 'Cancel' : 'Add Expense'}
            </button>
          </div>
          {showExpenseForm && (
            <form onSubmit={handleExpenseSubmit} className="bg-white border border-border p-4 grid grid-cols-4 gap-4">
              <select value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })} className="border border-border px-3 py-2" required>
                <option value="">Category</option>
                {expenseCategories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <input type="number" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} placeholder="Amount" className="border border-border px-3 py-2" required />
              <input type="text" value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} placeholder="Description" className="border border-border px-3 py-2" required />
              <input type="date" value={expenseForm.date} onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })} className="border border-border px-3 py-2" required />
              {user?.role === 'ADMIN' && <input type="text" value={expenseForm.storeId} onChange={(e) => setExpenseForm({ ...expenseForm, storeId: e.target.value })} placeholder="Store ID" className="border border-border px-3 py-2" required />}
              <div className="col-span-4"><button type="submit" className="bg-primary text-white px-4 py-2 text-sm font-medium hover:opacity-90">Save Expense</button></div>
            </form>
          )}
          <div className="bg-white border border-border overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted"><tr><th className="text-left px-4 py-3">Date</th><th className="text-left px-4 py-3">Category</th><th className="text-left px-4 py-3">Description</th><th className="text-right px-4 py-3">Amount</th><th className="text-left px-4 py-3">By</th></tr></thead>
              <tbody>
                {expensesQuery.data?.data.map((e: any) => (
                  <tr key={e.id} className="border-t border-border">
                    <td className="px-4 py-3 text-xs">{new Date(e.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-xs">{e.category}</td>
                    <td className="px-4 py-3">{e.description}</td>
                    <td className="px-4 py-3 text-right font-mono">GHS {e.amount}</td>
                    <td className="px-4 py-3 text-xs">{e.employee?.name || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {expensesQuery.data && (
              <div className="px-4 py-3 border-t border-border text-right font-bold font-mono">
                Total: GHS {Number(expensesQuery.data.meta.total).toFixed(2)}
              </div>
            )}
            {(!expensesQuery.data || expensesQuery.data.data.length === 0) && <div className="p-8 text-center text-muted-foreground text-sm">No expenses recorded</div>}
          </div>
        </div>
      )}
    </div>
  );
}
