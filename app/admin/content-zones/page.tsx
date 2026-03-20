'use client';

import { useEffect, useState, startTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface ContentSettings {
  ad_enabled?: string;
  ad_header_html?: string;
  ad_sidebar_html?: string;
  ad_footer_html?: string;
  ad_between_appointments_html?: string;
  [key: string]: string | undefined;
}

export default function AdminContentZonesPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [settings, setSettings] = useState<ContentSettings>({});
  const [previewZone, setPreviewZone] = useState<'ad_header_html' | 'ad_sidebar_html' | 'ad_footer_html' | 'ad_between_appointments_html' | null>(null);

  const fetchSettings = async (token: string) => {
    try {
      const response = await fetch('/api/admin/widget', {
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
      startTransition(() => {
        setUser(payload);
        fetchSettings(token);
      });
    } catch (e) {
      router.push('/login');
    }
  }, [router]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch('/api/admin/widget', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(settings),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Content settings saved successfully' });
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to save settings' });
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({ type: 'error', text: 'Error saving settings' });
    }
    setSaving(false);
  };

  const updateSetting = (key: keyof ContentSettings, value: string) => {
    setSettings({ ...settings, [key]: value });
  };

  if (!user || loading) return null;

  const contentZones = [
    {
      key: 'ad_header_html' as keyof ContentSettings,
      enabledKey: 'ad_header_enabled' as keyof ContentSettings,
      displayKey: 'ad_header_display' as keyof ContentSettings,
      label: 'Header Content',
      description: 'Displays at the top of pages, below the navigation header',
      placeholder: '<div>Your HTML content here</div>',
      hasDisplayOptions: true
    },
    {
      key: 'ad_sidebar_html' as keyof ContentSettings,
      enabledKey: 'ad_sidebar_enabled' as keyof ContentSettings,
      label: 'Sidebar Content',
      description: 'Displays in a sidebar on desktop view (desktop only)',
      placeholder: '<div>Your HTML content here</div>',
      hasDisplayOptions: false
    },
    {
      key: 'ad_footer_html' as keyof ContentSettings,
      enabledKey: 'ad_footer_enabled' as keyof ContentSettings,
      displayKey: 'ad_footer_display' as keyof ContentSettings,
      label: 'Footer Content',
      description: 'Displays at the bottom of pages, above the footer',
      placeholder: '<div>Your HTML content here</div>',
      hasDisplayOptions: true
    },
    {
      key: 'ad_between_appointments_html' as keyof ContentSettings,
      enabledKey: 'ad_between_appointments_enabled' as keyof ContentSettings,
      label: 'Inline Content',
      description: 'Displays between appointment cards on the main page',
      placeholder: '<div>Your HTML content here</div>',
      hasDisplayOptions: false
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-blue-600">Content Zones</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">Configure HTML content embeds across the site</p>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/admin"
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium"
              >
                ← Back to Admin
              </Link>
              <span className="text-gray-600 dark:text-gray-400">{user.username}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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

        {/* Global Toggle */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Enable Content Globally</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Master switch to enable or disable all content zones across the site</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.ad_enabled === 'true'}
                onChange={(e) => updateSetting('ad_enabled', e.target.checked ? 'true' : 'false')}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        {/* Warning Banner */}
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="text-sm text-yellow-900 dark:text-yellow-200">
              <p className="font-medium mb-1">⚠️ Security Notice:</p>
              <p>HTML content is embedded directly into pages. Only paste HTML from trusted sources. Be cautious of:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Scripts that could compromise user security</li>
                <li>Malicious code or tracking scripts</li>
                <li>Content that violates your terms of service</li>
              </ul>
              <p className="mt-2 font-medium">For best security, use iframe-based codes or vetted sources.</p>
            </div>
          </div>
        </div>

        {/* Content Zones */}
        <div className="space-y-6">
          {contentZones.map((zone) => {
            const isZoneEnabled = settings[zone.enabledKey] === undefined ? true : settings[zone.enabledKey] === 'true';

            return (
            <div key={zone.key} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{zone.label}</h2>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isZoneEnabled}
                          onChange={(e) => updateSetting(zone.enabledKey, e.target.checked ? 'true' : 'false')}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                        <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                          {isZoneEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </label>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{zone.description}</p>

                    {zone.hasDisplayOptions && (
                      <div className="mt-3 flex items-center gap-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Display on:</label>
                        <select
                          value={settings[zone.displayKey!] || 'both'}
                          onChange={(e) => updateSetting(zone.displayKey!, e.target.value)}
                          className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="both">Desktop & Mobile</option>
                          <option value="desktop">Desktop Only</option>
                          <option value="mobile">Mobile Only</option>
                        </select>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setPreviewZone(previewZone === zone.key ? null : zone.key as any)}
                    className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 flex-shrink-0 ml-4"
                  >
                    {previewZone === zone.key ? 'Hide Preview' : 'Show Preview'}
                  </button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    HTML Code
                  </label>
                  <textarea
                    value={settings[zone.key] || ''}
                    onChange={(e) => updateSetting(zone.key, e.target.value)}
                    rows={8}
                    className="w-full px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white font-mono text-xs sm:text-sm min-h-[120px]"
                    placeholder={zone.placeholder}
                  />
                </div>

                {/* Preview */}
                {previewZone === zone.key && settings[zone.key] && (
                  <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4">
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Preview:</div>
                    <div
                      className="bg-gray-50 dark:bg-gray-900 p-4 rounded border border-gray-200 dark:border-gray-700"
                      dangerouslySetInnerHTML={{ __html: settings[zone.key] || '' }}
                    />
                  </div>
                )}
              </div>
            </div>
            );
          })}
        </div>

        {/* Save Button */}
        <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4 mt-6">
          <Link
            href="/admin"
            className="w-full sm:w-auto px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-medium text-center min-h-[44px] flex items-center justify-center"
          >
            Cancel
          </Link>
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full sm:w-auto px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:bg-gray-400 min-h-[44px]"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </main>
    </div>
  );
}
