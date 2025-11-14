"use client";

import Link from "next/link";
import { Address } from "@/lib/type";

export default function AddressForm({
  address,
  setAddress,
  loading,
  saving,
  onSave,
  continuePath = "/products",
}: {
  address: Address;
  setAddress: (update: (prev: Address) => Address) => void;
  loading: boolean;
  saving: "idle" | "saving" | "saved" | "error";
  onSave: () => void;
  continuePath?: string;
}) {
  return (
    <div className="max-w-7xl mx-auto px-4">
      <div className="bg-white border rounded-2xl p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-medium text-gray-900">Shipping Address</p>
            <p className="text-sm text-gray-500">Save or edit your delivery details</p>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-gray-600">Loading address…</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                  className="px-3 py-2 border rounded-lg"
                  placeholder="Full Name"
                  value={address.fullName}
                  onChange={(e) =>
                    setAddress((prev) => ({ ...prev, fullName: e.target.value }))
                  }
                />
                <input
                  className="px-3 py-2 border rounded-lg"
                  placeholder="Phone"
                  value={address.phone}
                  onChange={(e) =>
                    setAddress((prev) => ({ ...prev, phone: e.target.value }))
                  }
                />
              </div>

              <input
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="Address line 1"
                value={address.line1}
                onChange={(e) =>
                  setAddress((prev) => ({ ...prev, line1: e.target.value }))
                }
              />

              <input
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="Address line 2 (optional)"
                value={address.line2 || ""}
                onChange={(e) =>
                  setAddress((prev) => ({ ...prev, line2: e.target.value }))
                }
              />

              <div className="grid grid-cols-3 gap-3">
                <input
                  className="px-3 py-2 border rounded-lg"
                  placeholder="City"
                  value={address.city}
                  onChange={(e) =>
                    setAddress((prev) => ({ ...prev, city: e.target.value }))
                  }
                />
                <input
                  className="px-3 py-2 border rounded-lg"
                  placeholder="State"
                  value={address.state}
                  onChange={(e) =>
                    setAddress((prev) => ({ ...prev, state: e.target.value }))
                  }
                />
                <input
                  className="px-3 py-2 border rounded-lg"
                  placeholder="PIN Code"
                  value={address.pincode}
                  onChange={(e) =>
                    setAddress((prev) => ({ ...prev, pincode: e.target.value }))
                  }
                />
              </div>

              <div className="pt-1 flex items-center gap-3">
                <button
                  onClick={onSave}
                  disabled={saving === "saving"}
                  className="px-5 py-2 rounded-lg bg-black text-white hover:bg-gray-800 disabled:opacity-60"
                >
                  {saving === "saving" ? "Saving…" : "Save Address"}
                </button>

                {saving === "saved" && (
                  <span className="text-sm text-green-600">Saved!</span>
                )}
                {saving === "error" && (
                  <span className="text-sm text-red-600">Failed to save</span>
                )}
              </div>
            </div>

            <div className="border rounded-xl p-4 bg-gray-50">
              <h3 className="text-sm font-semibold mb-2">
                Default Shipping To
              </h3>

              <div className="text-sm text-gray-700 space-y-1">
                <p className="font-medium">{address.fullName || "—"}</p>
                <p>{address.line1 || "—"}</p>
                {address.line2 && <p>{address.line2}</p>}
                <p>
                  {address.city || "—"}, {address.state || "—"}{" "}
                  {address.pincode || ""}
                </p>
                <p>Phone: {address.phone || "—"}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
