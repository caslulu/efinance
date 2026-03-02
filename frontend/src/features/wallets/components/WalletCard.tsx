import clsx from 'clsx';
import { formatCurrency } from '@/lib/utils';
import type { Wallet } from '../../../types/Wallet';
import type { Card as CardType } from '../../../types/Card';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Minus, Pencil, CreditCard } from 'lucide-react';
import { CardItem } from './CardItem';

interface WalletCardProps {
  wallet: Wallet;
  cards: CardType[];
  onAddFunds: (id: number) => void;
  onAddExpense: (id: number) => void;
  onEdit: () => void;
  onAddCard: () => void;
  onEditCard: (card: CardType) => void;
  onAddCardExpense: (card: CardType) => void;
  onPayCardInvoice: (card: CardType) => void;
}

export const WalletCard = ({
  wallet,
  cards,
  onAddFunds,
  onAddExpense,
  onEdit,
  onAddCard,
  onEditCard,
  onAddCardExpense,
  onPayCardInvoice,
}: WalletCardProps) => {
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
      <CardContent className="space-y-3">
        <div>
          <p className="text-[10px] uppercase font-bold text-muted-foreground">Saldo Disponível</p>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {formatCurrency(Number(wallet.actual_cash))}
          </div>
        </div>

        {/* Cards section */}
        {cards.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
              <CreditCard className="h-3 w-3" />
              Cartões
            </p>
            {cards.map((card) => (
              <CardItem
                key={card.id}
                card={card}
                onEdit={() => onEditCard(card)}
                onAddExpense={() => onAddCardExpense(card)}
                onPayInvoice={() => onPayCardInvoice(card)}
              />
            ))}
          </div>
        )}

        {/* Add card button */}
        {wallet.type === 'BANK' && (
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs border-dashed"
            onClick={onAddCard}
          >
            <CreditCard className="mr-2 h-3 w-3" />
            Adicionar Cartão
          </Button>
        )}
      </CardContent>
      <CardFooter className="flex gap-2 pt-2">
        <Button
          variant="outline"
          className="flex-1 text-green-600 dark:text-green-400 border-green-200 hover:bg-green-50 dark:hover:bg-green-900/20 hover:text-green-700 dark:hover:text-green-300"
          onClick={() => onAddFunds(wallet.id)}
        >
          <Plus className="mr-2 h-4 w-4" /> Adicionar
        </Button>
        <Button
          variant="outline"
          className="flex-1 text-red-600 dark:text-red-400 border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-700 dark:hover:text-red-300"
          onClick={() => onAddExpense(wallet.id)}
        >
          <Minus className="mr-2 h-4 w-4" /> Despesa
        </Button>
      </CardFooter>
    </Card>
  );
};