// app/verify/page.tsx
"use client";

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function VerifyPage() {
  const [emailToken, setEmailToken] = useState('');
  const [phoneToken, setPhoneToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resending, setResending] = useState({ email: false, phone: false });

  const { verifyEmail, verifyPhone, resendVerification } = useAuth();
  const router = useRouter();

  const handleEmailVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await verifyEmail(emailToken);
      setSuccess('Email verified successfully!');
      setEmailToken('');
    } catch (err: any) {
      setError(err.message || 'Email verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await verifyPhone(phoneToken);
      setSuccess('Phone verified successfully!');
      setPhoneToken('');
    } catch (err: any) {
      setError(err.message || 'Phone verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async (type: 'email' | 'phone', identifier: string) => {
    setResending(prev => ({ ...prev, [type]: true }));
    setError('');

    try {
      await resendVerification(type, identifier);
      setSuccess(`Verification code sent to your ${type}`);
    } catch (err: any) {
      setError(err.message || `Failed to send ${type} verification`);
    } finally {
      setResending(prev => ({ ...prev, [type]: false }));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-amber-600 rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-lg">N</span>
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Verify Your Account
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Please verify your email and phone to complete registration
          </p>
        </div>

        <div className="mt-8 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}
          
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-lg text-sm">
              {success}
            </div>
          )}

          {/* Email Verification */}
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Verify Email Address</h3>
            <form onSubmit={handleEmailVerify} className="space-y-4">
              <div>
                <label htmlFor="emailToken" className="block text-sm font-medium text-gray-700 mb-1">
                  Email Verification Code
                </label>
                <input
                  id="emailToken"
                  type="text"
                  required
                  value={emailToken}
                  onChange={(e) => setEmailToken(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  placeholder="Enter code from email"
                />
              </div>
              <div className="flex space-x-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-amber-600 text-white py-2 px-4 rounded-lg hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
                >
                  Verify Email
                </button>
                <button
                  type="button"
                  onClick={() => handleResend('email', 'user-email')}
                  disabled={resending.email}
                  className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
                >
                  {resending.email ? 'Sending...' : 'Resend Code'}
                </button>
              </div>
            </form>
          </div>

          {/* Phone Verification */}
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Verify Phone Number</h3>
            <form onSubmit={handlePhoneVerify} className="space-y-4">
              <div>
                <label htmlFor="phoneToken" className="block text-sm font-medium text-gray-700 mb-1">
                  SMS Verification Code
                </label>
                <input
                  id="phoneToken"
                  type="text"
                  required
                  value={phoneToken}
                  onChange={(e) => setPhoneToken(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  placeholder="Enter code from SMS"
                />
              </div>
              <div className="flex space-x-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-amber-600 text-white py-2 px-4 rounded-lg hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
                >
                  Verify Phone
                </button>
                <button
                  type="button"
                  onClick={() => handleResend('phone', 'user-phone')}
                  disabled={resending.phone}
                  className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
                >
                  {resending.phone ? 'Sending...' : 'Resend SMS'}
                </button>
              </div>
            </form>
          </div>

          <div className="text-center">
            <button
              onClick={() => router.push('/account')}
              className="text-amber-600 hover:text-amber-500 font-medium"
            >
              Skip verification for now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}