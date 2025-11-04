export interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  image: string;
  order_id: string;
  handler: (response: RazorpayResponse) => void;
  prefill: {
    name: string;
    email: string;
    contact: string;
  };
  notes: {
    address: string;
  };
  theme: {
    color: string;
  };
  modal?: {
    ondismiss?: () => void;
    animation?: boolean;
  };
  retry?: {
    enabled: boolean;
    max_count: number;
  };
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
  }
}

/**
 * Load Razorpay script dynamically
 * @returns Promise<boolean> - true if loaded successfully, false otherwise
 */
export function loadRazorpay(): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    if (typeof window === "undefined") {
      return resolve(false);
    }

    // Check if Razorpay is already loaded
    if (window.Razorpay) {
      return resolve(true);
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    
    script.onload = () => {
      console.log("Razorpay SDK loaded successfully");
      resolve(true);
    };
    
    script.onerror = () => {
      console.error("Failed to load Razorpay SDK");
      resolve(false);
    };
    
    document.body.appendChild(script);
  });
}

/**
 * Initialize Razorpay payment
 * @param options - Razorpay options
 * @returns Promise<void>
 */
export const initializePayment = async (options: RazorpayOptions): Promise<void> => {
  const razorpayLoaded = await loadRazorpay();
  
  if (!razorpayLoaded) {
    throw new Error('Razorpay SDK failed to load. Please check your internet connection.');
  }

  if (!window.Razorpay) {
    throw new Error('Razorpay is not available. Please refresh the page and try again.');
  }

  const rzp = new window.Razorpay({
    ...options,
    modal: {
      ondismiss: () => {
        console.log('Payment modal dismissed');
        options.modal?.ondismiss?.();
      },
      animation: true,
      ...options.modal,
    },
  });

  rzp.open();
};

/**
 * Create Razorpay order on your backend
 * @param amount - Amount in paise (e.g., 1000 = ₹10)
 * @param currency - Currency code (default: INR)
 * @param receipt - Receipt ID
 */
export const createRazorpayOrder = async (
  amount: number,
  currency: string = "INR",
  receipt?: string
): Promise<{ id: string; amount: number; currency: string }> => {
  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://nazmi-boutique-2.onrender.com";
    
    const response = await fetch(`${API_BASE}/api/payments/create-order`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount,
        currency,
        receipt: receipt || `receipt_${Date.now()}`,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to create order");
    }

    const data = await response.json();
    return data.order;
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    throw new Error("Unable to create payment order. Please try again.");
  }
};

/**
 * Verify Razorpay payment signature
 * @param paymentResponse - Payment response from Razorpay
 * @param orderId - Order ID
 */
export const verifyPayment = async (
  paymentResponse: RazorpayResponse,
  orderId: string
): Promise<boolean> => {
  try {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://nazmi-boutique-2.onrender.com";
    
    const response = await fetch(`${API_BASE}/api/payments/verify-payment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        razorpay_payment_id: paymentResponse.razorpay_payment_id,
        razorpay_order_id: paymentResponse.razorpay_order_id,
        razorpay_signature: paymentResponse.razorpay_signature,
        order_id: orderId,
      }),
    });

    if (!response.ok) {
      throw new Error("Payment verification failed");
    }

    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error("Error verifying payment:", error);
    return false;
  }
};

/**
 * Process complete payment flow
 * @param amount - Amount in rupees
 * @param userDetails - User details for prefill
 * @param onSuccess - Success callback
 * @param onError - Error callback
 */
export const processPayment = async ({
  amount,
  userDetails,
  onSuccess,
  onError,
  description = "Purchase from Nazmi Boutique",
}: {
  amount: number; // in rupees
  userDetails: {
    name: string;
    email: string;
    contact: string;
    address: string;
  };
  onSuccess: (paymentId: string, orderId: string) => void;
  onError: (error: string) => void;
  description?: string;
}): Promise<void> => {
  try {
    // Convert amount to paise
    const amountInPaise = Math.round(amount * 100);

    // Create order
    const order = await createRazorpayOrder(amountInPaise);

    // Razorpay options
    const options: RazorpayOptions = {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
      amount: amountInPaise,
      currency: "INR",
      name: "Nazmi Boutique",
      description: description,
      image: "/logo.png", // Your boutique logo
      order_id: order.id,
      prefill: {
        name: userDetails.name,
        email: userDetails.email,
        contact: userDetails.contact,
      },
      notes: {
        address: userDetails.address,
      },
      theme: {
        color: "#D97706", // Amber color matching your theme
      },
      modal: {
        ondismiss: () => {
          onError("Payment cancelled by user");
        },
      },
      retry: {
        enabled: true,
        max_count: 3,
      },
      timeout: 300, // 5 minutes
      remember_customer: true,
    };

    options.handler = async (response: RazorpayResponse) => {
      try {
        // Verify payment
        const isVerified = await verifyPayment(response, order.id);
        
        if (isVerified) {
          console.log("Payment verified successfully");
          onSuccess(response.razorpay_payment_id, response.razorpay_order_id);
        } else {
          onError("Payment verification failed. Please contact support.");
        }
      } catch (error) {
        console.error("Payment handler error:", error);
        onError("Payment processing failed. Please try again.");
      }
    };

    // Initialize payment
    await initializePayment(options);
  } catch (error) {
    console.error("Payment process error:", error);
    onError(error instanceof Error ? error.message : "Payment initialization failed");
  }
};

/**
 * Check if Razorpay is available
 */
export const isRazorpayAvailable = (): boolean => {
  if (typeof window === "undefined") return false;
  return !!window.Razorpay;
};

/**
 * Format amount for display
 * @param amount - Amount in paise
 * @returns Formatted amount string
 */
export const formatAmount = (amount: number): string => {
  return `₹${(amount / 100).toFixed(2)}`;
};

/**
 * Get default Razorpay options
 */
export const getDefaultRazorpayOptions = (): Partial<RazorpayOptions> => {
  return {
    theme: {
      color: "#D97706", // Amber-600
    },
    modal: {
      animation: true,
    },
    retry: {
      enabled: true,
      max_count: 3,
    },
    timeout: 300,
    remember_customer: true,
  };
};

/**
 * Demo payment function for testing
 */
export const processDemoPayment = async (amount: number): Promise<boolean> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Simulate successful payment in demo mode
      console.log(`Demo payment processed for ₹${amount}`);
      resolve(true);
    }, 2000);
  });
};

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