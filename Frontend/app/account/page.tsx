"use client";

import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function AccountPage() {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push("/auth/login");
  }, [loading, isAuthenticated, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const displayName = (user as any)?.firstName || (user as any)?.username || (user?.email?.split("@")[0] ?? "");

  return (
    <section className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-3xl mx-auto px-4">
        <h1 className="text-2xl font-bold">Welcome back{displayName ? `, ${displayName}` : ""}!</h1>
        <p className="text-gray-600 mt-2">Email: {user?.email || "-"}</p>
        <p className="text-gray-600">Phone: {(user as any)?.phone || "-"}</p>
      </div>
    </section>
  );
}
