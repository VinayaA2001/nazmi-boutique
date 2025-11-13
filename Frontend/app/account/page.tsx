// app/account/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import AccountHeader from "@/components/account/AccountHeader";
import AccountTabs from "@/components/account/AccountTabs";
import OverviewTiles from "@/components/account/OverviewTiles";
import OrdersList from "@/components/account/OrdersList";
import WishlistGrid from "@/components/account/WishlistGrid";
import AddressForm from "@/components/account/AddressForm";

import {
  Address,
  Order,
  ProductLite,
  User,
  WishlistItem,
} from "@/lib/type";
import {
  getAddress,
  getOrders,
  getProfile,
  rehydrateProducts,
  saveAddress,
} from "@/lib/api";
// Multi-address state & handlers
import { getAddresses, addAddress, updateAddress, deleteAddress, setDefaultAddress } from "@/lib/api";

type TabId = "overview" | "orders" | "addresses";

export default function AccountPage() {
  /* ---------- Tabs: support /account?tab=orders ---------- */
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as TabId) || "overview";
  const [active, setActive] = useState<TabId>(initialTab);

  useEffect(() => {
    const t = (searchParams.get("tab") as TabId) || "overview";
    setActive(t);
  }, [searchParams]);

  /* ---------- User ---------- */
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    (async () => setUser(await getProfile()))();
  }, []);

  /* ---------- Orders ---------- */
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setOrdersLoading(true);
      try {
        const list = await getOrders(); // must include Bearer token in lib/api
        setOrders(list);
      } finally {
        setOrdersLoading(false);
      }
    })();
  }, []);

  /* ---------- Wishlist (local) + rehydrate ---------- */
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [rehydrated, setRehydrated] = useState<Record<string, ProductLite>>({});

  useEffect(() => {
    const load = () => {
      try {
        const raw = localStorage.getItem("wishlist");
        setWishlist(raw ? JSON.parse(raw) : []);
      } catch {
        setWishlist([]);
      }
    };
    load();
    const handler = () => load();
    window.addEventListener("wishlist-updated", handler);
    return () => window.removeEventListener("wishlist-updated", handler);
  }, []);

  useEffect(() => {
    (async () => {
      if (!wishlist.length) return setRehydrated({});
      const ids = wishlist.map((w) => w.productId);
      setRehydrated(await rehydrateProducts(ids));
    })();
  }, [wishlist]);

  const removeFromWishlist = (productId: string) => {
    try {
      const raw = localStorage.getItem("wishlist");
      const arr: WishlistItem[] = raw ? JSON.parse(raw) : [];
      const next = arr.filter((i) => i.productId !== productId);
      localStorage.setItem("wishlist", JSON.stringify(next));
      window.dispatchEvent(new Event("wishlist-updated"));
    } catch {}
  };

  /* ---------- Address (prefill after checkout + from server) ---------- */
  const [address, setAddress] = useState<Address>({
    fullName: "",
    phone: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    pincode: "",
  });
  // Multi-address state
  const [addresses, setAddresses] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const addressTemplate: Address = { fullName: "", phone: "", line1: "", line2: "", city: "", state: "", pincode: "" };
  const [draftAddr, setDraftAddr] = useState<Address>(addressTemplate);

  // Load saved addresses
  useEffect(() => { (async () => setAddresses(await getAddresses()))(); }, []);

  const onSetDefault = async (id: string) => { await setDefaultAddress(id); const list = await getAddresses(); setAddresses(list); try { const chosen = list.find((a:any)=>a.isDefault) || list.find((a:any)=>a._id===id); if (chosen) { localStorage.setItem("last_shipping_address", JSON.stringify({ fullName: chosen.fullName, phone: chosen.phone, line1: chosen.line1, line2: chosen.line2, city: chosen.city, state: chosen.state, pincode: chosen.pincode })); } } catch {} };
  const onEdit = (a: any) => { setEditingId(a._id); setDraftAddr({ fullName:a.fullName, phone:a.phone, line1:a.line1, line2:a.line2, city:a.city, state:a.state, pincode:a.pincode }); setShowForm(true); };
  const onDelete = async (id: string) => { await deleteAddress(id); setAddresses(await getAddresses()); };
  const onSaveDraft = async () => {
  setAddrSaving("saving");
  const ok = editingId
    ? await updateAddress(editingId, draftAddr)
    : !!(await addAddress(draftAddr, addresses.length === 0));
  setAddrSaving(ok ? "saved" : "error");
  if (ok) {
    try {
      localStorage.setItem("last_shipping_address", JSON.stringify(draftAddr));
    } catch {}
    setShowForm(false);
    setEditingId(null);
    setDraftAddr(addressTemplate);
    setAddresses(await getAddresses());
  }
  setTimeout(() => setAddrSaving("idle"), 1200);
};
  const [addrLoading, setAddrLoading] = useState(false);
  const [addrSaving, setAddrSaving] =
    useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    (async () => {
      setAddrLoading(true);
      try {
        // Prefill from checkout
        const last = localStorage.getItem("last_shipping_address");
        if (last) setAddress((prev) => ({ ...prev, ...JSON.parse(last) }));

        // Merge with server-stored profile address (wins if exists)
        const srv = await getAddress();
        if (srv) setAddress((prev) => ({ ...prev, ...srv }));
      } finally {
        setAddrLoading(false);
      }
    })();
  }, []);

  const onSaveAddress = async () => {
    setAddrSaving("saving");
    const ok = await saveAddress(address);
    if (ok) {
      localStorage.setItem("last_shipping_address", JSON.stringify(address));
      setAddrSaving("saved");
      setTimeout(() => setAddrSaving("idle"), 1500);
    } else {
      setAddrSaving("error");
    }
  };

  /* ---------- Derived ---------- */
  const deliveredCount = useMemo(
    () => orders.filter((o) => o.status === "DELIVERED").length,
    [orders]
  );

  /* ---------- UI ---------- */
  return (
    <section className="min-h-screen bg-gray-50 pt-[var(--header-offset)]">
      <AccountHeader user={user} />
      <AccountTabs active={active} setActive={setActive} />

      {/* Overview */}
      {active === "overview" && (
        <OverviewTiles
          ordersCount={orders.length}

          deliveredCount={deliveredCount}
          onRecentClick={() => setActive("orders")}

          onDeliveredClick={() => setActive("orders")}
        />
      )}

      {/* Orders */}
      {active === "orders" && (
        <OrdersList orders={orders} loading={ordersLoading} />
      )}`n      {/* Addresses */}
      {active === "addresses" && (
        <div className="max-w-7xl mx-auto px-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Your Addresses</h3>
            <button
              onClick={() => { setEditingId(null); setDraftAddr(addressTemplate); setShowForm(true); }}
              className="px-4 py-2 rounded-lg bg-black text-white hover:bg-gray-800"
            >
              Add New
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-6">
            {addresses.map((a) => (
              <div key={a._id} className="border rounded-lg p-4 bg-white">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{a.fullName}</p>
                    <p>{a.line1}</p>
                    {a.line2 && <p>{a.line2}</p>}
                    <p>{a.city}, {a.state} {a.pincode}</p>
                    <p>Phone: {a.phone}</p>
                    {a.isDefault && (
                      <span className="inline-block mt-2 text-xs px-2 py-1 rounded bg-green-100 text-green-700">Default</span>
                    )}
                  </div>
                  <div className="space-x-2">
                    {!a.isDefault && (
                      <button onClick={() => onSetDefault(a._id)} className="text-sm underline">Set default</button>
                    )}
                    <button onClick={() => onEdit(a)} className="text-sm underline">Edit</button>
                    <button onClick={() => onDelete(a._id)} className="text-sm text-red-600 underline">Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {showForm && (
            <AddressForm
              address={draftAddr}
              setAddress={(updater) => setDraftAddr(updater(draftAddr))}
              loading={addrLoading}
              saving={addrSaving}
              onSave={onSaveDraft}
            />
          )}
        </div>
      )}

      <div className="h-10" />
    </section>
  );
}










