// C:\NAZMI_BOUTIQUE\Frontend\lib\api.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import { API_BASE } from "./constants";
import type { Address, AddressItem, Order, ProductLite, User } from "./type";

/* ============================================================
   === Tiny API Helper (client-safe, unified)
   ============================================================ */

/** Core fetch wrapper — safe for browser and Next.js  */
export function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const safeInit: RequestInit = {
    ...init,
    // Add if you switch to cookie-based sessions:
    // credentials: 'include',
  };
  return fetch(input, safeInit);
}

/** POST JSON and return parsed result or throw descriptive error */
export async function postJSON<T = any>(
  url: string,
  body: any,
  headers: Record<string, string> = { "Content-Type": "application/json" }
): Promise<T> {
  const res = await apiFetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body ?? {}),
  });

  const parsed = await parseJSONSafe(res);
  if (!res.ok) {
    const msg =
      (parsed && ((parsed as any).error || (parsed as any).message)) ||
      `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return (parsed as T) ?? ({} as T);
}

/** Parse JSON safely from a response */
export async function getJSON<T = any>(res: Response): Promise<T | null> {
  return (await parseJSONSafe(res)) as T | null;
}

async function parseJSONSafe(res: Response): Promise<any | null> {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text || null;
  }
}

/** Build full API URL if only path is given */
export function apiUrl(path: string) {
  if (!path.startsWith("/")) return `${API_BASE}/${path}`;
  return `${API_BASE}${path}`;
}

/* ============================================================
   === Global Config
   ============================================================ */

export const API: string = API_BASE;

/** Get Authorization header from localStorage token */
const authHeaders = (): Record<string, string> => {
  if (typeof window === "undefined") return {};
  try {
    const token = window.localStorage.getItem("auth_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
};

/* ============================================================
   === AUTH
   ============================================================ */

export const loginUser = async (email: string, password: string) => {
  return postJSON<{ message: string; token: string; user: User }>(
    `${API}/api/auth/login`,
    { email, password }
  );
};

export const registerUser = async (
  username: string,
  email: string,
  password: string
) => {
  return postJSON<{ message: string; token: string; user: User }>(
    `${API}/api/auth/register`,
    { username, email, password }
  );
};

export const getProfile = async (): Promise<User | null> => {
  try {
    // Use same-origin proxy for consistent auth handling
    const res = await apiFetch(`/api/auth/profile`, {
      headers: { ...authHeaders() },
    });
    if (!res.ok) return null;
    const data = await getJSON<{ user: User }>(res);
    return data?.user ?? null;
  } catch (err) {
    console.warn("[getProfile] failed:", err);
    return null;
  }
};

/* ============================================================
   === ORDERS
   ============================================================ */

export const getOrders = async (): Promise<Order[]> => {
  try {
    const res = await apiFetch(`${API}/api/orders/user`, {
      headers: { ...authHeaders() },
    });
    if (!res.ok) return [];
    return (await getJSON<Order[]>(res)) ?? [];
  } catch (err) {
    console.warn("[getOrders] failed:", err);
    return [];
  }
};

export const createOrder = async (orderData: any) => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...authHeaders(),
  };
  return postJSON(`${API}/api/orders`, orderData, headers);
};

/* ============================================================
   === PRODUCTS
   ============================================================ */

export const getAllProducts = async () => {
  try {
    const res = await apiFetch(`${API}/api/products`);
    if (!res.ok) return [];
    return (await getJSON<any[]>(res)) ?? [];
  } catch (err) {
    console.error("[getAllProducts] failed:", err);
    return [];
  }
};

export const getProductById = async (productId: string) => {
  try {
    const res = await apiFetch(`${API}/api/products/${productId}`);
    if (!res.ok) return null;
    return await getJSON<any>(res);
  } catch (err) {
    console.error(`[getProductById] ${productId} failed:`, err);
    return null;
  }
};

export const rehydrateProducts = async (
  productIds: string[]
): Promise<Record<string, ProductLite>> => {
  const out: Record<string, ProductLite> = {};
  for (const id of productIds) {
    try {
      const res = await apiFetch(`${API}/api/products/${id}`);
      if (!res.ok) continue;
      const raw = await getJSON<any>(res);
      const p = raw && raw.product ? raw.product : raw;
      const images: string[] = Array.isArray(p?.images) ? p.images : [];
      const firstImage = images.length ? images[0] : undefined;
      const variants = Array.isArray(p?.variants) ? p.variants : [];
      const totalStock = typeof p?.totalStock === "number"
        ? p.totalStock
        : variants.reduce((sum: number, v: any) => sum + Number(v?.stock || v?.quantity || 0), 0);
      out[id] = {
        _id: String(p?._id ?? id),
        name: p?.name || p?.product_name || p?.title || "",
        price: Number(p?.price ?? p?.minPrice ?? 0),
        image: p?.image || firstImage || "/images/poster1.png",
        inStock: totalStock > 0,
        slug: p?.slug,
      };
    } catch (err) {
      console.warn(`[rehydrateProducts] ${id} failed:`, err);
    }
  }
  return out;
};

/* ============================================================
   === ADDRESS
   ============================================================ */

export const getAddress = async (): Promise<Partial<Address> | null> => {
  try {
    const res = await apiFetch(`/api/user/addresses`, {
      method: "GET",
      headers: { ...authHeaders() },
      cache: "no-store",
    });
    if (res.ok) {
      const data = await getJSON<{ addresses: AddressItem[]; defaultId?: string }>(res);
      const list = data?.addresses ?? [];
      if (!list.length) return null;
      const preferredId = data?.defaultId || list.find((a) => a.isDefault)?._id;
      const chosen = preferredId
        ? list.find((a) => String(a._id) === String(preferredId))
        : list[0];
      if (chosen) {
        const { fullName, phone, line1, line2, city, state, pincode } = chosen;
        return { fullName, phone, line1, line2, city, state, pincode };
      }
    }
  } catch (err) {
    console.warn("[getAddress] failed to load multi-address list:", err);
  }
  try {
    const profile = await getProfile();
    return (profile?.profile as Partial<Address>) ?? null;
  } catch (err) {
    console.warn("[getAddress] profile fallback failed:", err);
    return null;
  }
};

export async function saveAddress(addr: Address): Promise<boolean> {
  try {
    const auth = authHeaders();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...auth,
    };

    const addressData = {
      fullName: addr.fullName?.trim() ?? "",
      phone: String(addr.phone ?? "").trim(),
      line1: addr.line1?.trim() ?? "",
      line2: (addr.line2 ?? "").trim(),
      city: addr.city?.trim() ?? "",
      state: addr.state?.trim() ?? "",
      pincode: String(addr.pincode ?? "").trim(),
    };

    let existing: AddressItem[] = [];
    let defaultId: string | undefined;
    try {
      const res = await apiFetch(`/api/user/addresses`, {
        method: "GET",
        headers: { ...auth },
        cache: "no-store",
      });
      if (res.ok) {
        const data = await getJSON<{ addresses: AddressItem[]; defaultId?: string }>(res);
        existing = data?.addresses ?? [];
        defaultId = data?.defaultId || existing.find((a) => a.isDefault)?._id;
      }
    } catch (err) {
      console.warn("[saveAddress] address list fetch failed:", err);
    }

    if (defaultId) {
      const updateRes = await apiFetch(`/api/user/addresses/${defaultId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ ...addressData, isDefault: true }),
      });
      if (updateRes.ok) return true;
      await logFailure("Address update", updateRes);
    }

    const createRes = await apiFetch(`/api/user/addresses`, {
      method: "POST",
      headers,
      body: JSON.stringify({ ...addressData, isDefault: existing.length === 0 }),
    });
    if (createRes.ok) return true;

    await logFailure("Address create", createRes);
    if (createRes.status === 401 || createRes.status === 403) {
      console.warn(
        "[saveAddress] Unauthorized. Ensure localStorage has a valid 'auth_token'."
      );
    }
    return false;
  } catch (err) {
    console.error("[saveAddress] error:", err);
    return false;
  }
}

