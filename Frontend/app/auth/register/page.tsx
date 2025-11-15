// app/auth/register/page.tsx (or wherever this lives)
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[6-9]\d{9}$/;

export default function RegisterPage() {
  const { register } = useAuth();

  const [firstName, setFirst] = useState("");
  const [lastName, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPass] = useState("");
  const [confirmPassword, setConfirmPass] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const emailValid = useMemo(() => EMAIL_RE.test(email.trim()), [email]);
  const phoneValid = useMemo(
    () => !phone.trim() || PHONE_RE.test(phone.trim()),
    [phone]
  );
  const passwordValid = useMemo(() => password.length >= 8, [password]);

  const canSubmit =
    emailValid &&
    phoneValid &&
    passwordValid &&
    password === confirmPassword &&
    !!firstName.trim();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setSuccess(null);

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPhone = phone.trim();

    if (!emailValid) return setErr("Please enter a valid email"), undefined;
    if (!phoneValid) return setErr("Please enter a valid 10-digit mobile"), undefined;
    if (!passwordValid) return setErr("Password must be at least 8 characters"), undefined;
    if (password !== confirmPassword)
      return setErr("Passwords do not match"), undefined;

    setLoading(true);
    try {
      const response = await register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: trimmedEmail,
        phone: trimmedPhone,
        password,
      });

      // ✅ Clear form fields
      setFirst("");
      setLast("");
      setEmail("");
      setPhone("");
      setPass("");
      setConfirmPass("");

      // ✅ Clear any previous error
      setErr(null);

      // ✅ Strong, clear success message
      setSuccess(
        response?.message ||
          `Account created successfully! We’ve sent a verification mail to ${trimmedEmail}. Please check your inbox and spam folder before signing in.`
      );
    } catch (e: any) {
      setErr(e?.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <h1 className="text-2xl font-bold mb-2">Create your account</h1>
        <p className="text-sm text-gray-600 mb-4">
          We&apos;ll set up your Nazmi Boutique account.
        </p>

        {err && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-3 mb-3">
            {err}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-md p-3 mb-4">
            <p>{success}</p>
          </div>
        )}

        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              className="border rounded-lg p-3"
              placeholder="First name *"
              value={firstName}
              onChange={(e) => {
                setFirst(e.target.value);
                if (err) setErr(null);
              }}
              required
            />
            <input
              className="border rounded-lg p-3"
              placeholder="Last name"
              value={lastName}
              onChange={(e) => {
                setLast(e.target.value);
                if (err) setErr(null);
              }}
            />
          </div>

          <input
            className={`border rounded-lg p-3 w-full ${
              email && !emailValid ? "border-red-400" : ""
            }`}
            type="email"
            placeholder="Email *"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (err) setErr(null);
            }}
            required
          />

          <input
            className={`border rounded-lg p-3 w-full ${
              phone && !phoneValid ? "border-red-400" : ""
            }`}
            type="tel"
            placeholder="Phone (optional)"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              if (err) setErr(null);
            }}
          />

          <input
            className={`border rounded-lg p-3 w-full ${
              password && !passwordValid ? "border-red-400" : ""
            }`}
            type="password"
            placeholder="Password (min 8 chars) *"
            value={password}
            onChange={(e) => {
              setPass(e.target.value);
              if (err) setErr(null);
            }}
            required
          />

          <input
            className={`border rounded-lg p-3 w-full ${
              confirmPassword && confirmPassword !== password
                ? "border-red-400"
                : ""
            }`}
            type="password"
            placeholder="Confirm Password *"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPass(e.target.value);
              if (err) setErr(null);
            }}
            required
          />

          <button
            type="submit"
            disabled={loading || !canSubmit}
            className="w-full bg-black text-white py-3 rounded-lg font-semibold disabled:opacity-60"
          >
            {loading ? "Sending verification mail..." : "Create account"}
          </button>
        </form>

        <p className="text-sm text-gray-600 mt-4">
          Already have an account?{" "}
          <Link href="/auth/login" className="underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
