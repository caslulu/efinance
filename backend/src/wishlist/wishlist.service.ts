import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWishlistDto } from './dto/create-wishlist.dto';
import { UpdateWishlistDto } from './dto/update-wishlist.dto';
import { CreateWishlistProductDto } from './dto/create-wishlist-product.dto';
import { UpdateWishlistProductDto } from './dto/update-wishlist-product.dto';

@Injectable()
export class WishlistService {
  private readonly logger = new Logger(WishlistService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailerService: MailerService,
  ) { }

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

    await this.prisma.wishlistPriceAlertNotification.deleteMany({
      where: {
        wishlistProduct: {
          id_wishlist: id,
        },
      },
    });

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

    const product = await this.prisma.wishlistProduct.create({
      data: {
        id_wishlist: wishlistId,
        name_product: createWishlistProductDto.name_product,
        price: createWishlistProductDto.price,
        url: createWishlistProductDto.url,
        send_price_alerts: createWishlistProductDto.send_price_alerts ?? false,
        last_checked_price: createWishlistProductDto.price,
      },
    });

    await this.prisma.wishlistProductHistory.create({
      data: {
        wishlist_product_id: product.id,
        price: product.price,
      }
    });

    return product;

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

    const nextData: UpdateWishlistProductDto & {
      last_checked_price?: number;
    } = {
      ...updateWishlistProductDto,
    };

    if (typeof updateWishlistProductDto.price === 'number') {
      nextData.last_checked_price = updateWishlistProductDto.price;
    }

