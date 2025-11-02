'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, CreditCard, Shield, Truck, Wallet, Building, QrCode, X, Video, Clock, Package } from 'lucide-react';

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

const RZP_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_RZFeCq3NZLg9Rz";
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://nazmi-boutique-2.onrender.com";

const SHIPPING_THRESHOLD = 2000;
const SHIPPING_FEE = 60;

// Load Razorpay
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

// ✅ WRAP the main component to handle useSearchParams
function CheckoutContent() {
  const [loading, setLoading] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isDirectOrder, setIsDirectOrder] = useState(false);
  const [currentStep, setCurrentStep] = useState<'details' | 'payment'>('details');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [showOrderSummary, setShowOrderSummary] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  
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

  // Payment methods
  const paymentMethods = [
    { 
      id: 'upi', 
      name: 'UPI', 
      icon: QrCode, 
      description: 'Pay via UPI Apps',
      color: 'bg-purple-500'
    },
    { 
      id: 'card', 
      name: 'Credit/Debit Card', 
      icon: CreditCard, 
      description: 'Visa, Mastercard, RuPay',
      color: 'bg-blue-500'
    },
    { 
      id: 'netbanking', 
      name: 'Net Banking', 
      icon: Building, 
      description: 'All major banks',
      color: 'bg-green-500'
    },
    { 
      id: 'wallet', 
      name: 'Wallet', 
      icon: Wallet, 
      description: 'Paytm, PhonePe, etc.',
      color: 'bg-orange-500'
    },
  ];

  // Check backend status on component mount
  useEffect(() => {
    const checkBackendStatus = async () => {
      try {
        console.log('🔍 Checking backend status at:', API_BASE);
        const response = await fetch(`${API_BASE}/`, {
          method: 'GET',
          headers: { "Content-Type": "application/json" },
        });
        
        if (response.ok) {
          console.log('✅ Backend is online');
          setBackendStatus('online');
        } else {
          console.log('❌ Backend returned error:', response.status);
          setBackendStatus('offline');
        }
      } catch (error) {
        console.error('❌ Backend connection failed:', error);
        setBackendStatus('offline');
      }
    };

    checkBackendStatus();
  }, []);

  // Load order items
  useEffect(() => {
    const loadOrderItems = () => {
      try {
        const orderType = searchParams.get('type');
        
        if (orderType === 'direct') {
          const directOrder = sessionStorage.getItem('directOrder');
          if (directOrder) {
            const items = JSON.parse(directOrder);
            setCartItems(items);
            setIsDirectOrder(true);
          } else {
            alert('No direct order found. Please try again.');
            router.back();
          }
        } else {
          const cartData = localStorage.getItem("cart");
          if (cartData) {
            const items = JSON.parse(cartData);
            setCartItems(items);
            setIsDirectOrder(false);
          } else {
            router.push('/cart');
          }
        }
      } catch (error) {
        console.error("Error loading order items:", error);
        router.push('/cart');
      }
    };

    loadOrderItems();
  }, [searchParams, router]);

  // Calculate totals
  const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const shippingFee = subtotal >= SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  const grandTotal = subtotal + shippingFee;

  // Validate shipping details
  const validateShippingDetails = () => {
    const required: (keyof ShippingInfo)[] = ["name", "email", "phone", "address1", "city", "state", "pincode"];
    for (const field of required) {
      if (!shipping[field]?.trim()) {
        alert(`Please fill in ${field.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
        return false;
      }
    }
    return true;
  };

  // Proceed to payment
  const proceedToPayment = () => {
    if (validateShippingDetails()) {
      setCurrentStep('payment');
    }
  };

  // ✅ UPDATED: Initialize Razorpay payment with better error handling
  const initiateRazorpayPayment = async () => {
    if (!selectedPaymentMethod) {
      alert('Please select a payment method');
      return;
    }

    if (backendStatus === 'offline') {
      alert('🚨 Backend server is currently offline. Please try again later.');
      return;
    }

    setLoading(true);

    try {
      console.log('🚀 Starting payment process...');
      console.log('📞 Backend URL:', API_BASE);

      // 1. Create order in backend
      const orderData = {
        customer_name: shipping.name,
        customer_email: shipping.email,
        customer_phone: shipping.phone,
        shipping_address: `${shipping.address1}${shipping.address2 ? ', ' + shipping.address2 : ''}, ${shipping.city}, ${shipping.state} - ${shipping.pincode}, ${shipping.country}`,
        items: cartItems.map(item => ({
          product_id: item.productId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          size: item.size,
          color: item.color,
          product_code: item.productCode,
        })),
        subtotal,
        shipping_fee: shippingFee,
        grand_total: grandTotal,
        payment_method: selectedPaymentMethod,
        order_type: isDirectOrder ? "direct" : "cart"
      };

      console.log('📦 Creating order with data:', orderData);

      // Create order in your backend with timeout
      const orderResponse = await fetch(`${API_BASE}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData),
      });

      if (!orderResponse.ok) {
        const errorText = await orderResponse.text();
        console.error('❌ Order creation failed:', {
          status: orderResponse.status,
          statusText: orderResponse.statusText,
          error: errorText
        });
        throw new Error(`Failed to create order: ${orderResponse.status} - ${orderResponse.statusText}`);
      }

      const orderResult = await orderResponse.json();
      const orderId = orderResult.order_id || orderResult._id;

      console.log('✅ Order created successfully:', orderId);

      // 2. Create Razorpay order
      console.log('💰 Creating Razorpay order for order ID:', orderId);
      
      const razorpayResponse = await fetch(`${API_BASE}/api/payments/razorpay/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: orderId
        }),
      });

      if (!razorpayResponse.ok) {
        const errorText = await razorpayResponse.text();
        console.error('❌ Razorpay order creation failed:', {
          status: razorpayResponse.status,
          statusText: razorpayResponse.statusText,
          error: errorText
        });
        throw new Error(`Payment setup failed: ${razorpayResponse.status} - ${razorpayResponse.statusText}`);
      }

      const razorpayOrder = await razorpayResponse.json();
      console.log('✅ Razorpay order created:', razorpayOrder);

      // ✅ VALIDATION CHECKS
      if (razorpayOrder.currency !== "INR") {
        throw new Error("Currency mismatch. Expected INR, got: " + razorpayOrder.currency);
      }

      if (!razorpayOrder.razorpay_order_id) {
        throw new Error("Invalid Razorpay order response - missing order ID");
      }

      if (!razorpayOrder.amount || razorpayOrder.amount === 0) {
        throw new Error("Invalid amount in Razorpay order");
      }

      // 3. Load Razorpay SDK
      console.log('📚 Loading Razorpay SDK...');
      const razorpayLoaded = await loadRazorpay();
      if (!razorpayLoaded) {
        throw new Error("Failed to load payment gateway. Please check your internet connection.");
      }

      // 4. Razorpay configuration
      const options: any = {
        key: RZP_KEY_ID,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        name: "Nazmi Boutique",
        description: `Order for ${cartItems.length} item(s)`,
        order_id: razorpayOrder.razorpay_order_id,
        handler: async function (response: any) {
          try {
            console.log('💳 Payment response received:', response);
            
            if (!response.razorpay_payment_id || !response.razorpay_order_id) {
              throw new Error("Invalid payment response from Razorpay");
            }

            // Verify payment
            console.log('🔐 Verifying payment...');
            const verifyResponse = await fetch(`${API_BASE}/api/payments/razorpay/verify`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
              }),
            });

            if (verifyResponse.ok) {
              console.log('✅ Payment verified successfully!');
              
              // Payment successful - clear cart and redirect to success page
              if (isDirectOrder) {
                sessionStorage.removeItem('directOrder');
              } else {
                localStorage.removeItem("cart");
                window.dispatchEvent(new Event("cart-updated"));
              }
              
              router.push('/order-success');
            } else {
              const errorText = await verifyResponse.text();
              console.error('❌ Payment verification failed:', errorText);
              throw new Error("Payment verification failed. Please contact support.");
            }
          } catch (error) {
            console.error("❌ Payment verification error:", error);
            alert("Payment verification failed. Please contact support with your order details.");
            setLoading(false);
          }
        },
        prefill: {
          name: shipping.name,
          email: shipping.email,
          contact: shipping.phone,
        },
        notes: {
          address: `${shipping.address1}, ${shipping.city}, ${shipping.state} - ${shipping.pincode}`,
          order_type: isDirectOrder ? "direct" : "cart",
          payment_method: selectedPaymentMethod,
          order_id: orderId
        },
        theme: {
          color: "#000000",
        },
        modal: {
          ondismiss: function() {
            console.log("Payment modal closed by user");
            setLoading(false);
          },
        }
      };

      // Payment method configuration
      if (selectedPaymentMethod === 'upi') {
        options.method = 'upi';
      } else if (selectedPaymentMethod === 'card') {
        options.method = 'card';
      } else if (selectedPaymentMethod === 'netbanking') {
        options.method = 'netbanking';
      } else if (selectedPaymentMethod === 'wallet') {
        options.method = 'wallet';
      }

      console.log('🎯 Opening Razorpay checkout...');
      const rzp = new window.Razorpay(options);
      rzp.open();

    } catch (error: any) {
      console.error("❌ Payment initiation error:", error);
      
      // User-friendly error messages
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        alert(`🌐 NETWORK ERROR\n\nCannot connect to our servers. Please:\n• Check your internet connection\n• Try again in a few moments\n• Contact support if issue persists`);
      } else if (error.message.includes('offline')) {
        alert(`🚨 SERVICE UNAVAILABLE\n\nOur payment service is temporarily offline. Please try again in a few minutes.`);
      } else {
        alert(`❌ Payment Error\n\n${error.message || "Something went wrong. Please try again."}`);
      }
      
      setLoading(false);
    }
  };

  // Render backend status indicator
  const renderBackendStatus = () => {
    if (backendStatus === 'checking') {
      return (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-yellow-800 text-center">
            🔍 Checking server connection...
          </p>
        </div>
      );
    }
    
    if (backendStatus === 'offline') {
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-red-800 text-center">
            ❌ Server temporarily unavailable. Please try again later.
          </p>
        </div>
      );
    }
    
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
        <p className="text-sm text-green-800 text-center">
          ✅ Connected to server
        </p>
      </div>
    );
  };

  // Render payment method info
  const renderPaymentMethodInfo = () => {
    const method = paymentMethods.find(m => m.id === selectedPaymentMethod);
    
    if (!method) {
      return (
        <div className="text-center py-8">
          <CreditCard className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Select a payment method to continue</p>
        </div>
      );
    }

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
            {selectedPaymentMethod === 'upi' && '💡 You will be redirected to UPI payment'}
            {selectedPaymentMethod === 'card' && '💳 Enter your card details in the secure payment window'}
            {selectedPaymentMethod === 'netbanking' && '🏦 You will be redirected to your bank for payment'}
            {selectedPaymentMethod === 'wallet' && '📱 You will be redirected to your wallet app'}
          </p>
        </div>

        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <p className="text-sm text-green-800 text-center">
            <strong>Secure Payment:</strong> All transactions are encrypted and protected
          </p>
        </div>
      </div>
    );
  };

  // Mobile Order Summary Component
  const MobileOrderSummary = () => (
    <div className="lg:hidden bg-white border-t border-gray-200 fixed bottom-0 left-0 right-0 z-50">
      <div className="p-4">
        <div className="flex justify-between items-center mb-3">
          <div>
            <p className="text-sm text-gray-600">Total</p>
            <p className="text-xl font-bold text-gray-900">₹{grandTotal.toLocaleString("en-IN")}</p>
          </div>
          <button
            onClick={() => setShowOrderSummary(true)}
            className="bg-black text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors"
          >
            View Summary
          </button>
        </div>
      </div>
    </div>
  );

  // Mobile Order Summary Modal
  const MobileOrderSummaryModal = () => (
    <div className={`lg:hidden fixed inset-0 bg-black bg-opacity-50 z-50 transition-opacity ${
      showOrderSummary ? 'opacity-100' : 'opacity-0 pointer-events-none'
    }`}>
      <div className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl transition-transform ${
        showOrderSummary ? 'transform-none' : 'translate-y-full'
      }`}>
        <div className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Order Summary</h3>
            <button 
              onClick={() => setShowOrderSummary(false)}
              className="p-2 hover:bg-gray-100 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="space-y-3 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Order value</span>
              <span className="font-semibold">₹{subtotal.toLocaleString("en-IN")}</span>
            </div>
            
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Delivery fee</span>
              <span className={`font-semibold ${shippingFee === 0 ? "text-green-600" : "text-gray-900"}`}>
                {shippingFee === 0 ? "FREE" : `₹${shippingFee}`}
              </span>
            </div>
            
            {shippingFee > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-xs text-yellow-800 text-center">
                  Add ₹{(SHIPPING_THRESHOLD - subtotal).toLocaleString("en-IN")} more for FREE shipping
                </p>
              </div>
            )}
            
            <div className="border-t pt-3">
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-900">TOTAL</span>
                <span className="text-xl font-bold text-gray-900">
                  ₹{grandTotal.toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          </div>

          {/* Order Items in Modal */}
          <div className="border-t pt-4">
            <h4 className="font-semibold mb-3">Order Items ({cartItems.length})</h4>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {cartItems.map((item) => (
                <div key={item.id} className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                    <Image
                      src={item.image}
                      alt={item.name}
                      width={48}
                      height={48}
                      className="object-cover w-full h-full"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                    <p className="text-xs text-gray-500">
                      {item.size && `Size: ${item.size}`} 
                      {item.size && item.color && " • "} 
                      {item.color && `Color: ${item.color}`}
                    </p>
                    <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">₹{(item.price * item.quantity).toLocaleString("en-IN")}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Damaged Products Return Policy Component
  const DamagedProductsPolicy = () => (
    <div className="border-t pt-6 mt-6">
      <div className="space-y-4">
        <div className="text-center">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-2">
            <Shield className="w-5 h-5 text-red-600" />
          </div>
          <h3 className="font-semibold text-gray-900 text-sm mb-1">Damaged Product Protection</h3>
        </div>

        {/* Mobile-friendly points */}
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <div className="w-4 h-4 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <div className="w-1.5 h-1.5 bg-green-600 rounded-full"></div>
            </div>
            <p className="text-xs text-gray-700">
              <span className="font-semibold">Returns for damage only</span> - Live video verification required
            </p>
          </div>
          
          <div className="flex items-start gap-2">
            <div className="w-4 h-4 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <div className="w-1.5 h-1.5 bg-green-600 rounded-full"></div>
            </div>
            <p className="text-xs text-gray-700">
              <span className="font-semibold">24-hour reporting</span> - Contact support immediately
            </p>
          </div>

          <div className="flex items-start gap-2">
            <div className="w-4 h-4 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <div className="w-1.5 h-1.5 bg-green-600 rounded-full"></div>
            </div>
            <p className="text-xs text-gray-700">
              <span className="font-semibold">Original packaging</span> - Keep tags and packaging intact
            </p>
          </div>
        </div>

        {/* Mobile process */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs font-semibold text-blue-900 mb-2">Return Process:</p>
          <div className="space-y-1 text-xs text-blue-800">
            <div className="flex items-center gap-2">
              <span className="bg-blue-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs font-bold">1</span>
              <span>Contact support within 24h</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-blue-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs font-bold">2</span>
              <span>Schedule video call</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-blue-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs font-bold">3</span>
              <span>Open package on video</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-blue-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs font-bold">4</span>
              <span>Get approval & pickup</span>
            </div>
          </div>
        </div>

        {/* Important Notes */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <div className="w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-white text-xs font-bold">!</span>
            </div>
            <div>
              <p className="text-xs font-medium text-yellow-800 mb-1">Important:</p>
              <p className="text-xs text-yellow-700">
                No returns for change of mind, wrong size, or color preference. Only manufacturing defects or transit damage accepted.
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
    <div className="min-h-screen bg-gray-50 pb-20 lg:pb-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header - Mobile Optimized */}
        <div className="flex items-center justify-between mb-6 lg:mb-8 py-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => currentStep === 'payment' ? setCurrentStep('details') : router.back()}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl lg:text-3xl font-bold">CHECKOUT</h1>
          </div>
          
          {/* Step Indicator - Mobile Horizontal */}
          <div className="flex items-center gap-2 lg:gap-4">
            <div className={`px-3 py-1 lg:px-4 lg:py-2 rounded-full text-xs lg:text-sm font-medium ${
              currentStep === 'details' ? 'bg-black text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              1
            </div>
            <div className={`px-3 py-1 lg:px-4 lg:py-2 rounded-full text-xs lg:text-sm font-medium ${
              currentStep === 'payment' ? 'bg-black text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              2
            </div>
          </div>
        </div>
        
        {/* Step Labels - Mobile */}
        <div className="flex justify-between mb-6 lg:hidden px-2">
          <span className={`text-sm font-medium ${currentStep === 'details' ? 'text-black' : 'text-gray-500'}`}>
            Shipping Details
          </span>
          <span className={`text-sm font-medium ${currentStep === 'payment' ? 'text-black' : 'text-gray-500'}`}>
            Payment
          </span>
        </div>
        
        <div className="grid lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {currentStep === 'details' ? (
              /* Shipping Info Section - Mobile Optimized */
              <div className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-gray-100 p-4 lg:p-6">
                <h2 className="text-lg lg:text-xl font-semibold mb-4 lg:mb-6 text-gray-900">Shipping Information</h2>
                
                <div className="space-y-4">
                  <div className="grid gap-4">
                    <input
                      type="text"
                      placeholder="Full Name *"
                      value={shipping.name}
                      onChange={(e) => setShipping({ ...shipping, name: e.target.value })}
                      className="w-full p-3 lg:p-4 border border-gray-300 rounded-lg lg:rounded-xl focus:ring-2 focus:ring-black focus:border-transparent text-sm lg:text-base"
                    />
                    <input
                      type="email"
                      placeholder="Email Address *"
                      value={shipping.email}
                      onChange={(e) => setShipping({ ...shipping, email: e.target.value })}
                      className="w-full p-3 lg:p-4 border border-gray-300 rounded-lg lg:rounded-xl focus:ring-2 focus:ring-black focus:border-transparent text-sm lg:text-base"
                    />
                  </div>
                  
                  <input
                    type="tel"
                    placeholder="Phone Number *"
                    value={shipping.phone}
                    onChange={(e) => setShipping({ ...shipping, phone: e.target.value })}
                    className="w-full p-3 lg:p-4 border border-gray-300 rounded-lg lg:rounded-xl focus:ring-2 focus:ring-black focus:border-transparent text-sm lg:text-base"
                  />
                  
                  <input
                    type="text"
                    placeholder="Address Line 1 *"
                    value={shipping.address1}
                    onChange={(e) => setShipping({ ...shipping, address1: e.target.value })}
                    className="w-full p-3 lg:p-4 border border-gray-300 rounded-lg lg:rounded-xl focus:ring-2 focus:ring-black focus:border-transparent text-sm lg:text-base"
                  />
                  
                  <input
                    type="text"
                    placeholder="Address Line 2 (optional)"
                    value={shipping.address2}
                    onChange={(e) => setShipping({ ...shipping, address2: e.target.value })}
                    className="w-full p-3 lg:p-4 border border-gray-300 rounded-lg lg:rounded-xl focus:ring-2 focus:ring-black focus:border-transparent text-sm lg:text-base"
                  />
                  
                  <div className="grid gap-4">
                    <input
                      type="text"
                      placeholder="City *"
                      value={shipping.city}
                      onChange={(e) => setShipping({ ...shipping, city: e.target.value })}
                      className="w-full p-3 lg:p-4 border border-gray-300 rounded-lg lg:rounded-xl focus:ring-2 focus:ring-black focus:border-transparent text-sm lg:text-base"
                    />
                    <input
                      type="text"
                      placeholder="State *"
                      value={shipping.state}
                      onChange={(e) => setShipping({ ...shipping, state: e.target.value })}
                      className="w-full p-3 lg:p-4 border border-gray-300 rounded-lg lg:rounded-xl focus:ring-2 focus:ring-black focus:border-transparent text-sm lg:text-base"
                    />
                  </div>
                  
                  <div className="grid gap-4">
                    <input
                      type="text"
                      placeholder="Pincode *"
                      value={shipping.pincode}
                      onChange={(e) => setShipping({ ...shipping, pincode: e.target.value })}
                      className="w-full p-3 lg:p-4 border border-gray-300 rounded-lg lg:rounded-xl focus:ring-2 focus:ring-black focus:border-transparent text-sm lg:text-base"
                    />
                    <input
                      type="text"
                      placeholder="Country"
                      value={shipping.country}
                      onChange={(e) => setShipping({ ...shipping, country: e.target.value })}
                      className="w-full p-3 lg:p-4 border border-gray-300 rounded-lg lg:rounded-xl focus:ring-2 focus:ring-black focus:border-transparent text-sm lg:text-base"
                    />
                  </div>
                </div>

                <button
                  onClick={proceedToPayment}
                  className="w-full bg-black text-white py-3 lg:py-4 px-6 rounded-lg lg:rounded-xl font-semibold hover:bg-gray-800 transition-all duration-300 mt-6 text-sm lg:text-base"
                >
                  CONTINUE TO PAYMENT
                </button>
              </div>
            ) : (
              /* Payment Section - Mobile Optimized */
              <div className="space-y-6">
                {/* Payment Method Selection */}
                <div className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-gray-100 p-4 lg:p-6">
                  <h2 className="text-lg lg:text-xl font-semibold mb-4 lg:mb-6 text-gray-900">Select Payment Method</h2>
                  
                  <div className="grid grid-cols-2 gap-3 lg:gap-4">
                    {paymentMethods.map((method) => (
                      <div
                        key={method.id}
                        onClick={() => setSelectedPaymentMethod(method.id)}
                        className={`p-3 lg:p-4 border-2 rounded-lg lg:rounded-xl cursor-pointer transition-all ${
                          selectedPaymentMethod === method.id
                            ? 'border-black bg-gray-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex flex-col items-center text-center gap-2">
                          <div className={`p-2 rounded-lg ${method.color} text-white`}>
                            <method.icon className="w-4 h-4 lg:w-5 lg:h-5" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900 text-xs lg:text-sm">{method.name}</h3>
                            <p className="text-xs text-gray-600 hidden lg:block">{method.description}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Payment Method Info */}
                {selectedPaymentMethod && (
                  <div className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-gray-100 p-4 lg:p-6">
                    <h3 className="text-base lg:text-lg font-semibold mb-4 text-gray-900">
                      {paymentMethods.find(m => m.id === selectedPaymentMethod)?.name} Payment
                    </h3>
                    
                    {renderPaymentMethodInfo()}

                    <button
                      onClick={initiateRazorpayPayment}
                      disabled={loading || backendStatus === 'offline'}
                      className="w-full bg-black text-white py-3 lg:py-4 px-6 rounded-lg lg:rounded-xl font-semibold hover:bg-gray-800 transition-all duration-300 mt-6 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-3 text-sm lg:text-base"
                    >
                      {loading ? (
                        <>
                          <div className="w-4 h-4 lg:w-5 lg:h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Processing Payment...
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-4 h-4 lg:w-5 lg:h-5" />
                          PAY ₹{grandTotal.toLocaleString("en-IN")}
                        </>
                      )}
                    </button>
                    
                    {backendStatus === 'offline' && (
                      <p className="text-sm text-red-600 text-center mt-3">
                        Payment temporarily unavailable. Please try again later.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Order Items - Mobile Optimized */}
            <div className="bg-white rounded-xl lg:rounded-2xl shadow-sm border border-gray-100 p-4 lg:p-6">
              <h2 className="text-lg lg:text-xl font-semibold mb-4 lg:mb-6 text-gray-900">
                Order Items ({cartItems.length})
              </h2>
              
              <div className="space-y-4">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 lg:gap-4 border-b pb-4 last:border-b-0">
                    <div className="w-16 h-16 lg:w-20 lg:h-20 bg-gray-200 rounded-lg lg:rounded-xl overflow-hidden flex-shrink-0">
                      <Image
                        src={item.image}
                        alt={item.name}
                        width={64}
                        height={64}
                        className="object-cover w-full h-full"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm lg:text-base truncate">{item.name}</p>
                      <p className="text-xs lg:text-sm text-gray-500 mt-1">
                        {item.size && `Size: ${item.size}`} 
                        {item.size && item.color && " • "} 
                        {item.color && `Color: ${item.color}`}
                      </p>
                      <p className="text-xs lg:text-sm text-gray-500">Qty: {item.quantity}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900 text-sm lg:text-base">₹{(item.price * item.quantity).toLocaleString("en-IN")}</p>
                      <p className="text-xs text-gray-500 hidden lg:block">₹{item.price.toLocaleString("en-IN")} each</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Order Summary Sidebar - Desktop Only */}
          <div className="hidden lg:block lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sticky top-8">
              <h2 className="text-xl font-semibold mb-6 text-gray-900">Order Summary</h2>
              
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Order value</span>
                  <span className="font-semibold">₹{subtotal.toLocaleString("en-IN")}</span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Estimated delivery fee</span>
                  <span className={`font-semibold ${shippingFee === 0 ? "text-green-600" : "text-gray-900"}`}>
                    {shippingFee === 0 ? "FREE" : `₹${shippingFee}`}
                  </span>
                </div>
                
                {shippingFee > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-2">
                    <p className="text-xs text-yellow-800 text-center">
                      Add ₹{(SHIPPING_THRESHOLD - subtotal).toLocaleString("en-IN")} more for FREE shipping
                    </p>
                  </div>
                )}
                
                <div className="border-t pt-3 mt-3">
                  <div className="flex justify-between items-center text-lg">
                    <span className="font-bold text-gray-900">TOTAL</span>
                    <span className="text-2xl font-bold text-gray-900">
                      ₹{grandTotal.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Trust Badges */}
              <div className="border-t pt-6 mt-6">
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center">
                    <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-2">
                      <Truck className="w-5 h-5 text-green-600" />
                    </div>
                    <p className="text-xs font-medium text-gray-700">Free Shipping</p>
                    <p className="text-xs text-gray-500">Above ₹1999</p>
                  </div>
                  <div className="text-center">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-2">
                      <Shield className="w-5 h-5 text-blue-600" />
                    </div>
                    <p className="text-xs font-medium text-gray-700">Secure</p>
                    <p className="text-xs text-gray-500">Payment</p>
                  </div>
                  <div className="text-center">
                    <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-2">
                      <Video className="w-5 h-5 text-red-600" />
                    </div>
                    <p className="text-xs font-medium text-gray-700">Damage Protection</p>
                    <p className="text-xs text-gray-500">Video Verification</p>
                  </div>
                </div>
                
                {/* Damaged Products Return Policy */}
                <DamagedProductsPolicy />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Order Summary Bottom Bar */}
      <MobileOrderSummary />
      
      {/* Mobile Order Summary Modal */}
      <MobileOrderSummaryModal />
    </div>
  );
}

// ✅ MAIN EXPORT WITH SUSPENSE BOUNDARY
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