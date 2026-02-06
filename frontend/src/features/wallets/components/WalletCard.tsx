import clsx from 'clsx';
import type { Wallet } from '../../../types/Wallet';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Minus, Pencil } from 'lucide-react';

interface WalletCardProps {
  wallet: Wallet;
  onAddFunds: (id: number) => void;
  onAddExpense: (id: number) => void;
  onEdit: () => void;
}

export const WalletCard = ({ wallet, onAddFunds, onAddExpense, onEdit }: WalletCardProps) => {
  const typeColors: Record<string, string> = {
    BANK: 'bg-blue-500 hover:bg-blue-600',
    PHYSICAL: 'bg-green-500 hover:bg-green-600',
    MEAL_VOUCHER: 'bg-orange-500 hover:bg-orange-600',
    INVESTMENT: 'bg-purple-500 hover:bg-purple-600',
    OTHER: 'bg-gray-500 hover:bg-gray-600',
  };

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <Card className="hover:shadow-md transition-shadow relative group">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {wallet.name}
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge className={clsx('text-white', typeColors[wallet.type] || 'bg-gray-500')}>
            {wallet.type.replace('_', ' ')}
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
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Saldo Disponível</p>
              <div className="text-lg font-bold text-green-600">
                {formatCurrency(Number(wallet.actual_cash))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-muted-foreground">Fatura Atual</p>
                <div className="text-sm font-bold text-red-600">
                  {formatCurrency(Number(wallet.current_invoice || 0))}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Fatura Total</p>
                <div className="text-sm font-bold text-red-700">
                  {formatCurrency(Number(wallet.total_invoice || 0))}
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
