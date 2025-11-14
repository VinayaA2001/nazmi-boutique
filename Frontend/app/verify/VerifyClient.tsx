"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function VerifyClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const { verifyEmail, resendVerification } = useAuth();

  const [tokenInput, setTokenInput] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const tokenFromURL = useMemo(() => (sp.get("token") || "").trim(), [sp]);

  useEffect(() => {
    if (!tokenFromURL) return;
    (async () => {
      setBusy(true);
      try {
        await verifyEmail(tokenFromURL);
        router.replace("/account");
      } catch (e: any) {
        setErr(e?.message || "Verification failed");
      } finally {
        setBusy(false);
      }
    })();
  }, [tokenFromURL, verifyEmail, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await verifyEmail(tokenInput.trim());
      router.replace("/account");
    } catch (e: any) {
      setErr(e?.message || "Verification failed");
    } finally {
      setBusy(false);
    }
  }

  async function resend(email: string) {
    try {
      await resendVerification(email.trim().toLowerCase());
      setInfo("Verification email sent. Please check your inbox.");
    } catch (e: any) {
      setErr(e?.message || "Failed to resend verification email");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <h1 className="text-2xl font-bold mb-2">Verify your email</h1>
        <p className="text-sm text-gray-600 mb-4">
          Paste your verification token here. If you opened this from email, it may verify automatically.
        </p>

        {err && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-3 mb-3">{err}</div>}
        {info && <div className="bg-blue-50 border border-blue-200 text-blue-700 text-sm rounded-md p-3 mb-3">{info}</div>}

        <form onSubmit={onSubmit} className="space-y-3">
          <input
            className="border rounded-lg p-3 w-full"
            placeholder="Verification token"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
          />
          <button
            type="submit"
            disabled={busy || !tokenInput.trim()}
            className="w-full bg-black text-white py-3 rounded-lg font-semibold disabled:opacity-60"
          >
            {busy ? "Verifying..." : "Verify"}
          </button>
        </form>

        <div className="text-sm text-gray-700 mt-4">
          Didn&apos;t get the email? You can go back to the login page and resend from there, or
          <button
            className="underline ml-1"
            onClick={() => {
              const email = prompt("Enter your account email to resend verification:") || "";
              if (email) resend(email);
            }}
          >
            click here to resend
          </button>.
        </div>
      </div>
    </div>
  );
}
