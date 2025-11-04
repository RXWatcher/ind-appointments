'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { APPOINTMENT_TYPES, LOCATIONS } from '@/lib/appointment-data';

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
    locations: ['ALL'] as string[], // Changed to array for multiple locations
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

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      setUser(payload);
      fetchPreferences(token);
    } catch (e) {
      router.push('/login');
    }
  }, [router]);

  const fetchPreferences = async (token: string) => {
    try {
      const response = await fetch('/api/preferences', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setPreferences(data.data);
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.locations.length === 0) {
      alert('Please select at least one location');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      alert('Please log in to save preferences');
      return;
    }

    try {
      const response = await fetch('/api/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          location: formData.locations.join(',') // Convert array to comma-separated string
        }),
      });

      const data = await response.json();
      if (data.success) {
        alert('Preference(s) saved successfully!');
        setShowForm(false);
        setFormData({
          appointmentType: APPOINTMENT_TYPES[0]?.value || 'BIO',
          locations: ['ALL'],
          persons: 1,
          daysAhead: 30,
          emailEnabled: true,
          pushEnabled: false,
          whatsappEnabled: false,
          notificationInterval: 15,
          dndStartTime: '22:00',
          dndEndTime: '08:00',
        });
        fetchPreferences(token);
      } else {
        alert('Error saving preference: ' + (data.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error saving preference:', error);
      alert('Error saving preference. Check console for details.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this preference?')) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(`/api/preferences?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.success) {
        fetchPreferences(token);
      }
    } catch (error) {
      console.error('Error deleting preference:', error);
    }
  };

  const getTypeLabel = (type: string) => {
    const appointmentType = APPOINTMENT_TYPES.find((t) => t.value === type);
    return appointmentType?.label || type;
  };

  const getLocationLabel = (loc: string) => {
    if (loc === 'ALL') return 'All Locations';

    // Handle comma-separated locations
    if (loc.includes(',')) {
      const locationCodes = loc.split(',');
      if (locationCodes.includes('ALL')) return 'All Locations';

      const labels = locationCodes.map(code => {
        const location = LOCATIONS.find((l) => l.value === code.trim());
        return location?.label || code;
      });
      return labels.join(', ');
    }

    const location = LOCATIONS.find((l) => l.value === loc);
    return location?.label || loc;
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <Link href="/" className="text-xl sm:text-2xl font-bold text-blue-600">
              IND Appointments
            </Link>
            <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
              <span className="text-sm text-gray-600 dark:text-gray-400">Hello, {user.username}</span>
              <Link
                href="/"
                className="px-3 sm:px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium min-h-[44px] flex items-center"
              >
                Back to Appointments
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Notification Preferences</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Set up email alerts for specific appointment types and locations. You can create multiple alerts with different combinations.
          </p>
          <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 dark:border-blue-400 p-4 rounded">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-blue-900 dark:text-blue-200">
                  <strong>Tip:</strong> Create separate alerts for different combinations. For example: "Document Collection at Amsterdam" and "Biometrics at All Locations" will give you notifications for both scenarios.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Add Preference Button */}
        <div className="mb-6">
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            {showForm ? 'Cancel' : '+ Add New Preference'}
          </button>
        </div>

        {/* Add Preference Form */}
        {showForm && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 sm:p-6 mb-6">
            <h3 className="text-base sm:text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Add Notification Preference</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Appointment Type
                  </label>
                  <select
                    value={formData.appointmentType}
                    onChange={(e) => setFormData({ ...formData, appointmentType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  >
                    {APPOINTMENT_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Locations (select multiple)
                  </label>
                  <div className="space-y-2 max-h-none md:max-h-64 md:overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg p-2 dark:bg-gray-700">
                    <label className="flex items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-600 rounded cursor-pointer min-h-[44px]">
                      <input
                        type="checkbox"
                        checked={formData.locations.includes('ALL')}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({ ...formData, locations: ['ALL'] });
                          } else {
                            setFormData({ ...formData, locations: [] });
                          }
                        }}
                        className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="ml-3 text-sm font-semibold text-gray-900 dark:text-gray-100 flex-1">All Locations</span>
                    </label>
                    <div className="border-t border-gray-200 dark:border-gray-600 pt-2">
                      {LOCATIONS.map((loc) => (
                        <label key={loc.value} className="flex items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-600 rounded cursor-pointer min-h-[44px]">
                          <input
                            type="checkbox"
                            checked={formData.locations.includes(loc.value)}
                            disabled={formData.locations.includes('ALL')}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({
                                  ...formData,
                                  locations: [...formData.locations.filter(l => l !== 'ALL'), loc.value]
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  locations: formData.locations.filter(l => l !== loc.value)
                                });
                              }
                            }}
                            className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="ml-3 text-sm text-gray-700 dark:text-gray-300 flex-1">{loc.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    {formData.locations.includes('ALL')
                      ? 'Monitoring all locations'
                      : `Monitoring ${formData.locations.length} location${formData.locations.length !== 1 ? 's' : ''}`
                    }
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Number of Persons
                  </label>
                  <select
                    value={formData.persons}
                    onChange={(e) => setFormData({ ...formData, persons: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  >
                    <option value="1">1 Person</option>
                    <option value="2">2 Persons</option>
                    <option value="3">3 Persons</option>
                    <option value="4">4 Persons</option>
                    <option value="5">5 Persons</option>
                    <option value="6">6 Persons</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">We check all person counts 1-6 automatically</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    How far in advance? (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="90"
                    value={formData.daysAhead}
                    onChange={(e) => setFormData({ ...formData, daysAhead: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Get notified about appointments from today up to this many days in the future (e.g., 30 = next month)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Notification Interval
                  </label>
                  <select
                    value={formData.notificationInterval}
                    onChange={(e) => setFormData({ ...formData, notificationInterval: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  >
                    <option value="5">Every 5 minutes</option>
                    <option value="15">Every 15 minutes</option>
                    <option value="30">Every 30 minutes</option>
                    <option value="60">Every hour</option>
                    <option value="120">Every 2 hours</option>
                    <option value="240">Every 4 hours</option>
                    <option value="480">Every 8 hours</option>
                    <option value="1440">Once per day</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Minimum time between notifications</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Do Not Disturb - Start Time
                  </label>
                  <input
                    type="time"
                    value={formData.dndStartTime}
                    onChange={(e) => setFormData({ ...formData, dndStartTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">No notifications after this time</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Do Not Disturb - End Time
                  </label>
                  <input
                    type="time"
                    value={formData.dndEndTime}
                    onChange={(e) => setFormData({ ...formData, dndEndTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">No notifications before this time</p>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2 text-sm">Notification Settings</h4>
                <p className="text-xs text-blue-800 dark:text-blue-200 mb-3">
                  Example: If DND is 22:00-08:00, no notifications will be sent between 10 PM and 8 AM.
                  The notification interval ensures you don't get spammed - if set to 1 hour, you'll receive at most one notification per hour for this alert.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Notification Channels
                </label>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="emailEnabled"
                    checked={formData.emailEnabled}
                    onChange={(e) => setFormData({ ...formData, emailEnabled: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="emailEnabled" className="ml-2 block text-sm text-gray-900 dark:text-gray-100">
                    Email notifications
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="pushEnabled"
                    checked={formData.pushEnabled}
                    onChange={(e) => setFormData({ ...formData, pushEnabled: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="pushEnabled" className="ml-2 block text-sm text-gray-900 dark:text-gray-100">
                    Pushover notifications (configure in Settings)
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="whatsappEnabled"
                    checked={formData.whatsappEnabled}
                    onChange={(e) => setFormData({ ...formData, whatsappEnabled: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="whatsappEnabled" className="ml-2 block text-sm text-gray-900 dark:text-gray-100">
                    WhatsApp notifications (configure in Settings)
                  </label>
                </div>
              </div>

              <button
                type="submit"
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium min-h-[44px]"
              >
                Save Preference
              </button>
            </form>
          </div>
        )}

        {/* Preferences List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Your Preferences</h2>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : preferences.length === 0 ? (
            <div className="p-12 text-center text-gray-500 dark:text-gray-400">
              <p>No preferences set up yet.</p>
              <p className="mt-2 text-sm">Click "Add New Preference" to get started!</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {preferences.map((pref) => (
                <div key={pref.id} className="p-4 sm:p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className="inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium bg-blue-100 text-blue-800 dark:text-blue-300">
                          {getTypeLabel(pref.appointment_type)}
                        </span>
                        <span className="inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium bg-green-100 text-green-800 break-all">
                          {getLocationLabel(pref.location)}
                        </span>
                        {pref.persons > 1 && (
                          <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">{pref.persons} persons</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 sm:gap-6 mt-3 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        <div>
                          <span className="font-medium">Next {pref.days_ahead} days</span>
                        </div>
                        <div>
                          {pref.email_enabled && (
                            <span className="text-green-600">✓ Email enabled</span>
                          )}
                        </div>
                        <div>
                          <span className={pref.is_active ? 'text-green-600' : 'text-gray-400'}>
                            {pref.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(pref.id)}
                      className="w-full sm:w-auto sm:ml-4 px-4 py-3 sm:py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors min-h-[44px]"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
