// C:\NAZMI_BOUTIQUE\Frontend\lib\constants.ts

// API Configuration
// Prefer NEXT_PUBLIC_API_URL if set; fall back to legacy NEXT_PUBLIC_API_BASE
export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:5000';

// Razorpay Configuration
export const RAZORPAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_RZFeCq3NZLg9Rz';

// App Configuration
export const APP_NAME = 'Nazmi Boutique';
export const APP_DESCRIPTION = 'Premium fashion store offering traditional and contemporary clothing';

// Cloudinary Configuration (if needed)
export const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'your-cloud-name';
export const CLOUDINARY_UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'your-upload-preset';

// Currency Configuration
export const CURRENCY = 'INR';
export const CURRENCY_SYMBOL = '₹';

// Shipping Configuration
export const SHIPPING_COST = 99;
export const FREE_SHIPPING_THRESHOLD = 2999;

// Tax Configuration
export const TAX_RATE = 0.18; // 18% GST

// Pagination
export const PRODUCTS_PER_PAGE = 12;
export const ORDERS_PER_PAGE = 10;

// Local Storage Keys
export const AUTH_TOKEN_KEY = 'auth_token';
export const USER_DATA_KEY = 'user';
export const CART_ITEMS_KEY = 'cart_items';
export const WISHLIST_ITEMS_KEY = 'wishlist';
export const RECENTLY_VIEWED_KEY = 'recently_viewed';

// API Endpoints
export const API_ENDPOINTS = {
  // Auth
  LOGIN: '/api/auth/login',
  REGISTER: '/api/auth/register',
  PROFILE: '/api/auth/profile',
  
  // Products
  PRODUCTS: '/api/products',
  PRODUCT_BY_ID: '/api/products',
  CATEGORIES: '/api/categories',
  
  // Orders
  ORDERS: '/api/orders',
  USER_ORDERS: '/api/orders/user',
  
  // Payments
  CREATE_RAZORPAY_ORDER: '/api/payments/razorpay/create-order',
  VERIFY_RAZORPAY_PAYMENT: '/api/payments/razorpay/verify',
  CREATE_PAYMENT_ORDER: '/api/payments/create-order',
  VERIFY_PAYMENT: '/api/payments/verify',
  
  // Cart
  CART: '/api/cart',
  ADD_TO_CART: '/api/cart/add',
  
  // Email
  SEND_EMAIL: '/api/email/send',
  
  // Utility
  HEALTH: '/api/health',
  DEBUG_DB: '/api/debug/db',
  DEBUG_ROUTES: '/api/debug/routes',
  CORS_TEST: '/api/debug/cors-test'
};

// Product Categories
export const PRODUCT_CATEGORIES = [
  'traditional',
  'western',
  'accessories',
  'footwear',
  'jewelry'
];

// Order Status
export const ORDER_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled'
};

// Payment Status
export const PAYMENT_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  FAILED: 'failed',
  REFUNDED: 'refunded'
};

// Theme Colors
export const COLORS = {
  primary: '#D97706', // amber-600
  primaryDark: '#B45309', // amber-700
  secondary: '#7C3AED', // violet-600
  accent: '#EC4899', // pink-500
  success: '#10B981', // emerald-500
  warning: '#F59E0B', // amber-500
  error: '#EF4444', // red-500
  gray: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827'
  }
};

// Social Media Links
export const SOCIAL_LINKS = {
  instagram: 'https://instagram.com/nazmiboutique',
  facebook: 'https://facebook.com/nazmiboutique',
  twitter: 'https://twitter.com/nazmiboutique',
  pinterest: 'https://pinterest.com/nazmiboutique'
};

// Contact Information
export const CONTACT_INFO = {
  email: 'nazmiboutique1@gmail.com',
  phone: '+91 99959 47709',
  address: '123 Fashion Street, Mumbai, Maharashtra 400001',
  businessHours: 'Mon-Sat: 10:00 AM - 8:00 PM'
};

// Feature Flags
export const FEATURE_FLAGS = {
  ENABLE_WISHLIST: true,
  ENABLE_REVIEWS: true,
  ENABLE_COMPARE: false,
  ENABLE_QUICK_VIEW: true,
  ENABLE_SIZE_GUIDE: true
};

// Default SEO Configuration
export const DEFAULT_SEO = {
  title: 'Nazmi Boutique - Premium Fashion Store',
  description: 'Discover the latest trends in traditional and contemporary fashion at Nazmi Boutique. Quality clothing with exclusive designs.',
  keywords: 'fashion, clothing, traditional, western, kurti, saree, boutique, india',
  ogImage: '/images/og-image.jpg',
  twitterHandle: '@nazmiboutique'
};

// Validation Rules
export const VALIDATION_RULES = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^[6-9]\d{9}$/, // Indian phone numbers
  PINCODE: /^\d{6}$/,
  NAME: /^[a-zA-Z\s]{2,50}$/
};

// Date Formats
export const DATE_FORMATS = {
  DISPLAY: 'DD MMM YYYY',
  ORDER: 'DD MMM YYYY, hh:mm A',
  TIMESTAMP: 'YYYY-MM-DDTHH:mm:ss.SSSZ'
};

// Export default for backward compatibility
export default {
  API_BASE,
  RAZORPAY_KEY_ID,
  APP_NAME,
  APP_DESCRIPTION,
  CURRENCY,
  CURRENCY_SYMBOL,
  SHIPPING_COST,
  FREE_SHIPPING_THRESHOLD,
  TAX_RATE,
  PRODUCTS_PER_PAGE,
  API_ENDPOINTS,
  PRODUCT_CATEGORIES,
  ORDER_STATUS,
  PAYMENT_STATUS,
  COLORS
};
