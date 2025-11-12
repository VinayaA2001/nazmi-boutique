﻿"use client";

import { useEffect, useMemo, useState } from "react";
import AccountHeader from "@/components/account/AccountHeader";
import AccountTabs from "@/components/account/AccountTabs";
import OverviewTiles from "@/components/account/OverviewTiles";
import OrdersList from "@/components/account/OrdersList";
import WishlistGrid from "@/components/account/WishlistGrid";
import AddressForm from "@/components/account/AddressForm";

import { Address, Order, ProductLite, User, WishlistItem } from "@/lib/type";
import { getAddress, getOrders, getProfile, rehydrateProducts, saveAddress } from "@/lib/api";

type TabId = "overview" | "orders" | "wishlist" | "addresses";

export default function AccountPage() {
  const [active, setActive] = useState<TabId>("overview");

  // User
  const [user, setUser] = useState<User | null>(null);

  // Orders
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Wishlist (localStorage + rehydrate)
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [rehydrated, setRehydrated] = useState<Record<string, ProductLite>>({});

  // Address
  const [address, setAddress] = useState<Address>({
    fullName: "",
    phone: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    pincode: "",
  });
  const [addrLoading, setAddrLoading] = useState(false);
  const [addrSaving, setAddrSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");

  /* Load profile */
  useEffect(() => {
    (async () => setUser(await getProfile()))();
  }, []);

  /* Orders */
  useEffect(() => {
    (async () => {
      setOrdersLoading(true);
      try {
        const list = await getOrders();
        setOrders(list);
      } finally {
        setOrdersLoading(false);
      }
    })();
  }, []);

  /* Wishlist: local + rehydrate */
  useEffect(() => {
    const load = () => {
      try {
        const raw = localStorage.getItem("wishlist");
        setWishlist(raw ? JSON.parse(raw) : []);
      } catch { setWishlist([]); }
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

  /* Address */
  useEffect(() => {
    (async () => {
      setAddrLoading(true);
      try {
        // Prefill from localStorage if present (after checkout)
        const last = localStorage.getItem("last_shipping_address");
        if (last) setAddress((prev) => ({ ...prev, ...JSON.parse(last) }));

        const srv = await getAddress();
        if (srv) setAddress((prev) => ({ ...prev, ...srv }));
      } finally {
        setAddrLoading(false);
      }
    })();
  }, []);

  const deliveredCount = useMemo(() => orders.filter((o) => o.status === "DELIVERED").length, [orders]);

  const removeFromWishlist = (productId: string) => {
    try {
      const raw = localStorage.getItem("wishlist");
      const arr: WishlistItem[] = raw ? JSON.parse(raw) : [];
      const next = arr.filter((i) => i.productId !== productId);
      localStorage.setItem("wishlist", JSON.stringify(next));
      window.dispatchEvent(new Event("wishlist-updated"));
    } catch {}
  };

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

  return (
    <section className="min-h-screen bg-gray-50 pt-[var(--header-offset)]">
      <AccountHeader user={user} />
      <AccountTabs active={active} setActive={setActive} />

      {/* Overview */}
      {active === "overview" && (
        <OverviewTiles
          ordersCount={orders.length}
          wishlistCount={wishlist.length}
          deliveredCount={deliveredCount}
        />
      )}

      {/* Orders */}
      {active === "orders" && <OrdersList orders={orders} loading={ordersLoading} />}

      {/* Wishlist */}
      {active === "wishlist" && (
        <WishlistGrid wishlist={wishlist} rehydrated={rehydrated} onRemove={removeFromWishlist} />
      )}

      {/* Addresses */}
      {active === "addresses" && (
        <AddressForm
          address={address}
          setAddress={(updater) => setAddress(updater(address))}
          loading={addrLoading}
          saving={addrSaving}
          onSave={onSaveAddress}
        />
      )}

      <div className="h-10" />
    </section>
  );
}