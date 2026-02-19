import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWishlistDto } from './dto/create-wishlist.dto';
import { UpdateWishlistDto } from './dto/update-wishlist.dto';
import { CreateWishlistProductDto } from './dto/create-wishlist-product.dto';
import { UpdateWishlistProductDto } from './dto/update-wishlist-product.dto';
import {
  SearchStoreProductsDto,
  WishlistStore,
} from './dto/search-store-products.dto';

type StoreSearchResult = {
  name: string;
  description: string;
  price: number | null;
  url: string;
  image: string | null;
  store: WishlistStore;
};

@Injectable()
export class WishlistService {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: number, createWishlistDto: CreateWishlistDto) {
    return this.prisma.wishlist.create({
      data: {
        user_id: userId,
        name: createWishlistDto.name,
      },
      include: { products: true },
    });
  }

  findAll(userId: number) {
    return this.prisma.wishlist.findMany({
      where: { user_id: userId },
      include: {
        products: {
          orderBy: { id: 'desc' },
        },
      },
      orderBy: { id: 'desc' },
    });
  }

  async findOne(id: number, userId: number) {
    const wishlist = await this.prisma.wishlist.findUnique({
      where: { id },
      include: {
        products: {
          orderBy: { id: 'desc' },
        },
      },
    });

    if (!wishlist || wishlist.user_id !== userId) {
      throw new NotFoundException('Wishlist not found');
    }

    return wishlist;
  }

  async update(
    id: number,
    userId: number,
    updateWishlistDto: UpdateWishlistDto,
  ) {
    await this.findOne(id, userId);

    return this.prisma.wishlist.update({
      where: { id },
      data: updateWishlistDto,
      include: { products: true },
    });
  }

  async remove(id: number, userId: number) {
    await this.findOne(id, userId);

    await this.prisma.wishlistProduct.deleteMany({
      where: { id_wishlist: id },
    });

    return this.prisma.wishlist.delete({
      where: { id },
    });
  }

  async addProduct(
    wishlistId: number,
    userId: number,
    createWishlistProductDto: CreateWishlistProductDto,
  ) {
    await this.findOne(wishlistId, userId);

    return this.prisma.wishlistProduct.create({
      data: {
        id_wishlist: wishlistId,
        name_product: createWishlistProductDto.name_product,
        price: createWishlistProductDto.price,
      },
    });
  }

  async updateProduct(
    wishlistId: number,
    productId: number,
    userId: number,
    updateWishlistProductDto: UpdateWishlistProductDto,
  ) {
    await this.findOne(wishlistId, userId);

    const product = await this.prisma.wishlistProduct.findFirst({
      where: {
        id: productId,
        id_wishlist: wishlistId,
      },
    });

    if (!product) {
      throw new NotFoundException('Wishlist product not found');
    }

    return this.prisma.wishlistProduct.update({
      where: { id: productId },
      data: updateWishlistProductDto,
    });
  }

  async removeProduct(wishlistId: number, productId: number, userId: number) {
    await this.findOne(wishlistId, userId);

    const product = await this.prisma.wishlistProduct.findFirst({
      where: {
        id: productId,
        id_wishlist: wishlistId,
      },
    });

    if (!product) {
      throw new NotFoundException('Wishlist product not found');
    }

    return this.prisma.wishlistProduct.delete({
      where: { id: productId },
    });
  }

  async searchProducts(searchDto: SearchStoreProductsDto) {
    try {
      switch (searchDto.store) {
        case WishlistStore.MERCADOLIVRE:
          return this.searchMercadoLivre(searchDto.query);
        case WishlistStore.AMAZON:
          return this.searchAmazon(searchDto.query);
        case WishlistStore.SHOPEE:
          return this.searchShopee(searchDto.query);
        case WishlistStore.SHEIN:
          return this.searchWithWebScraping(searchDto.query, searchDto.store);
        default:
          return [];
      }
    } catch {
      return [];
    }
  }

  private async searchMercadoLivre(
    query: string,
  ): Promise<StoreSearchResult[]> {
    const url = `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(query)}&limit=12`;
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      return this.searchMercadoLivreFallback(query);
    }

    const data = (await response.json()) as {
      results?: Array<{
        title?: string;
        price?: number;
        sale_price?: number;
        original_price?: number;
        permalink?: string;
        thumbnail?: string;
      }>;
    };

    const normalizedResults = (data.results || [])
      .filter((item) => item.title && item.permalink)
      .map((item) => ({
        name: item.title || 'Produto sem nome',
        description: item.title || 'Produto sem descrição',
        price: this.normalizeNumberPrice(
          item.price,
          item.sale_price,
          item.original_price,
        ),
        url: item.permalink || '',
        image: item.thumbnail || null,
        store: WishlistStore.MERCADOLIVRE,
      }))
      .filter((item) => item.url);

    if (normalizedResults.length > 0) {
      return normalizedResults;
    }

    return this.searchMercadoLivreFallback(query);
  }

  private async searchMercadoLivreFallback(
    query: string,
  ): Promise<StoreSearchResult[]> {
    const html = await this.fetchText(
      `https://lista.mercadolivre.com.br/${encodeURIComponent(query)}`,
    );

    if (!html) {
      return [];
    }

    const cards = html.split('ui-search-layout__item').slice(1, 13);

    return cards
      .map((chunk) => {
        const title = this.stripHtml(
          chunk.match(/ui-search-item__title[^>]*>([\s\S]*?)<\/h3>/i)?.[1] ||
            '',
        );

        const href =
          chunk.match(/<a[^>]*href="([^"]+)"[^>]*ui-search-link/i)?.[1] ||
          chunk.match(/<a[^>]*href="([^"]+)"/i)?.[1] ||
          '';

        const image =
          chunk.match(/<img[^>]*src="([^"]+)"/i)?.[1] ||
          chunk.match(/<img[^>]*data-src="([^"]+)"/i)?.[1] ||
          null;

        const price = this.parseBrazilianMoney(
          chunk.match(/R\$\s*([\d.]+(?:,\d{2})?)/i)?.[1] || null,
        );

        return {
          name: title || 'Produto sem nome',
          description: title || 'Produto sem descrição',
          price,
          url: href,
          image,
          store: WishlistStore.MERCADOLIVRE,
        } satisfies StoreSearchResult;
      })
      .filter((item) => item.url);
  }

  private async searchAmazon(query: string): Promise<StoreSearchResult[]> {
    const html = await this.fetchText(
      `https://www.amazon.com.br/s?k=${encodeURIComponent(query)}`,
    );

    if (!html) {
      return this.searchWithWebScraping(query, WishlistStore.AMAZON);
    }

    const chunks = html
      .split('data-component-type="s-search-result"')
      .slice(1, 13);

    const parsed = chunks
      .map((chunk) => {
        const title = this.stripHtml(
          chunk.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1] || '',
        );

        if (/\bseguro\b/i.test(title)) {
          return null;
        }

        const relativeUrl =
          chunk.match(/<a[^>]*href="([^"]+)"[^>]*a-link-normal/i)?.[1] || '';

        const image =
          chunk.match(
            /<img[^>]*class="[^"]*s-image[^"]*"[^>]*src="([^"]+)"/i,
          )?.[1] || null;

        const price = this.extractAmazonCardPrice(chunk);

        if (!relativeUrl || !title) return null;

        return {
          name: title,
          description: title,
          price,
          url: this.toAbsoluteUrl(relativeUrl, 'https://www.amazon.com.br'),
          image,
          store: WishlistStore.AMAZON,
        } satisfies StoreSearchResult;
      })
      .filter((item) => Boolean(item && item.url)) as StoreSearchResult[];

    if (parsed.length > 0) {
      return parsed;
    }

    return this.searchWithWebScraping(query, WishlistStore.AMAZON);
  }

  private async searchShopee(query: string): Promise<StoreSearchResult[]> {
    const url = `https://shopee.com.br/api/v4/search/search_items?by=relevancy&keyword=${encodeURIComponent(query)}&limit=12&newest=0&order=desc&page_type=search&scenario=PAGE_GLOBAL_SEARCH&version=2`;
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        Referer: `https://shopee.com.br/search?keyword=${encodeURIComponent(query)}`,
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'x-api-source': 'pc',
      },
    });

    if (response.ok) {
      const data = (await response.json()) as {
        items?: Array<{
          item_basic?: {
            name?: string;
            price?: number;
            price_min?: number;
            image?: string;
            shopid?: number;
            itemid?: number;
          };
        }>;
      };

      const apiItems = (data.items || [])
        .map((entry) => entry.item_basic)
        .filter((item) => item?.name && item.shopid && item.itemid)
        .map((item) => {
          const rawPrice =
            typeof item?.price_min === 'number'
              ? item.price_min
              : typeof item?.price === 'number'
                ? item.price
                : null;

          const normalizedPrice = rawPrice ? rawPrice / 100000 : null;

          return {
            name: item?.name || 'Produto sem nome',
            description: item?.name || 'Produto sem descrição',
            price: normalizedPrice,
            url: `https://shopee.com.br/product/${item?.shopid}/${item?.itemid}`,
            image: item?.image
              ? `https://down-br.img.susercontent.com/file/${item.image}`
              : null,
            store: WishlistStore.SHOPEE,
          } satisfies StoreSearchResult;
        });

      if (apiItems.length > 0) {
        return apiItems;
      }
    }

    const htmlFallback = await this.searchShopeeHtmlFallback(query);
    if (htmlFallback.length > 0) {
      return htmlFallback;
    }

    return this.searchWithWebScraping(query, WishlistStore.SHOPEE);
  }

  private async searchShopeeHtmlFallback(
    query: string,
  ): Promise<StoreSearchResult[]> {
    const html = await this.fetchText(
      `https://shopee.com.br/search?keyword=${encodeURIComponent(query)}`,
    );

    if (!html) {
      return [];
    }

    const productLinks = Array.from(
      new Set(
        [...html.matchAll(/\/product\/(\d+)\/(\d+)/g)]
          .map(
            (match) => `https://shopee.com.br/product/${match[1]}/${match[2]}`,
          )
          .slice(0, 12),
      ),
    );

    return productLinks.map((url) => ({
      name: 'Produto Shopee',
      description: 'Resultado encontrado na Shopee',
      price: null,
      url,
      image: null,
      store: WishlistStore.SHOPEE,
    }));
  }

  private async searchWithWebScraping(
    query: string,
    store: WishlistStore,
  ): Promise<StoreSearchResult[]> {
    const domainByStore: Record<WishlistStore, string> = {
      [WishlistStore.AMAZON]: 'amazon.com.br',
      [WishlistStore.MERCADOLIVRE]: 'mercadolivre.com.br',
      [WishlistStore.SHOPEE]: 'shopee.com.br',
      [WishlistStore.SHEIN]: 'br.shein.com',
    };

    const domain = domainByStore[store];
    const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(`site:${domain} ${query}`)}`;
    const html = await this.fetchText(searchUrl);

    if (!html) {
      return [];
    }

    const matches = [
      ...html.matchAll(
        /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi,
      ),
    ];
    const rawItems = matches
      .slice(0, 12)
      .map((match) => {
        const ddgHref = match[1] || '';
        const url = this.extractDuckDuckGoTargetUrl(ddgHref);
        const title = this.stripHtml(match[2] || '');
        return { url, title };
      })
      .filter((item) => item.url && this.isUrlFromStore(item.url, store));

    const uniqueByUrl = Array.from(
      new Map(rawItems.map((item) => [item.url, item])).values(),
    );

    const details = await Promise.all(
      uniqueByUrl.slice(0, 8).map(async (item) => {
        const productHtml = await this.fetchText(item.url);
        const extractedPrice = productHtml
          ? this.extractPrice(productHtml)
          : null;
        const image = productHtml ? this.extractImage(productHtml) : null;

        return {
          name: item.title,
          description: item.title,
          price: extractedPrice,
          url: item.url,
          image,
          store,
        } satisfies StoreSearchResult;
      }),
    );

    return details;
  }

  private toAbsoluteUrl(pathOrUrl: string, base: string) {
    if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
      return pathOrUrl;
    }

    try {
      return new URL(pathOrUrl, base).toString();
    } catch {
      return pathOrUrl;
    }
  }

  private async fetchText(url: string): Promise<string | null> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000);
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) return null;
      return response.text();
    } catch {
      return null;
    }
  }

  private stripHtml(input: string) {
    return input
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extractDuckDuckGoTargetUrl(ddgHref: string) {
    try {
      if (ddgHref.startsWith('http://') || ddgHref.startsWith('https://'))
        return ddgHref;
      const parsed = new URL(ddgHref, 'https://duckduckgo.com');
      const uddg = parsed.searchParams.get('uddg');
      return uddg ? decodeURIComponent(uddg) : ddgHref;
    } catch {
      return ddgHref;
    }
  }

  private isUrlFromStore(url: string, store: WishlistStore) {
    const validators: Record<WishlistStore, (host: string) => boolean> = {
      [WishlistStore.AMAZON]: (host) => host.includes('amazon.'),
      [WishlistStore.MERCADOLIVRE]: (host) => host.includes('mercadolivre.'),
      [WishlistStore.SHOPEE]: (host) => host.includes('shopee.'),
      [WishlistStore.SHEIN]: (host) => host.includes('shein.'),
    };

    try {
      const host = new URL(url).hostname.toLowerCase();
      return validators[store](host);
    } catch {
      return false;
    }
  }

  private extractPrice(html: string): number | null {
    const patterns = [
      /"price"\s*:\s*"?(\d+[.,]\d{2})"?/i,
      /R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i,
      /content="(\d+[.,]\d{2})"\s*itemprop="price"/i,
      /"amount"\s*:\s*"?(\d+[.,]\d{2})"?/i,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (!match?.[1]) continue;

      const normalized = match[1].replace(/\./g, '').replace(',', '.');
      const parsed = Number(normalized);
      if (!Number.isNaN(parsed) && parsed > 0) return parsed;
    }

    return null;
  }

  private extractAmazonCardPrice(chunk: string): number | null {
    const whole = chunk.match(/a-price-whole">\s*([\d.]+)/i)?.[1] || '';
    const fraction = chunk.match(/a-price-fraction">\s*(\d{2})/i)?.[1] || '';

    if (whole) {
      const withFraction = `${whole}${fraction ? `,${fraction}` : ''}`;
      const parsed = this.parseBrazilianMoney(withFraction);
      if (parsed) {
        return parsed;
      }
    }

    const offscreenPrices = [
      ...chunk.matchAll(/a-offscreen[^>]*>([\s\S]*?)<\/span>/gi),
    ]
      .map((match) => this.stripHtml(match[1] || ''))
      .map((text) => text.replace('R$', '').trim())
      .filter((text) => text.length > 0)
      .map((text) => this.parseBrazilianMoney(text))
      .filter(
        (price): price is number => typeof price === 'number' && price > 0,
      );

    return offscreenPrices[0] ?? null;
  }

  private normalizeNumberPrice(
    ...values: Array<number | undefined>
  ): number | null {
    for (const value of values) {
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        return value;
      }
    }

    return null;
  }

  private parseBrazilianMoney(value: string | null): number | null {
    if (!value) return null;

    const normalized = value
      .replace(/\s/g, '')
      .replace(/\./g, '')
      .replace(',', '.');
    const parsed = Number(normalized);

    if (Number.isNaN(parsed) || parsed <= 0) {
      return null;
    }

    return parsed;
  }

  private extractImage(html: string): string | null {
    const imagePatterns = [
      /<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i,
      /<meta[^>]*name="twitter:image"[^>]*content="([^"]+)"/i,
    ];

    for (const pattern of imagePatterns) {
      const match = html.match(pattern);
      if (match?.[1]) {
        return match[1];
      }
    }

    return null;
  }
}
