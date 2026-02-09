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
  onPayInvoice?: () => void;
}

export const WalletCard = ({ wallet, onAddFunds, onAddExpense, onEdit, onPayInvoice }: WalletCardProps) => {
  const typeColors: Record<string, string> = {
// ...
// ...
            <div className="grid grid-cols-2 gap-2">
              {Number(wallet.due_invoice) > 0 ? (
                <>
                  <div>
                    <p className="text-xs text-muted-foreground">Fatura Fechada</p>
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-bold text-red-600">
                        {formatCurrency(Number(wallet.due_invoice))}
                      </div>
                      {onPayInvoice && (
                        <Button variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={onPayInvoice}>
                          Pagar
                        </Button>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Fatura Aberta</p>
                    <div className="text-sm font-bold text-blue-600">
                      {formatCurrency(Number(wallet.current_invoice))}
                    </div>
                  </div>
                </>
              ) : (
                <div>
                  <p className="text-xs text-muted-foreground">Fatura Atual</p>
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-bold text-red-600">
                      {formatCurrency(Number(wallet.current_invoice || 0))}
                    </div>
                    {onPayInvoice && Number(wallet.current_invoice) > 0 && (
                        <Button variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={onPayInvoice}>
                          Pagar
                        </Button>
                    )}
                  </div>
                </div>
              )}
              
              <div>
                <p className="text-xs text-muted-foreground">Fatura Total</p>
// ...
