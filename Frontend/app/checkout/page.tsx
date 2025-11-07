// app/checkout/page.tsx
"use client";

import { useState, useEffect, Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, CreditCard, Shield, Truck, Wallet, Building, QrCode, X, Video } from "lucide-react";

/* ========= Types ========= */
interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  size: string;
  color: string;
  productCode: string;
  maxStock: number;
  isDirectOrder?: boolean;
}
interface ShippingInfo {
  name: string; email: string; phone: string; address1: string; address2: string;
  city: string; state: string; pincode: string; country: string;
}

/* ========= Globals ========= */
declare global { interface Window { Razorpay: any } }

const RZP_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_RZFeCq3NZLg9Rz";
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const SHIPPING_THRESHOLD = 2000;
const SHIPPING_FEE = 60;

/* ========= Utils ========= */
const getToken = (): string | null => {
  try {
    const t = localStorage.getItem("auth_token"); // unified
    return t ? (t.startsWith("Bearer ") ? t : `Bearer ${t}`) : null;
  } catch { return null; }
};
const getAuthHeaders = () => {
  const token = getToken();
  return token ? { Authorization: token } : {};
};
async function loadRazorpay(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (window.Razorpay) return true;
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

/* ========= Page ========= */
function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isDirectOrder, setIsDirectOrder] = useState(false);
  const [currentStep, setCurrentStep] = useState<"details" | "payment">("details");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("");
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline">("checking");
  const [showOrderSummary, setShowOrderSummary] = useState(false);

  const [shipping, setShipping] = useState<ShippingInfo>({
    name: "", email: "", phone: "", address1: "", address2: "", city: "", state: "", pincode: "", country: "India",
  });

  // Prefill from saved user
  useEffect(() => {
    try {
      const saved = localStorage.getItem("auth_user");
      if (saved) {
        const u = JSON.parse(saved);
        setShipping((s) => ({
          ...s,
          name: s.name || [u?.firstName, u?.lastName].filter(Boolean).join(" ") || "",
          email: s.email || u?.email || "",
          phone: s.phone || (u?.phone ? String(u.phone) : ""),
        }));
      }
    } catch {}
  }, []);

  // Backend health
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/health`);
        setBackendStatus(r.ok ? "online" : "offline");
      } catch { setBackendStatus("offline"); }
    })();
  }, []);

  // Load items
  useEffect(() => {
    try {
      const orderType = searchParams.get("type");
      if (orderType === "direct") {
        const directOrder = sessionStorage.getItem("directOrder");
        if (directOrder) {
          const items = JSON.parse(directOrder);
          if (Array.isArray(items) && items.length) {
            setCartItems(items); setIsDirectOrder(true); return;
          }
        }
        alert("No direct order found. Please try again."); router.back();
      } else {
        const cartData = localStorage.getItem("cart");
        if (cartData) {
          const items = JSON.parse(cartData);
          if (Array.isArray(items) && items.length) {
            setCartItems(items); setIsDirectOrder(false); return;
          }
        }
        router.push("/cart");
      }
    } catch (e) { console.error(e); router.push("/cart"); }
  }, [searchParams, router]);

  // Totals
  const { subtotal, shippingFee, grandTotal } = useMemo(() => {
    const sub = cartItems.reduce((sum, it) => sum + Number(it.price || 0) * Number(it.quantity || 0), 0);
    const sFee = sub >= SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
    return { subtotal: sub, shippingFee: sFee, grandTotal: sub + sFee };
  }, [cartItems]);

  // Validation
  const validateShippingDetails = () => {
    const required: (keyof ShippingInfo)[] = ["name", "email", "phone", "address1", "city", "state", "pincode"];
    for (const f of required) {
      if (!String(shipping[f] || "").trim()) {
        alert(`Please fill in ${String(f).replace(/([A-Z])/g, " $1").toLowerCase()}`);
        return false;
      }
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(shipping.email)) return alert("Please enter a valid email address"), false;
    const phoneDigits = shipping.phone.replace(/\D/g, "");
    if (!/^[6-9]\d{9}$/.test(phoneDigits)) return alert("Please enter a valid 10-digit phone number"), false;
    if (!/^\d{6}$/.test(shipping.pincode.trim())) return alert("Please enter a valid 6-digit pincode"), false;
    return true;
  };
  const proceedToPayment = () => { if (validateShippingDetails()) setCurrentStep("payment"); };

  // Payment flow
  const initiateRazorpayPayment = async () => {
    if (!selectedPaymentMethod) return alert("Please select a payment method");
    if (backendStatus === "offline") return alert("🚨 Backend server is currently offline. Please try again later.");
    if (!cartItems.length) { alert("Your cart is empty."); router.push("/cart"); return; }

    setLoading(true);
    try {
      // 1) Create internal order (Flask)
      const orderRes = await fetch(`${API_BASE}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          customer_name: shipping.name,
          customer_email: shipping.email,
          customer_phone: shipping.phone,
          shipping_address: `${shipping.address1}${shipping.address2 ? ", " + shipping.address2 : ""}, ${shipping.city}, ${shipping.state} - ${shipping.pincode}, ${shipping.country}`,
          items: cartItems.map((i) => ({
            product_id: i.productId, name: i.name, price: i.price, quantity: i.quantity,
            size: i.size, color: i.color, product_code: i.productCode,
          })),
          subtotal, shipping_fee: shippingFee, grand_total: grandTotal,
          payment_method: selectedPaymentMethod, order_type: isDirectOrder ? "direct" : "cart",
        }),
      });
      const orderJson = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderJson?.error || "Failed to create order");
      const orderId: string = orderJson.order_id;
      if (!orderId) throw new Error("No order ID returned from server");

      // 2) Create RP order (Flask)
      const rpRes = await fetch(`${API_BASE}/api/payments/razorpay/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ order_id: orderId }),
      });
      const rpJson = await rpRes.json();
      if (!rpRes.ok) throw new Error(rpJson?.error || "Payment setup failed");
      if (!rpJson.razorpay_order_id || !rpJson.amount) throw new Error("Invalid Razorpay order response");

      // 3) Load SDK
      if (!(await loadRazorpay())) throw new Error("Failed to load payment gateway");

      // 4) Open checkout
      const rzp = new window.Razorpay({
        key: RZP_KEY_ID,
        amount: rpJson.amount,
        currency: "INR",
        name: "Nazmi Boutique",
        description: `Order for ${cartItems.length} item(s)`,
        order_id: rpJson.razorpay_order_id,
        prefill: { name: shipping.name, email: shipping.email, contact: shipping.phone },
        notes: {
          address: `${shipping.address1}, ${shipping.city}, ${shipping.state} - ${shipping.pincode}`,
          order_type: isDirectOrder ? "direct" : "cart",
          payment_method: selectedPaymentMethod,
          order_id: orderId,
        },
        theme: { color: "#000000" },
        modal: { ondismiss: () => setLoading(false) },
        retry: { enabled: false },
        timeout: 900,
        method: {
          upi: selectedPaymentMethod === "upi",
          card: selectedPaymentMethod === "card",
          netbanking: selectedPaymentMethod === "netbanking",
          wallet: selectedPaymentMethod === "wallet",
        },
        handler: async (resp: any) => {
          try {
            if (!resp.razorpay_payment_id || !resp.razorpay_order_id || !resp.razorpay_signature) {
              throw new Error("Invalid payment response from Razorpay");
            }
            const verifyRes = await fetch(`${API_BASE}/api/payments/razorpay/verify`, {
              method: "POST",
              headers: { "Content-Type": "application/json", ...getAuthHeaders() },
              body: JSON.stringify({
                razorpay_payment_id: resp.razorpay_payment_id,
                razorpay_order_id: resp.razorpay_order_id,
                razorpay_signature: resp.razorpay_signature,
              }),
            });
            const verifyJson = await verifyRes.json();
            if (!verifyRes.ok || !verifyJson.success) throw new Error(verifyJson?.error || "Payment verification failed");
            if (isDirectOrder) sessionStorage.removeItem("directOrder");
            else { localStorage.removeItem("cart"); window.dispatchEvent(new Event("cart-updated")); }
            router.push("/order-success");
          } catch (err: any) {
            alert(`Payment verification failed: ${err.message}`); setLoading(false);
          }
        },
      });

      rzp.on("payment.failed", (r: any) => {
        const msg = r?.error?.description || r?.error?.reason || "Payment failed. Please try again.";
        alert(`Payment Failed: ${msg}`); setLoading(false);
      });

      rzp.open();
    } catch (e: any) {
      const m = String(e?.message || "");
      if (m.includes("Failed to fetch") || m.includes("NetworkError")) {
        alert("🌐 NETWORK ERROR\n\nPlease check your internet and try again.");
      } else if (m.includes("offline")) {
        alert("🚨 SERVICE UNAVAILABLE\n\nPlease try again in a few minutes.");
      } else {
        alert(`❌ Payment Error\n\n${m || "Please try again."}`);
      }
      setLoading(false);
    }
  };

  /* ----- UI helpers (unchanged) ----- */
  const paymentMethods = [
    { id: "upi", name: "UPI", icon: QrCode, description: "Pay via UPI Apps", color: "bg-purple-500" },
    { id: "card", name: "Credit/Debit Card", icon: CreditCard, description: "Visa, Mastercard, RuPay", color: "bg-blue-500" },
    { id: "netbanking", name: "Net Banking", icon: Building, description: "All major banks", color: "bg-green-500" },
    { id: "wallet", name: "Wallet", icon: Wallet, description: "Paytm, PhonePe, etc.", color: "bg-orange-500" },
  ] as const;

  const renderBackendStatus = () => backendStatus === "checking" ? (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4"><p className="text-sm text-yellow-800 text-center">🔍 Checking server connection...</p></div>
  ) : backendStatus === "offline" ? (
    <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4"><p className="text-sm text-red-800 text-center">❌ Server temporarily unavailable. Please try again later.</p></div>
  ) : (
    <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4"><p className="text-sm text-green-800 text-center">✅ Connected to server</p></div>
  );

  const renderPaymentMethodInfo = () => {
    const method = paymentMethods.find((m) => m.id === selectedPaymentMethod);
    if (!method) return (
      <div className="text-center py-8"><CreditCard className="w-16 h-16 text-gray-400 mx-auto mb-4" /><p className="text-gray-600">Select a payment method to continue</p></div>
    );
    return (
      <div className="space-y-4">
        {renderBackendStatus()}
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${method.color} text-white`}><method.icon className="w-6 h-6" /></div>
            <div><h3 className="font-semibold text-gray-900">{method.name}</h3><p className="text-sm text-gray-600">{method.description}</p></div>
          </div>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg">
          <p className="text-sm text-gray-700 text-center">
            {selectedPaymentMethod === "upi" && "📱 You will be redirected to UPI apps like Google Pay, PhonePe, Paytm"}
            {selectedPaymentMethod === "card" && "💳 Enter your card details in the secure payment window"}
            {selectedPaymentMethod === "netbanking" && "🏦 You will be redirected to your bank for payment"}
            {selectedPaymentMethod === "wallet" && "📱 You will be redirected to your wallet app"}
          </p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <p className="text-sm text-green-800 text-center"><strong>Secure Payment:</strong> All transactions are encrypted and protected</p>
        </div>
      </div>
    );
  };

  const DamagedProductsPolicy = () => (
    <div className="border-t pt-6 mt-6">
      <div className="space-y-4">
        <div className="text-center">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-2">
            <Shield className="w-5 h-5 text-red-600" />
          </div>
          <h3 className="font-semibold text-gray-900 text-sm mb-1">Damaged Product Protection</h3>
        </div>
        <div className="space-y-2">
          <div className="flex items-start gap-2"><div className="w-4 h-4 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"><div className="w-1.5 h-1.5 bg-green-600 rounded-full"></div></div><p className="text-xs text-gray-700"><span className="font-semibold">Returns for damage only</span> — Live video verification required</p></div>
          <div className="flex items-start gap-2"><div className="w-4 h-4 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"><div className="w-1.5 h-1.5 bg-green-600 rounded-full"></div></div><p className="text-xs text-gray-700"><span className="font-semibold">24-hour reporting</span> — Contact support immediately</p></div>
          <div className="flex items-start gap-2"><div className="w-4 h-4 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"><div className="w-1.5 h-1.5 bg-green-600 rounded-full"></div></div><p className="text-xs text-gray-700"><span className="font-semibold">Original packaging</span> — Keep tags and packaging intact</p></div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="flex items-start gap-2"><div className="w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"><span className="text-white text-xs font-bold">!</span></div>
            <div><p className="text-xs font-medium text-yellow-800 mb-1">Important:</p><p className="text-xs text-yellow-700">No returns for change of mind, wrong size, or color preference. Only manufacturing defects or transit damage accepted.</p></div>
          </div>
        </div>
        <div className="text-center"><p className="text-xs text-gray-600">Help: <span className="font-semibold">+91-9995947709</span></p></div>
      </div>
    </div>
  );

  if (!cartItems.length) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">No items to checkout</h2>
          <button onClick={() => router.push("/")} className="bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800">Continue Shopping</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 lg:pb-8">
      {/* ...UI below unchanged from your version... */}
      {/* (Keep the rest of your JSX as-is; only network/token logic changed) */}
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-700">Loading checkout...</h2>
        </div>
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}