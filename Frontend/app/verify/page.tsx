"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

export default function VerifyPage() {
  return (
    <Suspense fallback={<VerifyFallback />}>
      <VerifyContent />
    </Suspense>
  );
}

function VerifyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { verifyEmail, resendVerification } = useAuth();
  const verifyEmailRef = useRef(verifyEmail);

  useEffect(() => {
    verifyEmailRef.current = verifyEmail;
  }, [verifyEmail]);

  const initialToken = searchParams.get("token") || "";
  const [token, setToken] = useState(initialToken);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!initialToken) return;
    setToken(initialToken);
    setSuccess("Verifying link...");
    setError(null);
    setLoading(true);
    (async () => {
      try {
        await verifyEmailRef.current(initialToken);
        setSuccess("Email verified! You're all set.");
        router.push("/account");
      } catch (err: any) {
        setSuccess(null);
        setError(err?.message || "Verification failed");
      } finally {
        setLoading(false);
      }
    })();
  }, [initialToken, router]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await verifyEmailRef.current(token.trim());
      setSuccess("Email verified! You can now continue to your account.");
    } catch (err: any) {
      setError(err?.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setResending(true);
    try {
      await resendVerification(email.trim().toLowerCase());
      setSuccess("Verification email sent. Please check your inbox.");
    } catch (err: any) {
      setError(err?.message || "Unable to resend verification email");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-amber-600 rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-lg">N</span>
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">Verify Your Email</h2>
          <p className="mt-2 text-sm text-gray-600">
            Enter the code from your email or use the link we sent you.
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

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Enter Verification Code</h3>
            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label htmlFor="token" className="block text-sm font-medium text-gray-700 mb-1">
                  Email Verification Code
                </label>
                <input
                  id="token"
                  type="text"
                  required
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  placeholder="Paste code from email"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-amber-600 text-white py-2 px-4 rounded-lg hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
              >
                {loading ? "Verifying..." : "Verify email"}
              </button>
            </form>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Need a new link?</h3>
            <form onSubmit={handleResend} className="space-y-4">
              <div>
                <label htmlFor="resendEmail" className="block text-sm font-medium text-gray-700 mb-1">
                  Email address
                </label>
                <input
                  id="resendEmail"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  placeholder="you@example.com"
                />
              </div>
              <button
                type="submit"
                disabled={resending}
                className="w-full bg-gray-900 text-white py-2 px-4 rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
              >
                {resending ? "Sending..." : "Resend verification email"}
              </button>
            </form>
          </div>

          <div className="text-center text-sm text-gray-600">
            <p>
              Need help? <Link className="underline" href="/contact">Contact support</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function VerifyFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-500">Preparing verification page...</p>
    </div>
  );
}
