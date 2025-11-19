// app/checkout/page.tsx
"use client";

import { useState, useEffect, Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, CreditCard, Shield, Truck, X, Video, Lock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

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
  city: string;
  state: string;
  pincode: string;
  country: string;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

const RZP_KEY_ID =
  process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_RZFeCq3NZLg9Rz";
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const SHIPPING_THRESHOLD = 2000;
const SHIPPING_FEE = 60;

const inr = (n: number | string) =>
  `₹${Number(n || 0).toLocaleString("en-IN")}`;

async function loadRazorpay(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (window.Razorpay) return true;
  
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, loading: authLoading, user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isDirectOrder, setIsDirectOrder] = useState(false);
  const [backendStatus, setBackendStatus] = useState<
    "checking" | "online" | "offline"
  >("checking");
  const [showOrderSummary, setShowOrderSummary] = useState(false);

  const [shipping, setShipping] = useState<ShippingInfo>({
    name: "",
    email: "",
    phone: "",
    address1: "",
    city: "",
    state: "",
    pincode: "",
    country: "India",
  });

  // Determine login redirect target
  const [loginUrl, setLoginUrl] = useState("/auth/login?redirect=%2Fcheckout");
  
  useEffect(() => {
    if (typeof window === "undefined") return;
    const queryString = window.location.search || "";
    setLoginUrl(`/auth/login?redirect=${encodeURIComponent(`/checkout${queryString}`)}`);
  }, []);

  // Prefill from logged-in user
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    
    setShipping((prev) => ({
      ...prev,
      name: prev.name || 
           [user.firstName, user.lastName].filter(Boolean).join(" ") || 
           (user as any).username ||
           "",
      email: prev.email || user.email || "",
      phone: prev.phone || (user.phone ? String(user.phone) : ""),
    }));
  }, [isAuthenticated, user]);

  // Check backend health
  useEffect(() => {
    const checkBackendHealth = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/health`);
        setBackendStatus(response.ok ? "online" : "offline");
      } catch {
        setBackendStatus("offline");
      }
    };

    checkBackendHealth();
  }, []);

  // Load items (direct order or cart)
  useEffect(() => {
    const loadCartItems = () => {
      try {
        const orderType = searchParams.get("type");
        
        if (orderType === "direct") {
          const directOrder = sessionStorage.getItem("directOrder");
          if (directOrder) {
            const items = JSON.parse(directOrder);
            if (Array.isArray(items) && items.length > 0) {
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
            if (Array.isArray(items) && items.length > 0) {
              setCartItems(items);
              setIsDirectOrder(false);
              return;
            }
          }
          router.push("/cart");
        }
      } catch (error) {
        console.error("Error loading cart items:", error);
        router.push("/cart");
      }
    };

    loadCartItems();
  }, [searchParams, router]);

  // Calculate totals
  const { subtotal, shippingFee, grandTotal } = useMemo(() => {
    const sub = cartItems.reduce(
      (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0),
      0
    );
    const fee = sub >= SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
    return { 
      subtotal: sub, 
      shippingFee: fee, 
      grandTotal: sub + fee 
    };
  }, [cartItems]);

  // Load saved addresses when logged in
  useEffect(() => {
    const loadSavedAddresses = async () => {
      try {
        const token = localStorage.getItem("auth_token");
        if (!token) return;

        const response = await fetch(`/api/user/addresses`, { 
          cache: "no-store" 
        });
        
        if (!response.ok) return;

        const data = await response.json().catch(() => null) as
          | { addresses?: any[]; defaultId?: string }
          | null;

        const addresses = data?.addresses ?? [];
        if (addresses.length === 0) return;

        const defaultAddress = addresses.find((addr: any) => addr.isDefault) || addresses[0];
        
        setShipping((prev) => ({
          ...prev,
          name: defaultAddress.fullName || prev.name,
          phone: defaultAddress.phone || prev.phone,
          address1: defaultAddress.line1 || prev.address1,
          city: defaultAddress.city || prev.city,
          state: defaultAddress.state || prev.state,
          pincode: defaultAddress.pincode || prev.pincode,
        }));
      } catch (error) {
        console.error("Error loading saved addresses:", error);
      }
    };

    loadSavedAddresses();
  }, []);

  // Fallback: prefill from last saved address in localStorage
  useEffect(() => {
    try {
      const lastAddress = localStorage.getItem("last_shipping_address");
      if (!lastAddress) return;

      const address = JSON.parse(lastAddress);
      setShipping((prev) => ({
        ...prev,
        name: address.fullName || prev.name,
        phone: address.phone || prev.phone,
        address1: address.line1 || prev.address1,
        city: address.city || prev.city,
        state: address.state || prev.state,
        pincode: address.pincode || prev.pincode,
      }));
    } catch (error) {
      console.error("Error loading last shipping address:", error);
    }
  }, []);

  // Validation function
  const validateShippingDetails = (): boolean => {
    const required: (keyof ShippingInfo)[] = [
      "name",
      "email",
      "phone",
      "address1",
      "city",
      "state",
      "pincode",
    ];

    for (const field of required) {
      if (!String(shipping[field] || "").trim()) {
        const fieldName = field.replace(/([A-Z])/g, " $1").toLowerCase();
        alert(`Please fill in ${fieldName}`);
        return false;
      }
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(shipping.email)) {
      alert("Please enter a valid email address");
      return false;
    }

    const phoneDigits = shipping.phone.replace(/\D/g, "");
    if (!/^[6-9]\d{9}$/.test(phoneDigits)) {
      alert("Please enter a valid 10-digit phone number");
      return false;
    }

    if (!/^\d{6}$/.test(shipping.pincode.trim())) {
      alert("Please enter a valid 6-digit pincode");
      return false;
    }

    return true;
  };

  // Payment handler
  const payWithRazorpay = async () => {
    if (backendStatus === "offline") {
      alert("Backend server is currently offline. Please try again later.");
      return;
    }

    if (cartItems.length === 0) {
      alert("Your cart is empty.");
      router.push("/cart");
      return;
    }

    if (!validateShippingDetails()) return;

    setLoading(true);

    try {
      // Save address for future prefill
      localStorage.setItem(
        "last_shipping_address",
        JSON.stringify({
          fullName: shipping.name,
          phone: shipping.phone,
          line1: shipping.address1,
          city: shipping.city,
          state: shipping.state,
          pincode: shipping.pincode,
        })
      );

      const token = localStorage.getItem("auth_token");

      // 1) Create internal order
      const orderResponse = await fetch(`${API_BASE}/api/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          customer_name: shipping.name,
          customer_email: shipping.email,
          customer_phone: shipping.phone,
          shipping_address: {
            fullName: shipping.name,
            phone: shipping.phone,
            line1: shipping.address1,
            city: shipping.city,
            state: shipping.state,
            pincode: shipping.pincode,
          },
          items: cartItems.map((item) => ({
            product_id: item.productId,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            size: item.size,
            color: item.color,
            image: item.image,
            product_code: item.productCode,
          })),
          subtotal,
          shipping_fee: shippingFee,
          grand_total: grandTotal,
          payment_method: "razorpay",
          order_type: isDirectOrder ? "direct" : "cart",
        }),
      });

      const orderData = await orderResponse.json();
      
      if (!orderResponse.ok) {
        throw new Error(orderData?.error || "Failed to create order");
      }

      const orderId: string = orderData.order_id;
      if (!orderId) {
        throw new Error("No order ID returned from server");
      }

      // 2) Create Razorpay order
      const razorpayResponse = await fetch(
        `${API_BASE}/api/payments/razorpay/create-order`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order_id: orderId }),
        }
      );

      const razorpayData = await razorpayResponse.json();
      
      if (!razorpayResponse.ok) {
        throw new Error(razorpayData?.error || "Payment setup failed");
      }

      if (!razorpayData.razorpay_order_id || !razorpayData.amount) {
        throw new Error("Invalid Razorpay order response");
      }

      // 3) Load Razorpay SDK
      if (!(await loadRazorpay())) {
        throw new Error("Failed to load payment gateway");
      }

      // 4) Open Razorpay checkout
      const razorpay = new window.Razorpay({
        key: RZP_KEY_ID,
        amount: razorpayData.amount,
        currency: "INR",
        name: "Nazmi Boutique",
        description: `Order for ${cartItems.length} item(s)`,
        order_id: razorpayData.razorpay_order_id,
        prefill: {
          name: shipping.name,
          email: shipping.email,
          contact: shipping.phone,
        },
        notes: {
          address: `${shipping.address1}, ${shipping.city}, ${shipping.state} - ${shipping.pincode}`,
          order_type: isDirectOrder ? "direct" : "cart",
          payment_method: "razorpay",
          order_id: orderId,
        },
        theme: { color: "#000000" },
        modal: {
          ondismiss: async () => {
            setLoading(false);
            try {
              await fetch(`/api/payments/attempt-log`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  order_id: orderId,
                  status: "cancelled",
                  razorpay_order_id: razorpayData.razorpay_order_id,
                }),
              });
            } catch {
              // Ignore logging errors
            }
          },
        },
        retry: { enabled: false },
        timeout: 900,
        handler: async (response: any) => {
          try {
            // Verify payment
            const verifyResponse = await fetch(
              `${API_BASE}/api/payments/razorpay/verify`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_signature: response.razorpay_signature,
                }),
              }
            );

            const verifyData = await verifyResponse.json();
            
            if (!verifyResponse.ok || !verifyData.success) {
              throw new Error(
                verifyData?.error || "Payment verification failed"
              );
            }

            // Clear cart/local storage
            if (isDirectOrder) {
              sessionStorage.removeItem("directOrder");
            } else {
              localStorage.removeItem("cart");
              window.dispatchEvent(new Event("cart-updated"));
            }

            setLoading(false);
            // Redirect to orders page
            router.push("/account?tab=orders");
          } catch (error: any) {
            try {
              await fetch(`/api/payments/attempt-log`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  order_id: orderId,
                  status: "failed",
                  razorpay_order_id: response?.razorpay_order_id,
                  razorpay_payment_id: response?.razorpay_payment_id,
                  reason: error?.message,
                }),
              });
            } catch {
              // Ignore logging errors
            }
            
            alert(`Payment verification failed: ${error.message}`);
            setLoading(false);
          }
        },
      });

      razorpay.on("payment.failed", (response: any) => {
        const errorMessage =
          response?.error?.description ||
          response?.error?.reason ||
          "Payment failed. Please try again.";
        
        try {
          fetch(`/api/payments/attempt-log`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              order_id: orderId,
              status: "failed",
              razorpay_order_id: razorpayData.razorpay_order_id,
              reason: errorMessage,
            }),
          });
        } catch {
          // Ignore logging errors
        }
        
        alert(`Payment Failed: ${errorMessage}`);
        setLoading(false);
      });

      razorpay.open();
    } catch (error: any) {
      const errorMessage = String(error?.message || "");
      
      if (errorMessage.includes("Failed to fetch") || errorMessage.includes("NetworkError")) {
        alert("NETWORK ERROR\n\nPlease check your internet connection and try again.");
      } else if (errorMessage.includes("offline")) {
        alert("SERVICE UNAVAILABLE\n\nPlease try again in a few minutes.");
      } else {
        alert(`Payment Error\n\n${errorMessage || "Please try again."}`);
      }
      
      setLoading(false);
    }
  };

  // Damaged Products Policy Component
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
              <div className="w-1.5 h-1.5 bg-green-600 rounded-full" />
            </div>
            <p className="text-xs text-gray-700">
              <span className="font-semibold">Returns for damage only</span> — Live
              video verification required{" "}
              <Video className="inline w-3 h-3 text-gray-500 ml-1" />
            </p>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-4 h-4 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <div className="w-1.5 h-1.5 bg-green-600 rounded-full" />
            </div>
            <p className="text-xs text-gray-700">
              <span className="font-semibold">24-hour reporting</span> — Contact
              support immediately
            </p>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-4 h-4 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <div className="w-1.5 h-1.5 bg-green-600 rounded-full" />
            </div>
            <p className="text-xs text-gray-700">
              <span className="font-semibold">Original packaging</span> — Keep tags
              and packaging intact
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

  // Order Summary Component
  const renderOrderSummary = () => (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">
            Order Summary
          </h2>
          <span className="text-xs text-gray-500">
            {cartItems.length} item{cartItems.length !== 1 ? "s" : ""}
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
                  {item.size && `Size: ${item.size}`}
                  {item.size && item.color && " • "}
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
            <span className="font-medium">3–7 working days</span> across
            Kerala.
          </p>
        </div>
      </div>
      <DamagedProductsPolicy />
    </div>
  );

  // Loading state
  if (authLoading) {
    return (
      <section className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-600">Checking your session…</p>
        </div>
      </section>
    );
  }

  // Authentication check
  if (!isAuthenticated) {
    return (
      <section className="min-h-screen bg-[#fbfaf8] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white border border-gray-100 rounded-2xl shadow-xl p-6 space-y-4 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gray-900 text-white flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-semibold text-gray-900">
              Sign in to continue
            </h1>
            <p className="text-sm text-gray-600">
              Checkout with your Nazmi Boutique account so we can save your
              address, apply offers, and track your orders.
            </p>
          </div>
          <button
            className="w-full bg-black text-white py-3 rounded-lg font-semibold hover:bg-gray-800 transition"
            onClick={() => router.push(loginUrl)}
          >
            Sign in now
          </button>
          <p className="text-xs text-gray-500">
            Don&apos;t have an account? You can create one on the next screen in
            a few seconds.
          </p>
        </div>
      </section>
    );
  }

  // Empty cart state
  if (cartItems.length === 0) {
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
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="flex-1 text-center lg:text-left">
            <h1 className="text-sm sm:text-base font-semibold text-gray-900">
              Checkout Nazmi Boutique
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

      {/* Main Layout */}
      <main className="max-w-6xl mx-auto px-4 pt-4 lg:pt-8 grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1.25fr)] gap-6 lg:gap-8">
        {/* LEFT: Shipping Form + Payment */}
        <section>
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
                    setShipping((prev) => ({ ...prev, name: e.target.value }))
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
                    setShipping((prev) => ({ ...prev, email: e.target.value }))
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
                    setShipping((prev) => ({ ...prev, phone: e.target.value }))
                  }
                  className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent"
                  placeholder="10-digit mobile number"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Address
                </label>
                <input
                  type="text"
                  value={shipping.address1}
                  onChange={(e) =>
                    setShipping((prev) => ({ ...prev, address1: e.target.value }))
                  }
                  className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent"
                  placeholder="House / Building / Street / Landmark"
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
                    setShipping((prev) => ({ ...prev, city: e.target.value }))
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
                    setShipping((prev) => ({ ...prev, state: e.target.value }))
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
                    setShipping((prev) => ({ ...prev, pincode: e.target.value }))
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
                    setShipping((prev) => ({ ...prev, country: e.target.value }))
                  }
                  className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent"
                  placeholder="Country"
                />
              </div>
            </div>

            <div className="mt-5">
              <button
                onClick={payWithRazorpay}
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 bg-black text-white px-6 py-3 rounded-lg text-sm font-medium hover:bg-gray-900 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
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
              <p className="text-[11px] text-gray-500 mt-2 text-center">
                Do not refresh or close this page during payment.
              </p>
            </div>
          </div>
        </section>

        {/* RIGHT: Order Summary (desktop) */}
        <aside className="hidden lg:block">{renderOrderSummary()}</aside>
      </main>

      {/* Mobile Order Summary Bottom Sheet */}
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

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4" />
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