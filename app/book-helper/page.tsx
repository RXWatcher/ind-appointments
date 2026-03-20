'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getAppointmentType, getLocation } from '@/lib/appointment-data';

function BookHelperContent() {
  const searchParams = useSearchParams();
  const [bookingWindow, setBookingWindow] = useState<Window | null>(null);

  const type = searchParams.get('type') || '';
  const location = searchParams.get('location') || '';
  const locationName = searchParams.get('locationName') || '';
  const date = searchParams.get('date') || '';
  const startTime = searchParams.get('startTime') || '';
  const endTime = searchParams.get('endTime') || '';
  const persons = searchParams.get('persons') || '1';

  const appointmentType = getAppointmentType(type);
  const locationData = getLocation(location);

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const getDayOfMonth = (dateString: string) => {
    return new Date(dateString).getDate();
  };

  const handleOpenBooking = () => {
    const bookingUrl = appointmentType?.bookingUrl || 'https://oap.ind.nl/oap/';
    const newWindow = window.open(bookingUrl, '_blank', 'width=1200,height=800');
    setBookingWindow(newWindow);
  };

  const copyInstructions = () => {
    const instructions = `IND Appointment Booking Instructions:

1. Select Location: ${locationName}
2. Set Persons: ${persons}
3. Click on Date: ${getDayOfMonth(date)} (${formatDate(date)})
4. Select Time: ${startTime} - ${endTime}
5. Click "To details ›"
6. Fill in your personal information
7. Confirm your appointment`;

    navigator.clipboard.writeText(instructions);
    alert('Instructions copied to clipboard!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <Link href="/" className="text-2xl font-bold text-blue-600">
              IND Appointments
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 sm:p-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">
            Booking Assistant
          </h1>

          <div className="bg-blue-50 border-l-4 border-blue-600 p-6 mb-8">
            <h2 className="text-xl font-semibold text-blue-900 mb-4">
              Your Appointment Details:
            </h2>
            <div className="space-y-3 text-blue-900 dark:text-blue-200">
              <div className="flex items-start">
                <span className="font-medium min-w-[140px]">Type:</span>
                <span>{appointmentType?.label}</span>
              </div>
              <div className="flex items-start">
                <span className="font-medium min-w-[140px]">Location:</span>
                <span>{locationName}</span>
              </div>
              <div className="flex items-start">
                <span className="font-medium min-w-[140px]">Date:</span>
                <span>{formatDate(date)}</span>
              </div>
              <div className="flex items-start">
                <span className="font-medium min-w-[140px]">Time:</span>
                <span>{startTime} - {endTime}</span>
              </div>
              <div className="flex items-start">
                <span className="font-medium min-w-[140px]">Persons:</span>
                <span>{persons}</span>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-600 dark:border-yellow-600 p-6 mb-8">
            <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-100 mb-3">
              Important: Complete booking within 15 minutes
            </h3>
            <p className="text-yellow-800 dark:text-yellow-200">
              Once you start the booking process, you have 15 minutes to complete it. Make sure you have your V-number, BSN, and contact information ready.
            </p>
          </div>

          <div className="space-y-6 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Step-by-Step Instructions:
            </h2>

            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                  1
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Select the location</h3>
                  <p className="text-gray-600 dark:text-gray-400">Choose: <span className="font-mono font-semibold">{locationName}</span></p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                  2
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Set number of persons</h3>
                  <p className="text-gray-600 dark:text-gray-400">Set to: <span className="font-mono font-semibold">{persons}</span></p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                  3
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Click on the date</h3>
                  <p className="text-gray-600 dark:text-gray-400">Click on day: <span className="font-mono font-semibold">{getDayOfMonth(date)}</span> ({formatDate(date)})</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                  4
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Select the time slot</h3>
                  <p className="text-gray-600 dark:text-gray-400">Choose: <span className="font-mono font-semibold">{startTime} - {endTime}</span></p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                  5
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Click &quot;To details &rsaquo;&quot;</h3>
                  <p className="text-gray-600 dark:text-gray-400">Proceed to the personal details form</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                  6
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Fill in your personal information</h3>
                  <p className="text-gray-600 dark:text-gray-400">Enter your email, phone, V-number, BSN (if known), and name</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">
                  7
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Confirm your appointment</h3>
                  <p className="text-gray-600 dark:text-gray-400">Review and submit your booking</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <button
              onClick={handleOpenBooking}
              className="flex-1 px-6 py-4 bg-blue-600 text-white text-base sm:text-lg rounded-lg hover:bg-blue-700 font-semibold transition-colors min-h-[44px]"
            >
              Open IND Booking Page →
            </button>
            <button
              onClick={copyInstructions}
              className="sm:flex-shrink-0 px-6 py-4 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-medium transition-colors min-h-[44px]"
            >
              Copy Instructions
            </button>
          </div>

          <div className="mt-6 text-center">
            <Link href="/" className="text-blue-600 hover:text-blue-700 dark:hover:text-blue-400">
              ← Back to Appointments
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function BookHelperPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <BookHelperContent />
    </Suspense>
  );
}