/* ============================================================
   === RAZORPAY
   ============================================================ */

export const createRazorpayOrder = async (orderId: string) => {
  return postJSON(`${API}/api/payments/razorpay/create-order`, {
    order_id: orderId,
  });
};

export const verifyRazorpayPayment = async (paymentData: any) => {
  return postJSON(`${API}/api/payments/razorpay/verify`, paymentData);
};

/* ============================================================
   === LEGACY HELPERS
   ============================================================ */

export const getAddressLegacy = async (): Promise<Partial<Address> | null> => {
  return null;
};

export const saveAddressLegacy = async (_address: any): Promise<boolean> => {
  await new Promise((r) => setTimeout(r, 200));
  return true;
};

/* ============================================================
   === Diagnostics
   ============================================================ */

async function logFailure(label: string, r: Response) {
  const text = await safeText(r);
  console.warn(
    `[api] ${label} failed → status=${r.status} ${r.statusText} | response=`,
    text
  );
}

async function safeText(r: Response) {
  try {
    const ct = r.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const j = await r.json().catch(() => null);
      if (j && typeof j === "object") {
        return (j as any).message || (j as any).error || JSON.stringify(j);
      }
    }
    return await r.text();
  } catch {
    return "";
  }
}

// ===== Addresses (multi) =====
export type { AddressItem } from "./type";

export const getAddresses = async (): Promise<AddressItem[]> => {
  try {
    const res = await apiFetch(`/api/user/addresses`, { method: "GET" });
    if (!res.ok) return [];
    const data = await getJSON<{ addresses: AddressItem[] }>(res);
    return data?.addresses ?? [];
  } catch {
    return [];
  }
};

export const addAddress = async (addr: Address, isDefault = false): Promise<AddressItem | null> => {
  const res = await apiFetch(`/api/user/addresses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...addr, isDefault }),
  });
  if (!res.ok) return null;
  const data = await getJSON<{ address: AddressItem }>(res);
  return data?.address ?? null;
};

export const updateAddress = async (id: string, addr: Partial<Address>, isDefault?: boolean): Promise<boolean> => {
  const res = await apiFetch(`/api/user/addresses/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...addr, ...(isDefault ? { isDefault: true } : {}) }),
  });
  return res.ok;
};

export const deleteAddress = async (id: string): Promise<boolean> => {
  const res = await apiFetch(`/api/user/addresses/${id}`, { method: "DELETE" });
  return res.ok;
};

export const setDefaultAddress = async (id: string): Promise<boolean> => {
  const res = await apiFetch(`/api/user/addresses/${id}`, { method: "PATCH" });
  return res.ok;
};


