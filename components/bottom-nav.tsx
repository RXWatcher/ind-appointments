'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function BottomNav({ user }: { user: any }) {
  const pathname = usePathname();
  if (!user) return null;

  const links = [
    { href: '/', label: 'Home', icon: '🏠', activeIcon: '🏠' },
    { href: '/preferences', label: 'Alerts', icon: '🔔', activeIcon: '🔔' },
    { href: '/autobook', label: 'Book', icon: '📅', activeIcon: '📅' },
    { href: '/settings', label: 'Settings', icon: '⚙️', activeIcon: '⚙️' },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 glass-card rounded-none border-t border-gray-200/50 dark:border-gray-700/50 md:hidden"
         style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
         aria-label="Main navigation">
      <div className="flex justify-around">
        {links.map(link => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex flex-col items-center py-2 px-3 min-h-[52px] min-w-[52px] transition-colors ${
                isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="text-xl leading-none">{isActive ? link.activeIcon : link.icon}</span>
              <span className="text-[10px] font-medium mt-0.5">{link.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
