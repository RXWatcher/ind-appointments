'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { APPOINTMENT_TYPES, LOCATIONS } from '@/lib/appointment-data';
import { ThemeToggle } from '@/components/theme-toggle';
import { ContentZone } from '@/components/content-zone';
import { useWebSocket } from '@/hooks/useWebSocket';
import { AppointmentCard } from '@/components/appointment-card';
import { FilterPanel } from '@/components/filter-panel';
import { StatsBar } from '@/components/stats-bar';
import { SkeletonList, SkeletonStats } from '@/components/skeleton-loader';
import { BottomNav } from '@/components/bottom-nav';

interface Appointment {
  id: number;
  date: string;
  start_time: string;
  end_time: string;
  appointment_type: string;
  location: string;
  location_name: string;
  appointment_type_name: string;
  persons: number;
  first_seen_at: string;
  source?: string;
}

const TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  ...APPOINTMENT_TYPES.map(t => ({ value: t.value, label: t.label }))
];
const LOCATION_OPTIONS = [
  { value: '', label: 'All Locations' },
  ...LOCATIONS.map(l => ({ value: l.value, label: l.label }))
];
const PERSON_OPTIONS = [
  { value: '', label: 'Any # of People' },
  ...([1,2,3,4,5,6].map(n => ({ value: String(n), label: `${n} Person${n > 1 ? 's' : ''}` })))
];

function HomePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    type: searchParams.get('type') || '',
    location: searchParams.get('location') || '',
    persons: searchParams.get('persons') || ''
  });
  const [user, setUser] = useState<any>(null);
  const [totalAppointments, setTotalAppointments] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [lastCheck, setLastCheck] = useState<string | null>(null);
  const [shareUrlCopied, setShareUrlCopied] = useState(false);
  const [newAppointmentsToast, setNewAppointmentsToast] = useState<{ count: number; source: string } | null>(null);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.type) params.append('type', filter.type);
      if (filter.location) params.append('location', filter.location);
      if (filter.persons) params.append('persons', filter.persons);
      params.append('limit', '100');
      const response = await fetch(`/api/appointments?${params}`);
      const data = await response.json();
      if (data.success) {
        setAppointments(data.data.appointments);
        setTotalAppointments(data.data.pagination.total);
      }
    } catch (error) {
      console.error('Error fetching appointments:', error);
    }
    setLoading(false);
  }, [filter]);

  const handleNewAppointments = useCallback((appts: any[], source: string) => {
    setNewAppointmentsToast({ count: appts.length, source });
    setTimeout(() => { fetchAppointments(); setNewAppointmentsToast(null); }, 3000);
  }, [fetchAppointments]);

  const { isConnected } = useWebSocket({ onNewAppointments: handleNewAppointments });

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try { setUser(JSON.parse(atob(token.split('.')[1]))); } catch {}
    }
  }, []);

  useEffect(() => {
    fetchAppointments();
    const params = new URLSearchParams();
    if (filter.type) params.set('type', filter.type);
    if (filter.location) params.set('location', filter.location);
    if (filter.persons) params.set('persons', filter.persons);
    router.replace(params.toString() ? `?${params}` : '/', { scroll: false });
  }, [filter, fetchAppointments, router]);

  useEffect(() => {
    fetch('/api/status').then(r => r.json()).then(d => {
      if (d.success && d.data.lastCheck) setLastCheck(d.data.lastCheck);
    }).catch(() => {});
  }, []);

  const getDaysFromNow = (dateString: string) => {
    const d = new Date(dateString);
    const diff = Math.ceil((d.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    return `In ${diff} days`;
  };

  const handleLogout = () => { localStorage.removeItem('token'); setUser(null); };

  const handleBookNow = (appointment: Appointment) => {
    const source = appointment.source || 'IND';
    if (source === 'THE_HAGUE_IC') { window.open('https://appointment.thehagueinternationalcentre.nl/', '_blank'); return; }
    if (source === 'ROTTERDAM_IC') { window.open('https://www.rotterdam.info/en/internationals/appointment', '_blank'); return; }
    if (source === 'DIGID') { window.open('https://digidafspraak.nederlandwereldwijd.nl/', '_blank'); return; }
    const p = new URLSearchParams({
      type: appointment.appointment_type, location: appointment.location,
      locationName: appointment.location_name, date: appointment.date,
      startTime: appointment.start_time, endTime: appointment.end_time,
      persons: appointment.persons.toString()
    });
    window.open(`/autobook?${p}`, '_blank');
  };

  const shareFilteredView = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'IND Appointments', url: window.location.href });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setShareUrlCopied(true);
        setTimeout(() => setShareUrlCopied(false), 2000);
      }
    } catch { /* user cancelled share */ }
  };

  const uniqueLocations = new Set(appointments.map(a => a.location)).size;

  return (
    <div className="min-h-screen md:h-screen flex flex-col bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Toast: new appointments */}
      {newAppointmentsToast && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-blue-600 text-white px-5 py-2.5 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in-up text-sm">
          🔔 {newAppointmentsToast.count} new appointment{newAppointmentsToast.count > 1 ? 's' : ''} found!
        </div>
      )}

      {/* Screen reader live region */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {newAppointmentsToast && <p>{newAppointmentsToast.count} new appointments found</p>}
      </div>

      {/* WebSocket status */}
      {user && (
        <div className={`fixed z-40 px-2.5 py-1 rounded-full text-[10px] flex items-center gap-1.5 ${isConnected ? 'bg-green-100/80 text-green-800 dark:bg-green-900/40 dark:text-green-300' : 'bg-gray-100/80 text-gray-600 dark:bg-gray-800/60 dark:text-gray-400'}`}
          style={{ bottom: 'max(4.5rem, calc(env(safe-area-inset-bottom) + 3.5rem))', right: '0.75rem' }}>
          <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
          {isConnected ? 'Live' : 'Offline'}
        </div>
      )}

      {/* ─── Header ─── */}
      <header className="flex-shrink-0 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-blue-700 to-purple-700" />
        <div className="relative max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <span className="text-xl">🇳🇱</span> IND Appointments
              </h1>
              <p className="text-[11px] sm:text-xs text-blue-100 mt-0.5">Track available IND appointments across the Netherlands</p>
            </div>
            <div className="flex items-center gap-2">
              {user ? (
                <>
                  {/* Mobile hamburger */}
                  <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="md:hidden p-2 text-white hover:text-blue-200 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    aria-label="Menu" aria-expanded={mobileMenuOpen}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {mobileMenuOpen
                        ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
                    </svg>
                  </button>

                  {/* Desktop nav */}
                  <div className="hidden md:flex items-center gap-3">
                    {user.role === 'admin' && (
                      <Link href="/admin" className="text-sm text-purple-200 hover:text-white font-medium min-h-[44px] flex items-center">⚡ Admin</Link>
                    )}
                    <Link href="/preferences" className="text-sm text-blue-100 hover:text-white font-medium min-h-[44px] flex items-center">My Alerts</Link>
                    <Link href="/settings" className="text-sm text-blue-100 hover:text-white font-medium min-h-[44px] flex items-center">Settings</Link>
                    <Link href="/notifications" className="text-sm text-blue-100 hover:text-white font-medium min-h-[44px] flex items-center">History</Link>
                    <ThemeToggle />
                    <span className="text-sm text-blue-200">{user.username}</span>
                    <button onClick={handleLogout} className="px-3 py-1.5 bg-white/10 text-white text-sm rounded-lg hover:bg-white/20 min-h-[44px]">Logout</button>
                  </div>

                  {/* Mobile dropdown */}
                  {mobileMenuOpen && (
                    <>
                      <div className="fixed inset-0 bg-black/25 md:hidden z-40" onClick={() => setMobileMenuOpen(false)} aria-hidden="true" />
                      <div className="absolute top-full right-0 mt-2 mr-4 w-56 glass-card md:hidden z-50 overflow-hidden">
                        {user.role === 'admin' && (
                          <Link href="/admin" className="block px-4 py-3 text-sm hover:bg-gray-100/50 dark:hover:bg-gray-700/50 dark:text-gray-200 border-b border-gray-100 dark:border-gray-700" onClick={() => setMobileMenuOpen(false)}>⚡ Admin</Link>
                        )}
                        <Link href="/preferences" className="block px-4 py-3 text-sm hover:bg-gray-100/50 dark:hover:bg-gray-700/50 dark:text-gray-200 border-b border-gray-100 dark:border-gray-700" onClick={() => setMobileMenuOpen(false)}>My Alerts</Link>
                        <Link href="/settings" className="block px-4 py-3 text-sm hover:bg-gray-100/50 dark:hover:bg-gray-700/50 dark:text-gray-200 border-b border-gray-100 dark:border-gray-700" onClick={() => setMobileMenuOpen(false)}>Settings</Link>
                        <Link href="/notifications" className="block px-4 py-3 text-sm hover:bg-gray-100/50 dark:hover:bg-gray-700/50 dark:text-gray-200 border-b border-gray-100 dark:border-gray-700" onClick={() => setMobileMenuOpen(false)}>History</Link>
                        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                          <span className="text-sm text-gray-700 dark:text-gray-300">Theme</span>
                          <ThemeToggle />
                        </div>
                        <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">{user.username}</div>
                        <button onClick={() => { handleLogout(); setMobileMenuOpen(false); }} className="block w-full text-left px-4 py-3 text-sm hover:bg-gray-100/50 dark:hover:bg-gray-700/50 dark:text-gray-200">Logout</button>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <>
                  <ThemeToggle />
                  <Link href="/login" className="px-3 py-2 text-sm text-blue-100 font-medium hover:text-white min-h-[44px] flex items-center">Login</Link>
                  <Link href="/signup" className="px-3 py-2 text-sm bg-white/15 text-white rounded-lg hover:bg-white/25 min-h-[44px] flex items-center whitespace-nowrap backdrop-blur-sm">
                    <span className="md:hidden">Sign Up</span>
                    <span className="hidden md:inline">Sign Up for Notifications!</span>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <ContentZone zone="header" className="flex-shrink-0 max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-3" />

      {/* ─── Main Content ─── */}
      <div id="main-content" className="flex-1 md:overflow-y-auto pb-20 md:pb-0">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          {/* Filter Panel (collapsible on mobile) */}
          <FilterPanel
            filter={filter}
            onFilterChange={setFilter}
            typeOptions={TYPE_OPTIONS}
            locationOptions={LOCATION_OPTIONS}
            personOptions={PERSON_OPTIONS}
            onShare={shareFilteredView}
            shareUrlCopied={shareUrlCopied}
          />

          {/* Stats */}
          {loading ? (
            <SkeletonStats />
          ) : (
            <StatsBar
              totalAppointments={totalAppointments}
              nextAvailable={appointments.length > 0 ? getDaysFromNow(appointments[0].date) : 'N/A'}
              lastCheck={lastCheck}
              uniqueLocations={uniqueLocations}
            />
          )}

          {/* Appointments header */}
          <div className="glass-card mb-3">
            <div className="p-3 flex justify-between items-center">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Available Appointments</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const params = new URLSearchParams();
                    if (filter.type) params.append('type', filter.type);
                    if (filter.location) params.append('location', filter.location);
                    if (filter.persons) params.append('persons', filter.persons);
                    window.location.href = `/api/appointments/export?${params}`;
                  }}
                  className="px-2.5 py-2 md:py-1.5 text-xs min-h-[44px] md:min-h-0 bg-gray-200/60 dark:bg-gray-700/60 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center gap-1"
                  title="Export to CSV" aria-label="Export to CSV"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  CSV
                </button>
                <a href={`/api/appointments/ical?${new URLSearchParams(Object.entries(filter).filter(([_, v]) => v))}`}
                  className="px-2.5 py-2 md:py-1.5 text-xs min-h-[44px] md:min-h-0 bg-gray-200/60 dark:bg-gray-700/60 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center gap-1"
                  title="Export to Calendar" aria-label="Export to Calendar"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  iCal
                </a>
                <button onClick={fetchAppointments}
                  className="px-3 py-2 md:py-1.5 text-xs min-h-[44px] md:min-h-0 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 font-medium"
                  aria-label="Refresh appointments"
                >
                  Refresh
                </button>
              </div>
            </div>
          </div>

          <div className="flex gap-6">
            {/* Main list */}
            <div className="flex-1">
              {loading ? (
                <SkeletonList count={6} />
              ) : appointments.length === 0 ? (
                <div className="glass-card p-12 text-center text-gray-500 dark:text-gray-400">
                  <svg className="mx-auto h-12 w-12 text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">No appointments found</h3>
                  <p className="mt-1 text-xs">Try adjusting your filters or check back later.</p>
                </div>
              ) : (
                <div className="space-y-3" role="feed" aria-label="Available appointments" aria-busy={loading}>
                  {appointments.map((appointment, index) => (
                    <div key={appointment.id}>
                      <AppointmentCard
                        appointment={appointment}
                        index={index}
                        onBookNow={handleBookNow}
                      />
                      {(index + 1) % 10 === 0 && index < appointments.length - 1 && (
                        <div className="py-2"><ContentZone zone="between_appointments" /></div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="hidden lg:block lg:w-80 flex-shrink-0">
              <div className="sticky top-4"><ContentZone zone="sidebar" /></div>
            </div>
          </div>

          <ContentZone zone="footer" className="py-4" />

          <footer className="mt-12 glass-card" role="contentinfo">
            <div className="px-4 sm:px-6 lg:px-8 py-6">
              <div className="text-center text-xs text-gray-600 dark:text-gray-400">
                <p>© 2025 IND Appointments Tracker. Not affiliated with IND.</p>
                <p className="mt-1">An unofficial tool to help track IND appointment availability.</p>
              </div>
            </div>
          </footer>
        </div>
      </div>

      {/* Bottom nav (mobile) */}
      <BottomNav user={user} />
    </div>
  );
}

function HomePageLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">Loading appointments...</p>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<HomePageLoading />}>
      <HomePageContent />
    </Suspense>
  );
}
