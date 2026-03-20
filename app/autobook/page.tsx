'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function AutoBookContent() {
  const searchParams = useSearchParams();
  const [currentStep, setCurrentStep] = useState(0);
  const [copiedValues, setCopiedValues] = useState<Record<string, boolean>>({});

  const appointmentType = searchParams.get('type') || '';
  const location = searchParams.get('location') || '';
  const locationName = searchParams.get('locationName') || '';
  const date = searchParams.get('date') || '';
  const startTime = searchParams.get('startTime') || '';
  const endTime = searchParams.get('endTime') || '';
  const persons = searchParams.get('persons') || '1';

  const bookingUrls: Record<string, string> = {
    'DOC': 'https://oap.ind.nl/oap/en/#/doc',
    'BIO': 'https://oap.ind.nl/oap/en/#/bio',
    'VAA': 'https://oap.ind.nl/oap/en/#/vaa',
    'TKV': 'https://oap.ind.nl/oap/en/#/tkv',
    'UKR': 'https://oap.ind.nl/oap/en/#/ukr',
    'FAM': 'https://oap.ind.nl/oap/en/#/fam'
  };

  const typeNames: Record<string, string> = {
    'DOC': 'Document Collection', 'BIO': 'Biometric Appointment',
    'VAA': 'Residence Endorsement Sticker', 'TKV': 'Return Visa',
    'UKR': 'Ukraine Residence Permit', 'FAM': 'Family Reunification'
  };

  const appointmentDate = new Date(date);
  const dayNumber = appointmentDate.getDate();
  const monthName = appointmentDate.toLocaleDateString('en-US', { month: 'long' });
  const year = appointmentDate.getFullYear();

  const copyValue = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedValues(prev => ({ ...prev, [key]: true }));
      setTimeout(() => setCopiedValues(prev => ({ ...prev, [key]: false })), 2000);
    } catch {}
  };

  const steps = [
    { title: 'Open IND Page', desc: 'Click the button below to open the booking page' },
    { title: 'Select Location', desc: `Choose: ${locationName}` },
    { title: 'Set Persons', desc: `Set to: ${persons}` },
    { title: 'Navigate to Month', desc: `Go to: ${monthName} ${year}` },
    { title: 'Click Date', desc: `Select day: ${dayNumber}` },
    { title: 'Select Time', desc: `Choose: ${startTime} - ${endTime}` },
    { title: 'Complete Booking', desc: 'Fill in your details and confirm' },
  ];

  const openIndPage = () => {
    const url = bookingUrls[appointmentType];
    if (url) {
      window.open(url, '_blank');
      setCurrentStep(1);
    }
  };

  const copyableValue = (value: string, valueKey: string) => (
    <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2.5 mt-2">
      <code className="flex-1 font-mono text-blue-900 dark:text-blue-100 text-sm font-semibold break-all">{value}</code>
      <button onClick={() => copyValue(valueKey, value)}
        className="flex-shrink-0 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 min-h-[36px] transition-colors"
      >
        {copiedValues[valueKey] ? '✓ Copied' : 'Copy'}
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-blue-700 to-purple-700" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link href="/" className="text-lg font-bold text-white flex items-center gap-2">
            <span>🇳🇱</span> Booking Helper
          </Link>
        </div>
      </header>

      <main id="main-content" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* Step progress (horizontal scroll on mobile) */}
        <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-2 -mx-1 px-1" role="progressbar" aria-valuenow={currentStep} aria-valuemin={0} aria-valuemax={steps.length - 1}>
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => setCurrentStep(i)}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all min-w-[32px] ${
                  currentStep > i ? 'bg-green-500 text-white' :
                  currentStep === i ? 'bg-blue-600 text-white ring-2 ring-blue-300' :
                  'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                }`}
                aria-label={`Step ${i + 1}: ${step.title}`}
              >
                {currentStep > i ? '✓' : i + 1}
              </button>
              {i < steps.length - 1 && (
                <div className={`w-6 h-0.5 ${currentStep > i ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          {/* Left: Appointment summary */}
          <div className="order-1">
            <div className="glass-card p-4 sm:p-5 mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3">Your Appointment</h2>
              <div className="space-y-2.5">
                {[
                  ['Type', typeNames[appointmentType] || appointmentType],
                  ['Location', locationName],
                  ['Date', `${monthName} ${dayNumber}, ${year}`],
                  ['Time', `${startTime} - ${endTime}`],
                  ['Persons', persons],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-gray-700 last:border-0">
                    <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Warning */}
            <div className="glass-card border-l-4 border-l-yellow-500 p-4 mb-4">
              <div className="flex items-start gap-3">
                <span className="text-xl flex-shrink-0">⚡</span>
                <div>
                  <h3 className="text-sm font-semibold text-yellow-900 dark:text-yellow-200">Act Fast!</h3>
                  <p className="text-xs text-yellow-800 dark:text-yellow-300 mt-0.5">This slot may be taken at any moment. Complete the booking ASAP!</p>
                </div>
              </div>
            </div>

            {/* Main CTA */}
            {currentStep === 0 ? (
              <button onClick={openIndPage}
                className="w-full px-6 py-4 bg-blue-600 text-white text-base font-semibold rounded-xl hover:bg-blue-700 active:bg-blue-800 transition-all shadow-lg shadow-blue-500/25 min-h-[52px]">
                Open IND Booking Page →
              </button>
            ) : (
              <div className="glass-card border-l-4 border-l-green-500 p-4 flex items-center gap-3">
                <span className="text-green-600 text-xl">✅</span>
                <span className="text-sm font-medium text-green-800 dark:text-green-200">IND page opened! Follow the steps →</span>
              </div>
            )}
          </div>

          {/* Right: Steps */}
          <div className="glass-card p-4 sm:p-5 order-2">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Step-by-Step</h2>
            <div className="space-y-4">
              {/* Step 1: Location */}
              <div className={`flex items-start gap-3 ${currentStep >= 1 ? '' : 'opacity-50'}`}>
                <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${currentStep > 1 ? 'bg-green-500 text-white' : currentStep === 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                  {currentStep > 1 ? '✓' : '1'}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">Select Location</h3>
                  {copyableValue(locationName, "location")}
                  {currentStep === 1 && <button onClick={() => setCurrentStep(2)} className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium">Done → Next step</button>}
                </div>
              </div>

              {/* Step 2: Persons */}
              <div className={`flex items-start gap-3 ${currentStep >= 2 ? '' : 'opacity-50'}`}>
                <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${currentStep > 2 ? 'bg-green-500 text-white' : currentStep === 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                  {currentStep > 2 ? '✓' : '2'}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">Set Persons to <span className="text-blue-600 text-lg">{persons}</span></h3>
                  {currentStep === 2 && <button onClick={() => setCurrentStep(3)} className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium">Done → Next step</button>}
                </div>
              </div>

              {/* Step 3: Month */}
              <div className={`flex items-start gap-3 ${currentStep >= 3 ? '' : 'opacity-50'}`}>
                <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${currentStep > 3 ? 'bg-green-500 text-white' : currentStep === 3 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                  {currentStep > 3 ? '✓' : '3'}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">Navigate to <span className="text-blue-600">{monthName} {year}</span></h3>
                  <p className="text-xs text-gray-500 mt-0.5">Use ← and → arrows in the calendar</p>
                  {currentStep === 3 && <button onClick={() => setCurrentStep(4)} className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium">Done → Next step</button>}
                </div>
              </div>

              {/* Step 4: Day */}
              <div className={`flex items-start gap-3 ${currentStep >= 4 ? '' : 'opacity-50'}`}>
                <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${currentStep > 4 ? 'bg-green-500 text-white' : currentStep === 4 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                  {currentStep > 4 ? '✓' : '4'}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">Click day <span className="text-blue-600 text-2xl font-bold">{dayNumber}</span></h3>
                  {currentStep === 4 && <button onClick={() => setCurrentStep(5)} className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium">Done → Next step</button>}
                </div>
              </div>

              {/* Step 5: Time */}
              <div className={`flex items-start gap-3 ${currentStep >= 5 ? '' : 'opacity-50'}`}>
                <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${currentStep > 5 ? 'bg-green-500 text-white' : currentStep === 5 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                  {currentStep > 5 ? '✓' : '5'}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">Select Time</h3>
                  {copyableValue(`${startTime} - ${endTime}`, "time")}
                  <p className="text-[11px] text-yellow-700 dark:text-yellow-400 mt-1">⚠️ If unavailable, pick any slot</p>
                  {currentStep === 5 && <button onClick={() => setCurrentStep(6)} className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium">Done → Next step</button>}
                </div>
              </div>

              {/* Step 6: Complete */}
              <div className={`flex items-start gap-3 ${currentStep >= 6 ? '' : 'opacity-50'}`}>
                <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${currentStep >= 6 ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                  {currentStep >= 6 ? '✓' : '6'}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">Complete Booking</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Click &quot;To details &rsaquo;&quot; and fill in your information</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link href="/" className="text-sm text-blue-600 hover:text-blue-700 font-medium min-h-[44px] inline-flex items-center">← Back to Appointments</Link>
        </div>
      </main>
    </div>
  );
}

export default function AutoBookPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>}>
      <AutoBookContent />
    </Suspense>
  );
}
