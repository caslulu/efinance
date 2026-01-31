import clsx from 'clsx';
import type { Wallet } from '../../../types/Wallet';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Minus } from 'lucide-react';

interface WalletCardProps {
  wallet: Wallet;
  onAddFunds: (id: number) => void;
  onAddExpense: (id: number) => void;
}

export const WalletCard = ({ wallet, onAddFunds, onAddExpense }: WalletCardProps) => {
  const typeColors = {
    BANK: 'bg-blue-500 hover:bg-blue-600',
    PHYSICAL: 'bg-green-500 hover:bg-green-600',
    MEAL_VOUCHER: 'bg-orange-500 hover:bg-orange-600',
    INVESTMENT: 'bg-purple-500 hover:bg-purple-600',
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {wallet.name}
        </CardTitle>
        <Badge className={clsx('text-white', typeColors[wallet.type] || 'bg-gray-500')}>
          {wallet.type.replace('_', ' ')}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">R$ {Number(wallet.actual_cash).toFixed(2)}</div>
        <p className="text-xs text-muted-foreground mt-1">ID: #{wallet.id}</p>
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
