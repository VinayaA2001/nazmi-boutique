export type User = {
  id: string;
  username: string;
  email: string;
  is_admin: boolean;
  created_at: string;
};

export type Address = {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
};

export type OrderItem = {
  productId: string;
  name: string;
  image?: string;
  price: number;
  qty: number;
};

export type OrderStatus =
  | "PLACED"
  | "CONFIRMED"
  | "PACKED"
  | "SHIPPED"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED";

export type Order = {
  _id: string;
  orderNumber: string;
  placedAt: string;
  status: OrderStatus;
  expectedDeliveryDate?: string;
  shippingAddress: Address;
  items: OrderItem[];
  payment: {
    method: string;
    status: "PENDING" | "PAID" | "FAILED" | "REFUNDED";
    amount: number;
    currency: "INR";
  };
};

export type ProductLite = {
  _id: string;
  slug?: string;
  name: string;
  price: number;
  image: string;
  inStock: boolean;
};

export type WishlistItem = {
  productId: string;
  name: string;
  price: number;
  image: string;
  productCode?: string;
};

export type AddressItem = Address & {
  _id: string;
  isDefault?: boolean;
};
