"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress
} from "@/lib/api";

import { useAuth } from "@/context/AuthContext";

type TabId = "overview" | "orders" | "addresses";

export default function AccountPage() {
  return (
    <Suspense fallback={<AccountPageFallback />}>
      <AccountPageContent />
    </Suspense>
  );
}

function AccountPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, loading: authLoading, logout } = useAuth();

  const [authReady, setAuthReady] = useState(false);

  const initialTab = (searchParams.get("tab") as TabId) || "overview";

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      const target = `${window.location.pathname}${window.location.search}`;
      router.replace(`/auth/login?redirect=${encodeURIComponent(target)}`);
      return;
    }
    setAuthReady(true);
  }, [authLoading, isAuthenticated]);

  const [active, setActive] = useState<TabId>(initialTab);

  useEffect(() => {
    const t = (searchParams.get("tab") as TabId) || "overview";
    setActive(t);
  }, [searchParams]);

  /* ========== USER ========== */
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    if (!authReady) return;
    (async () => setUser(await getProfile()))();
  }, [authReady]);

  /* ========== ORDERS ========== */
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  useEffect(() => {
    if (!authReady) return;
    (async () => {
      setOrdersLoading(true);
      try {
        const list = await getOrders();
        setOrders(list);
      } finally {
        setOrdersLoading(false);
      }
    })();
  }, [authReady]);

  /* ========== WISHLIST ========== */
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [rehydrated, setRehydrated] = useState<Record<string, ProductLite>>({});

  useEffect(() => {
    const raw = localStorage.getItem("wishlist");
    setWishlist(raw ? JSON.parse(raw) : []);

    const handler = () => {
      const r = localStorage.getItem("wishlist");
      setWishlist(r ? JSON.parse(r) : []);
    };

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
    const raw = localStorage.getItem("wishlist");
    const arr: WishlistItem[] = raw ? JSON.parse(raw) : [];
    const next = arr.filter((i) => i.productId !== productId);
    localStorage.setItem("wishlist", JSON.stringify(next));
    window.dispatchEvent(new Event("wishlist-updated"));
  };

  /* ========== ADDRESSES ========== */
  const emptyAddress: Address = {
    fullName: "",
    phone: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    pincode: "",
  };

  const [addresses, setAddresses] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftAddr, setDraftAddr] = useState<Address>(emptyAddress);

  useEffect(() => {
    if (!authReady) return;
    (async () => setAddresses(await getAddresses()))();
  }, [authReady]);

  const onSetDefault = async (id: string) => {
    await setDefaultAddress(id);
    setAddresses(await getAddresses());
  };

  const onEdit = (addr: any) => {
    setEditingId(addr._id);
    setDraftAddr({
      fullName: addr.fullName,
      phone: addr.phone,
      line1: addr.line1,
      line2: addr.line2 || "",
      city: addr.city,
      state: addr.state,
      pincode: addr.pincode,
    });
    setShowForm(true);
  };

  const onDelete = async (id: string) => {
    await deleteAddress(id);
    setAddresses(await getAddresses());
  };

  const onSaveDraft = async () => {
    let ok = false;

    if (editingId) {
      ok = await updateAddress(editingId, draftAddr);
    } else {
      ok = await addAddress(draftAddr, addresses.length === 0);
    }

    if (ok) {
      setShowForm(false);
      setEditingId(null);
      setDraftAddr(emptyAddress);
      setAddresses(await getAddresses());
    }
  };

  /* ========== UI ========== */
  const deliveredCount = useMemo(
    () => orders.filter((o) => o.status === "DELIVERED").length,
    [orders]
  );

  if (!authReady) {
    return (
      <section className="min-h-screen bg-gray-50 pt-[var(--header-offset)]">
        <AccountHeader user={null} />
        <div className="max-w-4xl mx-auto px-4 py-16 text-gray-500">
          Loading your account…
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-screen bg-gray-50 pt-[var(--header-offset)]">
      <AccountHeader user={user} onLogout={logout} />
      <AccountTabs active={active} setActive={setActive} />

      {active === "overview" && (
        <OverviewTiles
          ordersCount={orders.length}
          deliveredCount={deliveredCount}
          onRecentClick={() => setActive("orders")}
          onDeliveredClick={() => setActive("orders")}
        />
      )}

      {active === "orders" && (
        <OrdersList orders={orders} loading={ordersLoading} />
      )}

      {active === "addresses" && (
        <div className="max-w-7xl mx-auto px-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Your Addresses</h3>
            <button
              onClick={() => {
                setEditingId(null);
                setDraftAddr(emptyAddress);
                setShowForm(true);
              }}
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
                      <span className="inline-block mt-2 text-xs px-2 py-1 rounded bg-green-100 text-green-700">
                        Default
                      </span>
                    )}
                  </div>
                  <div className="space-x-2">
                    {!a.isDefault && (
                      <button onClick={() => onSetDefault(a._id)} className="text-sm underline">
                        Set default
                      </button>
                    )}
                    <button onClick={() => onEdit(a)} className="text-sm underline">
                      Edit
                    </button>
                    <button onClick={() => onDelete(a._id)} className="text-sm text-red-600 underline">
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {showForm && (
            <AddressForm
              address={draftAddr}
              setAddress={setDraftAddr}
              loading={false}
              saving={"idle"}
              onSave={onSaveDraft}
            />
          )}
        </div>
      )}

      <div className="h-10" />
    </section>
  );
}

function AccountPageFallback() {
  return (
    <section className="min-h-screen bg-gray-50 pt-[var(--header-offset)]">
      <div className="max-w-4xl mx-auto px-4 py-16 text-gray-500">
        Loading your account...
      </div>
    </section>
  );
}
