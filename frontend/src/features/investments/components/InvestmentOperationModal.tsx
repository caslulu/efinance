import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getErrorMessage } from '@/lib/utils';
import { useCreateInvestmentOperation, useInvestmentMarketData } from '@/hooks';
import type { Wallet } from '@/types/Wallet';
import type { InvestmentMarketItem } from '@/types/InvestmentMarket';

interface InvestmentOperationModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallets: Wallet[];
}

const formatDateInput = (value: Date) => {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatMoney = (value: number, currency = 'BRL') =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(value);

const getSecondaryQuote = (quote: InvestmentMarketItem | null) => {
  if (!quote) {
    return null;
  }

  if (quote.currency === 'USD') {
    return quote.currencyValues.price.brl;
  }

  if (quote.currency === 'BRL') {
    return quote.currencyValues.price.usd;
  }

  return null;
};

const getSecondaryCurrency = (currency: string) => {
  if (currency === 'USD') return 'BRL';
  if (currency === 'BRL') return 'USD';
  return null;
};

export function InvestmentOperationModal({
  isOpen,
  onClose,
  wallets,
}: InvestmentOperationModalProps) {
  const investmentWallets = useMemo(
    () => wallets.filter((wallet) => wallet.type === 'INVESTMENT'),
    [wallets],
  );
  const createOperation = useCreateInvestmentOperation();
  const [walletId, setWalletId] = useState('');
  const [assetType, setAssetType] = useState<'LISTED' | 'CDB'>('LISTED');
  const [operationType, setOperationType] = useState<'BUY' | 'SELL'>('BUY');
  const [market, setMarket] = useState<'BR' | 'GLOBAL'>('BR');
  const [symbol, setSymbol] = useState('');
  const [transactionDate, setTransactionDate] = useState(formatDateInput(new Date()));
  const [quantity, setQuantity] = useState('');
  const [grossAmount, setGrossAmount] = useState('');
  const [cdbCdiPercentage, setCdbCdiPercentage] = useState('');
  const [cdbCdiRate, setCdbCdiRate] = useState('');
  const normalizedSymbol = symbol.trim().toUpperCase();
  const numericQuantity = Number(quantity);
  const shouldLoadQuote = isOpen && assetType === 'LISTED' && normalizedSymbol.length > 0;
  const {
    data: quoteResults = [],
    isFetching: isQuoteLoading,
    error: quoteError,
  } = useInvestmentMarketData(
    {
      symbols: normalizedSymbol ? [normalizedSymbol] : [],
      periods: [1],
      market,
    },
    shouldLoadQuote,
  );
  const currentQuote = quoteResults[0] ?? null;
  const estimatedAmount =
    currentQuote && Number.isFinite(numericQuantity) && numericQuantity > 0
      ? currentQuote.price * numericQuantity
      : null;
  const secondaryQuote = getSecondaryQuote(currentQuote);
  const secondaryCurrency = currentQuote ? getSecondaryCurrency(currentQuote.currency) : null;
  const estimatedSecondaryAmount =
    secondaryQuote !== null && Number.isFinite(numericQuantity) && numericQuantity > 0
      ? secondaryQuote * numericQuantity
      : null;
  const isQuoteUnavailable = shouldLoadQuote && !isQuoteLoading && !currentQuote;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setWalletId(investmentWallets[0] ? String(investmentWallets[0].id) : '');
    setAssetType('LISTED');
    setOperationType('BUY');
    setMarket('BR');
    setSymbol('');
    setTransactionDate(formatDateInput(new Date()));
    setQuantity('');
    setGrossAmount('');
    setCdbCdiPercentage('');
    setCdbCdiRate('');
  }, [investmentWallets, isOpen]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!walletId) {
      toast.error('Selecione uma carteira de investimento.');
      return;
    }

    if (!symbol.trim()) {
      toast.error(assetType === 'CDB' ? 'Informe um nome para o CDB.' : 'Informe o ticker do ativo.');
      return;
    }

    if (assetType === 'LISTED') {
      if (!quantity || Number(quantity) <= 0) {
        toast.error('Informe uma quantidade válida.');
        return;
      }

      if (isQuoteLoading) {
        toast.error('Aguarde a atualização da cotação atual antes de registrar.');
        return;
      }

      if (!currentQuote) {
        toast.error('Não foi possível obter a cotação atual desse ativo.');
        return;
      }
    } else {
      if (!grossAmount || Number(grossAmount) <= 0) {
        toast.error(
          operationType === 'SELL'
            ? 'Informe o valor recebido no resgate.'
            : 'Informe o valor do aporte.',
        );
        return;
      }

      if (operationType === 'SELL' && (!quantity || Number(quantity) <= 0)) {
        toast.error(
          operationType === 'SELL'
            ? 'Informe o principal resgatado.'
            : 'Informe um valor de aporte válido.',
        );
        return;
      }

      if (operationType === 'BUY') {
        if (!cdbCdiPercentage || Number(cdbCdiPercentage) <= 0) {
          toast.error('Informe o percentual do CDI contratado.');
          return;
        }

        if (!cdbCdiRate || Number(cdbCdiRate) <= 0) {
          toast.error('Informe o CDI anual utilizado no cálculo.');
          return;
        }
      }
    }

    try {
      await createOperation.mutateAsync({
        wallet_id: Number(walletId),
        operation_type: operationType,
        asset_type: assetType,
        market: assetType === 'CDB' ? 'BR' : market,
        symbol: symbol.trim().toUpperCase(),
        transaction_date: new Date(`${transactionDate}T12:00:00`).toISOString(),
        quantity:
          assetType === 'LISTED' || (assetType === 'CDB' && operationType === 'SELL')
            ? Number(quantity)
            : undefined,
        gross_amount: assetType === 'CDB' ? Number(grossAmount) : undefined,
        cdb_cdi_percentage:
          assetType === 'CDB' && operationType === 'BUY'
            ? Number(cdbCdiPercentage)
            : undefined,
        cdb_cdi_rate:
          assetType === 'CDB' && operationType === 'BUY'
            ? Number(cdbCdiRate)
            : undefined,
      });
      toast.success(
        assetType === 'CDB'
          ? operationType === 'BUY'
            ? 'Aporte de CDB registrado com sucesso.'
            : 'Resgate de CDB registrado com sucesso.'
          : operationType === 'BUY'
          ? 'Compra registrada com sucesso.'
          : 'Venda registrada com sucesso.',
      );
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Falha ao registrar operação.'));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Registrar operação</DialogTitle>
          <DialogDescription>
            Lance compras e vendas da sua carteira de investimentos.
          </DialogDescription>
        </DialogHeader>

        {investmentWallets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
            Crie primeiro uma carteira do tipo investimento para registrar operações.
          </div>
        ) : (
          <form className="grid gap-4" onSubmit={handleSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="investment-wallet">Carteira</Label>
              <Select value={walletId} onValueChange={setWalletId}>
                <SelectTrigger id="investment-wallet">
                  <SelectValue placeholder="Selecione a carteira" />
                </SelectTrigger>
                <SelectContent>
                  {investmentWallets.map((wallet) => (
                    <SelectItem key={wallet.id} value={String(wallet.id)}>
                      {wallet.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="operation-asset-type">Tipo</Label>
                <Select
                  value={assetType}
                  onValueChange={(value) => {
                    const nextType = value as 'LISTED' | 'CDB';
                    setAssetType(nextType);
                    if (nextType === 'CDB') {
                      setOperationType('BUY');
                      setMarket('BR');
                      setQuantity('');
                      setGrossAmount('');
                      setCdbCdiPercentage('');
                      setCdbCdiRate('');
                    }
                  }}
                >
                  <SelectTrigger id="operation-asset-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LISTED">Ativo listado</SelectItem>
                    <SelectItem value="CDB">CDB</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="operation-type">Operação</Label>
                <Select
                  value={operationType}
                  onValueChange={(value) => setOperationType(value as 'BUY' | 'SELL')}
                >
                  <SelectTrigger id="operation-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BUY">
                      {assetType === 'CDB' ? 'Aporte' : 'Compra'}
                    </SelectItem>
                    <SelectItem value="SELL">
                      {assetType === 'CDB' ? 'Resgate' : 'Venda'}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="operation-market">Mercado</Label>
                <Select
                  value={market}
                  onValueChange={(value) => setMarket(value as 'BR' | 'GLOBAL')}
                  disabled={assetType === 'CDB'}
                >
                  <SelectTrigger id="operation-market">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BR">Brasil</SelectItem>
                    <SelectItem value="GLOBAL">Internacional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="operation-symbol">
                  {assetType === 'CDB' ? 'Nome do CDB' : 'Ticker'}
                </Label>
                <Input
                  id="operation-symbol"
                  value={symbol}
                  onChange={(event) => setSymbol(event.target.value.toUpperCase())}
                  placeholder={assetType === 'CDB' ? 'CDB NUBANK 120% CDI' : market === 'BR' ? 'PETR4' : 'TSLA'}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="operation-date">Data</Label>
                <Input
                  id="operation-date"
                  type="date"
                  value={transactionDate}
                  onChange={(event) => setTransactionDate(event.target.value)}
                />
              </div>
            </div>

            {assetType === 'LISTED' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="operation-quantity">Quantidade</Label>
                  <Input
                    id="operation-quantity"
                    type="number"
                    inputMode="decimal"
                    step="0.000001"
                    min="0.000001"
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                    placeholder="10"
                  />
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="operation-gross-amount">
                    {operationType === 'SELL' ? 'Valor recebido' : 'Valor aplicado'}
                  </Label>
                  <Input
                    id="operation-gross-amount"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0.01"
                    value={grossAmount}
                    onChange={(event) => setGrossAmount(event.target.value)}
                    placeholder={operationType === 'SELL' ? '1120' : '1000'}
                  />
                </div>
                {operationType === 'SELL' ? (
                  <div className="grid gap-2">
                    <Label htmlFor="operation-quantity">Principal resgatado</Label>
                    <Input
                      id="operation-quantity"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0.01"
                      value={quantity}
                      onChange={(event) => setQuantity(event.target.value)}
                      placeholder="1000"
                    />
                  </div>
                ) : null}
                {operationType === 'BUY' ? (
                  <>
                    <div className="grid gap-2">
                      <Label htmlFor="operation-cdb-cdi-percentage">% do CDI</Label>
                      <Input
                        id="operation-cdb-cdi-percentage"
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0.01"
                        value={cdbCdiPercentage}
                        onChange={(event) => setCdbCdiPercentage(event.target.value)}
                        placeholder="120"
                      />
                    </div>
                    <div className="grid gap-2 sm:col-span-2">
                      <Label htmlFor="operation-cdb-cdi-rate">CDI anual (%)</Label>
                      <Input
                        id="operation-cdb-cdi-rate"
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0.01"
                        value={cdbCdiRate}
                        onChange={(event) => setCdbCdiRate(event.target.value)}
                        placeholder="10.65"
                      />
                    </div>
                  </>
                ) : null}
              </div>
            )}

            <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {assetType === 'CDB'
                      ? operationType === 'SELL'
                        ? 'Dados usados no resgate'
                        : 'Rentabilidade usada no cálculo'
                      : 'Cotação usada no lançamento'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {assetType === 'CDB'
                      ? operationType === 'SELL'
                        ? 'Informe o principal resgatado e o valor efetivamente recebido para registrar o resgate.'
                        : 'O valor atual do CDB será estimado usando o CDI anual informado, o percentual contratado e capitalização em dias úteis.'
                      : 'A operação será registrada com o preço atual do ativo no momento do envio.'}
                  </p>
                </div>
                {assetType === 'LISTED' && isQuoteLoading && normalizedSymbol ? (
                  <span className="text-xs font-medium text-muted-foreground">Buscando...</span>
                ) : null}
              </div>

              {assetType === 'CDB' ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-border/50 bg-background/80 px-3 py-2">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      {operationType === 'SELL' ? 'Principal informado' : 'Taxa contratada'}
                    </div>
                    <div className="mt-1 text-base font-semibold text-foreground">
                      {operationType === 'SELL'
                        ? quantity
                          ? formatMoney(Number(quantity), 'BRL')
                          : 'Informe o principal'
                        : cdbCdiPercentage
                        ? `${cdbCdiPercentage}% do CDI`
                        : 'Informe o percentual'}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border/50 bg-background/80 px-3 py-2">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      {operationType === 'SELL' ? 'Valor recebido' : 'CDI anual'}
                    </div>
                    <div className="mt-1 text-base font-semibold text-foreground">
                      {operationType === 'SELL'
                        ? grossAmount
                          ? formatMoney(Number(grossAmount), 'BRL')
                          : 'Informe o valor'
                        : cdbCdiRate
                        ? `${cdbCdiRate}% a.a.`
                        : 'Informe o CDI'}
                    </div>
                  </div>
                </div>
              ) : currentQuote ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-border/50 bg-background/80 px-3 py-2">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      Preço atual
                    </div>
                    <div className="mt-1 text-base font-semibold text-foreground">
                      {formatMoney(currentQuote.price, currentQuote.currency)}
                    </div>
                    {secondaryQuote !== null && secondaryCurrency ? (
                      <div className="text-xs text-muted-foreground">
                        {formatMoney(secondaryQuote, secondaryCurrency)}
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-lg border border-border/50 bg-background/80 px-3 py-2">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      Total estimado
                    </div>
                    <div className="mt-1 text-base font-semibold text-foreground">
                      {estimatedAmount !== null
                        ? formatMoney(estimatedAmount, currentQuote.currency)
                        : 'Informe a quantidade'}
                    </div>
                    {estimatedSecondaryAmount !== null && secondaryCurrency ? (
                      <div className="text-xs text-muted-foreground">
                        {formatMoney(estimatedSecondaryAmount, secondaryCurrency)}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-sm text-muted-foreground">
                  {normalizedSymbol
                    ? isQuoteLoading
                      ? 'Atualizando a cotação desse ativo.'
                      : 'Nenhuma cotação disponível para esse ticker no mercado selecionado.'
                    : 'Digite um ticker para buscar a cotação atual automaticamente.'}
                </div>
              )}

              {quoteError && normalizedSymbol ? (
                <div className="mt-3 text-xs text-rose-600 dark:text-rose-300">
                  {getErrorMessage(quoteError, 'Falha ao buscar a cotação atual.')}
                </div>
              ) : null}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createOperation.isPending || isQuoteLoading || isQuoteUnavailable}
              >
                {createOperation.isPending ? 'Salvando...' : 'Registrar'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
