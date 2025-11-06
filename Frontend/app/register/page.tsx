"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";

/* helpers */
const isEmail = (s: string) => /^\S+@\S+\.\S+$/.test(s.trim());
const isIndian10Digit = (s: string) => /^[6-9]\d{9}$/.test(s.trim());
const normPhone = (s: string) => s.replace(/[^\d]/g, "");

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName,  setLastName]  = useState("");
  const [email,     setEmail]     = useState("");
  const [phone,     setPhone]     = useState("");
  const [password,  setPassword]  = useState("");
  const [confirm,   setConfirm]   = useState("");

  const [error, setError]         = useState("");
  const [emailErr, setEmailErr]   = useState("");
  const [phoneErr, setPhoneErr]   = useState("");
  const [passErr, setPassErr]     = useState("");
  const [loading, setLoading]     = useState(false);

  const emailValid = useMemo(() => (email ? isEmail(email) : true), [email]);
  const phoneValid = useMemo(() => (phone ? isIndian10Digit(phone) : true), [phone]);
  const passMatch  = useMemo(() => (confirm ? password === confirm : true), [password, confirm]);

  const canSubmit =
    !loading &&
    firstName.trim() &&
    lastName.trim() &&
    (email.trim() || phone.trim()) &&
    emailValid &&
    phoneValid &&
    password.length >= 6 &&
    passMatch;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setEmailErr(""); setPhoneErr(""); setPassErr("");

    if (!firstName.trim() || !lastName.trim()) {
      setError("First name and last name are required");
      return;
    }
    if (!email.trim() && !phone.trim()) {
      setError("Provide at least email or phone");
      return;
    }
    if (email.trim() && !emailValid) {
      setEmailErr("Enter a valid email address");
      return;
    }
    if (phone.trim() && !phoneValid) {
      setPhoneErr("Enter a valid 10-digit Indian phone number");
      return;
    }
    if (password.length < 6) {
      setPassErr("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      setPassErr("Passwords do not match");
      return;
    }

    try {
      setLoading(true);
      await register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() ? normPhone(phone) : undefined,
        password,
      });
      router.push("/account"); // auto-logged-in by context
    } catch (err: any) {
      const msg = err?.message || "Registration failed";
      const field = err?.field as string | undefined;

      if (field === "email") setEmailErr(msg);
      else if (field === "phone") setPhoneErr(msg);
      else if (field === "password") setPassErr(msg);
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
          <h2 className="mt-6 text-3xl font-bold text-gray-900">Create Account</h2>
          <p className="mt-2 text-sm text-gray-600">Use your email or a 10-digit Indian phone number</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={onSubmit} noValidate>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                placeholder="First name"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                placeholder="Last name"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-amber-500 ${
                  email && !emailValid ? "border-red-300" : "border-gray-300"
                }`}
                placeholder="you@example.com"
              />
              {emailErr && <p className="mt-1 text-sm text-red-600">{emailErr}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-amber-500 ${
                  phone && !phoneValid ? "border-red-300" : "border-gray-300"
                }`}
                placeholder="10-digit Indian number (e.g. 9876543210)"
                inputMode="numeric"
                pattern="[0-9]*"
              />
              {phoneErr && <p className="mt-1 text-sm text-red-600">{phoneErr}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-amber-500 ${
                  passErr ? "border-red-300" : "border-gray-300"
                }`}
                placeholder="Minimum 6 characters"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password *</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-amber-500 ${
                  passErr ? "border-red-300" : "border-gray-300"
                }`}
                placeholder="Re-enter password"
                required
              />
              {passErr && <p className="mt-1 text-sm text-red-600">{passErr}</p>}
            </div>
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full bg-amber-600 text-white py-3 px-4 rounded-lg hover:bg-amber-700 disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Account"}
          </button>

          <div className="text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-amber-600 hover:text-amber-500">
                Sign in here
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
