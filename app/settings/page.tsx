'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';

interface NotificationCredentials {
  pushover_user_key?: string;
  whatsapp_phone_number?: string;
}

function SettingsForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [credentials, setCredentials] = useState<NotificationCredentials>({});
  const [timezone, setTimezone] = useState<string>('Europe/Amsterdam');
  const [timezones, setTimezones] = useState<string[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [changingPassword, setChangingPassword] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [changingEmail, setChangingEmail] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      setUser(payload);
      fetchCredentials(token);
      fetchTimezone(token);

      // Get available timezones
      try {
        const tzList = Intl.supportedValuesOf('timeZone');
        setTimezones(tzList);
      } catch (e) {
        // Fallback for older browsers
        setTimezones(['Europe/Amsterdam', 'America/New_York', 'Asia/Tokyo', 'Australia/Sydney']);
      }
    } catch (e) {
      router.push('/login');
    }
  }, [router]);

  useEffect(() => {
    // Check for email change messages in URL
    const messageParam = searchParams.get('message');
    const errorParam = searchParams.get('error');

    if (messageParam === 'email_changed') {
      setMessage({ type: 'success', text: '✅ Email changed successfully! You can now log in with your new email address.' });
      // Clear URL parameters
      router.replace('/settings');
    } else if (errorParam === 'invalid_token') {
      setMessage({ type: 'error', text: 'Invalid or expired email change link. Please request a new one.' });
      router.replace('/settings');
    } else if (errorParam === 'token_expired') {
      setMessage({ type: 'error', text: 'Email change link expired. Please request a new one.' });
      router.replace('/settings');
    } else if (errorParam === 'email_taken') {
      setMessage({ type: 'error', text: 'The requested email address is already in use.' });
      router.replace('/settings');
    } else if (errorParam === 'verification_failed') {
      setMessage({ type: 'error', text: 'Email change verification failed. Please try again.' });
      router.replace('/settings');
    }
  }, [searchParams, router]);

  const fetchCredentials = async (token: string) => {
    try {
      const response = await fetch('/api/user/notification-credentials', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setCredentials(data.data || {});
      }
    } catch (error) {
      console.error('Error fetching credentials:', error);
    }
    setLoading(false);
  };

  const fetchTimezone = async (token: string) => {
    try {
      const response = await fetch('/api/user/timezone', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setTimezone(data.data.timezone || 'Europe/Amsterdam');
      }
    } catch (error) {
      console.error('Error fetching timezone:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      // Save credentials
      const credResponse = await fetch('/api/user/notification-credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(credentials),
      });

      // Save timezone
      const tzResponse = await fetch('/api/user/timezone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ timezone }),
      });

      const credData = await credResponse.json();
      const tzData = await tzResponse.json();

      if (credData.success && tzData.success) {
        setMessage({ type: 'success', text: 'Settings saved successfully' });
      } else {
        setMessage({ type: 'error', text: credData.message || tzData.message || 'Failed to save settings' });
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({ type: 'error', text: 'Error saving settings' });
    }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    setChangingPassword(true);
    setMessage(null);
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch('/api/user/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(passwordData),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Password changed successfully' });
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to change password' });
      }
    } catch (error) {
      console.error('Error changing password:', error);
      setMessage({ type: 'error', text: 'Error changing password' });
    }
    setChangingPassword(false);
  };

  const handleChangeEmail = async () => {
    if (!newEmail || !newEmail.includes('@')) {
      setMessage({ type: 'error', text: 'Please enter a valid email address' });
      return;
    }

    setChangingEmail(true);
    setMessage(null);
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch('/api/user/change-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ newEmail }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: data.message });
        setNewEmail('');
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to request email change' });
      }
    } catch (error) {
      console.error('Error changing email:', error);
      setMessage({ type: 'error', text: 'Error requesting email change' });
    }
    setChangingEmail(false);
  };

  if (!user || loading) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-blue-600">Notification Settings</h1>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Configure your personal notification preferences</p>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
              <ThemeToggle />
              <Link
                href="/"
                className="px-3 sm:px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium min-h-[44px] flex items-center"
              >
                ← Back
              </Link>
              <span className="text-sm text-gray-600 dark:text-gray-400 hidden sm:inline">{user.username}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {message && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="space-y-6">
          {/* Email Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Email Address</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Your email address for login and notifications</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Current Email
                </label>
                <input
                  type="email"
                  value={user.email}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  New Email Address
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white min-h-[44px]"
                  placeholder="Enter new email address"
                />
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  A verification link will be sent to your new email address. Your email will only be changed after you verify it.
                </p>
              </div>
              <div className="pt-2">
                <button
                  onClick={handleChangeEmail}
                  disabled={changingEmail || !newEmail}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed min-h-[44px]"
                >
                  {changingEmail ? 'Requesting Change...' : 'Change Email'}
                </button>
              </div>
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Email notifications are enabled by default. You can manage which appointment types trigger emails in your{' '}
                  <Link href="/preferences" className="text-blue-600 hover:underline">notification preferences</Link>.
                </p>
              </div>
            </div>
          </div>

          {/* Pushover Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Pushover Push Notifications</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Receive instant push notifications on your mobile device</p>
                </div>
                <a
                  href="https://pushover.net"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 active:bg-blue-800 font-medium min-h-[44px]"
                >
                  Sign Up for Pushover
                </a>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">How to set up Pushover:</h3>
                <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800 dark:text-blue-300">
                  <li>Create a free account at <a href="https://pushover.net" target="_blank" rel="noopener noreferrer" className="underline">pushover.net</a></li>
                  <li>Download the Pushover app on your iOS or Android device ($4.99 one-time purchase)</li>
                  <li>Log in to the Pushover website and copy your <strong>User Key</strong> from the dashboard</li>
                  <li>Paste your User Key below</li>
                  <li>Enable push notifications in your <Link href="/preferences" className="underline">notification preferences</Link></li>
                </ol>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Pushover User Key
                </label>
                <input
                  type="text"
                  value={credentials.pushover_user_key || ''}
                  onChange={(e) => setCredentials({ ...credentials, pushover_user_key: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white min-h-[44px]"
                  placeholder="Enter your Pushover User Key"
                />
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  You can find your User Key on your{' '}
                  <a href="https://pushover.net" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    Pushover dashboard
                  </a>
                </p>
              </div>
            </div>
          </div>

          {/* Timezone Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Timezone</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Set your timezone for Do Not Disturb times</p>
            </div>
            <div className="p-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Your Timezone
                </label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white min-h-[44px]"
                >
                  {timezones.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  This timezone will be used for Do Not Disturb times in your notification preferences.
                </p>
              </div>
            </div>
          </div>

          {/* WhatsApp Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">WhatsApp Notifications</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Receive instant notifications via WhatsApp Business Cloud API</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">WhatsApp Integration</h3>
                <p className="text-sm text-blue-800 dark:text-blue-300 mb-2">
                  Receive appointment notifications directly to your WhatsApp! The admin has configured WhatsApp Business Cloud API.
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm text-blue-800">
                  <li>Enter your WhatsApp phone number below (with country code)</li>
                  <li>Enable WhatsApp notifications in your <Link href="/preferences" className="underline">notification preferences</Link></li>
                  <li>Start receiving instant WhatsApp alerts!</li>
                </ul>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  WhatsApp Phone Number (with country code)
                </label>
                <input
                  type="text"
                  value={credentials.whatsapp_phone_number || ''}
                  onChange={(e) => setCredentials({ ...credentials, whatsapp_phone_number: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white min-h-[44px]"
                  placeholder="+31612345678"
                />
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Example: +31612345678 (Netherlands), +1234567890 (USA), +44XXXXXXXXXX (UK)
                </p>
              </div>
            </div>
          </div>

          {/* Change Password Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Change Password</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Update your account password</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Current Password
                </label>
                <input
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white min-h-[44px]"
                  placeholder="Enter current password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white min-h-[44px]"
                  placeholder="Enter new password (min 8 characters)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white min-h-[44px]"
                  placeholder="Confirm new password"
                />
              </div>
              <div className="pt-2">
                <button
                  onClick={handleChangePassword}
                  disabled={changingPassword || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed min-h-[44px]"
                >
                  {changingPassword ? 'Changing Password...' : 'Change Password'}
                </button>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4">
            <Link
              href="/preferences"
              className="w-full sm:w-auto px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-center rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-medium min-h-[44px] flex items-center justify-center"
            >
              Manage Alert Preferences
            </Link>
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full sm:w-auto px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:bg-gray-400 min-h-[44px]"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    }>
      <SettingsForm />
    </Suspense>
  );
}
