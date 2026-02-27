import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { useSubscriptions, useDeleteSubscription, useUpdateSubscription, useTriggerSubscriptionCheck } from '@/hooks';
import type { Subscription } from '../../../types/Subscription';
import { CreateSubscriptionModal } from '../components/CreateSubscriptionModal';
import { EditSubscriptionModal } from '../components/EditSubscriptionModal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
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
import { Plus, Trash, PauseCircle, PlayCircle, RefreshCw, Edit2 } from 'lucide-react';
import { CategoryIcon } from '@/components/IconPicker';

const frequencyLabels: Record<string, string> = {
  WEEKLY: 'Semanal',
  MONTHLY: 'Mensal',
  QUARTERLY: 'Trimestral',
  YEARLY: 'Anual',
};

export const SubscriptionsPage = () => {
  const { data: subscriptions = [], isLoading: loading, refetch: refetchSubscriptions } = useSubscriptions();
  const deleteSubscription = useDeleteSubscription();
  const updateSubscription = useUpdateSubscription();
  const triggerCheck = useTriggerSubscriptionCheck();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const summary = useMemo(() => {
    const active = subscriptions.filter(s => s.status === 'ACTIVE');
    const paused = subscriptions.filter(s => s.status === 'PAUSED');
    const monthlyTotal = active.reduce((sum, s) => {
      const val = Number(s.value);
      switch (s.frequency) {
        case 'WEEKLY': return sum + val * 4;
        case 'MONTHLY': return sum + val;
        case 'QUARTERLY': return sum + val / 3;
        case 'YEARLY': return sum + val / 12;
        default: return sum + val;
      }
    }, 0);
    return { activeCount: active.length, pausedCount: paused.length, monthlyTotal };
  }, [subscriptions]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const handleTriggerCheck = async () => {
    try {
      await triggerCheck.mutateAsync();
      toast.success('Verificação de recorrência disparada com sucesso');
    } catch (error) {
      toast.error('Falha ao disparar verificação');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteSubscription.mutateAsync(id);
    } catch (error) {
      toast.error('Falha ao excluir recorrência');
    }
  };

  const handleToggleStatus = async (sub: Subscription) => {
    const newStatus = sub.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    try {
      await updateSubscription.mutateAsync({ id: sub.id, data: { status: newStatus } });
    } catch (error) {
      toast.error('Falha ao atualizar status');
    }
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Recorrências</h1>
        <div className="flex gap-4">
          <Button variant="ghost" size="sm" onClick={handleTriggerCheck} className="text-muted-foreground" title="Verificar e gerar transações pendentes das recorrências ativas">
            <RefreshCw className="mr-2 h-4 w-4" /> Sincronizar
          </Button>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Novo Recorrente
          </Button>
        </div>
      </div>

      {subscriptions.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border bg-white p-4">
            <p className="text-sm text-muted-foreground">Custo Mensal Estimado</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.monthlyTotal)}</p>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <p className="text-sm text-muted-foreground">Ativas</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{summary.activeCount}</p>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-yellow-500" />
              <p className="text-sm text-muted-foreground">Pausadas</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{summary.pausedCount}</p>
          </div>
        </div>
      )}

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
                <TableCell>{frequencyLabels[sub.frequency] || sub.frequency}</TableCell>
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
                  {new Date(sub.next_billing_date).toLocaleDateString('pt-BR')}
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
                    <Button variant="ghost" size="icon" onClick={() => setEditingSubscription(sub)} title="Editar">
                      <Edit2 className="h-4 w-4 text-blue-500" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setConfirmDeleteId(sub.id)} title="Excluir">
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

      <EditSubscriptionModal
        isOpen={!!editingSubscription}
        subscription={editingSubscription}
        onClose={() => setEditingSubscription(null)}
        onSuccess={() => refetchSubscriptions()}
      />

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Excluir Recorrência"
        description="Tem certeza que deseja excluir esta recorrência? Todas as transações geradas por ela também serão excluídas."
        confirmLabel="Excluir"
        destructive
        onConfirm={() => {
          if (confirmDeleteId !== null) handleDelete(confirmDeleteId);
          setConfirmDeleteId(null);
        }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
};
