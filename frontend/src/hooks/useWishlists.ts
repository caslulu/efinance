import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/api';
import { queryKeys } from '@/lib/queryClient';
import type {
  PriceAlertNotificationsResponse,
  Wishlist,
  WishlistProduct,
  WishlistProductHistory,
} from '@/types/Wishlist';

export function useWishlists() {
  return useQuery({
    queryKey: queryKeys.wishlists,
    queryFn: async () => {
      const res = await api.get<Wishlist[]>('/wishlists');
      return Array.isArray(res.data) ? res.data : [];
    },
  });
}

export function useWishlistProductHistory(wishlistId: number, productId: number) {
  return useQuery({
    queryKey: ['wishlistProductHistory', wishlistId, productId],
    queryFn: async () => {
      const res = await api.get<WishlistProductHistory[]>(`/wishlists/${wishlistId}/products/${productId}/history`);
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: !!wishlistId && !!productId,
  });
}

export function useCreateWishlist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Pick<Wishlist, 'name'>) => {
      const res = await api.post('/wishlists', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.wishlists });
    },
  });
}

export function useUpdateWishlist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Pick<Wishlist, 'name'> }) => {
      const res = await api.patch(`/wishlists/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.wishlists });
    },
  });
}

export function useDeleteWishlist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/wishlists/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.wishlists });
    },
  });
}

export function useCreateWishlistProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      wishlistId,
      data,
    }: {
      wishlistId: number;
      data: Pick<WishlistProduct, 'name_product' | 'price'> & {
        url?: string;
        send_price_alerts?: boolean;
      };
    }) => {
      const res = await api.post(`/wishlists/${wishlistId}/products`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.wishlists });
    },
  });
}

export function useUpdateWishlistProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      wishlistId,
      productId,
      data,
    }: {
      wishlistId: number;
      productId: number;
      data: Partial<Pick<WishlistProduct, 'name_product' | 'price'>> & {
        url?: string;
        send_price_alerts?: boolean;
      };
    }) => {
      const res = await api.patch(`/wishlists/${wishlistId}/products/${productId}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.wishlists });
    },
  });
}

export function useDeleteWishlistProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ wishlistId, productId }: { wishlistId: number; productId: number }) => {
      await api.delete(`/wishlists/${wishlistId}/products/${productId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.wishlists });
    },
  });
}

export function useScrapeProductUrl() {
  return useMutation({
    mutationFn: async (url: string) => {
      const res = await api.get<{ name: string | null; price: number | null; image: string | null }>(
        '/wishlists/scrape-url',
        { params: { url } },
      );
      return res.data;
    },
  });
}

export function usePriceAlertNotifications() {
  return useQuery({
    queryKey: queryKeys.priceAlertNotifications,
    queryFn: async () => {
      const res = await api.get<PriceAlertNotificationsResponse>(
        '/wishlists/price-alert-notifications',
      );
      return res.data;
    },
    refetchInterval: 60_000,
  });
}

export function useMarkPriceAlertAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: number) => {
      const res = await api.post(
        `/wishlists/price-alert-notifications/${notificationId}/read`,
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.priceAlertNotifications });
    },
  });
}
