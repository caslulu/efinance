import { useEffect, useState } from 'react';
import { api } from '../../../api/api';
import type { Subscription } from '../../../types/Subscription';
import { CreateSubscriptionModal } from '../components/CreateSubscriptionModal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import clsx from 'clsx';
import { Play, Plus } from 'lucide-react';

export const SubscriptionsPage = () => {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchSubscriptions = async () => {
    try {
      const res = await api.get('/subscriptions');
      if (Array.isArray(res.data)) {
        setSubscriptions(res.data);
      } else {
        setSubscriptions([]);
      }
    } catch (error) {
      console.error('Failed to fetch subscriptions');
    } finally {
      setLoading(false);
    }
  };

  const triggerCheck = async () => {
    try {
      await api.post('/subscriptions/trigger');
      alert('Verificação de recorrência disparada com sucesso');
      fetchSubscriptions();
    } catch (error) {
      alert('Falha ao disparar verificação');
    }
  };

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Recorrências</h1>
        <div className="flex gap-4">
          <Button variant="outline" onClick={triggerCheck}>
            <Play className="mr-2 h-4 w-4" /> Processar Pendentes
          </Button>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Novo Recorrente
          </Button>
        </div>
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Frequência</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Próx. Cobrança</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subscriptions.map((sub) => (
              <TableRow key={sub.id}>
                <TableCell className="font-medium">{sub.name}</TableCell>
                <TableCell>R$ {Number(sub.value).toFixed(2)}</TableCell>
                <TableCell>{sub.frequency}</TableCell>
                <TableCell>
                  <Badge 
                    variant="outline"
                    className={clsx(
                        sub.status === 'ACTIVE' ? 'border-green-500 text-green-600 bg-green-50' : 'border-yellow-500 text-yellow-600 bg-yellow-50'
                    )}
                  >
                    {sub.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {new Date(sub.next_billing_date).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
            {subscriptions.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  Nenhuma recorrência encontrada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <CreateSubscriptionModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={fetchSubscriptions}
      />
    </div>
  );
};
