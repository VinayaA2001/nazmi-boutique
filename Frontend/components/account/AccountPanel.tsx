"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export type AccountPanelProps = {
  open: boolean;
  onClose: () => void;
};

export default function AccountPanel({ open, onClose }: AccountPanelProps) {
  const { user, isAuthenticated, logout } = useAuth();
  const router = useRouter();

  // Don’t render anything when closed
  if (!open) return null;

  // Lock body scroll while panel is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Close on ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

    const handleSignOut = () => {
    try {
      // Prefer context logout
      if (logout) {
        logout();
      } else {
        // Fallback: clear local storage if context not wired
        localStorage.removeItem("auth_token");
        localStorage.removeItem("auth_user");
        document.cookie = "auth_token=; Path=/; Max-Age=0; SameSite=Lax";
        document.cookie = "user=; Path=/; Max-Age=0; SameSite=Lax";
      }
    } catch {
      // ignore
    }
    onClose();
    router.push("/"); // go back to home after logout
  };

  const displayName =
    (user as any)?.firstName ||
    (user as any)?.username ||
    user?.email?.split("@")[0] ||
    "Guest";

  return (
    <div className="fixed inset-0 z-[200]">
      {/* Backdrop */}
      <button
        aria-label="Close account panel"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Slide-in panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Account panel"
        className="absolute right-0 top-0 h-full w-full sm:w-[480px] bg-white shadow-2xl translate-x-0 transition-transform duration-300"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="text-lg font-semibold">
              {isAuthenticated ? "My Account" : "Welcome"}
            </h2>
            {isAuthenticated && (
              <p className="text-xs text-gray-500">
                Signed in as {user?.email ?? displayName}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            Close
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* If logged in: account overview + sign out */}
          {isAuthenticated ? (
            <>
              <Link href="/account" onClick={onClose} className="block">
                <div className="rounded-xl border p-4 hover:border-black">
                  <p className="font-medium">Account Overview</p>
                  <p className="text-sm text-gray-500">
                    Orders, wishlist &amp; addresses
                  </p>
                </div>
              </Link>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Link
                  href="/account"
                  onClick={onClose}
                  className="rounded-xl border p-4 hover:border-black"
                >
                  <p className="font-medium">Your Orders</p>
                  <p className="text-sm text-gray-500">
                    Track status &amp; history
                  </p>
                </Link>

                <Link
                  href="/account"
                  onClick={onClose}
                  className="rounded-xl border p-4 hover:border-black"
                >
                  <p className="font-medium">Wishlist</p>
                  <p className="text-sm text-gray-500">Saved items</p>
                </Link>

                <Link
                  href="/account#addresses"
                  onClick={onClose}
                  className="rounded-xl border p-4 hover:border-black"
                >
                  <p className="font-medium">Addresses</p>
                  <p className="text-sm text-gray-500">
                    Manage delivery details
                  </p>
                </Link>
              </div>

              <button
                onClick={handleSignOut}
                className="w-full mt-2 text-sm px-4 py-2 rounded-lg bg-black text-white hover:bg-gray-800"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              {/* If NOT logged in: login / register shortcuts */}
              <Link href="/auth/login" onClick={onClose} className="block">
                <div className="rounded-xl border p-4 hover:border-black">
                  <p className="font-medium">Sign in</p>
                  <p className="text-sm text-gray-500">
                    Access your orders &amp; wishlist
                  </p>
                </div>
              </Link>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Link
                  href="/auth/login"
                  onClick={onClose}
                  className="rounded-xl border p-4 hover:border-black"
                >
                  <p className="font-medium">Existing Customer</p>
                  <p className="text-sm text-gray-500">
                    Log in to your account
                  </p>
                </Link>

                <Link
                  href="/auth/register"
                  onClick={onClose}
                  className="rounded-xl border p-4 hover:border-black"
                >
                  <p className="font-medium">Create Account</p>
                  <p className="text-sm text-gray-500">
                    Faster checkout &amp; tracking
                  </p>
                </Link>
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
