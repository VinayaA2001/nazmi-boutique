// C:\NAZMI_BOUTIQUE\Frontend\lib\api.ts
import { API_BASE } from './constants';
import type { Address, Order, ProductLite, User } from "./type";

/** Base URL for your backend API */
export const API: string = API_BASE;

/** Build Authorization header from localStorage token, if present */
const authHeaders = (): Record<string, string> => {
  if (typeof window === "undefined") return {};
  try {
    const token = window.localStorage.getItem("auth_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
};

export const getProfile = async (): Promise<User | null> => {
  try {
    const token = localStorage.getItem('auth_token');
    if (!token) return null;

    const response = await fetch(`${API}/api/auth/profile`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      return data.user;
    }
    return null;
  } catch (error) {
    console.error('Failed to fetch profile:', error);
    return null;
  }
};

export const getOrders = async (): Promise<Order[]> => {
  try {
    const token = localStorage.getItem('auth_token');
    if (!token) return [];

    const response = await fetch(`${API}/api/orders/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (response.ok) {
      return await response.json();
    }
    return [];
  } catch (error) {
    console.error('Failed to fetch orders:', error);
    return [];
  }
};

export const rehydrateProducts = async (productIds: string[]): Promise<Record<string, ProductLite>> => {
  try {
    const results: Record<string, ProductLite> = {};
    
    for (const id of productIds) {
      try {
        const response = await fetch(`${API}/api/products/${id}`);
        if (response.ok) {
          const product = await response.json();
          results[id] = {
            _id: product._id,
            name: product.name,
            price: product.price,
            image: product.image || "/images/placeholder.jpg",
            inStock: product.stock > 0,
            slug: product.slug
          };
        }
      } catch (error) {
        console.error(`Failed to fetch product ${id}:`, error);
      }
    }
    
    return results;
  } catch (error) {
    console.error('Failed to rehydrate products:', error);
    return {};
  }
};

export const getAddress = async (): Promise<Partial<Address> | null> => {
  try {
    const token = localStorage.getItem('auth_token');
    if (!token) return null;

    // Try the profile endpoint first to get address info
    const response = await fetch(`${API}/api/auth/profile`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      if (data.user?.profile) {
        return data.user.profile;
      }
    }
    return null;
  } catch (error) {
    console.error('Failed to fetch address:', error);
    return null;
  }
};

/**
 * Save address with graceful fallbacks
 * Returns boolean (true on success) to avoid breaking your existing code.
 */
export async function saveAddress(addr: Address): Promise<boolean> {
  try {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      console.warn('No auth token found');
      return false;
    }

    // Normalize/trim values to reduce backend validation failures
    const addressData = {
      fullName: addr.fullName?.trim() ?? "",
      phone: String(addr.phone ?? "").trim(),
      line1: addr.line1?.trim() ?? "",
      line2: (addr.line2 ?? "").trim(),
      city: addr.city?.trim() ?? "",
      state: addr.state?.trim() ?? "",
      pincode: String(addr.pincode ?? "").trim(),
    };

    // Try updating user profile with address info
    const response = await fetch(`${API}/api/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        profile: addressData
      }),
    });

    if (response.ok) {
      return true;
    }

    // If the profile endpoint doesn't support PUT, try a dedicated address endpoint
    if (response.status === 405 || response.status === 404) {
      // Fallback: Try a dedicated address endpoint if it exists
      const fallbackResponse = await fetch(`${API}/api/user/address`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(addressData),
      });

      if (fallbackResponse.ok) {
        return true;
      }

      // Log the failure for debugging
      await logFailure("Address save fallback", fallbackResponse);
    }

    // Log the original failure
    await logFailure("Profile update", response);

    // Unauthorized hints
    if (response.status === 401 || response.status === 403) {
      console.warn(
        "[saveAddress] Unauthorized: missing/invalid token. Ensure you are logged in and localStorage contains 'auth_token'."
      );
    }

    return false;
  } catch (err) {
    console.error("[saveAddress] Network/Unexpected error:", err);
    return false;
  }
}

// Legacy functions for compatibility (you can remove these if not needed)
export const getAddressLegacy = async (): Promise<Partial<Address> | null> => {
  try {
    const token = localStorage.getItem('auth_token');
    if (!token) return null;

    // This would be your actual address endpoint
    // For now, return null as we don't have this endpoint yet
    return null;
  } catch (error) {
    console.error('Failed to fetch address:', error);
    return null;
  }
};

export const saveAddressLegacy = async (address: any): Promise<boolean> => {
  try {
    const token = localStorage.getItem('auth_token');
    if (!token) return false;

    // This would be your actual address endpoint
    // For now, just simulate success
    await new Promise(resolve => setTimeout(resolve, 500));
    return true;
  } catch (error) {
    console.error('Failed to save address:', error);
    return false;
  }
};

/* -------------------- helpers -------------------- */

async function logFailure(label: string, r: Response) {
  const text = await safeText(r);
  console.warn(
    `[saveAddress] ${label} failed → status=${r.status} ${r.statusText} | response=`,
    text
  );
}

async function safeText(r: Response) {
  try {
    const ct = r.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const j = await r.json().catch(() => null);
      if (j && typeof j === "object") {
        return j.message || j.error || JSON.stringify(j);
      }
    }
    return await r.text();
  } catch {
    return "";
  }
}

// Additional API functions that might be useful

export const loginUser = async (email: string, password: string) => {
  try {
    const response = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (response.ok) {
      return await response.json();
    } else {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Login failed');
    }
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

export const registerUser = async (username: string, email: string, password: string) => {
  try {
    const response = await fetch(`${API}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, email, password }),
    });

    if (response.ok) {
      return await response.json();
    } else {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Registration failed');
    }
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
};

export const getAllProducts = async () => {
  try {
    const response = await fetch(`${API}/api/products`);
    if (response.ok) {
      return await response.json();
    }
    return [];
  } catch (error) {
    console.error('Failed to fetch products:', error);
    return [];
  }
};

export const getProductById = async (productId: string) => {
  try {
    const response = await fetch(`${API}/api/products/${productId}`);
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (error) {
    console.error('Failed to fetch product:', error);
    return null;
  }
};

export const createOrder = async (orderData: any) => {
  try {
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API}/api/orders`, {
      method: 'POST',
      headers,
      body: JSON.stringify(orderData),
    });

    if (response.ok) {
      return await response.json();
    } else {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Order creation failed');
    }
  } catch (error) {
    console.error('Order creation error:', error);
    throw error;
  }
};

export const createRazorpayOrder = async (orderId: string) => {
  try {
    const response = await fetch(`${API}/api/payments/razorpay/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ order_id: orderId }),
    });

    if (response.ok) {
      return await response.json();
    } else {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Razorpay order creation failed');
    }
  } catch (error) {
    console.error('Razorpay order creation error:', error);
    throw error;
  }
};

export const verifyRazorpayPayment = async (paymentData: any) => {
  try {
    const response = await fetch(`${API}/api/payments/razorpay/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paymentData),
    });

    if (response.ok) {
      return await response.json();
    } else {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Payment verification failed');
    }
  } catch (error) {
    console.error('Payment verification error:', error);
    throw error;
  }
};