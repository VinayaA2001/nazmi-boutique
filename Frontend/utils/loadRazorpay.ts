// lib/razorpay.ts
// ------------------------------------------------------------
// Helper for Razorpay in Next.js (App Router).
// Works in TEST mode with rzp_test_* keys.
// ------------------------------------------------------------

export interface RazorpayOptions {
  key: string;
  amount: number; // in paise
  currency: string;
  name: string;
  description: string;
  image: string;
  order_id: string;
  handler: (response: RazorpayResponse) => void;
  prefill: { name: string; email: string; contact: string };
  notes: { address: string };
  theme: { color: string };
  modal?: { ondismiss?: () => void; animation?: boolean };
  retry?: { enabled: boolean; max_count: number };
  timeout?: number;
  remember_customer?: boolean;
}

export interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface RazorpayError {
  code: string;
  description: string;
  source: string;
  step: string;
  reason: string;
  metadata: any;
}

declare global {
  interface Window {
    Razorpay: any;
    __RZP_KEY?: string;
  }
}

/* ----------------------------------------------------------
   Config: proxy vs direct backend
---------------------------------------------------------- */
const USE_PROXY_ROUTES = true;

const PUBLIC_API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://nazmi-boutique-2.onrender.com";

const CREATE_ORDER_PATH = USE_PROXY_ROUTES
  ? "/api/payments/razorpay/create-order"
  : "/api/payments/create-order";

const VERIFY_PAYMENT_PATH = USE_PROXY_ROUTES
  ? "/api/payments/razorpay/verify"
  : "/api/payments/verify-payment";

/* ----------------------------------------------------------
   Runtime key resolver (fixes “missing NEXT_PUBLIC_RAZORPAY_KEY_ID”)
---------------------------------------------------------- */
async function ensurePublicKey(): Promise<string> {
  // 1) If baked in at build time, use it
  const baked = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "";
  if (baked) return baked;

  // 2) If a previous call fetched it, reuse
  if (typeof window !== "undefined" && window.__RZP_KEY) return window.__RZP_KEY;

  // 3) Fetch from API (you should have app/api/payments/razorpay/public-key)
  try {
    const r = await fetch("/api/payments/razorpay/public-key", { cache: "no-store" });
    const j = await r.json();
    const key = j?.key || "";
    if (typeof window !== "undefined") window.__RZP_KEY = key;
    return key;
  } catch {
    return "";
  }
}

/* ---------------------------------------------------------- */
export function loadRazorpay(): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export const initializePayment = async (options: RazorpayOptions): Promise<void> => {
  const loaded = await loadRazorpay();
  if (!loaded || !window.Razorpay) {
    throw new Error("Razorpay SDK failed to load. Check your internet connection.");
  }

  if (!options?.key) {
    throw new Error("Payment configuration missing: NEXT_PUBLIC_RAZORPAY_KEY_ID");
  }

  const rzp = new window.Razorpay({
    ...options,
    modal: {
      animation: true,
      ondismiss: () => {
        options.modal?.ondismiss?.();
      },
      ...options.modal,
    },
  });

  rzp.open();
};

/* ---------------------------------------------------------- */
export const createRazorpayOrder = async (
  amountPaise: number,
  currency: string = "INR",
  receipt?: string
): Promise<{ id: string; amount: number; currency: string }> => {
  const url = USE_PROXY_ROUTES ? CREATE_ORDER_PATH : `${PUBLIC_API_BASE}${CREATE_ORDER_PATH}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: amountPaise,
      currency,
      receipt: receipt || `receipt_${Date.now()}`,
    }),
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    const msg = data?.message || data?.error || `Failed to create order (${res.status})`;
    throw new Error(msg);
  }

  // Normalize common shapes: {id,...} OR {order:{id,...}} OR {order_id:...}
  const order = data?.order || data?.data || data;
  const id = order?.id || order?.order_id || data?.order_id || data?.id;
  const amount = Number(order?.amount ?? data?.amount ?? amountPaise);
  const curr = order?.currency || data?.currency || currency;

  if (!id) throw new Error("Backend did not return a Razorpay order id.");

  return { id, amount, currency: curr };
};

export const verifyPayment = async (
  paymentResponse: RazorpayResponse,
  orderId: string
): Promise<boolean> => {
  const url = USE_PROXY_ROUTES ? VERIFY_PAYMENT_PATH : `${PUBLIC_API_BASE}${VERIFY_PAYMENT_PATH}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      razorpay_payment_id: paymentResponse.razorpay_payment_id,
      razorpay_order_id: paymentResponse.razorpay_order_id,
      razorpay_signature: paymentResponse.razorpay_signature,
      order_id: orderId,
    }),
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    console.error("Verify payment failed:", data);
    return false;
  }
  return !!(data?.success ?? data?.verified ?? data?.ok);
};

export const processPayment = async ({
  amount, // rupees
  userDetails,
  onSuccess,
  onError,
  description = "Purchase from Nazmi Boutique",
}: {
  amount: number;
  userDetails: { name: string; email: string; contact: string; address: string };
  onSuccess: (paymentId: string, orderId: string) => void;
  onError: (error: string) => void;
  description?: string;
}): Promise<void> => {
  try {
    const key = await ensurePublicKey();
    if (!key) throw new Error("Payment configuration missing: NEXT_PUBLIC_RAZORPAY_KEY_ID");

    const amountPaise = Math.round(amount * 100);
    const order = await createRazorpayOrder(amountPaise);

    const options: RazorpayOptions = {
      key,
      amount: amountPaise,
      currency: "INR",
      name: "Nazmi Boutique",
      description,
      image: "/logo.png",
      order_id: order.id,
      prefill: {
        name: userDetails.name,
        email: userDetails.email,
        contact: userDetails.contact,
      },
      notes: { address: userDetails.address },
      theme: { color: "#D97706" },
      modal: { ondismiss: () => onError("Payment cancelled by user") },
      retry: { enabled: true, max_count: 3 },
      timeout: 300,
      remember_customer: true,
      handler: async (response: RazorpayResponse) => {
        try {
          const ok = await verifyPayment(response, order.id);
          if (ok) onSuccess(response.razorpay_payment_id, response.razorpay_order_id);
          else onError("Payment verification failed. Please contact support.");
        } catch (e) {
          console.error("Payment handler error:", e);
          onError("Payment processing failed. Please try again.");
        }
      },
    };

    await initializePayment(options);
  } catch (err: any) {
    console.error("Payment process error:", err);
    onError(err?.message || "Payment initialization failed");
  }
};

/* ---------------------------------------------------------- */
export const isRazorpayAvailable = (): boolean =>
  typeof window !== "undefined" && !!window.Razorpay;

export const formatAmount = (amountPaise: number): string =>
  `₹${(amountPaise / 100).toFixed(2)}`;

export const getDefaultRazorpayOptions = (): Partial<RazorpayOptions> => ({
  theme: { color: "#D97706" },
  modal: { animation: true },
  retry: { enabled: true, max_count: 3 },
  timeout: 300,
  remember_customer: true,
});

export const processDemoPayment = async (amount: number): Promise<boolean> =>
  new Promise((resolve) => setTimeout(() => resolve(true), 1200));

export default {
  loadRazorpay,
  initializePayment,
  createRazorpayOrder,
  verifyPayment,
  processPayment,
  isRazorpayAvailable,
  formatAmount,
  getDefaultRazorpayOptions,
  processDemoPayment,
};
