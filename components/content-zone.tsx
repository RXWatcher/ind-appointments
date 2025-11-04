'use client';

import { useEffect, useState } from 'react';

interface ContentZoneProps {
  zone: 'header' | 'sidebar' | 'footer' | 'between_appointments';
  className?: string;
}

// Generate obfuscated class name based on zone to avoid ad blocker detection
const getZoneClass = (zone: string): string => {
  const obfuscationMap: Record<string, string> = {
    'header': 'feature-banner-top',
    'sidebar': 'info-widget-aside',
    'footer': 'partner-section-bottom',
    'between_appointments': 'content-block-inline'
  };
  return obfuscationMap[zone] || 'content-widget';
};

// Generate random suffix for additional obfuscation
const getRandomSuffix = (): string => {
  return Math.random().toString(36).substring(2, 8);
};

export function ContentZone({ zone, className = '' }: ContentZoneProps) {
  const [contentHtml, setContentHtml] = useState<string>('');
  const [isEnabled, setIsEnabled] = useState<boolean>(false);
  const [displayMode, setDisplayMode] = useState<string>('both');
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [randomClass] = useState(() => `w-${getRandomSuffix()}`);

  // Lazy loading: only fetch when component mounts
  useEffect(() => {
    setMounted(true);
    // Slight delay to avoid blocking initial page render
    const timer = setTimeout(() => {
      fetchContentSettings();
    }, 100);

    return () => clearTimeout(timer);
  }, [zone]);

  const fetchContentSettings = async () => {
    try {
      const response = await fetch('/api/widget');
      const data = await response.json();

      if (data.success) {
        const globalEnabled = data.data.ad_enabled === 'true';
        const zoneEnabledKey = `ad_${zone}_enabled`;
        const zoneEnabled = data.data[zoneEnabledKey] === undefined ? true : data.data[zoneEnabledKey] === 'true';

        // Both global and zone-specific must be enabled
        setIsEnabled(globalEnabled && zoneEnabled);

        const zoneKey = `ad_${zone}_html`;
        setContentHtml(data.data[zoneKey] || '');

        // Check display mode (desktop/mobile/both)
        const displayKey = `ad_${zone}_display`;
        setDisplayMode(data.data[displayKey] || 'both');
      }
    } catch (error) {
      console.error('Error fetching content settings:', error);
    }
    setLoading(false);
  };

  // Don't render anything if not mounted, disabled, loading, or no HTML is set
  if (!mounted || loading || !isEnabled || !contentHtml) {
    return null;
  }

  // Apply display classes based on displayMode
  let displayClasses = '';
  if (displayMode === 'desktop') {
    displayClasses = 'hidden lg:block';
  } else if (displayMode === 'mobile') {
    displayClasses = 'block lg:hidden';
  }

  const zoneClass = getZoneClass(zone);

  return (
    <div
      className={`${zoneClass} ${randomClass} ${displayClasses} ${className}`}
      data-type="feature"
      dangerouslySetInnerHTML={{ __html: contentHtml }}
    />
  );
}
