"use client";

import { usePathname, useRouter } from "next/navigation";
import type { User } from "@/lib/type";

type Props = {
  user: User | null;
  onLogout?: () => void;
};

export default function AccountHeader({ user, onLogout }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const firstLetter = (user?.username || user?.email?.[0] || "N").charAt(0).toUpperCase();

  const buildRedirect = () => {
    try {
      const qs = typeof window !== "undefined" ? window.location.search || "" : "";
      const target = `${pathname || "/account"}${qs}`;
      return encodeURIComponent(target);
    } catch {
      return encodeURIComponent(pathname || "/account");
    }
  };

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
      return;
    }
    try {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
      document.cookie = "auth_token=; Path=/; Max-Age=0; SameSite=Lax";
      document.cookie = "user=; Path=/; Max-Age=0; SameSite=Lax";
    } catch {}
    router.replace("/auth/login");
  };

  const goLogin = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/auth/login?redirect=${buildRedirect()}`);
  };

  const goRegister = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/auth/register?redirect=${buildRedirect()}`);
  };

  return (
    <div className="bg-white border-b">
      <div className="max-w-7xl mx-auto px-4 py-6 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 text-white grid place-items-center font-semibold text-lg">
          {firstLetter}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl md:text-3xl font-semibold text-gray-900">
            {user ? `Hi, ${user.username}` : "My Account"}
          </h1>
          <p className="text-sm text-gray-500 truncate">
            {user?.email ?? "Sign in to access orders & wishlist"}
          </p>
        </div>
        {user ? (
          <button onClick={handleLogout} className="text-sm px-4 py-2 rounded-lg bg-black text-white hover:bg-gray-800">
            Sign out
          </button>
        ) : (
          <div className="flex gap-2">
            <button type="button" onClick={goLogin} className="text-sm px-4 py-2 rounded-lg bg-black text-white hover:bg-gray-800">
              Sign in
            </button>
            <button type="button" onClick={goRegister} className="text-sm px-4 py-2 rounded-lg border hover:border-black">
              Create account
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
