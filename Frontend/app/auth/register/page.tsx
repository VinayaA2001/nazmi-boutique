"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();

  const [firstName, setFirst] = useState("");
  const [lastName, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPass] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await register({ firstName, lastName, email, phone, password });
      router.push("/"); // or /account
    } catch (e: any) {
      setErr(e?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <h1 className="text-2xl font-bold mb-2">Create your account</h1>
        <p className="text-sm text-gray-600 mb-4">We’ll set up your Nazmi Boutique account.</p>

        {err && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-3 mb-4">
            {err}
          </div>
        )}

        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input className="border rounded-lg p-3" placeholder="First name *" value={firstName} onChange={e=>setFirst(e.target.value)} required />
            <input className="border rounded-lg p-3" placeholder="Last name" value={lastName} onChange={e=>setLast(e.target.value)} />
          </div>
          <input className="border rounded-lg p-3 w-full" type="email" placeholder="Email *" value={email} onChange={e=>setEmail(e.target.value)} required />
          <input className="border rounded-lg p-3 w-full" type="tel" placeholder="Phone (optional)" value={phone} onChange={e=>setPhone(e.target.value)} />
          <input className="border rounded-lg p-3 w-full" type="password" placeholder="Password *" value={password} onChange={e=>setPass(e.target.value)} required />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white py-3 rounded-lg font-semibold disabled:opacity-60"
          >
            {loading ? "Creating..." : "Create account"}
          </button>
        </form>

        <p className="text-sm text-gray-600 mt-4">
          Already have an account?{" "}
          <Link href="/auth/login" className="underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
