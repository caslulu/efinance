import { useState } from 'react';
import { useSubscriptions, useDeleteSubscription, useUpdateSubscription, useTriggerSubscriptionCheck } from '@/hooks';
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
import { Play, Plus, Trash, PauseCircle, PlayCircle } from 'lucide-react';
import { CategoryIcon } from '@/components/IconPicker';

export const SubscriptionsPage = () => {
  const { data: subscriptions = [], isLoading: loading, refetch: refetchSubscriptions } = useSubscriptions();
  const deleteSubscription = useDeleteSubscription();
  const updateSubscription = useUpdateSubscription();
  const triggerCheck = useTriggerSubscriptionCheck();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const handleTriggerCheck = async () => {
    try {
      await triggerCheck.mutateAsync();
      alert('Verificação de recorrência disparada com sucesso');
    } catch (error) {
      alert('Falha ao disparar verificação');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir esta recorrência? Todas as transações geradas por ela também serão excluídas.')) return;
    
    try {
      await deleteSubscription.mutateAsync(id);
    } catch (error) {
      alert('Falha ao excluir recorrência');
    }
  };

  const handleToggleStatus = async (sub: Subscription) => {
    const newStatus = sub.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    try {
      await updateSubscription.mutateAsync({ id: sub.id, data: { status: newStatus } });
    } catch (error) {
      alert('Falha ao atualizar status');
    }
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Recorrências</h1>
        <div className="flex gap-4">
          <Button variant="outline" onClick={handleTriggerCheck}>
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
              <TableHead>Descrição</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Frequência</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Próx. Cobrança</TableHead>
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subscriptions.map((sub) => (
              <TableRow key={sub.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded bg-slate-100">
                      <CategoryIcon name={sub.category?.icon} className="h-4 w-4 text-slate-600" />
                    </div>
                    <span>{sub.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground truncate max-w-[120px]" title={sub.description}>
                  {sub.description || '-'}
                </TableCell>
                <TableCell>R$ {Number(sub.value).toFixed(2)}</TableCell>
                <TableCell>{sub.frequency}</TableCell>
                <TableCell>
                  <Badge 
                    variant="outline"
                    className={clsx(
                        sub.status === 'ACTIVE' ? 'border-green-500 text-green-600 bg-green-50' : 'border-yellow-500 text-yellow-600 bg-yellow-50'
                    )}
                  >
                    {sub.status === 'ACTIVE' ? 'Ativo' : 'Pausado'}
                  </Badge>
                </TableCell>
                <TableCell>
                  {new Date(sub.next_billing_date).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <div className="flex items-center">
                    <Button variant="ghost" size="icon" onClick={() => handleToggleStatus(sub)} title={sub.status === 'ACTIVE' ? 'Pausar' : 'Ativar'}>
                      {sub.status === 'ACTIVE' ? (
                        <PauseCircle className="h-4 w-4 text-yellow-500" />
                      ) : (
                        <PlayCircle className="h-4 w-4 text-green-500" />
                      )}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(sub.id)} title="Excluir">
                      <Trash className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {subscriptions.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
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
        onSuccess={() => refetchSubscriptions()}
      />
    </div>
  );
};
