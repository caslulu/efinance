import { useState, useMemo, useRef, useEffect } from 'react';
import { formatCurrency } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useTransactions, useSubscriptions, useWallets, useCategories, useDeleteTransaction } from '@/hooks';
import type { Transaction } from '../../../types/Transaction';
import { TransactionList } from '../components/TransactionList';
import { ChevronDown, ChevronRight, Calendar, Search, Filter, X, Wallet as WalletIcon, Download, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { toast } from 'sonner';

export const TransactionsPage = () => {
  const { data: transactions = [], isLoading: loadingTx, refetch: refetchTransactions } = useTransactions();
  const { data: subscriptions = [] } = useSubscriptions();
  const { data: wallets = [] } = useWallets();
  const { data: categories = [] } = useCategories();
  const loading = loadingTx;
  const [expandedMonths, setExpandedMonths] = useState<string[]>([]);
  const hasInitialExpanded = useRef(false);

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterWallet, setFilterWallet] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // Bulk Actions
  const [selectedTxIds, setSelectedTxIds] = useState<Set<number>>(new Set());
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const deleteMutation = useDeleteTransaction();

  const fetchData = () => {
    refetchTransactions();
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilterCategory('ALL');
    setFilterWallet('ALL');
    setFilterType('ALL');
    setFilterStartDate('');
    setFilterEndDate('');
  };

  const groupedData = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    // 1. Generate Virtual Future Transactions from Subscriptions
    const virtualTransactions: Transaction[] = [];
    subscriptions.forEach(sub => {
      if (sub.status !== 'ACTIVE') return;
      let currentDate = new Date(sub.next_billing_date);
      currentDate.setHours(12, 0, 0, 0);

      for (let i = 0; i < 12; i++) {
        if (currentDate > today) {
          virtualTransactions.push({
            id: -1 * (sub.id * 1000 + i),
            transaction_date: currentDate.toISOString(),
            wallet_id: sub.wallet_id,
            description: sub.name,
            transaction_type: sub.transaction_type as 'INCOME' | 'EXPENSE',
            is_recurring: true,
            value: Number(sub.value),
            category_id: sub.category_id,
            payment_method: 'Recorrente',
            TransactionCategory: (sub as any).category ? { id: (sub as any).category.id, name: (sub as any).category.name } : undefined
          } as any);
        }
        const nextDate = new Date(currentDate);
        switch (sub.frequency) {
          case 'WEEKLY': nextDate.setDate(nextDate.getDate() + 7); break;
          case 'MONTHLY': nextDate.setMonth(nextDate.getMonth() + 1); break;
          case 'QUARTERLY': nextDate.setMonth(nextDate.getMonth() + 3); break;
          case 'YEARLY': nextDate.setFullYear(nextDate.getFullYear() + 1); break;
        }
        currentDate = nextDate;
      }
    });

    // 2. Apply Filters
    const filteredTx = [...transactions, ...virtualTransactions].filter(tx => {
      const matchesSearch =
        (tx.description?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (tx.TransactionCategory?.name.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesCategory = filterCategory === 'ALL' || tx.category_id === Number(filterCategory);
      const matchesWallet = filterWallet === 'ALL' || tx.wallet_id === Number(filterWallet);
      const matchesType = filterType === 'ALL' || tx.transaction_type === filterType;

      const txDate = new Date(tx.transaction_date);
      const matchesStart = filterStartDate ? txDate >= new Date(filterStartDate + 'T00:00:00') : true;
      const matchesEnd = filterEndDate ? txDate <= new Date(filterEndDate + 'T23:59:59') : true;

      return matchesSearch && matchesCategory && matchesWallet && matchesType && matchesStart && matchesEnd;
    });

    // 3. Group by Month/Year
    const groups: Record<string, { label: string; transactions: Transaction[]; totalExpense: number; totalIncome: number; orderKey: number }> = {};

    filteredTx.forEach(tx => {
      const d = new Date(tx.transaction_date);
      const monthLabel = d.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
      const orderKey = d.getFullYear() * 100 + d.getMonth();

      if (!groups[monthLabel]) {
        groups[monthLabel] = {
          label: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
          transactions: [],
          totalExpense: 0,
          totalIncome: 0,
          orderKey
        };
      }

      groups[monthLabel].transactions.push(tx);
      const val = Number(tx.value);
      if (tx.transaction_type === 'EXPENSE') {
        groups[monthLabel].totalExpense += val;
      } else {
        groups[monthLabel].totalIncome += val;
      }
    });

    // 4. Convert to array and sort ASCENDING
    const sortedGroups = Object.values(groups)
      .sort((a, b) => a.orderKey - b.orderKey)
      .map(group => ({
        ...group,
        transactions: group.transactions.sort((a, b) =>
          new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
        )
      }));

    // 5. Split into Past, Current, Future
    const currentOrderKey = today.getFullYear() * 100 + today.getMonth();

    return {
      past: sortedGroups.filter(g => g.orderKey < currentOrderKey),
      current: sortedGroups.find(g => g.orderKey === currentOrderKey) || null,
      future: sortedGroups.filter(g => g.orderKey > currentOrderKey)
    };
  }, [transactions, subscriptions, searchTerm, filterCategory, filterWallet, filterType]);

  // Expand current month by default ONLY ONCE on load
  useEffect(() => {
    if (groupedData.current && !hasInitialExpanded.current) {
      setExpandedMonths([groupedData.current.label]);
      hasInitialExpanded.current = true;
    }
  }, [groupedData.current]);

  const toggleMonth = (label: string) => {
    setExpandedMonths(prev =>
      prev.includes(label) ? prev.filter(m => m !== label) : [...prev, label]
    );
  };

  const handleExportCSV = () => {
    const txToExport: Transaction[] = [];
    groupedData.past.forEach(g => txToExport.push(...g.transactions));
    if (groupedData.current) txToExport.push(...groupedData.current.transactions);
    groupedData.future.forEach(g => txToExport.push(...g.transactions));

    if (txToExport.length === 0) {
      toast.error('Nenhuma transação para exportar.');
      return;
    }

    const headers = ['Data', 'Nome', 'Categoria', 'Carteira ID', 'Método', 'Tipo', 'Valor'];
    const rows = txToExport.map(tx => [
      new Date(tx.transaction_date).toLocaleDateString('pt-BR'),
      `"${(tx.description || '').replace(/"/g, '""')}"`,
      `"${tx.TransactionCategory?.name || ''}"`,
      tx.wallet_id,
      tx.payment_method || '',
      tx.transaction_type,
      tx.value
    ]);

    // Use \ufeff for Excel UTF-8 BOM
    const csvContent = "data:text/csv;charset=utf-8,\ufeff"
      + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `extrato_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleBulkDelete = async () => {
    const idsToDelete = Array.from(selectedTxIds).filter(id => id > 0); // Ignore virtual futures
    if (idsToDelete.length === 0) {
      toast.error('Nenhuma transação real selecionada.');
      setIsBulkDeleteModalOpen(false);
      return;
    }

    try {
      for (const id of idsToDelete) {
        await deleteMutation.mutateAsync(id);
      }
      toast.success(`${idsToDelete.length} transações apagadas.`);
      setSelectedTxIds(new Set());
      refetchTransactions();
    } catch (error) {
      toast.error('Erro ao apagar algumas transações.');
    } finally {
      setIsBulkDeleteModalOpen(false);
    }
  };

  const toggleSelection = (id: number) => {
    setSelectedTxIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderGroup = (group: any) => {
    const isExpanded = expandedMonths.includes(group.label);
    const isFuture = group.orderKey > (new Date().getFullYear() * 100 + new Date().getMonth());

    return (
      <div key={group.label} className="border rounded-xl bg-card overflow-hidden shadow-sm transition-all hover:shadow-md">
        <button
          onClick={() => toggleMonth(group.label)}
          className="w-full flex items-center justify-between p-4 bg-muted/50 hover:bg-accent hover:text-accent-foreground transition-colors border-b"
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isFuture ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-muted text-muted-foreground'}`}>
              <Calendar size={18} />
            </div>
            <div className="text-left">
              <h3 className="font-bold text-foreground capitalize">{group.label}</h3>
              {isFuture && <span className="text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded uppercase font-bold ml-2">Projeção</span>}
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden md:flex gap-4 text-sm">
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground uppercase">Receitas</p>
                <p className="font-bold text-green-600 dark:text-green-400">{formatCurrency(group.totalIncome)}</p>
              </div>
              <div className="text-right border-l pl-4">
                <p className="text-[10px] text-muted-foreground uppercase">Gastos</p>
                <p className="font-bold text-red-600 dark:text-red-400">{formatCurrency(group.totalExpense)}</p>
              </div>
            </div>
            {isExpanded ? <ChevronDown className="text-muted-foreground" /> : <ChevronRight className="text-muted-foreground" />}
          </div>
        </button>

        {isExpanded && (
          <div className="p-2 animate-in fade-in slide-in-from-top-1 duration-200">
            <TransactionList
              transactions={group.transactions}
              onTransactionUpdated={fetchData}
              selectedIds={selectedTxIds}
              onToggleSelect={toggleSelection}
            />
          </div>
        )}
      </div>
    );
  };

  const isFiltered = searchTerm !== '' || filterCategory !== 'ALL' || filterWallet !== 'ALL' || filterType !== 'ALL' || filterStartDate !== '' || filterEndDate !== '';

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-foreground">Histórico de Transações</h1>
          {isFiltered && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-red-600 dark:text-red-400 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20">
              <X size={16} className="mr-2" /> Limpar Filtros
            </Button>
          )}
        </div>

        {/* Filters Bar */}
        <div className="grid gap-4 md:grid-cols-4 bg-card p-4 rounded-xl border shadow-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger>
              <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas as Categorias</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterWallet} onValueChange={setFilterWallet}>
            <SelectTrigger>
              <WalletIcon className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Carteira" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas as Carteiras</SelectItem>
              {wallets.map(w => (
                <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger>
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos os Tipos</SelectItem>
              <SelectItem value="INCOME">Apenas Receitas</SelectItem>
              <SelectItem value="EXPENSE">Apenas Despesas</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex gap-2 w-full md:col-span-4 flex-wrap md:flex-nowrap">
            <div className="flex items-center gap-2 flex-1 relative">
              <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">De:</span>
              <Input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="flex items-center gap-2 flex-1 relative">
              <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Até:</span>
              <Input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className="w-full"
              />
            </div>
          </div>
        </div>

        {/* Bulk Action / Export Bar */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            {selectedTxIds.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setIsBulkDeleteModalOpen(true)}
              >
                <Trash2 size={16} className="mr-2" />
                Apagar {selectedTxIds.size} selecionadas
              </Button>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download size={16} className="mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4 pt-4">
          <Skeleton className="h-6 w-32" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-12">
          {/* 1. CURRENT SECTION (TOP) */}
          {(groupedData.current || isFiltered) && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-2">
                <div className="h-px flex-1 bg-blue-100 dark:bg-blue-900"></div>
                {isFiltered ? 'Resultados Encontrados' : 'Atual'}
                <div className="h-px flex-1 bg-blue-100 dark:bg-blue-900"></div>
              </h2>
              {groupedData.current && renderGroup(groupedData.current)}
              {isFiltered && groupedData.past.length === 0 && !groupedData.current && groupedData.future.length === 0 && (
                <div className="text-center py-10 text-muted-foreground">Nenhuma transação corresponde aos filtros.</div>
              )}
            </div>
          )}

          {/* 2. FUTURE SECTION (MIDDLE) */}
          {!isFiltered && groupedData.future.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider flex items-center gap-2">
                <div className="h-px flex-1 bg-purple-100 dark:bg-purple-900"></div>
                Futuras
                <div className="h-px flex-1 bg-purple-100 dark:bg-purple-900"></div>
              </h2>
              <div className="space-y-4">
                {groupedData.future.map(renderGroup)}
              </div>
            </div>
          )}

          {/* 3. PAST SECTION (BOTTOM) */}
          {!isFiltered && groupedData.past.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <div className="h-px flex-1 bg-muted"></div>
                Passadas
                <div className="h-px flex-1 bg-muted"></div>
              </h2>
              <div className="space-y-4">
                {groupedData.past.map(renderGroup)}
              </div>
            </div>
          )}

          {isFiltered && (groupedData.past.length > 0 || groupedData.future.length > 0) && (
            <div className="space-y-4">
              {groupedData.future.map(renderGroup)}
              {groupedData.past.map(renderGroup)}
            </div>
          )}

          {groupedData.past.length === 0 && !groupedData.current && groupedData.future.length === 0 && !isFiltered && (
            <div className="text-center py-20 border-2 border-dashed rounded-xl text-muted-foreground">
              Nenhuma transação encontrada.
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={isBulkDeleteModalOpen}
        title="Apagar transações"
        description="Tem certeza que deseja apagar as transações selecionadas? Esta ação não pode ser desfeita."
        confirmLabel="Apagar"
        destructive
        onConfirm={handleBulkDelete}
        onCancel={() => setIsBulkDeleteModalOpen(false)}
      />
    </div>
  );
};
