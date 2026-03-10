'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface AdminStats {
  totalUsers: number;
  totalAppointments: number;
  totalPreferences: number;
  recentUsers: Array<{ username: string; email: string; created_at: string }>;
  recentJobs: Array<{ job_name: string; status: string; started_at: string; duration_ms: number; appointments_found: number }>;
}

function StatCard({ title, value, icon, color, trend }: { title: string; value: number | string; icon: string; color: string; trend?: string }) {
  return (
    <div className="glass-card glass-card-hover p-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-20 h-20 rounded-full -mr-6 -mt-6 opacity-10" style={{ background: color }} />
      <div className="relative">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">{icon}</span>
          <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{title}</span>
        </div>
        <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</div>
        {trend && <div className="text-[11px] text-green-600 dark:text-green-400 mt-0.5">{trend}</div>}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.role !== 'admin') { router.push('/'); return; }
      setUser(payload);
      fetchAdminStats(token);
    } catch { router.push('/login'); }
  }, [router]);

  const fetchAdminStats = async (token: string) => {
    try {
      const res = await fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setStats(data.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleTriggerScraper = async () => {
    setTriggering(true);
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch('/api/appointments', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      alert(data.success ? 'Scraper triggered!' : 'Failed');
      fetchAdminStats(token);
    } catch { alert('Error'); }
    setTriggering(false);
  };

  if (!user || loading) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-700 via-blue-700 to-blue-600" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">⚡ Admin Dashboard</h1>
              <p className="text-[11px] text-purple-200">System monitoring</p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/" className="text-sm text-purple-100 hover:text-white min-h-[44px] flex items-center">View Site</Link>
              <span className="text-sm text-purple-200">{user.username}</span>
            </div>
          </div>
        </div>
      </header>

      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          <StatCard title="Users" value={stats?.totalUsers || 0} icon="👥" color="#3b82f6" />
          <StatCard title="Appointments" value={stats?.totalAppointments || 0} icon="📅" color="#22c55e" />
          <StatCard title="Active Alerts" value={stats?.totalPreferences || 0} icon="🔔" color="#8b5cf6" />
        </div>

        {/* Actions */}
        <div className="glass-card p-4 mb-6">
          <h2 className="text-sm font-semibold mb-3 text-gray-900 dark:text-gray-100">Quick Actions</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <button onClick={handleTriggerScraper} disabled={triggering}
              className="px-4 py-3 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 font-medium disabled:opacity-50 min-h-[44px] w-full transition-colors">
              {triggering ? '⏳ Running...' : '🔄 Manual Scrape'}
            </button>
            <Link href="/admin/users"
              className="px-4 py-3 glass-card text-gray-700 dark:text-gray-300 text-sm rounded-xl hover:bg-gray-100/50 dark:hover:bg-gray-700/50 font-medium text-center min-h-[44px] flex items-center justify-center">
              👥 Users
            </Link>
            <Link href="/admin/notifications"
              className="px-4 py-3 glass-card text-gray-700 dark:text-gray-300 text-sm rounded-xl hover:bg-gray-100/50 dark:hover:bg-gray-700/50 font-medium text-center min-h-[44px] flex items-center justify-center">
              ⚙️ Notifications
            </Link>
            <Link href="/admin/content-zones"
              className="px-4 py-3 glass-card text-gray-700 dark:text-gray-300 text-sm rounded-xl hover:bg-gray-100/50 dark:hover:bg-gray-700/50 font-medium text-center min-h-[44px] flex items-center justify-center">
              📢 Content Zones
            </Link>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="glass-card overflow-hidden">
            <div className="p-4 border-b border-gray-200/50 dark:border-gray-700/50">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Recent Users</h2>
            </div>
            <div className="divide-y divide-gray-200/50 dark:divide-gray-700/50">
              {stats?.recentUsers?.length ? stats.recentUsers.map((u, i) => (
                <div key={i} className="p-3 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                  <div className="flex justify-between items-start">
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{u.username}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{u.email}</p>
                    </div>
                    <p className="text-[10px] text-gray-400 flex-shrink-0 ml-2">{new Date(u.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              )) : <p className="p-4 text-xs text-gray-500">No users yet</p>}
            </div>
          </div>

          <div className="glass-card overflow-hidden">
            <div className="p-4 border-b border-gray-200/50 dark:border-gray-700/50">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Recent Scraper Jobs</h2>
            </div>
            <div className="divide-y divide-gray-200/50 dark:divide-gray-700/50">
              {stats?.recentJobs?.length ? stats.recentJobs.map((job, i) => (
                <div key={i} className="p-3 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                  <div className="flex justify-between items-start mb-1">
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{job.job_name}</p>
                      <p className="text-xs text-gray-500">{job.appointments_found} found</p>
                    </div>
                    <span className={`px-2 py-0.5 text-[10px] rounded-full flex-shrink-0 ${
                      job.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'}`}>
                      {job.status}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-400">
                    <span>{new Date(job.started_at).toLocaleString()}</span>
                    <span>{(job.duration_ms / 1000).toFixed(1)}s</span>
                  </div>
                </div>
              )) : <p className="p-4 text-xs text-gray-500">No jobs yet</p>}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
