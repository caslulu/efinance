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

export interface Wishlist {
  id: number;
  user_id: number;
  name: string;
  products: WishlistProduct[];
}
