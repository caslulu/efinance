import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InvestmentMarket as PrismaInvestmentMarket,
  InvestmentOperationType,
  Prisma,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { InvestmentMarketDataService } from './investment-market-data.service';
import { CreateInvestmentOperationDto } from './dto/create-investment-operation.dto';
import {
  InvestmentPortfolioResponse,
  PortfolioPositionSummary,
  PortfolioWalletSummary,
} from './investment-portfolio.types';

type InvestmentOperationLike = {
  id: number;
  type: InvestmentOperationType;
  symbol: string;
  market: PrismaInvestmentMarket;
  currency: string;
  quantity: Decimal | null;
  unit_price: Decimal | null;
  gross_amount: Decimal;
  gross_amount_brl: Decimal;
  fx_rate: Decimal | null;
  transaction_date: Date;
  source_event_key: string | null;
  notes: string | null;
  created_at: Date;
};

type PositionReplayState = {
  quantity: Decimal;
  averageCost: Decimal;
  investedAmount: Decimal;
  investedAmountBrl: Decimal;
  realizedPnl: Decimal;
  realizedPnlBrl: Decimal;
  dividendsReceived: Decimal;
  dividendsReceivedBrl: Decimal;
  jcpReceived: Decimal;
  jcpReceivedBrl: Decimal;
};

type NormalizedManualOperation = {
  walletId: number;
  operationType: InvestmentOperationType;
  symbol: string;
  market: PrismaInvestmentMarket;
  currency: string;
  quantity: Decimal | null;
  unitPrice: Decimal | null;
  grossAmount: Decimal;
  grossAmountBrl: Decimal;
  fxRate: Decimal | null;
  transactionDate: Date;
  notes: string | null;
};

type WalletWithPortfolioFields = {
  id: number;
  name: string;
  type: string;
  actual_cash: Decimal;
};

const ZERO = new Decimal(0);
const EPSILON = new Decimal('0.000001');

