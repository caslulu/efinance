import { useState, useMemo } from 'react';
import { formatCurrency } from '@/lib/utils';
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
import { Plus, Trash, PauseCircle, PlayCircle, RefreshCw, Edit2, CalendarSync, DollarSign, Activity, Moon } from 'lucide-react';
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
    <div className="p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25">
            <CalendarSync className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Recorrências</h1>
            <p className="text-sm text-muted-foreground">
              {subscriptions.length} item{subscriptions.length !== 1 ? 'ns' : ''} recorrente{subscriptions.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" onClick={handleTriggerCheck} title="Verificar e gerar transações pendentes das recorrências ativas">
            <RefreshCw className="mr-2 h-4 w-4" /> Sincronizar
          </Button>
          <Button onClick={() => setIsCreateOpen(true)} size="sm">
            <Plus className="mr-2 h-4 w-4" /> Novo Recorrente
          </Button>
        </div>
      </div>

      {subscriptions.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-5 transition-all hover:shadow-md hover:shadow-emerald-500/5">
            <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-emerald-500 to-teal-500" />
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Custo Mensal Estimado</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{formatCurrency(summary.monthlyTotal)}</p>
          </div>
          <div className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-5 transition-all hover:shadow-md hover:shadow-green-500/5">
            <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-green-500 to-emerald-500" />
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <Activity className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Ativas</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{summary.activeCount}</p>
          </div>
          <div className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-5 transition-all hover:shadow-md hover:shadow-amber-500/5">
            <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-amber-500 to-yellow-500" />
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Moon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Pausadas</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{summary.pausedCount}</p>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
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
                    <div className="p-2 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 shadow-sm">
                      <CategoryIcon name={sub.icon || sub.category?.icon} className="h-4 w-4 text-slate-600 dark:text-slate-400" />
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
                      sub.status === 'ACTIVE' ? 'border-green-500 text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400' : 'border-yellow-500 text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-400'
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
                      <Edit2 className="h-4 w-4 text-emerald-500" />
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
                <TableCell colSpan={7} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="p-4 rounded-2xl bg-muted/50">
                      <CalendarSync className="h-8 w-8 text-muted-foreground/40" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Nenhuma recorrência</p>
                      <p className="text-sm text-muted-foreground">Adicione itens recorrentes para acompanhar seus gastos fixos.</p>
                    </div>
                  </div>
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
