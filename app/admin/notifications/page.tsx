'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface NotificationSettings {
  // SMTP Settings
  smtp_host?: string;
  smtp_port?: string;
  smtp_user?: string;
  smtp_pass?: string;
  smtp_from?: string;
  smtp_secure?: string;

  // Pushover Settings
  pushover_user_key?: string;
  pushover_api_token?: string;

  // WhatsApp Settings (WhatsApp Cloud API)
  whatsapp_access_token?: string;
  whatsapp_phone_number_id?: string;
  whatsapp_business_account_id?: string;
}

export default function AdminNotificationsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [settings, setSettings] = useState<NotificationSettings>({});
  const [testEmail, setTestEmail] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.role !== 'admin') {
        router.push('/');
        return;
      }
      setUser(payload);
      fetchSettings(token);
    } catch (e) {
      router.push('/login');
    }
  }, [router]);

  const fetchSettings = async (token: string) => {
    try {
      const response = await fetch('/api/admin/notifications/settings', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setSettings(data.data || {});
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch('/api/admin/notifications/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(settings),
      });
      const data = await response.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Settings saved successfully' });
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to save settings' });
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({ type: 'error', text: 'Error saving settings' });
    }
    setSaving(false);
  };

  const handleTest = async (provider: 'smtp' | 'pushover' | 'whatsapp') => {
    if (provider === 'smtp' && !testEmail) {
      setMessage({ type: 'error', text: 'Please enter a test email address' });
      return;
    }

    setTesting(provider);
    setMessage(null);
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch('/api/admin/notifications/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ provider, testEmail }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage({ type: 'success', text: data.message || 'Test successful' });
      } else {
        setMessage({ type: 'error', text: data.message || 'Test failed' });
      }
    } catch (error) {
      console.error('Error testing:', error);
      setMessage({ type: 'error', text: 'Error testing notification' });
    }
    setTesting(null);
  };

  if (!user || loading) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-blue-600">Notification Settings</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">Configure SMTP, Pushover, and WhatsApp</p>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/admin"
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium"
              >
                ← Back to Dashboard
              </Link>
              <span className="text-gray-600 dark:text-gray-400">{user.username}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
          {/* SMTP Settings */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">SMTP Settings (Email)</h2>
              <p className="text-sm text-gray-600 mt-1">Configure email notification settings</p>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    SMTP Host
                  </label>
                  <input
                    type="text"
                    value={settings.smtp_host || ''}
                    onChange={(e) => setSettings({ ...settings, smtp_host: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                    placeholder="smtp.gmail.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    SMTP Port
                  </label>
                  <input
                    type="text"
                    value={settings.smtp_port || ''}
                    onChange={(e) => setSettings({ ...settings, smtp_port: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                    placeholder="587"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  SMTP Username
                </label>
                <input
                  type="text"
                  value={settings.smtp_user || ''}
                  onChange={(e) => setSettings({ ...settings, smtp_user: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="your-email@gmail.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  SMTP Password
                </label>
                <input
                  type="password"
                  value={settings.smtp_pass || ''}
                  onChange={(e) => setSettings({ ...settings, smtp_pass: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="your-app-password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  From Email Address
                </label>
                <input
                  type="email"
                  value={settings.smtp_from || ''}
                  onChange={(e) => setSettings({ ...settings, smtp_from: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="noreply@yourdomain.com"
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="smtp_secure"
                  checked={settings.smtp_secure === '1'}
                  onChange={(e) => setSettings({ ...settings, smtp_secure: e.target.checked ? '1' : '0' })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="smtp_secure" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  Use SSL/TLS (recommended for port 465, uncheck for port 587 with STARTTLS)
                </label>
              </div>

              {/* Test SMTP */}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Test Email Address
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                    placeholder="test@example.com"
                  />
                  <button
                    onClick={() => handleTest('smtp')}
                    disabled={testing === 'smtp'}
                    className="px-4 sm:px-6 py-3 bg-green-600 text-white text-sm sm:text-base rounded-lg hover:bg-green-700 font-medium disabled:bg-gray-400 min-h-[44px] whitespace-nowrap"
                  >
                    {testing === 'smtp' ? 'Testing...' : 'Test SMTP'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Pushover Settings */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Pushover Settings</h2>
              <p className="text-sm text-gray-600 mt-1">Configure push notification settings</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pushover User Key
                </label>
                <input
                  type="text"
                  value={settings.pushover_user_key || ''}
                  onChange={(e) => setSettings({ ...settings, pushover_user_key: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="your-user-key"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pushover API Token
                </label>
                <input
                  type="text"
                  value={settings.pushover_api_token || ''}
                  onChange={(e) => setSettings({ ...settings, pushover_api_token: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="your-api-token"
                />
              </div>

              {/* Test Pushover */}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => handleTest('pushover')}
                  disabled={testing === 'pushover'}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:bg-gray-400"
                >
                  {testing === 'pushover' ? 'Testing...' : 'Test Pushover'}
                </button>
              </div>
            </div>
          </div>

          {/* WhatsApp Settings */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">WhatsApp Business Cloud API</h2>
              <p className="text-sm text-gray-600 mt-1">Configure WhatsApp Business Cloud API (free tier: 1,000 conversations/month)</p>
              <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-xs text-blue-800 dark:text-blue-300">
                  <strong>Setup Guide:</strong> Create a WhatsApp Business account at{' '}
                  <a href="https://business.facebook.com" target="_blank" rel="noopener noreferrer" className="underline">
                    business.facebook.com
                  </a>
                  {' '}→ WhatsApp → API Setup to get your credentials
                </p>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Access Token
                  <span className="text-xs text-gray-500 ml-2">(Get from Meta Business Suite)</span>
                </label>
                <input
                  type="password"
                  value={settings.whatsapp_access_token || ''}
                  onChange={(e) => setSettings({ ...settings, whatsapp_access_token: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="EAAxxxxxxxxxxxxxxxxxxxxxxxx"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number ID
                  <span className="text-xs text-gray-500 ml-2">(Not the actual phone number)</span>
                </label>
                <input
                  type="text"
                  value={settings.whatsapp_phone_number_id || ''}
                  onChange={(e) => setSettings({ ...settings, whatsapp_phone_number_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="123456789012345"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Business Account ID
                  <span className="text-xs text-gray-500 ml-2">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={settings.whatsapp_business_account_id || ''}
                  onChange={(e) => setSettings({ ...settings, whatsapp_business_account_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="123456789012345"
                />
              </div>

              {/* Test WhatsApp */}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => handleTest('whatsapp')}
                  disabled={testing === 'whatsapp'}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:bg-gray-400"
                >
                  {testing === 'whatsapp' ? 'Testing...' : 'Test WhatsApp'}
                </button>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full sm:w-auto px-6 sm:px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:bg-gray-400 min-h-[44px]"
            >
              {saving ? 'Saving...' : 'Save All Settings'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
