// app/checkout/page.tsx
"use client";

import { useState, useEffect, Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  ArrowLeft,
  CreditCard,
  Shield,
  Truck,
  Wallet,
  Building,
  QrCode,
  X,
  Video,
} from "lucide-react";

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
  name: string;
  email: string;
  phone: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

/* ========= Globals ========= */
declare global {
  interface Window {
    Razorpay: any;
  }
}

const RZP_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_RZFeCq3NZLg9Rz";
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const SHIPPING_THRESHOLD = 2000;
const SHIPPING_FEE = 60;

const inr = (n: number | string) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

/* ========= Razorpay loader ========= */
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

/* ========= Page (inner with Suspense) ========= */
function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isDirectOrder, setIsDirectOrder] = useState(false);
  const [currentStep, setCurrentStep] = useState<"details" | "payment">("details");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("");
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline">(
    "checking"
  );
  const [showOrderSummary, setShowOrderSummary] = useState(false);

  const [shipping, setShipping] = useState<ShippingInfo>({
    name: "",
    email: "",
    phone: "",
    address1: "",
    address2: "",
    city: "",
    state: "",
    pincode: "",
    country: "India",
  });

  // Optional prefill from saved user (no login required)
  useEffect(() => {
    try {
      const saved = localStorage.getItem("auth_user");
      if (saved) {
        const u = JSON.parse(saved);
        setShipping((s) => ({
          ...s,
          name:
            s.name ||
            [u?.firstName, u?.lastName].filter(Boolean).join(" ") ||
            "",
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
      } catch {
        setBackendStatus("offline");
      }
    })();
  }, []);

  // Load items (cart or direct order)
  useEffect(() => {
    try {
      const orderType = searchParams.get("type");
      if (orderType === "direct") {
        const directOrder = sessionStorage.getItem("directOrder");
        if (directOrder) {
          const items = JSON.parse(directOrder);
          if (Array.isArray(items) && items.length) {
            setCartItems(items);
            setIsDirectOrder(true);
            return;
          }
        }
        alert("No direct order found. Please try again.");
        router.back();
      } else {
        const cartData = localStorage.getItem("cart");
        if (cartData) {
          const items = JSON.parse(cartData);
          if (Array.isArray(items) && items.length) {
            setCartItems(items);
            setIsDirectOrder(false);
            return;
          }
        }
        router.push("/cart");
      }
    } catch (e) {
      console.error(e);
      router.push("/cart");
    }
  }, [searchParams, router]);

  // Totals
  const { subtotal, shippingFee, grandTotal } = useMemo(() => {
    const sub = cartItems.reduce(
      (sum, it) => sum + Number(it.price || 0) * Number(it.quantity || 0),
      0
    );
    const sFee = sub >= SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
    return { subtotal: sub, shippingFee: sFee, grandTotal: sub + sFee };
  }, [cartItems]);

  // Validation
  const validateShippingDetails = () => {
    const required: (keyof ShippingInfo)[] = [
      "name",
      "email",
      "phone",
      "address1",
      "city",
      "state",
      "pincode",
    ];
    for (const f of required) {
      if (!String(shipping[f] || "").trim()) {
        alert(
          `Please fill in ${String(f)
            .replace(/([A-Z])/g, " $1")
            .toLowerCase()}`
        );
        return false;
      }
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(shipping.email))
      return alert("Please enter a valid email address"), false;
    const phoneDigits = shipping.phone.replace(/\D/g, "");
    if (!/^[6-9]\d{9}$/.test(phoneDigits))
      return alert("Please enter a valid 10-digit phone number"), false;
    if (!/^\d{6}$/.test(shipping.pincode.trim()))
      return alert("Please enter a valid 6-digit pincode"), false;
    return true;
  };

  const proceedToPayment = () => {
    if (validateShippingDetails()) setCurrentStep("payment");
  };

  // Payment flow (no auth / token required)
  const initiateRazorpayPayment = async () => {
    if (!selectedPaymentMethod) return alert("Please select a payment method");
    if (backendStatus === "offline")
      return alert(
        "🚨 Backend server is currently offline. Please try again later."
      );
    if (!cartItems.length) {
      alert("Your cart is empty.");
      router.push("/cart");
      return;
    }

    setLoading(true);
    try {
      // 1) Create internal order (Flask)
      const orderRes = await fetch(`${API_BASE}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: shipping.name,
          customer_email: shipping.email,
          customer_phone: shipping.phone,
          shipping_address: `${shipping.address1}${
            shipping.address2 ? ", " + shipping.address2 : ""
          }, ${shipping.city}, ${shipping.state} - ${
            shipping.pincode
          }, ${shipping.country}`,
          items: cartItems.map((i) => ({
            product_id: i.productId,
            name: i.name,
            price: i.price,
            quantity: i.quantity,
            size: i.size,
            color: i.color,
            product_code: i.productCode,
          })),
          subtotal,
          shipping_fee: shippingFee,
          grand_total: grandTotal,
          payment_method: selectedPaymentMethod,
          order_type: isDirectOrder ? "direct" : "cart",
        }),
      });
      const orderJson = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderJson?.error || "Failed to create order");
      const orderId: string = orderJson.order_id;
      if (!orderId) throw new Error("No order ID returned from server");

      // 2) Create Razorpay order (Flask)
      const rpRes = await fetch(`${API_BASE}/api/payments/razorpay/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId }),
      });
      const rpJson = await rpRes.json();
      if (!rpRes.ok) throw new Error(rpJson?.error || "Payment setup failed");
      if (!rpJson.razorpay_order_id || !rpJson.amount)
        throw new Error("Invalid Razorpay order response");

      // 3) Load SDK
      if (!(await loadRazorpay()))
        throw new Error("Failed to load payment gateway");

      // 4) Open checkout
      const rzp = new window.Razorpay({
        key: RZP_KEY_ID,
        amount: rpJson.amount,
        currency: "INR",
        name: "Nazmi Boutique",
        description: `Order for ${cartItems.length} item(s)`,
        order_id: rpJson.razorpay_order_id,
        prefill: {
          name: shipping.name,
          email: shipping.email,
          contact: shipping.phone,
        },
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
            if (
              !resp.razorpay_payment_id ||
              !resp.razorpay_order_id ||
              !resp.razorpay_signature
            ) {
              throw new Error("Invalid payment response from Razorpay");
            }
            const verifyRes = await fetch(
              `${API_BASE}/api/payments/razorpay/verify`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  razorpay_payment_id: resp.razorpay_payment_id,
                  razorpay_order_id: resp.razorpay_order_id,
                  razorpay_signature: resp.razorpay_signature,
                }),
              }
            );
            const verifyJson = await verifyRes.json();
            if (!verifyRes.ok || !verifyJson.success)
              throw new Error(
                verifyJson?.error || "Payment verification failed"
              );
            if (isDirectOrder) {
              sessionStorage.removeItem("directOrder");
            } else {
              localStorage.removeItem("cart");
              window.dispatchEvent(new Event("cart-updated"));
            }
            router.push("/order-success");
          } catch (err: any) {
            alert(`Payment verification failed: ${err.message}`);
            setLoading(false);
          }
        },
      });

      rzp.on("payment.failed", (r: any) => {
        const msg =
          r?.error?.description ||
          r?.error?.reason ||
          "Payment failed. Please try again.";
        alert(`Payment Failed: ${msg}`);
        setLoading(false);
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

  /* ----- UI helpers ----- */
  const paymentMethods = [
    {
      id: "upi",
      name: "UPI",
      icon: QrCode,
      description: "Pay via UPI Apps",
      color: "bg-purple-500",
    },
    {
      id: "card",
      name: "Credit/Debit Card",
      icon: CreditCard,
      description: "Visa, Mastercard, RuPay",
      color: "bg-blue-500",
    },
    {
      id: "netbanking",
      name: "Net Banking",
      icon: Building,
      description: "All major banks",
      color: "bg-green-500",
    },
    {
      id: "wallet",
      name: "Wallet",
      icon: Wallet,
      description: "Paytm, PhonePe, etc.",
      color: "bg-orange-500",
    },
  ] as const;

  const renderBackendStatus = () =>
    backendStatus === "checking" ? (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
        <p className="text-sm text-yellow-800 text-center">
          🔍 Checking server connection...
        </p>
      </div>
    ) : backendStatus === "offline" ? (
      <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
        <p className="text-sm text-red-800 text-center">
          ❌ Server temporarily unavailable. Please try again later.
        </p>
      </div>
    ) : (
      <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
        <p className="text-sm text-green-800 text-center">✅ Connected to server</p>
      </div>
    );

  const renderPaymentMethodInfo = () => {
    const method = paymentMethods.find((m) => m.id === selectedPaymentMethod);
    if (!method)
      return (
        <div className="text-center py-8">
          <CreditCard className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">
            Select a payment method to continue
          </p>
        </div>
      );
    return (
      <div className="space-y-4">
        {renderBackendStatus()}
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${method.color} text-white`}>
              <method.icon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{method.name}</h3>
              <p className="text-sm text-gray-600">{method.description}</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg">
          <p className="text-sm text-gray-700 text-center">
            {selectedPaymentMethod === "upi" &&
              "📱 You will be redirected to UPI apps like Google Pay, PhonePe, Paytm"}
            {selectedPaymentMethod === "card" &&
              "💳 Enter your card details in the secure payment window"}
            {selectedPaymentMethod === "netbanking" &&
              "🏦 You will be redirected to your bank for payment"}
            {selectedPaymentMethod === "wallet" &&
              "📱 You will be redirected to your wallet app"}
          </p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <p className="text-sm text-green-800 text-center">
            <strong>Secure Payment:</strong> All transactions are encrypted and
            protected
          </p>
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
          <h3 className="font-semibold text-gray-900 text-sm mb-1">
            Damaged Product Protection
          </h3>
        </div>
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <div className="w-4 h-4 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <div className="w-1.5 h-1.5 bg-green-600 rounded-full"></div>
            </div>
            <p className="text-xs text-gray-700">
              <span className="font-semibold">Returns for damage only</span> —{" "}
              Live video verification required{" "}
              <Video className="inline w-3 h-3 text-gray-500 ml-1" />
            </p>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-4 h-4 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <div className="w-1.5 h-1.5 bg-green-600 rounded-full"></div>
            </div>
            <p className="text-xs text-gray-700">
              <span className="font-semibold">24-hour reporting</span> — Contact
              support immediately
            </p>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-4 h-4 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <div className="w-1.5 h-1.5 bg-green-600 rounded-full"></div>
            </div>
            <p className="text-xs text-gray-700">
              <span className="font-semibold">Original packaging</span> — Keep
              tags and packaging intact
            </p>
          </div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <div className="w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-white text-xs font-bold">!</span>
            </div>
            <div>
              <p className="text-xs font-medium text-yellow-800 mb-1">
                Important:
              </p>
              <p className="text-xs text-yellow-700">
                No returns for change of mind, wrong size, or color preference.
                Only manufacturing defects or transit damage accepted.
              </p>
            </div>
          </div>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-600">
            Help: <span className="font-semibold">+91-9995947709</span>
          </p>
        </div>
      </div>
    </div>
  );

  const renderOrderSummary = () => (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">
            Order Summary
          </h2>
          <span className="text-xs text-gray-500">
            {cartItems.length} item{cartItems.length > 1 ? "s" : ""}
          </span>
        </div>

        <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
          {cartItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 border-b last:border-b-0 pb-3 last:pb-0"
            >
              <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                <Image
                  src={item.image || "/images/poster1.png"}
                  alt={item.name}
                  width={56}
                  height={56}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 line-clamp-2">
                  {item.name}
                </p>
                <p className="text-xs text-gray-500">
                  {item.size && `Size: ${item.size}`}{" "}
                  {item.size && item.color && "•"}{" "}
                  {item.color && `Color: ${item.color}`}
                </p>
                <p className="text-xs text-gray-500">
                  Qty: {item.quantity} • Code: {item.productCode}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-900">
                  {inr(item.price * item.quantity)}
                </p>
                <p className="text-[10px] text-gray-400">
                  {inr(item.price)} / item
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t mt-3 pt-3 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Subtotal</span>
            <span className="font-medium text-gray-900">
              {inr(subtotal)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Shipping</span>
            <span
              className={`font-medium ${
                shippingFee === 0 ? "text-green-700" : "text-gray-900"
              }`}
            >
              {shippingFee === 0 ? "FREE" : inr(shippingFee)}
            </span>
          </div>
          <div className="flex justify-between items-center pt-1 border-t">
            <span className="text-sm text-gray-600">Total</span>
            <span className="text-lg font-semibold text-gray-900">
              {inr(grandTotal)}
            </span>
          </div>
          {shippingFee > 0 && (
            <p className="text-xs text-gray-500 pt-1">
              Add items worth {inr(SHIPPING_THRESHOLD - subtotal)} more to get{" "}
              <b>Free Shipping</b>.
            </p>
          )}
        </div>

        <div className="mt-4 flex items-center gap-2 bg-gray-50 border border-dashed border-gray-200 rounded-xl px-3 py-2.5">
          <Truck className="w-4 h-4 text-gray-600" />
          <p className="text-xs text-gray-600">
            Estimated delivery{" "}
            <span className="font-medium">3–7 working days</span> across Kerala.
          </p>
        </div>
      </div>

      <DamagedProductsPolicy />
    </div>
  );

  if (!cartItems.length) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">No items to checkout</h2>
          <button
            onClick={() => router.push("/")}
            className="bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24 lg:pb-10">
      {/* Header */}
      <div className="border-b bg-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="flex-1 text-center lg:text-left">
            <h1 className="text-sm sm:text-base font-semibold text-gray-900">
              Checkout – Nazmi Boutique
            </h1>
            <p className="text-[11px] text-gray-500">
              Secure payment powered by Razorpay
            </p>
          </div>
          <button
            className="ml-auto inline-flex items-center gap-2 text-xs font-medium text-gray-700 lg:hidden"
            onClick={() => setShowOrderSummary(true)}
          >
            <span>View summary</span>
            <span className="px-2 py-1 rounded-full bg-gray-100 text-[11px]">
              {inr(grandTotal)}
            </span>
          </button>
        </div>
      </div>

      {/* Steps + layout */}
      <main className="max-w-6xl mx-auto px-4 pt-4 lg:pt-8 grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1.25fr)] gap-6 lg:gap-8">
        {/* LEFT: Steps & forms */}
        <section>
          {/* Step indicator */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                    currentStep === "details"
                      ? "bg-black text-white"
                      : "bg-gray-900 text-white"
                  }`}
                >
                  1
                </div>
                <span
                  className={`text-xs sm:text-sm font-medium ${
                    currentStep === "details"
                      ? "text-gray-900"
                      : "text-gray-600"
                  }`}

                >
                  Shipping Details
                </span>
              </div>
              <div className="h-px w-10 sm:w-16 bg-gray-300" />
              <div className="flex items-center gap-2">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                    currentStep === "payment"
                      ? "bg-black text-white"
                      : "bg-gray-200 text-gray-500"
                  }`}
                >
                  2
                </div>
                <span
                  className={`text-xs sm:text-sm font-medium ${
                    currentStep === "payment"
                      ? "text-gray-900"
                      : "text-gray-400"
                  }`}
                >
                  Payment
                </span>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-[11px] text-gray-500">
              <Shield className="w-3.5 h-3.5" />
              100% secure & encrypted
            </div>
          </div>

          {/* Step content */}
          {currentStep === "details" ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">
                Shipping Details
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={shipping.name}
                    onChange={(e) =>
                      setShipping((s) => ({ ...s, name: e.target.value }))
                    }
                    className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent"
                    placeholder="Enter your full name"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={shipping.email}
                    onChange={(e) =>
                      setShipping((s) => ({ ...s, email: e.target.value }))
                    }
                    className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent"
                    placeholder="example@gmail.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={shipping.phone}
                    onChange={(e) =>
                      setShipping((s) => ({ ...s, phone: e.target.value }))
                    }
                    className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent"
                    placeholder="10-digit mobile number"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Address Line 1
                  </label>
                  <input
                    type="text"
                    value={shipping.address1}
                    onChange={(e) =>
                      setShipping((s) => ({ ...s, address1: e.target.value }))
                    }
                    className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent"
                    placeholder="House / Building / Street"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Address Line 2 (optional)
                  </label>
                  <input
                    type="text"
                    value={shipping.address2}
                    onChange={(e) =>
                      setShipping((s) => ({ ...s, address2: e.target.value }))
                    }
                    className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent"
                    placeholder="Landmark, Apartment name, etc."
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={shipping.city}
                    onChange={(e) =>
                      setShipping((s) => ({ ...s, city: e.target.value }))
                    }
                    className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent"
                    placeholder="City"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    State
                  </label>
                  <input
                    type="text"
                    value={shipping.state}
                    onChange={(e) =>
                      setShipping((s) => ({ ...s, state: e.target.value }))
                    }
                    className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent"
                    placeholder="State"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Pincode
                  </label>
                  <input
                    type="text"
                    value={shipping.pincode}
                    onChange={(e) =>
                      setShipping((s) => ({ ...s, pincode: e.target.value }))
                    }
                    className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent"
                    placeholder="6-digit pincode"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Country
                  </label>
                  <input
                    type="text"
                    value={shipping.country}
                    onChange={(e) =>
                      setShipping((s) => ({ ...s, country: e.target.value }))
                    }
                    className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent"
                    placeholder="Country"
                  />
                </div>
              </div>

              <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3">
                <button
                  onClick={proceedToPayment}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-black text-white px-6 py-3 rounded-lg text-sm font-medium hover:bg-gray-900"
                >
                  Continue to Payment
                </button>
                <p className="text-[11px] text-gray-500">
                  By continuing, you agree to our Terms & Conditions.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-gray-900">
                  Payment Method
                </h2>
                <button
                  onClick={() => setCurrentStep("details")}
                  className="text-xs text-gray-500 hover:text-gray-800 underline"
                >
                  Edit shipping details
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                {paymentMethods.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedPaymentMethod(m.id)}
                    className={`flex items-center gap-3 border rounded-xl px-3 py-3.5 text-left transition ${
                      selectedPaymentMethod === m.id
                        ? "border-black bg-black text-white"
                        : "border-gray-200 bg-white hover:border-gray-400"
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${m.color}`}
                    >
                      <m.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p
                        className={`text-sm font-semibold ${
                          selectedPaymentMethod === m.id
                            ? "text-white"
                            : "text-gray-900"
                        }`}
                      >
                        {m.name}
                      </p>
                      <p
                        className={`text-[11px] ${
                          selectedPaymentMethod === m.id
                            ? "text-gray-100"
                            : "text-gray-500"
                        }`}
                      >
                        {m.description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              {renderPaymentMethodInfo()}

              <div className="mt-6 space-y-2">
                <button
                  onClick={initiateRazorpayPayment}
                  disabled={loading || !selectedPaymentMethod}
                  className="w-full inline-flex items-center justify-center gap-2 bg-black text-white py-3 rounded-lg text-sm font-medium hover:bg-gray-900 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" />
                      Pay Securely with Razorpay
                    </>
                  )}
                </button>
                <p className="text-[11px] text-gray-500 text-center">
                  Do not refresh or close this page during payment.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* RIGHT: Summary (desktop) */}
        <aside className="hidden lg:block">{renderOrderSummary()}</aside>
      </main>

      {/* Mobile summary bottom sheet */}
      {showOrderSummary && (
        <div className="fixed inset-0 z-40 bg-black/40 flex justify-center items-end lg:hidden">
          <div className="bg-white rounded-t-2xl w-full max-h-[80vh] p-4 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">
                Order Summary
              </h3>
              <button
                onClick={() => setShowOrderSummary(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>
            {renderOrderSummary()}
          </div>
        </div>
      )}
    </div>
  );
}

/* ========= Outer (Suspense wrapper) ========= */
export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-700">
              Loading checkout...
            </h2>
          </div>
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
