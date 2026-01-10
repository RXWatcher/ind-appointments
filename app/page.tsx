'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { APPOINTMENT_TYPES, LOCATIONS, getAppointmentType } from '@/lib/appointment-data';
import { ThemeToggle } from '@/components/theme-toggle';
import { ContentZone } from '@/components/content-zone';
import { useWebSocket } from '@/hooks/useWebSocket';

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
  source?: string; // 'IND', 'THE_HAGUE_IC', 'ROTTERDAM_IC'
}

const APPOINTMENT_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  ...APPOINTMENT_TYPES.map(type => ({ value: type.value, label: type.label }))
];

const LOCATION_OPTIONS = [
  { value: '', label: 'All Locations' },
  ...LOCATIONS.map(loc => ({ value: loc.value, label: loc.label }))
];

const PERSON_COUNTS = [
  { value: '', label: 'Any # of People' },
  { value: '1', label: '1 Person' },
  { value: '2', label: '2 Persons' },
  { value: '3', label: '3 Persons' },
  { value: '4', label: '4 Persons' },
  { value: '5', label: '5 Persons' },
  { value: '6', label: '6 Persons' },
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
  const [showCopiedNotice, setShowCopiedNotice] = useState(false);
  const [totalAppointments, setTotalAppointments] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [lastCheck, setLastCheck] = useState<string | null>(null);
  const [shareUrlCopied, setShareUrlCopied] = useState(false);
  const [newAppointmentsToast, setNewAppointmentsToast] = useState<{ count: number; source: string } | null>(null);

  // WebSocket for real-time updates
  const handleNewAppointments = useCallback((appointments: any[], source: string) => {
    console.log(`[WS] Received ${appointments.length} new appointments from ${source}`);
    setNewAppointmentsToast({ count: appointments.length, source });
    // Auto-refresh after showing toast
    setTimeout(() => {
      fetchAppointments();
      setNewAppointmentsToast(null);
    }, 3000);
  }, []);

  const { isConnected } = useWebSocket({
    onNewAppointments: handleNewAppointments,
  });

  useEffect(() => {
    // Check for auth token
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUser(payload);
      } catch (e) {
        console.error('Invalid token');
      }
    }
  }, []);

  useEffect(() => {
    fetchAppointments();
    // Update URL with current filters
    const params = new URLSearchParams();
    if (filter.type) params.set('type', filter.type);
    if (filter.location) params.set('location', filter.location);
    if (filter.persons) params.set('persons', filter.persons);
    const newUrl = params.toString() ? `?${params.toString()}` : '/';
    router.replace(newUrl, { scroll: false });
  }, [filter]);

  useEffect(() => {
    // Fetch status on mount
    fetch('/api/status')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data.lastCheck) {
          setLastCheck(data.data.lastCheck);
        }
      })
      .catch(err => console.error('Error fetching status:', err));
  }, []);

  const fetchAppointments = async () => {
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
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getDaysFromNow = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    return `In ${diffDays} days`;
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffMins < 1) return 'Just now';
    if (diffMins === 1) return '1 minute ago';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const handleBookNow = async (appointment: Appointment) => {
    const source = appointment.source || 'IND';

    // Handle different sources with appropriate booking URLs
    if (source === 'THE_HAGUE_IC') {
      // Open The Hague International Centre booking page
      window.open('https://appointment.thehagueinternationalcentre.nl/', '_blank');
      return;
    }

    if (source === 'ROTTERDAM_IC') {
      // Open Rotterdam International Center booking page
      window.open('https://www.rotterdam.info/en/internationals/appointment', '_blank');
      return;
    }

    if (source === 'DIGID') {
      // Open DigiD video call booking page directly
      window.open('https://digidafspraak.nederlandwereldwijd.nl/', '_blank');
      return;
    }

    // Default: IND booking with automation helper
    const helperParams = new URLSearchParams({
      type: appointment.appointment_type,
      location: appointment.location,
      locationName: appointment.location_name,
      date: appointment.date,
      startTime: appointment.start_time,
      endTime: appointment.end_time,
      persons: appointment.persons.toString()
    });

    // Open booking helper with instructions
    window.open(`/autobook?${helperParams.toString()}`, '_blank');
  };

  const copyAppointmentDetails = async (appointment: Appointment) => {
    const details = `IND Appointment Details:
Type: ${appointment.appointment_type_name}
Location: ${appointment.location_name}
Date: ${formatDate(appointment.date)}
Time: ${appointment.start_time} - ${appointment.end_time}
Persons: ${appointment.persons}`;

    try {
      await navigator.clipboard.writeText(details);
      setCopiedId(appointment.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const shareFilteredView = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareUrlCopied(true);
      setTimeout(() => setShareUrlCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  return (
    <div className="min-h-screen md:h-screen flex flex-col bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Copied Notification */}
      {showCopiedNotice && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-slide-in">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span>Starting automation...</span>
        </div>
      )}

      {/* New Appointments Toast */}
      {newAppointmentsToast && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-bounce">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span>{newAppointmentsToast.count} new appointment{newAppointmentsToast.count > 1 ? 's' : ''} found! Refreshing...</span>
        </div>
      )}

      {/* WebSocket Connection Status */}
      {user && (
        <div
          className={`fixed z-40 px-3 py-1.5 rounded-full text-xs flex items-center gap-1.5 ${isConnected ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}
          style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))', right: 'max(1rem, env(safe-area-inset-right))' }}
        >
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
          <span>{isConnected ? 'Live updates' : 'Offline'}</span>
        </div>
      )}

      {/* Header */}
      <header className="flex-shrink-0 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 relative">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-blue-600">IND Appointments</h1>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Track available IND appointments in the Netherlands</p>
            </div>
            <div className="flex items-center gap-2">
              {user ? (
                <>
                  {/* Mobile Menu Button */}
                  <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="md:hidden p-2 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    aria-label="Menu"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {mobileMenuOpen ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                      )}
                    </svg>
                  </button>

                  {/* Desktop Navigation */}
                  <div className="hidden md:flex items-center gap-3">
                    {user.role === 'admin' && (
                      <Link
                        href="/admin"
                        className="text-sm text-purple-600 hover:text-purple-700 font-medium min-h-[44px] flex items-center"
                      >
                        ⚡ Admin
                      </Link>
                    )}
                    <Link
                      href="/preferences"
                      className="text-sm text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium min-h-[44px] flex items-center"
                    >
                      My Alerts
                    </Link>
                    <Link
                      href="/settings"
                      className="text-sm text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium min-h-[44px] flex items-center"
                    >
                      Settings
                    </Link>
                    <Link
                      href="/notifications"
                      className="text-sm text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium min-h-[44px] flex items-center"
                    >
                      History
                    </Link>
                    <ThemeToggle />
                    <span className="text-sm text-gray-600 dark:text-gray-400">Hello, {user.username}</span>
                    <button
                      onClick={handleLogout}
                      className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 min-h-[44px]"
                    >
                      Logout
                    </button>
                  </div>

                  {/* Mobile Dropdown Menu */}
                  {mobileMenuOpen && (
                    <>
                      {/* Backdrop */}
                      <div
                        className="fixed inset-0 bg-black bg-opacity-25 md:hidden z-40"
                        onClick={() => setMobileMenuOpen(false)}
                        aria-hidden="true"
                      />
                      {/* Menu */}
                      <div className="absolute top-full right-0 mt-2 mr-4 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 md:hidden z-50">
                      {user.role === 'admin' && (
                        <Link
                          href="/admin"
                          className="block px-4 py-3 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 dark:text-gray-300"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          ⚡ Admin
                        </Link>
                      )}
                      <Link
                        href="/preferences"
                        className="block px-4 py-3 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 dark:text-gray-300"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        My Alerts
                      </Link>
                      <Link
                        href="/settings"
                        className="block px-4 py-3 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 dark:text-gray-300"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        Settings
                      </Link>
                      <Link
                        href="/notifications"
                        className="block px-4 py-3 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 dark:text-gray-300"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        History
                      </Link>
                      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                        <span className="text-sm text-gray-700 dark:text-gray-300">Theme</span>
                        <ThemeToggle />
                      </div>
                      <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                        {user.username}
                      </div>
                      <button
                        onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                        className="block w-full text-left px-4 py-3 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300"
                      >
                        Logout
                      </button>
                    </div>
                    </>
                  )}
                </>
              ) : (
                <>
                  <ThemeToggle />
                  <Link
                    href="/login"
                    className="px-3 sm:px-4 py-2 text-sm text-blue-600 font-medium hover:text-blue-700 min-h-[44px] flex items-center"
                  >
                    Login
                  </Link>
                  <Link
                    href="/signup"
                    className="px-3 sm:px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 min-h-[44px] flex items-center whitespace-nowrap"
                  >
                    <span className="md:hidden">Sign Up</span>
                    <span className="hidden md:inline">Sign Up for Notifications!</span>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Header Content Zone */}
      <ContentZone zone="header" className="flex-shrink-0 max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-4" />

      {/* Fixed top section */}
      <div className="flex-shrink-0">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {/* Filters */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 mb-3">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Filter Appointments</h2>
            <button
              onClick={shareFilteredView}
              className="flex items-center gap-1 px-3 py-2 md:py-1.5 text-sm md:text-xs min-h-[44px] md:min-h-0 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 active:bg-gray-300 transition-colors"
              title="Copy link to filtered view"
            >
              {shareUrlCopied ? (
                <>
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  <span>Share</span>
                </>
              )}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm md:text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Appointment Type
              </label>
              <select
                value={filter.type}
                onChange={(e) => setFilter({ ...filter, type: e.target.value })}
                className="w-full px-3 py-2.5 md:py-1.5 text-base md:text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              >
                {APPOINTMENT_TYPE_OPTIONS.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm md:text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Location
              </label>
              <select
                value={filter.location}
                onChange={(e) => setFilter({ ...filter, location: e.target.value })}
                className="w-full px-3 py-2.5 md:py-1.5 text-base md:text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              >
                {LOCATION_OPTIONS.map((loc) => (
                  <option key={loc.value} value={loc.value}>
                    {loc.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm md:text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Number of Persons
              </label>
              <select
                value={filter.persons}
                onChange={(e) => setFilter({ ...filter, persons: e.target.value })}
                className="w-full px-3 py-2.5 md:py-1.5 text-base md:text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              >
                {PERSON_COUNTS.map((count) => (
                  <option key={count.value} value={count.value}>
                    {count.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="mb-3 grid grid-cols-2 gap-3">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3">
            <div className="text-sm md:text-xs text-gray-600 dark:text-gray-400 mb-1">Next Available</div>
            <div className="text-lg md:text-base font-bold text-purple-600">
              {appointments.length > 0 ? getDaysFromNow(appointments[0].date) : 'N/A'}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3">
            <div className="text-sm md:text-xs text-gray-600 dark:text-gray-400 mb-1">Last Checked</div>
            <div className="text-lg md:text-base font-bold text-green-600">
              {lastCheck ? formatTimeAgo(lastCheck) : 'N/A'}
            </div>
          </div>
        </div>

          {/* Available Appointments Header */}
          <div className="bg-white dark:bg-gray-800 rounded-t-lg shadow-sm mt-3">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Available Appointments</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const params = new URLSearchParams();
                      if (filter.type) params.append('type', filter.type);
                      if (filter.location) params.append('location', filter.location);
                      if (filter.persons) params.append('persons', filter.persons);
                      window.location.href = `/api/appointments/export?${params}`;
                    }}
                    className="px-3 py-2.5 md:py-2 text-sm min-h-[44px] md:min-h-0 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 active:bg-gray-400 flex items-center gap-1"
                    title="Export to CSV"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>CSV</span>
                  </button>
                  <a
                    href={`/api/appointments/ical?${new URLSearchParams(Object.entries(filter).filter(([_, v]) => v)).toString()}`}
                    className="px-3 py-2.5 md:py-2 text-sm min-h-[44px] md:min-h-0 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 active:bg-gray-400 flex items-center gap-1"
                    title="Export to Calendar (iCal)"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>iCal</span>
                  </a>
                  <button
                    onClick={fetchAppointments}
                    className="px-4 py-2.5 md:py-2 text-sm min-h-[44px] md:min-h-0 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800"
                  >
                    Refresh
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable appointments section */}
      <div className="flex-1 md:overflow-y-auto">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-6">
            {/* Main Content */}
            <div className="flex-1">
              {/* Appointments List Content */}
              <div className="bg-white dark:bg-gray-800 rounded-b-lg shadow-sm">

          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600 dark:text-gray-400">Loading appointments...</p>
            </div>
          ) : appointments.length === 0 ? (
            <div className="p-12 text-center text-gray-500 dark:text-gray-400">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No appointments found</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Try adjusting your filters or check back later.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {appointments.map((appointment, index) => (
                <>
                  <div
                    key={appointment.id}
                    className="p-4 sm:p-6 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        {appointment.location === 'THIC' ? (
                          <>
                            <span className="inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              Document Collection
                            </span>
                            <span className="inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              Biometrics
                            </span>
                            <span className="inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              <span className="sm:hidden">Residence Sticker</span>
                              <span className="hidden sm:inline">Residence Endorsement Sticker</span>
                            </span>
                          </>
                        ) : (
                          <span className="inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {appointment.appointment_type === 'VAA' ? (
                              <>
                                <span className="sm:hidden">Residence Sticker</span>
                                <span className="hidden sm:inline">Residence Endorsement Sticker</span>
                              </>
                            ) : (
                              <span className="max-w-[150px] sm:max-w-none truncate">{appointment.appointment_type_name}</span>
                            )}
                          </span>
                        )}
                        <span className="inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 max-w-[180px] sm:max-w-none truncate">
                          {appointment.location_name}
                        </span>
                        {appointment.persons > 1 && (
                          <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                            {appointment.persons} persons
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:flex sm:items-center gap-3 sm:gap-6 mt-3">
                        <div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">Date</div>
                          <div className="font-semibold text-base text-gray-900 dark:text-gray-100">
                            {formatDate(appointment.date)}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">Time</div>
                          <div className="font-semibold text-base text-gray-900 dark:text-gray-100">
                            {appointment.start_time} - {appointment.end_time}
                          </div>
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                          <div className="text-sm text-gray-600 dark:text-gray-400">Availability</div>
                          <div className="font-semibold text-base text-purple-600">
                            {getDaysFromNow(appointment.date)}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto sm:ml-4">
                      <button
                        onClick={() => copyAppointmentDetails(appointment)}
                        className="flex-shrink-0 px-3 py-3 sm:py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 active:bg-gray-400 transition-colors min-h-[44px] flex items-center justify-center gap-1"
                        title="Copy appointment details"
                      >
                        {copiedId === appointment.id ? (
                          <>
                            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="text-green-600">Copied</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                      <a
                        href={`/api/appointments/ical?id=${appointment.id}`}
                        className="flex-shrink-0 px-3 py-3 sm:py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 active:bg-gray-400 transition-colors min-h-[44px] flex items-center justify-center gap-1"
                        title="Add to calendar"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>Cal</span>
                      </a>
                      <button
                        onClick={() => handleBookNow(appointment)}
                        className="flex-1 sm:flex-initial px-4 py-3 sm:py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 active:bg-blue-800 whitespace-nowrap transition-colors min-h-[44px]"
                        title="Opens IND booking page"
                      >
                        Book Now →
                      </button>
                    </div>
                  </div>
                </div>
                {/* Insert content every 10 appointments */}
                {(index + 1) % 10 === 0 && index < appointments.length - 1 && (
                  <div className="p-4">
                    <ContentZone zone="between_appointments" />
                  </div>
                )}
                </>
              ))}
            </div>
          )}
              </div>
            </div>

            {/* Sidebar - Hidden on mobile, visible on lg screens */}
            <div className="hidden lg:block lg:w-80 flex-shrink-0">
              <div className="sticky top-4">
                <ContentZone zone="sidebar" />
              </div>
            </div>
          </div>

          {/* Footer Content Zone */}
          <ContentZone zone="footer" className="py-4" />

          {/* Footer */}
          <footer className="mt-16 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
            <div className="px-4 sm:px-6 lg:px-8 py-8">
              <div className="text-center text-sm text-gray-600 dark:text-gray-400">
                <p>© 2025 IND Appointments Tracker. Not affiliated with IND.</p>
                <p className="mt-2">
                  This is an unofficial tool to help track IND appointment availability.
                </p>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}

// Loading fallback for Suspense
function HomePageLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600 dark:text-gray-400">Loading appointments...</p>
      </div>
    </div>
  );
}

// Wrap in Suspense for useSearchParams
export default function HomePage() {
  return (
    <Suspense fallback={<HomePageLoading />}>
      <HomePageContent />
    </Suspense>
  );
}
