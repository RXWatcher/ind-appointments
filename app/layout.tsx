import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "IND Appointments Tracker",
  description: "Track and get notified about available IND appointments in the Netherlands",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "IND Tracker",
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    siteName: "IND Appointments Tracker",
    title: "IND Appointments Tracker",
    description: "Track and get notified about available IND appointments in the Netherlands",
  },
  twitter: {
    card: "summary",
    title: "IND Appointments Tracker",
    description: "Track and get notified about available IND appointments in the Netherlands",
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#1e40af' },
    { media: '(prefers-color-scheme: dark)', color: '#1e3a8a' },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            "name": "IND Appointments Tracker",
            "description": "Track available IND appointments across the Netherlands",
            "applicationCategory": "UtilityApplication",
            "operatingSystem": "Any",
          })
        }} />
      </head>
      <body className="h-full antialiased">
        {/* Skip navigation */}
        <a href="#main-content"
           className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100]
                      focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg">
          Skip to main content
        </a>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
        <script dangerouslySetInnerHTML={{
          __html: `
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js').then(
                  function(r) { console.log('SW registered:', r.scope); },
                  function(e) { console.log('SW registration failed:', e); }
                );
              });
            }
          `,
        }} />
      </body>
    </html>
  );
}
