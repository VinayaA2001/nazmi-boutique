"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";

/* Helpers */
const isEmail = (s: string) => /^\S+@\S+\.\S+$/.test(s.trim());
const normEmail = (s: string) => s.trim().toLowerCase();
const looksLikePhone = (s: string) => {
  const digits = s.trim().replace(/[^\d]/g, "");
  return digits.length >= 10 && digits.length <= 15;
};
const normPhone = (s: string) => {
  const raw = s.trim();
  const keptPlus = raw.startsWith("+") ? "+" : "";
  const digits = raw.replace(/[^\d]/g, "");
  return keptPlus + digits;
};

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [idErr, setIdErr] = useState("");
  const [pwdErr, setPwdErr] = useState("");
  const [loading, setLoading] = useState(false);

  const identifierType: "email" | "phone" | "invalid" = useMemo(() => {
    if (!emailOrPhone.trim()) return "invalid";
    if (isEmail(emailOrPhone)) return "email";
    if (looksLikePhone(emailOrPhone)) return "phone";
    return "invalid";
  }, [emailOrPhone]);

  const canSubmit =
    !loading &&
    password.length >= 6 &&
    identifierType !== "invalid";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setIdErr(""); setPwdErr("");

    if (identifierType === "invalid") {
      setIdErr("Enter a valid email address or phone number");
      return;
    }
    if (password.length < 6) {
      setPwdErr("Password must be at least 6 characters");
      return;
    }

    const identifier =
      identifierType === "email"
        ? normEmail(emailOrPhone)
        : normPhone(emailOrPhone);

    try {
      setLoading(true);
      await login(identifier, password);
      router.push("/account");
    } catch (err: any) {
      const field = err?.field;
      const msg = err?.message || "Login failed";
      if (field === "emailOrPhone") setIdErr(msg);
      else if (field === "password") setPwdErr(msg);
      else setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-amber-600 rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-lg">N</span>
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Sign in to Nazmi Boutique
          </h2>
          <p className="mt-2 text-sm text-gray-600">Use your email or phone number</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit} noValidate>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="emailOrPhone" className="block text-sm font-medium text-gray-700 mb-1">
              Email or Phone Number
            </label>
            <input
              id="emailOrPhone"
              type="text"
              value={emailOrPhone}
              onChange={(e) => setEmailOrPhone(e.target.value)}
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                idErr ? "border-red-300" : "border-gray-300"
              }`}
              placeholder="user@example.com or +91 98765 43210"
            />
            {idErr && <p className="mt-1 text-sm text-red-600">{idErr}</p>}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                pwdErr ? "border-red-300" : "border-gray-300"
              }`}
              placeholder="Enter your password"
            />
            {pwdErr && <p className="mt-1 text-sm text-red-600">{pwdErr}</p>}
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full bg-amber-600 text-white py-3 px-4 rounded-lg hover:bg-amber-700 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>

          <div className="text-center">
            <p className="text-sm text-gray-600">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="font-medium text-amber-600 hover:text-amber-500">
                Create one here
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
