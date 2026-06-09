import { useState } from 'react';
import { Settings as SettingsIcon, Store, Bell, Shield } from 'lucide-react';

export default function Settings() {
  const [tab, setTab] = useState<'general' | 'store' | 'security'>('general');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2"><SettingsIcon className="h-6 w-6" /> Settings</h1>

      <div className="flex gap-2 border-b border-border">
        {([
          { id: 'general' as const, label: 'General', icon: Bell },
          { id: 'store' as const, label: 'Store', icon: Store },
          { id: 'security' as const, label: 'Security', icon: Shield },
        ]).map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-4 py-2 text-sm font-medium flex items-center gap-2 ${tab === t.id ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'general' && (
        <div className="bg-white border border-border p-6 space-y-4 max-w-lg">
          <h3 className="font-semibold">Notification Preferences</h3>
          <div className="flex items-center justify-between py-2 border-b border-border">
            <span className="text-sm">Low stock alerts</span>
            <input type="checkbox" defaultChecked className="h-4 w-4" />
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border">
            <span className="text-sm">Daily sales summary</span>
            <input type="checkbox" defaultChecked className="h-4 w-4" />
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border">
            <span className="text-sm">New order notifications</span>
            <input type="checkbox" className="h-4 w-4" />
          </div>
          <p className="text-xs text-muted-foreground">These settings are saved locally for now.</p>
        </div>
      )}

      {tab === 'store' && (
        <div className="bg-white border border-border p-6 space-y-4 max-w-lg">
          <h3 className="font-semibold">Store Information</h3>
          <div className="space-y-2">
            <label className="text-sm font-medium">Store Name</label>
            <input type="text" defaultValue="BuildMat Main Branch" className="border border-border px-3 py-2 w-full" disabled />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Phone</label>
            <input type="text" defaultValue="+233 302 000 000" className="border border-border px-3 py-2 w-full" disabled />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Address</label>
            <input type="text" defaultValue="Tema Industrial Area" className="border border-border px-3 py-2 w-full" disabled />
          </div>
          <p className="text-xs text-muted-foreground">Store details are managed by the administrator.</p>
        </div>
      )}

      {tab === 'security' && (
        <div className="bg-white border border-border p-6 space-y-4 max-w-lg">
          <h3 className="font-semibold">Security Settings</h3>
          <div className="space-y-2">
            <label className="text-sm font-medium">Current Password</label>
            <input type="password" placeholder="••••••••" className="border border-border px-3 py-2 w-full" disabled />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">New Password</label>
            <input type="password" placeholder="••••••••" className="border border-border px-3 py-2 w-full" disabled />
          </div>
          <button className="bg-primary text-white px-4 py-2 text-sm font-medium hover:opacity-90" disabled>Change Password</button>
          <p className="text-xs text-muted-foreground">Password change will be enabled in a future update.</p>
        </div>
      )}
    </div>
  );
}
