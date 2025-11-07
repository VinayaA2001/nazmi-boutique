// app/(auth)/forgot-password/page.tsx  (or your current path)
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

const RAW_API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const API_BASE = RAW_API.replace(/\/+$/, ""); // trim trailing slash

type Health = {
  status: "healthy" | "unhealthy" | string;
  service?: string;
  database?: "connected" | "disconnected";
  razorpay?: "configured" | "not configured";
  timestamp?: string;
};

export default function ForgotPasswordClient() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline">("checking");
  const abortRef = useRef<AbortController | null>(null);

  /* ---------- Health check (runs once) ---------- */
  useEffect(() => {
    const ac = new AbortController();
    abortRef.current = ac;

    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/health`, { signal: ac.signal, cache: "no-store" });
        if (r.ok) {
          const h = (await r.json()) as Health;
          setBackendStatus(h?.status === "healthy" ? "online" : "offline");
        } else {
          setBackendStatus("offline");
        }
      } catch {
        setBackendStatus("offline");
      }
    })();

    return () => ac.abort();
  }, []);

  const emailValid = useMemo(() => /\S+@\S+\.\S+/.test(email.trim()), [email]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    setMessage("");
    setError("");

    if (!email.trim()) {
      setError("Email is required");
      return;
    }
    if (!emailValid) {
      setError("Please enter a valid email address");
      return;
    }

    setLoading(true);
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      if (backendStatus === "offline") {
        // Demo fallback if backend is down
        await new Promise((res) => setTimeout(res, 600));
        setMessage("Demo mode: If an account exists, a reset link would be sent.");
        setEmail("");
        return;
      }

      const resp = await fetch(`/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
        signal: ac.signal,
      });

      const data = await resp.json().catch(() => ({} as any));

      // Flask code returns 200 with message regardless of user existence (safe)
      if (resp.ok) {
        // Show message; also surface reset_link when DEBUG=true on server (dev convenience)
        setMessage(
          data?.message ||
            "If an account with that email exists, reset instructions have been sent."
        );
        if (data?.reset_link) {
          setMessage(
            (data?.message || "Password reset link (dev): ") + `\n${data.reset_link}`
          );
        }
        setEmail("");
        return;
      }

      // Common error shapes
      if (resp.status === 429) {
        setError(data?.message || "Too many attempts. Please try again later.");
      } else if (resp.status === 400) {
        setError(data?.message || "Invalid request. Please check the email and try again.");
      } else if (resp.status >= 500) {
        setError("Server error. Please try again later.");
      } else {
        setError(data?.message || "Failed to send reset instructions. Please try again.");
      }
    } catch (err) {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block mb-6">
            <div className="w-16 h-16 bg-gradient-to-r from-amber-600 to-orange-600 rounded-full flex items-center justify-center mx-auto shadow-lg">
              <span className="text-white font-bold text-2xl">N</span>
            </div>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Reset Your Password</h1>
          <p className="text-gray-600 text-sm">
            Enter your email address and we&apos;ll send you instructions to reset your password.
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
          {/* Backend Status */}
          {backendStatus !== "checking" && (
            <div
              className={`mb-6 p-3 rounded-lg text-center text-sm ${
                backendStatus === "online"
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-yellow-50 text-yellow-700 border border-yellow-200"
              }`}
            >
              {backendStatus === "online" ? "✅ Backend Connected" : "🔄 Backend offline – Using Demo Mode"}
            </div>
          )}

          {/* Success */}
          {message && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg whitespace-pre-wrap">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-green-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-green-700 text-sm">{message}</p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-red-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit} noValidate>
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError("");
                  }}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent transition-colors hover:border-gray-400 ${
                    email && !emailValid ? "border-red-300 focus:ring-red-300" : "border-gray-300 focus:ring-amber-500"
                  }`}
                  placeholder="you@example.com"
                  required
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                  </svg>
                </div>
              </div>
              {email && !emailValid && (
                <p className="mt-2 text-xs text-red-600">Please enter a valid email address.</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-amber-600 to-orange-600 text-white py-4 px-6 rounded-lg font-semibold hover:from-amber-700 hover:to-orange-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-3 shadow-lg hover:shadow-xl"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Sending Instructions...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Send Reset Instructions
                </>
              )}
            </button>
          </form>

          {/* Back to Login */}
          <div className="mt-6 text-center">
            <p className="text-gray-600 text-sm">
              Remember your password?{" "}
              <Link href="/login" className="font-semibold text-amber-600 hover:text-amber-700 underline">
                Back to Sign In
              </Link>
            </p>
          </div>
        </div>

        {/* Security Badges */}
        <div className="mt-8 grid grid-cols-2 gap-4 text-center">
          <div className="text-xs text-gray-600 p-3 bg-white rounded-lg border border-gray-200">
            <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-1">
              <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            Secure Process
          </div>
          <div className="text-xs text-gray-600 p-3 bg-white rounded-lg border border-gray-200">
            <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-1">
              <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.618 5.984A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016zM12 9v2m0 4h.01" />
              </svg>
            </div>
            Encrypted
          </div>
        </div>
      </div>
    </section>
  );
}
