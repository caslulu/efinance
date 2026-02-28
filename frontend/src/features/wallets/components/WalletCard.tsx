import clsx from 'clsx';
import { formatCurrency } from '@/lib/utils';
import type { Wallet } from '../../../types/Wallet';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Minus, Pencil, CreditCard, ReceiptText } from 'lucide-react';

interface WalletCardProps {
  wallet: Wallet;
  onAddFunds: (id: number) => void;
  onAddExpense: (id: number) => void;
  onEdit: () => void;
  onPayInvoice?: () => void;
}

export const WalletCard = ({ wallet, onAddFunds, onAddExpense, onEdit, onPayInvoice }: WalletCardProps) => {
  const typeColors: Record<string, string> = {
    BANK: 'bg-blue-500 hover:bg-blue-600',
    PHYSICAL: 'bg-green-500 hover:bg-green-600',
    MEAL_VOUCHER: 'bg-orange-500 hover:bg-orange-600',
    INVESTMENT: 'bg-purple-500 hover:bg-purple-600',
    OTHER: 'bg-gray-500 hover:bg-gray-600',
  };

  const typeLabels: Record<string, string> = {
    BANK: 'Banco',
    PHYSICAL: 'Dinheiro',
    MEAL_VOUCHER: 'Vale Refeição',
    INVESTMENT: 'Investimento',
    OTHER: 'Outro',
  };

  return (
    <Card className="hover:shadow-md transition-shadow relative group">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          {wallet.closing_day && <CreditCard className="h-4 w-4 text-blue-500" />}
          {wallet.name}
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge className={clsx('text-white', typeColors[wallet.type] || 'bg-gray-500')}>
            {typeLabels[wallet.type] || wallet.type}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={onEdit}
          >
            <Pencil className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {wallet.closing_day ? (
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Saldo Disponível</p>
                <div className="text-xl font-bold text-green-600">
                  {formatCurrency(Number(wallet.actual_cash))}
                </div>
              </div>
              {onPayInvoice && (Number(wallet.due_invoice) > 0 || Number(wallet.current_invoice) > 0) && (
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-2 h-8 px-3"
                  onClick={onPayInvoice}
                >
                  <ReceiptText className="h-4 w-4" />
                  Pagar Fatura
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
              <div className="space-y-1">
                <p className="text-[9px] uppercase font-bold text-muted-foreground">Fatura Fechada</p>
                <p className={clsx("text-sm font-bold", Number(wallet.due_invoice) > 0 ? "text-red-600" : "text-gray-400")}>
                  {formatCurrency(Number(wallet.due_invoice))}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[9px] uppercase font-bold text-muted-foreground">Fatura Aberta</p>
                <p className="text-sm font-bold text-blue-600">
                  {formatCurrency(Number(wallet.current_invoice))}
                </p>
              </div>
              <div className="col-span-2 pt-2 border-t border-gray-200 mt-1">
                <div className="flex justify-between items-center">
                  <p className="text-[9px] uppercase font-bold text-muted-foreground">Total Comprometido</p>
                  <p className="text-sm font-black text-red-700">
                    {formatCurrency(Number(wallet.total_invoice || 0))}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="text-2xl font-bold">
              {formatCurrency(Number(wallet.actual_cash))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">ID: #{wallet.id}</p>
          </>
        )}
      </CardContent>
      <CardFooter className="flex gap-2 pt-2">
        <Button
          variant="outline"
          className="flex-1 text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
          onClick={() => onAddFunds(wallet.id)}
        >
          <Plus className="mr-2 h-4 w-4" /> Adicionar
        </Button>
        <Button
          variant="outline"
          className="flex-1 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
          onClick={() => onAddExpense(wallet.id)}
        >
          <Minus className="mr-2 h-4 w-4" /> Despesa
        </Button>
      </CardFooter>
    </Card>
  );
};