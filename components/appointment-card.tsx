'use client';

import { useState, memo, useCallback } from 'react';

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

function getUrgencyConfig(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return {
    border: 'border-l-4 border-l-red-500',
    badge: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    badgeText: '🔥 TODAY',
    glow: 'shadow-red-200/50 dark:shadow-red-900/30',
  };
  if (diffDays === 1) return {
    border: 'border-l-4 border-l-orange-500',
    badge: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    badgeText: '⚡ TOMORROW',
    glow: 'shadow-orange-200/40 dark:shadow-orange-900/20',
  };
  if (diffDays <= 3) return {
    border: 'border-l-4 border-l-yellow-500',
    badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    badgeText: `📅 ${diffDays} days`,
    glow: '',
  };
  if (diffDays <= 7) return {
    border: 'border-l-4 border-l-blue-400',
    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    badgeText: 'This week',
    glow: '',
  };
  return {
    border: 'border-l-4 border-l-gray-300 dark:border-l-gray-600',
    badge: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    badgeText: `In ${diffDays} days`,
    glow: '',
  };
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
  });
}

function getDaysFromNow(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  return `In ${diffDays} days`;
}

interface AppointmentCardProps {
  appointment: Appointment;
  index: number;
  onBookNow: (appointment: Appointment) => void;
}

export const AppointmentCard = memo(function AppointmentCard({ appointment, index, onBookNow }: AppointmentCardProps) {
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const urgency = getUrgencyConfig(appointment.date);

  const copyDetails = useCallback(async () => {
    const details = `IND Appointment Details:\nType: ${appointment.appointment_type_name}\nLocation: ${appointment.location_name}\nDate: ${formatDate(appointment.date)}\nTime: ${appointment.start_time} - ${appointment.end_time}\nPersons: ${appointment.persons}`;
    try {
      await navigator.clipboard.writeText(details);
      setCopiedId(appointment.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      // Silently fail - clipboard may not be available
    }
  }, [appointment]);

  return (
    <article
      role="article"
      aria-label={`${appointment.appointment_type_name} at ${appointment.location_name} on ${formatDate(appointment.date)}`}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onBookNow(appointment); } }}
      className={`glass-card glass-card-hover ${urgency.border} ${urgency.glow} p-4 sm:p-5 animate-fade-in-up`}
      style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Urgency + Type badges */}
          <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${urgency.badge}`}>
              {urgency.badgeText}
            </span>
            {appointment.location === 'THIC' ? (
              <>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">DOC</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">BIO</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">VAA</span>
              </>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 max-w-[150px] sm:max-w-none truncate">
                {appointment.appointment_type === 'VAA' ? 'Residence Sticker' : appointment.appointment_type_name}
              </span>
            )}
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 max-w-[160px] sm:max-w-none truncate">
              📍 {appointment.location_name}
            </span>
            {appointment.persons > 1 && (
              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                👥 {appointment.persons}
              </span>
            )}
          </div>

          {/* Date / Time / Countdown */}
          <div className="grid grid-cols-3 gap-2 mt-2">
            <div>
              <div className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</div>
              <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">{formatDate(appointment.date)}</div>
            </div>
            <div>
              <div className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">Time</div>
              <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">{appointment.start_time} - {appointment.end_time}</div>
            </div>
            <div>
              <div className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">When</div>
              <div className="font-semibold text-sm text-purple-600 dark:text-purple-400">{getDaysFromNow(appointment.date)}</div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 w-full sm:w-auto sm:flex-col sm:items-end">
          <button
            onClick={copyDetails}
            className="flex-shrink-0 px-3 py-2.5 sm:py-2 bg-gray-200/80 dark:bg-gray-700/80 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 active:bg-gray-400 transition-colors min-h-[44px] flex items-center justify-center gap-1"
            title="Copy appointment details"
            aria-label="Copy appointment details"
          >
            {copiedId === appointment.id ? (
              <><svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg><span className="text-green-600 text-xs">Copied</span></>
            ) : (
              <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg><span className="text-xs">Copy</span></>
            )}
          </button>
          <a
            href={`/api/appointments/ical?id=${appointment.id}`}
            className="flex-shrink-0 px-3 py-2.5 sm:py-2 bg-gray-200/80 dark:bg-gray-700/80 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 active:bg-gray-400 transition-colors min-h-[44px] flex items-center justify-center gap-1"
            title="Add to calendar"
            aria-label="Add to calendar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            <span className="text-xs">Cal</span>
          </a>
          <button
            onClick={() => onBookNow(appointment)}
            className="flex-1 sm:flex-initial px-4 py-2.5 sm:py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 active:bg-blue-800 whitespace-nowrap transition-colors min-h-[44px]"
            title="Opens IND booking page"
            aria-label={`Book ${appointment.appointment_type_name} at ${appointment.location_name}`}
          >
            Book Now →
          </button>
        </div>
      </div>
    </article>
  );
});

// Display name for debugging
AppointmentCard.displayName = 'AppointmentCard';
