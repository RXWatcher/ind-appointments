'use client';

import { useEffect, useState, memo, useMemo } from 'react';

const AnimatedCounter = memo(function AnimatedCounter({ value, label, color, icon }: { value: number | string; label: string; color: string; icon: string }) {
  const [displayed, setDisplayed] = useState(0);
  const numVal = typeof value === 'number' ? value : 0;

  useEffect(() => {
    if (typeof value !== 'number') return;
    const duration = 600;
    const start = Date.now();
    const from = 0;
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(from + (numVal - from) * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };
    tick();
  }, [numVal, value]);

  return (
    <div className="glass-card p-3 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-16 h-16 rounded-full -mr-4 -mt-4 opacity-10" style={{ background: color }} />
      <div className="relative">
        <div className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1">
          <span>{icon}</span> {label}
        </div>
        <div className="text-xl font-bold mt-0.5" style={{ color }}>
          {typeof value === 'number' ? displayed : value}
        </div>
      </div>
    </div>
  );
});

export const Sparkline = memo(function Sparkline({ data, width = 100, height = 28 }: { data: number[]; width?: number; height?: number }) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  const isUp = data[data.length - 1] > data[0];
  return (
    <svg width={width} height={height} className="inline-block mt-1" aria-hidden="true">
      <polyline fill="none" stroke={isUp ? '#22c55e' : '#ef4444'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
});

interface StatsBarProps {
  totalAppointments: number;
  nextAvailable: string;
  lastCheck: string | null;
  uniqueLocations: number;
}

export const StatsBar = memo(function StatsBar({ totalAppointments, nextAvailable, lastCheck, uniqueLocations }: StatsBarProps) {
  const lastCheckFormatted = useMemo(() => {
    if (!lastCheck) return 'N/A';
    const date = new Date(lastCheck);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffMins < 1) return 'Just now';
    if (diffMins === 1) return '1 min ago';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours === 1) return '1h ago';
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }, [lastCheck]);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-3" role="region" aria-label="Appointment statistics">
      <AnimatedCounter value={totalAppointments} label="Available" color="#3b82f6" icon="📊" />
      <AnimatedCounter value={nextAvailable} label="Next" color="#8b5cf6" icon="⏳" />
      <AnimatedCounter value={lastCheckFormatted} label="Checked" color="#22c55e" icon="✅" />
      <AnimatedCounter value={uniqueLocations} label="Locations" color="#f97316" icon="📍" />
    </div>
  );
});