@Injectable()
export class InvestmentPortfolioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly marketDataService: InvestmentMarketDataService,
  ) {}

  async createOperation(
    userId: number,
    dto: CreateInvestmentOperationDto,
  ): Promise<{
    operationId: number;
    walletId: number;
    symbol: string;
    market: PrismaInvestmentMarket;
  }> {
    const normalized = await this.normalizeManualOperation(dto);
    const wallet = await this.getInvestmentWallet(userId, normalized.walletId);
    const existingOperations = await this.prisma.investmentOperation.findMany({
      where: {
        wallet_id: wallet.id,
        symbol: normalized.symbol,
        market: normalized.market,
      },
      orderBy: [{ transaction_date: 'asc' }, { id: 'asc' }],
    });

    this.assertOperationSequenceIsValid(existingOperations, normalized);

    if (
      normalized.operationType === InvestmentOperationType.BUY &&
      new Decimal(wallet.actual_cash).lessThan(normalized.grossAmountBrl)
    ) {
      throw new BadRequestException('Saldo insuficiente na carteira de investimento');
    }

    const operation = await this.prisma.$transaction(async (tx) => {
      const createdOperation = await tx.investmentOperation.create({
        data: {
          wallet_id: wallet.id,
          type: normalized.operationType,
          symbol: normalized.symbol,
          market: normalized.market,
          currency: normalized.currency,
          quantity: normalized.quantity,
          unit_price: normalized.unitPrice,
          gross_amount: normalized.grossAmount,
          gross_amount_brl: normalized.grossAmountBrl,
          fx_rate: normalized.fxRate,
          transaction_date: normalized.transactionDate,
          notes: normalized.notes,
        },
      });

      await this.applyWalletCashMovement(tx, wallet.id, normalized);
      await this.createMirrorTransaction(tx, userId, wallet.id, normalized);
      await this.rebuildPositionAggregate(
        tx,
        wallet.id,
        normalized.symbol,
        normalized.market,
      );

      return createdOperation;
    });

    await this.syncAutomaticDividendsForWalletSymbol(
      userId,
      wallet.id,
      normalized.symbol,
      normalized.market,
    );

    return {
      operationId: operation.id,
      walletId: wallet.id,
      symbol: normalized.symbol,
      market: normalized.market,
    };
  }

  async getPortfolio(userId: number): Promise<InvestmentPortfolioResponse> {
    await this.syncAutomaticDividendsForUser(userId);
    return this.buildPortfolio(userId);
  }

  async getWalletDisplaySummaries(
    userId: number,
  ): Promise<Map<number, PortfolioWalletSummary>> {
    const portfolio = await this.buildPortfolio(userId);
    return new Map(portfolio.wallets.map((wallet) => [wallet.walletId, wallet]));
  }

  async getPortfolioSummary(userId: number): Promise<InvestmentPortfolioResponse['summary']> {
    const portfolio = await this.buildPortfolio(userId);
    return portfolio.summary;
  }

  private async buildPortfolio(
    userId: number,
  ): Promise<InvestmentPortfolioResponse> {
    const [wallets, positions] = await Promise.all([
      this.prisma.wallet.findMany({
        where: { user_id: userId, type: 'INVESTMENT' },
        orderBy: [{ order: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          name: true,
          type: true,
          actual_cash: true,
        },
      }),
      this.prisma.investmentPosition.findMany({
        where: {
          wallet: { user_id: userId },
          quantity: { gt: ZERO },
        },
        include: {
          wallet: {
            select: {
              id: true,
              name: true,
              actual_cash: true,
            },
          },
        },
        orderBy: [{ wallet_id: 'asc' }, { symbol: 'asc' }],
      }),
    ]);

    if (wallets.length === 0) {
      return {
        summary: {
          totalPortfolioValue: 0,
          totalAvailableCash: 0,
          totalGainLoss: 0,
          totalGainLossPercent: 0,
          totalDividends: 0,
          totalJcp: 0,
          totalPositions: 0,
          totalWallets: 0,
        },
        wallets: [],
        positions: [],
      };
    }

    const marketDataMap = await this.loadMarketDataMap(positions);
    const positionSummaries = positions.map((position) =>
      this.toPositionSummary(position, marketDataMap),
    );

    await this.persistPositionSnapshots(positionSummaries);

    const walletSummaries = wallets.map((wallet) =>
      this.buildWalletSummary(wallet, positionSummaries),
    );

    const totalPortfolioValue = walletSummaries.reduce(
      (sum, wallet) => sum + wallet.portfolioValue,
      0,
    );
    const totalAvailableCash = walletSummaries.reduce(
      (sum, wallet) => sum + wallet.availableCash,
      0,
    );
    const totalGainLoss = walletSummaries.reduce(
      (sum, wallet) => sum + wallet.totalGainLoss,
      0,
    );
    const totalDividends = positionSummaries.reduce(
      (sum, position) => sum + position.dividendsReceivedBrl,
      0,
    );
    const totalJcp = positionSummaries.reduce(
      (sum, position) => sum + position.jcpReceivedBrl,
      0,
    );
    const totalInvestedCost = positionSummaries.reduce(
      (sum, position) => sum + position.investedAmountBrl,
      0,
    );

    return {
      summary: {
        totalPortfolioValue: this.roundMoney(totalPortfolioValue),
        totalAvailableCash: this.roundMoney(totalAvailableCash),
        totalGainLoss: this.roundMoney(totalGainLoss),
        totalGainLossPercent:
          totalInvestedCost > 0
            ? this.roundPercent((totalGainLoss / totalInvestedCost) * 100)
            : 0,
        totalDividends: this.roundMoney(totalDividends),
        totalJcp: this.roundMoney(totalJcp),
        totalPositions: positionSummaries.length,
        totalWallets: walletSummaries.length,
      },
      wallets: walletSummaries,
      positions: positionSummaries,
    };
  }

  private async loadMarketDataMap(
    positions: Array<{
      symbol: string;
      market: PrismaInvestmentMarket;
    }>,
  ): Promise<Map<string, Awaited<ReturnType<InvestmentMarketDataService['getMany']>>[number]>> {
    const map = new Map<
      string,
      Awaited<ReturnType<InvestmentMarketDataService['getMany']>>[number]
    >();
    const groupedSymbols = {
      BR: new Set<string>(),
      GLOBAL: new Set<string>(),
    };

    positions.forEach((position) => {
      groupedSymbols[position.market].add(position.symbol);
    });

    for (const market of ['BR', 'GLOBAL'] as const) {
      const symbols = Array.from(groupedSymbols[market]);
      if (symbols.length === 0) {
        continue;
      }

      const items = await this.marketDataService.getMany({
        symbols,
        periods: [1],
        market,
      });

      items.forEach((item) => {
        map.set(this.buildMarketKey(market, item.symbol), item);
      });
    }

    return map;
  }

  private toPositionSummary(
    position: {
      id: number;
      wallet_id: number;
      wallet: { id: number; name: string; actual_cash: Decimal };
      symbol: string;
      market: PrismaInvestmentMarket;
      currency: string;
      quantity: Decimal;
      average_cost: Decimal;
      invested_amount: Decimal;
      invested_amount_brl: Decimal;
      dividends_received: Decimal;
      dividends_received_brl: Decimal;
      jcp_received: Decimal;
      jcp_received_brl: Decimal;
      last_market_price: Decimal | null;
      last_market_price_brl: Decimal | null;
      last_market_at: Date | null;
    },
    marketDataMap: Map<
      string,
      Awaited<ReturnType<InvestmentMarketDataService['getMany']>>[number]
    >,
  ): PortfolioPositionSummary {
    const marketItem =
      marketDataMap.get(this.buildMarketKey(position.market, position.symbol)) ??
      null;
    const quantity = Number(position.quantity);
    const currentPrice =
      marketItem?.price ?? Number(position.last_market_price || ZERO);
    const currentPriceBrl =
      marketItem?.currencyValues.price.brl ??
      Number(position.last_market_price_brl || ZERO) ??
      0;
    const currentValue = quantity * currentPrice;
    const currentValueBrl = quantity * currentPriceBrl;
    const investedAmount = Number(position.invested_amount);
    const investedAmountBrl = Number(position.invested_amount_brl);
    const gainLoss = currentValue - investedAmount;
    const gainLossBrl = currentValueBrl - investedAmountBrl;

    return {
      positionId: position.id,
      walletId: position.wallet_id,
      walletName: position.wallet.name,
      symbol: position.symbol,
      market: position.market,
      marketSymbol: marketItem?.marketSymbol ?? position.symbol,
      quantity: this.roundQuantity(quantity),
      currency: position.currency,
      shortName: marketItem?.shortName ?? null,
      longName: marketItem?.longName ?? null,
      averageCost: Number(position.average_cost),
      averageCostBrl:
        quantity > 0
          ? this.roundMarketValue(investedAmountBrl / quantity)
          : 0,
      currentPrice: this.roundMarketValue(currentPrice),
      currentPriceBrl: this.roundMarketValue(currentPriceBrl),
      investedAmount: this.roundMarketValue(investedAmount),
      investedAmountBrl: this.roundMoney(investedAmountBrl),
      currentValue: this.roundMarketValue(currentValue),
      currentValueBrl: this.roundMoney(currentValueBrl),
      gainLoss: this.roundMarketValue(gainLoss),
      gainLossBrl: this.roundMoney(gainLossBrl),
      gainLossPercent:
        investedAmountBrl > 0
          ? this.roundPercent((gainLossBrl / investedAmountBrl) * 100)
          : 0,
      dividendsReceived: this.roundMarketValue(
        Number(position.dividends_received),
      ),
      dividendsReceivedBrl: this.roundMoney(
        Number(position.dividends_received_brl),
      ),
      jcpReceived: this.roundMarketValue(Number(position.jcp_received)),
      jcpReceivedBrl: this.roundMoney(Number(position.jcp_received_brl)),
      marketTime:
        marketItem?.marketTime ??
        position.last_market_at?.toISOString() ??
        null,
    };
  }

  private buildWalletSummary(
    wallet: WalletWithPortfolioFields,
    positions: PortfolioPositionSummary[],
  ): PortfolioWalletSummary {
    const walletPositions = positions.filter(
      (position) => position.walletId === wallet.id,
    );
    const portfolioValue = walletPositions.reduce(
      (sum, position) => sum + position.currentValueBrl,
      0,
    );
    const totalGainLoss = walletPositions.reduce(
      (sum, position) => sum + position.gainLossBrl,
      0,
    );
    const totalDividends = walletPositions.reduce(
      (sum, position) => sum + position.dividendsReceivedBrl + position.jcpReceivedBrl,
      0,
    );
    const investedAmountBrl = walletPositions.reduce(
      (sum, position) => sum + position.investedAmountBrl,
      0,
    );

    return {
      walletId: wallet.id,
      walletName: wallet.name,
      portfolioValue: this.roundMoney(portfolioValue),
      availableCash: this.roundMoney(Number(wallet.actual_cash)),
      positionsCount: walletPositions.length,
      displayValue: this.roundMoney(portfolioValue),
      totalGainLoss: this.roundMoney(totalGainLoss),
      totalGainLossPercent:
        investedAmountBrl > 0
          ? this.roundPercent((totalGainLoss / investedAmountBrl) * 100)
          : 0,
      totalDividends: this.roundMoney(totalDividends),
    };
  }

  private async persistPositionSnapshots(
    positions: PortfolioPositionSummary[],
  ): Promise<void> {
    await Promise.all(
      positions.map((position) =>
        this.prisma.investmentPosition.update({
          where: { id: position.positionId },
          data: {
            last_market_price: position.currentPrice,
            last_market_price_brl: position.currentPriceBrl,
            last_market_at: position.marketTime ? new Date(position.marketTime) : null,
          },
        }),
      ),
    );
  }

  private async syncAutomaticDividendsForUser(userId: number): Promise<void> {
    const positions = await this.prisma.investmentPosition.findMany({
      where: {
        wallet: { user_id: userId },
        market: PrismaInvestmentMarket.BR,
      },
      select: {
        wallet_id: true,
        symbol: true,
        market: true,
      },
    });

    for (const position of positions) {
      await this.syncAutomaticDividendsForWalletSymbol(
        userId,
        position.wallet_id,
        position.symbol,
        position.market,
      );
    }
  }

  private async syncAutomaticDividendsForWalletSymbol(
    userId: number,
    walletId: number,
    symbol: string,
    market: PrismaInvestmentMarket,
  ): Promise<void> {
    if (market !== PrismaInvestmentMarket.BR) {
      return;
    }

    const wallet = await this.getInvestmentWallet(userId, walletId);
    const dividendEvents = await this.marketDataService.getDividendEvents(
      symbol,
      'BR',
    );

    if (dividendEvents.length === 0) {
      return;
    }

    const existingOperations = await this.prisma.investmentOperation.findMany({
      where: {
        wallet_id: wallet.id,
        symbol,
        market,
      },
      orderBy: [{ transaction_date: 'asc' }, { id: 'asc' }],
    });

    const existingEventKeys = new Set(
      existingOperations
        .map((operation) => operation.source_event_key)
        .filter((key): key is string => Boolean(key)),
    );

    let createdAny = false;
    const localOperations = [...existingOperations];

    for (const event of dividendEvents) {
      const sourceEventKey = this.buildSourceEventKey(
        wallet.id,
        symbol,
        event.type,
        event.date,
        event.amount,
      );

      if (existingEventKeys.has(sourceEventKey)) {
        continue;
      }

      const quantityHeld = this.calculateHeldQuantityAtDate(
        localOperations,
        new Date(event.date),
      );

      if (quantityHeld.lte(ZERO)) {
        continue;
      }

      const grossAmount = this.roundMarketDecimal(
        quantityHeld.times(new Decimal(event.amount)),
      );
      const normalized: NormalizedManualOperation = {
        walletId: wallet.id,
        operationType:
          event.type === 'JCP'
            ? InvestmentOperationType.JCP
            : InvestmentOperationType.DIVIDEND,
        symbol,
        market,
        currency: 'BRL',
        quantity: null,
        unitPrice: null,
        grossAmount,
        grossAmountBrl: this.roundMoneyDecimal(grossAmount),
        fxRate: null,
        transactionDate: new Date(event.date),
        notes: 'Sincronizado automaticamente do provedor de mercado',
      };

      const operation = await this.prisma.$transaction(async (tx) => {
        const createdOperation = await tx.investmentOperation.create({
          data: {
            wallet_id: wallet.id,
            type: normalized.operationType,
            symbol: normalized.symbol,
            market: normalized.market,
            currency: normalized.currency,
            quantity: null,
            unit_price: null,
            gross_amount: normalized.grossAmount,
            gross_amount_brl: normalized.grossAmountBrl,
            fx_rate: null,
            transaction_date: normalized.transactionDate,
            notes: normalized.notes,
            source_event_key: sourceEventKey,
          },
        });

        await this.applyWalletCashMovement(tx, wallet.id, normalized);
        await this.createMirrorTransaction(tx, userId, wallet.id, normalized);
        await this.rebuildPositionAggregate(tx, wallet.id, symbol, market);

        return createdOperation;
      });

      localOperations.push(operation);
      existingEventKeys.add(sourceEventKey);
      createdAny = true;
    }

    if (!createdAny) {
      return;
    }
  }

  private calculateHeldQuantityAtDate(
    operations: InvestmentOperationLike[],
    targetDate: Date,
  ): Decimal {
    let quantity = ZERO;

    const filtered = operations
      .filter((operation) => operation.transaction_date <= targetDate)
      .sort((left, right) => {
        const diff =
          left.transaction_date.getTime() - right.transaction_date.getTime();
        if (diff !== 0) {
          return diff;
        }

        return left.id - right.id;
      });

    for (const operation of filtered) {
      if (operation.type === InvestmentOperationType.BUY) {
        quantity = quantity.plus(operation.quantity || ZERO);
      }

      if (operation.type === InvestmentOperationType.SELL) {
        quantity = quantity.minus(operation.quantity || ZERO);
      }
    }

    return quantity.greaterThan(EPSILON) ? quantity : ZERO;
  }

  private assertOperationSequenceIsValid(
    existingOperations: InvestmentOperationLike[],
    candidate: NormalizedManualOperation,
  ): void {
    const candidateLike: InvestmentOperationLike = {
      id: Number.MAX_SAFE_INTEGER,
      type: candidate.operationType,
      symbol: candidate.symbol,
      market: candidate.market,
      currency: candidate.currency,
      quantity: candidate.quantity,
      unit_price: candidate.unitPrice,
      gross_amount: candidate.grossAmount,
      gross_amount_brl: candidate.grossAmountBrl,
      fx_rate: candidate.fxRate,
      transaction_date: candidate.transactionDate,
      source_event_key: null,
      notes: candidate.notes,
      created_at: candidate.transactionDate,
    };

    this.replayOperations([...existingOperations, candidateLike], true);
  }

  private async rebuildPositionAggregate(
    tx: Prisma.TransactionClient,
    walletId: number,
    symbol: string,
    market: PrismaInvestmentMarket,
  ) {
    const operations = await tx.investmentOperation.findMany({
      where: {
        wallet_id: walletId,
        symbol,
        market,
      },
      orderBy: [{ transaction_date: 'asc' }, { id: 'asc' }],
    });
    const replayed = this.replayOperations(operations);
    const currency = operations[operations.length - 1]?.currency ?? this.resolveCurrency(market);

    const position = await tx.investmentPosition.upsert({
      where: {
        wallet_id_symbol_market: {
          wallet_id: walletId,
          symbol,
          market,
        },
      },
      create: {
        wallet_id: walletId,
        symbol,
        market,
        currency,
        quantity: replayed.quantity,
        average_cost: replayed.averageCost,
        invested_amount: replayed.investedAmount,
        invested_amount_brl: replayed.investedAmountBrl,
        realized_pnl: replayed.realizedPnl,
        realized_pnl_brl: replayed.realizedPnlBrl,
        dividends_received: replayed.dividendsReceived,
        dividends_received_brl: replayed.dividendsReceivedBrl,
        jcp_received: replayed.jcpReceived,
        jcp_received_brl: replayed.jcpReceivedBrl,
      },
      update: {
        currency,
        quantity: replayed.quantity,
        average_cost: replayed.averageCost,
        invested_amount: replayed.investedAmount,
        invested_amount_brl: replayed.investedAmountBrl,
        realized_pnl: replayed.realizedPnl,
        realized_pnl_brl: replayed.realizedPnlBrl,
        dividends_received: replayed.dividendsReceived,
        dividends_received_brl: replayed.dividendsReceivedBrl,
        jcp_received: replayed.jcpReceived,
        jcp_received_brl: replayed.jcpReceivedBrl,
      },
    });

    await tx.investmentOperation.updateMany({
      where: {
        wallet_id: walletId,
        symbol,
        market,
      },
      data: {
        position_id: position.id,
      },
    });

    return position;
  }

  private replayOperations(
    operations: InvestmentOperationLike[],
    throwOnInvalidSell = false,
  ): PositionReplayState {
    const sorted = [...operations].sort((left, right) => {
      const diff =
        left.transaction_date.getTime() - right.transaction_date.getTime();
      if (diff !== 0) {
        return diff;
      }

      return left.id - right.id;
    });

    let quantity = ZERO;
    let investedAmount = ZERO;
    let investedAmountBrl = ZERO;
    let realizedPnl = ZERO;
    let realizedPnlBrl = ZERO;
    let dividendsReceived = ZERO;
    let dividendsReceivedBrl = ZERO;
    let jcpReceived = ZERO;
    let jcpReceivedBrl = ZERO;

    for (const operation of sorted) {
      if (operation.type === InvestmentOperationType.BUY) {
        quantity = quantity.plus(operation.quantity || ZERO);
        investedAmount = investedAmount.plus(operation.gross_amount);
        investedAmountBrl = investedAmountBrl.plus(operation.gross_amount_brl);
        continue;
      }

      if (operation.type === InvestmentOperationType.SELL) {
        const operationQuantity = operation.quantity || ZERO;
        if (throwOnInvalidSell && quantity.plus(EPSILON).lessThan(operationQuantity)) {
          throw new BadRequestException(
            `Quantidade insuficiente para vender ${operation.symbol}`,
          );
        }

        if (quantity.plus(EPSILON).lessThan(operationQuantity)) {
          continue;
        }

        const averageCost =
          quantity.greaterThan(EPSILON)
            ? investedAmount.div(quantity)
            : ZERO;
        const averageCostBrl =
          quantity.greaterThan(EPSILON)
            ? investedAmountBrl.div(quantity)
            : ZERO;
        const removedCost = averageCost.times(operationQuantity);
        const removedCostBrl = averageCostBrl.times(operationQuantity);

        quantity = quantity.minus(operationQuantity);
        investedAmount = investedAmount.minus(removedCost);
        investedAmountBrl = investedAmountBrl.minus(removedCostBrl);
        realizedPnl = realizedPnl.plus(operation.gross_amount.minus(removedCost));
        realizedPnlBrl = realizedPnlBrl.plus(
          operation.gross_amount_brl.minus(removedCostBrl),
        );

        if (!quantity.greaterThan(EPSILON)) {
          quantity = ZERO;
          investedAmount = ZERO;
          investedAmountBrl = ZERO;
        }

        continue;
      }

      if (operation.type === InvestmentOperationType.DIVIDEND) {
        dividendsReceived = dividendsReceived.plus(operation.gross_amount);
        dividendsReceivedBrl = dividendsReceivedBrl.plus(
          operation.gross_amount_brl,
        );
      }

      if (operation.type === InvestmentOperationType.JCP) {
        jcpReceived = jcpReceived.plus(operation.gross_amount);
        jcpReceivedBrl = jcpReceivedBrl.plus(operation.gross_amount_brl);
      }
    }

    return {
      quantity: this.roundQuantityDecimal(quantity),
      averageCost:
        quantity.greaterThan(EPSILON)
          ? this.roundMarketDecimal(investedAmount.div(quantity))
          : ZERO,
      investedAmount: this.roundMarketDecimal(investedAmount),
      investedAmountBrl: this.roundMarketDecimal(investedAmountBrl),
      realizedPnl: this.roundMarketDecimal(realizedPnl),
      realizedPnlBrl: this.roundMarketDecimal(realizedPnlBrl),
      dividendsReceived: this.roundMarketDecimal(dividendsReceived),
      dividendsReceivedBrl: this.roundMarketDecimal(dividendsReceivedBrl),
      jcpReceived: this.roundMarketDecimal(jcpReceived),
      jcpReceivedBrl: this.roundMarketDecimal(jcpReceivedBrl),
    };
  }

  private async createMirrorTransaction(
    tx: Prisma.TransactionClient,
    userId: number,
    walletId: number,
    normalized: NormalizedManualOperation,
  ): Promise<void> {
    const categoryId = await this.getOrCreateInvestmentsCategoryId(tx, userId);

    await tx.transaction.create({
      data: {
        wallet_id: walletId,
        transaction_date: normalized.transactionDate,
        transaction_type:
          normalized.operationType === InvestmentOperationType.BUY
            ? 'EXPENSE'
            : 'INCOME',
        is_recurring: false,
        value: normalized.grossAmountBrl,
        payment_method: 'INVESTMENT',
        description: this.buildTransactionDescription(normalized),
        category_id: categoryId,
        is_processed: true,
      },
    });
  }

  private buildTransactionDescription(
    normalized: NormalizedManualOperation,
  ): string {
    if (normalized.operationType === InvestmentOperationType.BUY) {
      return `Compra de ${this.formatDecimal(normalized.quantity)} ${normalized.symbol}`;
    }

    if (normalized.operationType === InvestmentOperationType.SELL) {
      return `Venda de ${this.formatDecimal(normalized.quantity)} ${normalized.symbol}`;
    }

    if (normalized.operationType === InvestmentOperationType.JCP) {
      return `JCP recebido de ${normalized.symbol}`;
    }

    return `Dividendo recebido de ${normalized.symbol}`;
  }

  private async applyWalletCashMovement(
    tx: Prisma.TransactionClient,
    walletId: number,
    normalized: NormalizedManualOperation,
  ): Promise<void> {
    if (normalized.operationType === InvestmentOperationType.BUY) {
      await tx.wallet.update({
        where: { id: walletId },
        data: {
          actual_cash: {
            decrement: normalized.grossAmountBrl,
          },
        },
      });
      return;
    }

    await tx.wallet.update({
      where: { id: walletId },
      data: {
        actual_cash: {
          increment: normalized.grossAmountBrl,
        },
      },
    });
  }

  private async getOrCreateInvestmentsCategoryId(
    tx: Prisma.TransactionClient,
    userId: number,
  ): Promise<number> {
    const existing = await tx.transactionCategory.findFirst({
      where: {
        user_id: userId,
        name: 'Investimentos',
      },
    });

    if (existing) {
      return existing.id;
    }

    const created = await tx.transactionCategory.create({
      data: {
        user_id: userId,
        name: 'Investimentos',
      },
    });

    return created.id;
  }

  private async getInvestmentWallet(
    userId: number,
    walletId: number,
  ): Promise<{
    id: number;
    user_id: number;
    type: string;
    actual_cash: Decimal;
    name: string;
  }> {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: walletId },
      select: {
        id: true,
        user_id: true,
        type: true,
        actual_cash: true,
        name: true,
      },
    });

    if (!wallet || wallet.user_id !== userId) {
      throw new NotFoundException('Carteira de investimento não encontrada');
    }

    if (wallet.type !== 'INVESTMENT') {
      throw new BadRequestException(
        'A operação só pode ser registrada em carteiras do tipo investimento',
      );
    }

    return wallet;
  }

  private async normalizeManualOperation(
    dto: CreateInvestmentOperationDto,
  ): Promise<NormalizedManualOperation> {
    const operationType = dto.operation_type as InvestmentOperationType;
    const market = dto.market === 'GLOBAL'
      ? PrismaInvestmentMarket.GLOBAL
      : PrismaInvestmentMarket.BR;
    const symbol = this.normalizeSymbol(dto.symbol);
    const transactionDate = new Date(dto.transaction_date);

    if (Number.isNaN(transactionDate.getTime())) {
      throw new BadRequestException('Data da operação inválida');
    }

    if (this.isFutureDate(transactionDate)) {
      throw new BadRequestException(
        'Operações de investimento não podem ser registradas com data futura nesta versão',
      );
    }

    const currency = this.resolveCurrency(market);
    const fxRate =
      market === PrismaInvestmentMarket.GLOBAL
        ? await this.resolveUsdBrlRate()
        : null;

    if (operationType === InvestmentOperationType.BUY || operationType === InvestmentOperationType.SELL) {
      if (!dto.quantity || dto.quantity <= 0) {
        throw new BadRequestException('Quantidade deve ser maior que zero');
      }
      const liveQuote = await this.resolveOperationQuote(symbol, market);

      const quantity = this.roundQuantityDecimal(new Decimal(dto.quantity));
      const unitPrice = liveQuote.unitPrice;
      const grossAmount = this.roundMarketDecimal(quantity.times(unitPrice));
      const grossAmountBrl = this.roundMoneyDecimal(
        market === PrismaInvestmentMarket.GLOBAL && fxRate
          ? grossAmount.times(fxRate)
          : grossAmount,
      );

      return {
        walletId: dto.wallet_id,
        operationType,
        symbol,
        market,
        currency: liveQuote.currency,
        quantity,
        unitPrice,
        grossAmount,
        grossAmountBrl,
        fxRate,
        transactionDate,
        notes: dto.notes?.trim() || null,
      };
    }

    if (!dto.gross_amount || dto.gross_amount <= 0) {
      throw new BadRequestException('Valor do provento deve ser maior que zero');
    }

    const grossAmount = this.roundMarketDecimal(new Decimal(dto.gross_amount));
    const grossAmountBrl = this.roundMoneyDecimal(
      market === PrismaInvestmentMarket.GLOBAL && fxRate
        ? grossAmount.times(fxRate)
        : grossAmount,
    );

    return {
      walletId: dto.wallet_id,
      operationType,
      symbol,
      market,
      currency,
      quantity: null,
      unitPrice: null,
      grossAmount,
      grossAmountBrl,
      fxRate,
      transactionDate,
      notes: dto.notes?.trim() || null,
    };
  }

  private async resolveOperationQuote(
    symbol: string,
    market: PrismaInvestmentMarket,
  ): Promise<{ unitPrice: Decimal; currency: string }> {
    const items = await this.marketDataService.getMany({
      symbols: [symbol],
      periods: [1],
      market: market === PrismaInvestmentMarket.GLOBAL ? 'GLOBAL' : 'BR',
    });
    const item = items[0] ?? null;

    if (!item || !item.price || item.price <= 0) {
      throw new BadRequestException(
        `Não foi possível obter a cotação atual de ${symbol} para registrar a operação`,
      );
    }

    return {
      unitPrice: this.roundMarketDecimal(new Decimal(item.price)),
      currency: item.currency || this.resolveCurrency(market),
    };
  }

  private async resolveUsdBrlRate(): Promise<Decimal> {
    const rate = await this.marketDataService.getUsdBrlRateValue();
    if (!rate || rate <= 0) {
      throw new BadRequestException(
        'Não foi possível obter a cotação USD/BRL para registrar a operação',
      );
    }

    return this.roundMarketDecimal(new Decimal(rate));
  }

  private buildSourceEventKey(
    walletId: number,
    symbol: string,
    type: 'DIVIDEND' | 'JCP',
    date: string,
    amount: number,
  ): string {
    return [walletId, symbol, type, date, amount.toFixed(6)].join(':');
  }

  private buildMarketKey(
    market: PrismaInvestmentMarket,
    symbol: string,
  ): string {
    return `${market}:${this.normalizeSymbol(symbol)}`;
  }

  private normalizeSymbol(symbol: string): string {
    return symbol
      .trim()
      .toUpperCase()
      .replace(/\.SA$/i, '')
      .replace(/\.US$/i, '');
  }

  private resolveCurrency(market: PrismaInvestmentMarket): string {
    return market === PrismaInvestmentMarket.GLOBAL ? 'USD' : 'BRL';
  }

  private isFutureDate(date: Date): boolean {
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    return date.getTime() > endOfToday.getTime();
  }

  private roundMoney(value: number): number {
    return Number(value.toFixed(2));
  }

  private roundPercent(value: number): number {
    return Number(value.toFixed(2));
  }

  private roundMarketValue(value: number): number {
    return Number(value.toFixed(4));
  }

  private roundQuantity(value: number): number {
    return Number(value.toFixed(6));
  }

  private roundMoneyDecimal(value: Decimal): Decimal {
    return value.toDecimalPlaces(2);
  }

  private roundMarketDecimal(value: Decimal): Decimal {
    return value.toDecimalPlaces(6);
  }

  private roundQuantityDecimal(value: Decimal): Decimal {
    return value.toDecimalPlaces(6);
  }

  private formatDecimal(value: Decimal | null): string {
    return value ? Number(value).toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 6,
    }) : '0';
  }
}
