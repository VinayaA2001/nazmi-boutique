"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { postJSON } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function LoginClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const redirect = sp.get("redirect") || "/account";
  const { login, resendVerification } = useAuth();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [needsVerify, setNeedsVerify] = useState(false);

  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotMsg, setForgotMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setNeedsVerify(false);
    setBusy(true);
    try {
      await login(identifier, password);
      router.replace(redirect);
    } catch (e: any) {
      if (e?.code === "EMAIL_NOT_VERIFIED") {
        setNeedsVerify(true);
        setErr("Please verify your email to sign in.");
      } else {
        setErr(e?.message || "Invalid email or password");
      }
    } finally {
      setBusy(false);
    }
  }

  async function resendVerify() {
    try {
      await resendVerification(identifier.trim().toLowerCase());
      setErr("Verification email sent. Please check your inbox.");
    } catch (e: any) {
      setErr(e?.message || "Failed to resend verification email");
    }
  }

  async function sendForgot() {
    setForgotMsg(null);
    try {
      await postJSON(`/api/auth/forgot-password`, { email: forgotEmail });
      setForgotMsg("If an account exists, a reset link has been sent to your email.");
    } catch (e: any) {
      setForgotMsg(e?.message || "Unable to send reset link");
    }
  }

  return (
    <div className="min-h-screen flex items-start justify-center bg-gray-50 pt-16 px-4">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <h1 className="text-2xl font-bold mb-1 text-center">Sign in to Nazmi Boutique</h1>
        <p className="text-sm text-gray-600 text-center mb-6">Use your email</p>

        {err && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-3 py-2 mb-2">
            {err}
          </div>
        )}
        {needsVerify && (
          <p className="text-sm text-gray-700 mb-4">
            Didn&apos;t get it? <button type="button" onClick={resendVerify} className="underline">Resend verification email</button>
          </p>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="you@example.com"
              className="mt-1 w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
              autoComplete="username"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-black text-white py-3 rounded-lg font-semibold hover:bg-gray-800 disabled:opacity-60"
          >
            {busy ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="flex items-center justify-between mt-4 text-sm">
          <button onClick={() => setForgotOpen(true)} className="text-black underline">
            Forgot password?
          </button>
          <button onClick={() => router.push("/auth/register")} className="text-gray-700 hover:text-black">
            Don&apos;t have an account? <span className="underline">Create one here</span>
          </button>
        </div>
      </div>

      {forgotOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-md rounded-xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Reset your password</h3>
              <button onClick={() => setForgotOpen(false)} className="text-2xl leading-none">×</button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Enter your account email. We&apos;ll send a reset link if an account exists.
            </p>
            <input
              type="email"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent mb-3"
            />
            <button onClick={sendForgot} className="w-full bg-black text-white py-3 rounded-lg font-semibold hover:bg-gray-800">
              Send reset link
            </button>
            {forgotMsg && <p className="text-sm text-center mt-3">{forgotMsg}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
