'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function AutoBookContent() {
  const searchParams = useSearchParams();
  const [indWindowOpened, setIndWindowOpened] = useState(false);

  // Get appointment details from URL
  const appointmentType = searchParams.get('type') || '';
  const location = searchParams.get('location') || '';
  const locationName = searchParams.get('locationName') || '';
  const date = searchParams.get('date') || '';
  const startTime = searchParams.get('startTime') || '';
  const endTime = searchParams.get('endTime') || '';
  const persons = searchParams.get('persons') || '1';

  // Booking URLs for each appointment type
  const bookingUrls: Record<string, string> = {
    'DOC': 'https://oap.ind.nl/oap/en/#/doc',
    'BIO': 'https://oap.ind.nl/oap/en/#/bio',
    'VAA': 'https://oap.ind.nl/oap/en/#/vaa',
    'TKV': 'https://oap.ind.nl/oap/en/#/tkv',
    'UKR': 'https://oap.ind.nl/oap/en/#/ukr',
    'FAM': 'https://oap.ind.nl/oap/en/#/fam'
  };

  // Get appointment type name
  const typeNames: Record<string, string> = {
    'DOC': 'Document Collection',
    'BIO': 'Biometric Appointment',
    'VAA': 'Return Visa Application',
    'TKV': 'Return Visa',
    'UKR': 'Ukraine Residence Permit',
    'FAM': 'Family Reunification'
  };

  // Parse date
  const appointmentDate = new Date(date);
  const dayNumber = appointmentDate.getDate();
  const monthName = appointmentDate.toLocaleDateString('en-US', { month: 'long' });
  const year = appointmentDate.getFullYear();

  const openIndPage = () => {
    const bookingUrl = bookingUrls[appointmentType];
    if (bookingUrl) {
      window.open(bookingUrl, 'ind_booking', 'width=1200,height=900');
      setIndWindowOpened(true);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link href="/" className="text-2xl font-bold text-blue-600">
            IND Appointments - Booking Helper
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">

          {/* Left Column - Appointment Details */}
          <div className="order-1">
            <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-4 sm:mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">
                Your Appointment
              </h2>

              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row">
                  <span className="font-semibold text-gray-700 sm:w-32 text-sm sm:text-base">Type:</span>
                  <span className="text-gray-900 text-sm sm:text-base break-words">{typeNames[appointmentType] || appointmentType}</span>
                </div>
                <div className="flex flex-col sm:flex-row">
                  <span className="font-semibold text-gray-700 sm:w-32 text-sm sm:text-base">Location:</span>
                  <span className="text-gray-900 text-sm sm:text-base break-words">{locationName}</span>
                </div>
                <div className="flex flex-col sm:flex-row">
                  <span className="font-semibold text-gray-700 sm:w-32 text-sm sm:text-base">Date:</span>
                  <span className="text-gray-900 text-sm sm:text-base">{monthName} {dayNumber}, {year}</span>
                </div>
                <div className="flex flex-col sm:flex-row">
                  <span className="font-semibold text-gray-700 sm:w-32 text-sm sm:text-base">Time:</span>
                  <span className="text-gray-900 text-sm sm:text-base">{startTime} - {endTime}</span>
                </div>
                <div className="flex flex-col sm:flex-row">
                  <span className="font-semibold text-gray-700 sm:w-32 text-sm sm:text-base">Persons:</span>
                  <span className="text-gray-900 text-sm sm:text-base">{persons}</span>
                </div>
              </div>
            </div>

            {/* Warning Box */}
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 dark:border-yellow-500 p-6 rounded-lg mb-6">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-200 mb-2">
                    Act Fast!
                  </h3>
                  <p className="text-yellow-800 dark:text-yellow-300 text-sm">
                    This appointment time may be taken by someone else at any moment. Complete the booking as quickly as possible!
                  </p>
                </div>
              </div>
            </div>

            {/* Action Button */}
            {!indWindowOpened ? (
              <button
                onClick={openIndPage}
                className="w-full px-6 py-4 bg-blue-600 text-white text-base sm:text-lg font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-lg min-h-[44px]"
              >
                Open IND Booking Page →
              </button>
            ) : (
              <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-lg">
                <div className="flex items-center">
                  <svg className="h-5 w-5 text-green-600 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-green-800 font-medium text-sm sm:text-base">
                    IND page opened! Follow the instructions →
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Instructions */}
          <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 order-2">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6">
              Step-by-Step Instructions
            </h2>

            <div className="space-y-5 sm:space-y-6">
              {/* Step 1 */}
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm sm:text-base">
                  1
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 mb-1 text-sm sm:text-base">Select Location</h3>
                  <p className="text-gray-600 text-xs sm:text-sm mb-2">In the dropdown menu, select:</p>
                  <div className="bg-blue-50 px-3 py-2 rounded border border-blue-200 overflow-x-auto">
                    <code className="text-blue-900 font-mono text-xs sm:text-sm font-semibold break-all">{locationName}</code>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                  2
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Set Number of Persons</h3>
                  <p className="text-gray-600 text-sm mb-2">Use the + or - buttons to set persons to:</p>
                  <div className="bg-blue-50 px-3 py-2 rounded border border-blue-200 inline-block">
                    <code className="text-blue-900 font-mono text-sm font-semibold">{persons}</code>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                  3
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Navigate to Correct Month</h3>
                  <p className="text-gray-600 text-sm mb-2">Use the ← and → arrows to navigate to:</p>
                  <div className="bg-blue-50 px-3 py-2 rounded border border-blue-200">
                    <code className="text-blue-900 font-mono text-sm font-semibold">{monthName} {year}</code>
                  </div>
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                  4
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Click the Date</h3>
                  <p className="text-gray-600 text-sm mb-2">In the calendar, click on day:</p>
                  <div className="bg-blue-50 px-3 py-2 rounded border border-blue-200 inline-block">
                    <code className="text-blue-900 font-mono text-2xl font-bold">{dayNumber}</code>
                  </div>
                </div>
              </div>

              {/* Step 5 */}
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                  5
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Select Time Slot</h3>
                  <p className="text-gray-600 text-sm mb-2">From the time dropdown, select:</p>
                  <div className="bg-blue-50 px-3 py-2 rounded border border-blue-200">
                    <code className="text-blue-900 font-mono text-sm font-semibold">{startTime} - {endTime}</code>
                  </div>
                  <p className="text-yellow-700 text-xs mt-2">
                    ⚠️ If this exact time is unavailable, choose any available time slot
                  </p>
                </div>
              </div>

              {/* Step 6 */}
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                  6
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Proceed to Details</h3>
                  <p className="text-gray-600 text-sm">
                    Click the <span className="font-semibold">\"To details ›\"</span> button
                  </p>
                </div>
              </div>

              {/* Step 7 */}
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">
                  7
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Complete Your Booking</h3>
                  <p className="text-gray-600 text-sm">
                    Fill in your personal information and confirm the booking
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Back Link */}
        <div className="mt-8 text-center">
          <Link href="/" className="text-blue-600 hover:text-blue-700 font-medium">
            ← Back to Appointments
          </Link>
        </div>
      </main>
    </div>
  );
}

export default function AutoBookPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AutoBookContent />
    </Suspense>
  );
}
