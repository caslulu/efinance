export interface WishlistProductHistory {
  id: number;
  wishlist_product_id: number;
  price: number;
  created_at: string;
}

export interface WishlistProduct {
  id: number;
  id_wishlist: number;
  name_product: string;
  price: number;
  url: string | null;
  send_price_alerts: boolean;
}

export interface PriceAlertNotification {
  id: number;
  user_id: number;
  wishlist_product_id: number;
  old_price: number;
  new_price: number;
  message: string;
  is_read: boolean;
  notified_at: string;
  wishlistProduct: {
    id: number;
    name_product: string;
    url: string | null;
  };
}

export interface PriceAlertNotificationsResponse {
  unreadCount: number;
  notifications: PriceAlertNotification[];
}

export interface WishlistScrapeResponse {
  name: string | null;
  price: number | null;
  image: string | null;
}

export interface WishlistScrapeResponseRaw {
  name?: string | null;
  title?: string | null;
  productName?: string | null;
  name_product?: string | null;
  price?: number | string | null;
  salePrice?: number | string | null;
  currentPrice?: number | string | null;
  amount?: number | string | null;
  image?: string | null;
  imageUrl?: string | null;
  thumbnail?: string | null;
}

export interface Wishlist {
  id: number;
  user_id: number;
  name: string;
  products: WishlistProduct[];
}