    return this.prisma.wishlistProduct.update({
      where: { id: productId },
      data: nextData,
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

    await this.prisma.wishlistPriceAlertNotification.deleteMany({
      where: {
        wishlist_product_id: productId,
      },
    });

    await this.prisma.wishlistProductHistory.deleteMany({
      where: {
        wishlist_product_id: productId,
      },
    });

    return this.prisma.wishlistProduct.delete({
      where: { id: productId },
    });
  }

  async getProductHistory(wishlistId: number, productId: number, userId: number) {
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

    return this.prisma.wishlistProductHistory.findMany({
      where: { wishlist_product_id: productId },
      orderBy: { created_at: 'asc' },
    });
  }

  async getPriceAlertNotifications(userId: number) {
    const notifications = await this.prisma.wishlistPriceAlertNotification.findMany({
      where: { user_id: userId },
      include: {
        wishlistProduct: {
          select: {
            id: true,
            name_product: true,
            url: true,
          },
        },
      },
      orderBy: {
        notified_at: 'desc',
      },
      take: 20,
    });

    const unreadCount = await this.prisma.wishlistPriceAlertNotification.count({
      where: {
        user_id: userId,
        is_read: false,
      },
    });

    return {
      unreadCount,
      notifications,
    };
  }

  async markPriceAlertAsRead(userId: number, notificationId: number) {
    const existing = await this.prisma.wishlistPriceAlertNotification.findFirst({
      where: {
        id: notificationId,
        user_id: userId,
      },
    });

    if (!existing) {
      throw new NotFoundException('Notificação não encontrada');
    }

    return this.prisma.wishlistPriceAlertNotification.update({
      where: { id: notificationId },
      data: { is_read: true },
    });
  }

  @Cron(CronExpression.EVERY_HOUR)
  async checkWishlistPriceDrops() {
    const products = await this.prisma.wishlistProduct.findMany({
      where: {
        send_price_alerts: true,
        url: {
          not: null,
        },
      },
      include: {
        wishlist: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                username: true,
              },
            },
          },
        },
      },
    });

    for (const product of products) {
      const targetUrl = product.url?.trim();
      if (!targetUrl) continue;

      try {
        const scraped = await this.scrapeProductUrl(targetUrl);
        if (!scraped.price || scraped.price <= 0) continue;

        const previousPrice = Number(product.last_checked_price ?? product.price);
        const currentPrice = scraped.price;

        if (currentPrice < previousPrice || currentPrice > previousPrice) {
          await this.prisma.wishlistProductHistory.create({
            data: {
              wishlist_product_id: product.id,
              price: currentPrice,
            }
          });
        }

        if (currentPrice < previousPrice) {
          const message = `O preço de "${product.name_product}" caiu de R$ ${previousPrice.toFixed(2)} para R$ ${currentPrice.toFixed(2)}.`;

          await this.prisma.wishlistPriceAlertNotification.create({
            data: {
              user_id: product.wishlist.user_id,
              wishlist_product_id: product.id,
              old_price: previousPrice,
              new_price: currentPrice,
              message,
            },
          });

          if (product.wishlist.user?.email) {
            await this.sendPriceDropEmail({
              to: product.wishlist.user.email,
              username: product.wishlist.user.username,
              productName: product.name_product,
              oldPrice: previousPrice,
              newPrice: currentPrice,
              url: targetUrl,
            });
          }
        }

        await this.prisma.wishlistProduct.update({
          where: { id: product.id },
          data: {
            price: currentPrice,
            last_checked_price: currentPrice,
          },
        });
      } catch (error) {
        this.logger.warn(
          `Falha ao processar alerta de preço para produto ${product.id}`,
        );
      }
    }
  }

  async scrapeProductUrl(
    url: string,
  ): Promise<{ name: string | null; price: number | null; image: string | null }> {
    try {
      if (this.isAmazonUrl(url)) {
        return this.scrapeAmazonProduct(url);
      }
      if (this.isMercadoLivreUrl(url)) {
        return this.scrapeMercadoLivreProduct(url);
      }
      return { name: null, price: null, image: null };
    } catch {
      return { name: null, price: null, image: null };
    }
  }

  private isAmazonUrl(url: string): boolean {
    return /amazon\.com\.br/i.test(url);
  }

  private isMercadoLivreUrl(url: string): boolean {
    return /mercadolivre\.com\.br|mercadolibre\.com/i.test(url);
  }

  private async scrapeAmazonProduct(
    url: string,
  ): Promise<{ name: string | null; price: number | null; image: string | null }> {
    const html = await this.fetchText(url);
    if (!html) return { name: null, price: null, image: null };

    const name = this.stripHtml(
      html.match(/<span[^>]*id="productTitle"[^>]*>([\s\S]*?)<\/span>/i)?.[1] || '',
    ) || null;

    const price = this.extractAmazonCardPrice(html);

    const image =
      html.match(/<img[^>]*id="landingImage"[^>]*src="([^"]+)"/i)?.[1] ||
      html.match(/<img[^>]*class="[^"]*a-dynamic-image[^"]*"[^>]*src="([^"]+)"/i)?.[1] ||
      null;

    return { name, price, image };
  }

  private async scrapeMercadoLivreProduct(
    url: string,
  ): Promise<{ name: string | null; price: number | null; image: string | null }> {
    // Try the official API first if URL contains item ID (MLB-\d+)
    const itemIdMatch = url.match(/MLB[-]?(\d+)/i);
    if (itemIdMatch) {
      const itemId = `MLB${itemIdMatch[1]}`;
      try {
        const apiResponse = await fetch(
          `https://api.mercadolibre.com/items/${itemId}`,
          {
            headers: {
              Accept: 'application/json',
              'User-Agent':
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            },
          },
        );
        if (apiResponse.ok) {
          const data = (await apiResponse.json()) as {
            title?: string;
            price?: number;
            sale_price?: number;
            original_price?: number;
            pictures?: Array<{ url?: string; secure_url?: string }>;
            thumbnail?: string;
          };
          return {
            name: data.title || null,
            price: this.normalizeNumberPrice(
              data.price,
              data.sale_price,
              data.original_price,
            ),
            image:
              data.pictures?.[0]?.secure_url ||
              data.pictures?.[0]?.url ||
              data.thumbnail ||
              null,
          };
        }
      } catch {
        // Fall through to HTML scraping
      }
    }

    // Fallback: scrape HTML
    const html = await this.fetchText(url);
    if (!html) return { name: null, price: null, image: null };

    const name = this.stripHtml(
      html.match(/<h1[^>]*class="[^"]*ui-pdp-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '',
    ) || null;

    const price = this.parseBrazilianMoney(
      html.match(/R\$\s*([\d.]+(?:,\d{2})?)/i)?.[1] || null,
    );

    const image =
      html.match(/<img[^>]*class="[^"]*ui-pdp-image[^"]*"[^>]*src="([^"]+)"/i)?.[1] ||
      null;

    return { name, price, image };
  }

  private async fetchText(url: string): Promise<string | null> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
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

  private async sendPriceDropEmail(params: {
    to: string;
    username?: string | null;
    productName: string;
    oldPrice: number;
    newPrice: number;
    url: string;
  }) {
    const { to, username, productName, oldPrice, newPrice, url } = params;

    try {
      await this.mailerService.sendMail({
        to,
        subject: 'Alerta de preço: produto da wishlist ficou mais barato',
        html: `
          <div style="font-family: Arial, sans-serif; color: #222;">
            <h2>💸 Preço caiu na sua wishlist</h2>
            <p>Olá, <strong>${username || 'usuário'}</strong>!</p>
            <p>O produto <strong>${productName}</strong> teve redução de preço.</p>
            <p><strong>Preço anterior:</strong> R$ ${oldPrice.toFixed(2)}</p>
            <p><strong>Novo preço:</strong> R$ ${newPrice.toFixed(2)}</p>
            <p><a href="${url}" target="_blank" rel="noopener noreferrer">Ver produto</a></p>
          </div>
        `,
      });
    } catch {
      this.logger.warn(`Falha ao enviar email de alerta para ${to}`);
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
}
