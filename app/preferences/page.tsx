'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { APPOINTMENT_TYPES, LOCATIONS } from '@/lib/appointment-data';
import { BottomNav } from '@/components/bottom-nav';

interface Preference {
  id: number;
  appointment_type: string;
  location: string;
  persons: number;
  days_ahead: number;
  email_enabled: boolean;
  push_enabled: boolean;
  whatsapp_enabled: boolean;
  notification_interval: number;
  dnd_start_time: string;
  dnd_end_time: string;
  is_active: boolean;
}

export default function PreferencesPage() {
  const router = useRouter();
  const [preferences, setPreferences] = useState<Preference[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    appointmentType: APPOINTMENT_TYPES[0]?.value || 'BIO',
    locations: ['ALL'] as string[],
    persons: 1,
    daysAhead: 30,
    emailEnabled: true,
    pushEnabled: false,
    whatsappEnabled: false,
    notificationInterval: 15,
    dndStartTime: '22:00',
    dndEndTime: '08:00',
  });
  const [user, setUser] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      setUser(payload);
      fetchPreferences(token);
    } catch { router.push('/login'); }
  }, [router]);

  const fetchPreferences = async (token: string) => {
    try {
      const res = await fetch('/api/preferences', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setPreferences(data.data);
    } catch (e) { console.error('Error:', e); }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isDigiD = formData.appointmentType === 'DGD';
    if (!isDigiD && formData.locations.length === 0) { alert('Select at least one location'); return; }
    const token = localStorage.getItem('token');
    if (!token) { alert('Please log in'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...formData, location: isDigiD ? 'DIGID_VC' : formData.locations.join(',') }),
      });
      const data = await res.json();
      if (data.success) {
        setShowForm(false);
        setFormData({ appointmentType: APPOINTMENT_TYPES[0]?.value || 'BIO', locations: ['ALL'], persons: 1, daysAhead: 30, emailEnabled: true, pushEnabled: false, whatsappEnabled: false, notificationInterval: 15, dndStartTime: '22:00', dndEndTime: '08:00' });
        fetchPreferences(token);
      } else { alert('Error: ' + (data.message || 'Unknown error')); }
    } catch (e) { console.error(e); alert('Error saving preference'); }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this preference?')) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    setDeletingId(id);
    // Optimistic removal
    setPreferences(prev => prev.filter(p => p.id !== id));
    try {
      await fetch(`/api/preferences?id=${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    } catch (e) {
      fetchPreferences(token); // Revert on error
    }
    setDeletingId(null);
  };

  const getTypeLabel = (t: string) => APPOINTMENT_TYPES.find(x => x.value === t)?.label || t;
  const getLocationLabel = (loc: string) => {
    if (loc === 'ALL') return 'All Locations';
    if (loc.includes(',')) {
      const codes = loc.split(',');
      if (codes.includes('ALL')) return 'All Locations';
      return codes.map(c => LOCATIONS.find(l => l.value === c.trim())?.label || c).join(', ');
    }
    return LOCATIONS.find(l => l.value === loc)?.label || loc;
  };

  const getNotificationChannels = (pref: Preference) => {
    const channels = [];
    if (pref.email_enabled) channels.push({ icon: '📧', label: 'Email', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' });
    if (pref.push_enabled) channels.push({ icon: '📱', label: 'Push', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' });
    if (pref.whatsapp_enabled) channels.push({ icon: '💬', label: 'WhatsApp', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' });
    return channels;
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 pb-20 md:pb-0">
      {/* Header */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-blue-700 to-purple-700" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <Link href="/" className="text-lg font-bold text-white flex items-center gap-2"><span>🇳🇱</span> IND Appointments</Link>
            <div className="flex items-center gap-3">
              <span className="text-sm text-blue-200 hidden sm:inline">{user.username}</span>
              <Link href="/" className="text-sm text-blue-100 hover:text-white font-medium min-h-[44px] flex items-center">Back</Link>
            </div>
          </div>
        </div>
      </header>

      <main id="main-content" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">🔔 Notification Preferences</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Set up alerts for specific appointment types and locations.</p>
        </div>

        {/* Add button */}
        <div className="mb-4">
          <button onClick={() => setShowForm(!showForm)}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 active:bg-blue-800 font-medium text-sm min-h-[44px] transition-colors shadow-sm shadow-blue-500/20">
            {showForm ? '✕ Cancel' : '+ Add New Alert'}
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <div className="glass-card p-4 sm:p-5 mb-5 animate-fade-in-up">
            <h3 className="text-base font-semibold mb-4 text-gray-900 dark:text-gray-100">New Alert</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Appointment Type</label>
                <select value={formData.appointmentType}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFormData(prev => v === 'DGD' ? { ...prev, appointmentType: v, locations: ['DIGID_VC'] }
                      : prev.appointmentType === 'DGD' ? { ...prev, appointmentType: v, locations: ['ALL'] }
                      : { ...prev, appointmentType: v });
                  }}
                  className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white">
                  {APPOINTMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                {formData.appointmentType === 'DGD' && (
                  <div className="mt-2 glass-card border-l-4 border-l-amber-500 p-3">
                    <p className="text-xs text-amber-800 dark:text-amber-200">
                      <strong>DigiD Video Call:</strong> Released Fridays at 9:00 & 14:00 (Amsterdam time). Slots fill fast!
                    </p>
                  </div>
                )}
              </div>

              {/* Locations */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {formData.appointmentType === 'DGD' ? 'Location' : 'Locations'}
                </label>
                {formData.appointmentType === 'DGD' ? (
                  <div className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-600 text-sm text-gray-700 dark:text-gray-200">📹 Video Call (Online)</div>
                ) : (
                  <div className="space-y-1 max-h-48 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg p-2 dark:bg-gray-700">
                    <label className="flex items-center p-2.5 hover:bg-gray-50 dark:hover:bg-gray-600 rounded cursor-pointer min-h-[44px]">
                      <input type="checkbox" checked={formData.locations.includes('ALL')}
                        onChange={(e) => setFormData({ ...formData, locations: e.target.checked ? ['ALL'] : [] })}
                        className="h-5 w-5 text-blue-600 rounded" />
                      <span className="ml-3 text-sm font-semibold text-gray-900 dark:text-gray-100">All Locations</span>
                    </label>
                    <div className="border-t border-gray-200 dark:border-gray-600 pt-1">
                      {LOCATIONS.filter(l => l.value !== 'DIGID_VC').map(loc => (
                        <label key={loc.value} className="flex items-center p-2.5 hover:bg-gray-50 dark:hover:bg-gray-600 rounded cursor-pointer min-h-[44px]">
                          <input type="checkbox" checked={formData.locations.includes(loc.value)} disabled={formData.locations.includes('ALL')}
                            onChange={(e) => setFormData({
                              ...formData,
                              locations: e.target.checked
                                ? [...formData.locations.filter(l => l !== 'ALL'), loc.value]
                                : formData.locations.filter(l => l !== loc.value)
                            })}
                            className="h-5 w-5 text-blue-600 rounded" />
                          <span className="ml-3 text-sm text-gray-700 dark:text-gray-300">{loc.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Persons</label>
                  <select value={formData.persons} onChange={(e) => setFormData({ ...formData, persons: parseInt(e.target.value) })}
                    className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white">
                    {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n} Person{n > 1 ? 's' : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Days Ahead</label>
                  <input type="number" min="1" max="90" value={formData.daysAhead}
                    onChange={(e) => setFormData({ ...formData, daysAhead: parseInt(e.target.value) })}
                    className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Notification Interval</label>
                  <select value={formData.notificationInterval}
                    onChange={(e) => setFormData({ ...formData, notificationInterval: parseInt(e.target.value) })}
                    className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white">
                    {[{v:5,l:'5 min'},{v:15,l:'15 min'},{v:30,l:'30 min'},{v:60,l:'1 hour'},{v:120,l:'2 hours'},{v:240,l:'4 hours'},{v:480,l:'8 hours'},{v:1440,l:'Daily'}]
                      .map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">DND Hours</label>
                  <div className="flex items-center gap-1">
                    <input type="time" value={formData.dndStartTime}
                      onChange={(e) => setFormData({ ...formData, dndStartTime: e.target.value })}
                      className="w-full px-2 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white" />
                    <span className="text-xs text-gray-400">-</span>
                    <input type="time" value={formData.dndEndTime}
                      onChange={(e) => setFormData({ ...formData, dndEndTime: e.target.value })}
                      className="w-full px-2 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white" />
                  </div>
                </div>
              </div>

              {/* Notification channels */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Channels</label>
                <div className="flex flex-wrap gap-3">
                  {[
                    { key: 'emailEnabled', icon: '📧', label: 'Email' },
                    { key: 'pushEnabled', icon: '📱', label: 'Pushover' },
                    { key: 'whatsappEnabled', icon: '💬', label: 'WhatsApp' },
                  ].map(ch => (
                    <label key={ch.key} className="flex items-center gap-2 cursor-pointer min-h-[44px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <input type="checkbox"
                        checked={(formData as any)[ch.key]}
                        onChange={(e) => setFormData({ ...formData, [ch.key]: e.target.checked })}
                        className="h-5 w-5 text-blue-600 rounded" />
                      <span className="text-sm">{ch.icon} {ch.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button type="submit" disabled={saving}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium min-h-[44px] disabled:opacity-50 transition-colors">
                {saving ? 'Saving...' : 'Save Alert'}
              </button>
            </form>
          </div>
        )}

        {/* Preferences list */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Your Alerts ({preferences.length})</h2>

          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="glass-card p-4"><div className="skeleton h-5 w-40 mb-2" /><div className="skeleton h-4 w-60" /></div>)}</div>
          ) : preferences.length === 0 ? (
            <div className="glass-card p-8 text-center text-gray-500 dark:text-gray-400">
              <p className="text-lg mb-1">🔕</p>
              <p className="text-sm">No alerts set up yet.</p>
              <p className="text-xs mt-1">Click "Add New Alert" to get started!</p>
            </div>
          ) : (
            preferences.map(pref => (
              <div key={pref.id} className="glass-card glass-card-hover p-4 animate-fade-in-up">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-2">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${pref.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                        {getTypeLabel(pref.appointment_type)}
                      </span>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 max-w-[200px] truncate">
                        📍 {getLocationLabel(pref.location)}
                      </span>
                      {pref.persons > 1 && <span className="text-[11px] text-gray-500">👥 {pref.persons}</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                      <span>Next {pref.days_ahead} days</span>
                      <span>•</span>
                      <span>Every {pref.notification_interval < 60 ? `${pref.notification_interval}m` : `${pref.notification_interval/60}h`}</span>
                      <span>•</span>
                      <span>DND {pref.dnd_start_time}–{pref.dnd_end_time}</span>
                    </div>
                    <div className="flex gap-1.5 mt-2">
                      {getNotificationChannels(pref).map(ch => (
                        <span key={ch.label} className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ch.color}`}>{ch.icon} {ch.label}</span>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => handleDelete(pref.id)}
                    className="flex-shrink-0 p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                    aria-label={`Delete ${getTypeLabel(pref.appointment_type)} alert`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
      <BottomNav user={user} />
    </div>
  );
}
