export interface WishlistProduct {
  id: number;
  id_wishlist: number;
  name_product: string;
  price: number;
  url: string | null;
}

export type WishlistStore = 'AMAZON' | 'MERCADOLIVRE';

export interface WishlistStoreSearchResult {
  name: string;
  description: string;
  price: number | null;
  url: string;
  image: string | null;
  store: WishlistStore;
}

export interface Wishlist {
  id: number;
  user_id: number;
  name: string;
  products: WishlistProduct[];
}
