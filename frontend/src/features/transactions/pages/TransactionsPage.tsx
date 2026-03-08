import { useState, useMemo, useRef, useEffect } from 'react';
import { formatCurrency } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useTransactions, useSubscriptions, useWallets, useCategories, useDeleteTransaction } from '@/hooks';
import type { Transaction } from '../../../types/Transaction';
import { TransactionList } from '../components/TransactionList';
import {
  ChevronDown, Search, SlidersHorizontal, X,
  Wallet as WalletIcon, Download, Trash2, TrendingUp, TrendingDown,
  ArrowLeftRight, Sparkles, Clock, CalendarDays
} from 'lucide-react';
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
  const [showFilters, setShowFilters] = useState(false);

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
        let nextDate: Date;
        const originalDay = new Date(sub.next_billing_date).getDate();
        switch (sub.frequency) {
          case 'WEEKLY':
            nextDate = new Date(currentDate);
            nextDate.setDate(nextDate.getDate() + 7);
            break;
          case 'MONTHLY': {
            nextDate = new Date(currentDate);
            nextDate.setMonth(nextDate.getMonth() + 1);
            const maxDay = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
            nextDate.setDate(Math.min(originalDay, maxDay));
            break;
          }
          case 'QUARTERLY': {
            nextDate = new Date(currentDate);
            nextDate.setMonth(nextDate.getMonth() + 3);
            const maxDayQ = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
            nextDate.setDate(Math.min(originalDay, maxDayQ));
            break;
          }
          case 'YEARLY':
            nextDate = new Date(currentDate);
            nextDate.setFullYear(nextDate.getFullYear() + 1);
            break;
          default:
            nextDate = new Date(currentDate);
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
    const idsToDelete = Array.from(selectedTxIds).filter(id => id > 0);
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

  // Summary stats
  const summaryStats = useMemo(() => {
    const allTx = transactions;
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthTx = allTx.filter(tx => {
      const d = new Date(tx.transaction_date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    const income = monthTx.filter(t => t.transaction_type === 'INCOME').reduce((s, t) => s + Number(t.value), 0);
    const expense = monthTx.filter(t => t.transaction_type === 'EXPENSE').reduce((s, t) => s + Number(t.value), 0);
    return { income, expense, balance: income - expense, count: monthTx.length };
  }, [transactions]);

  const isFiltered = searchTerm !== '' || filterCategory !== 'ALL' || filterWallet !== 'ALL' || filterType !== 'ALL' || filterStartDate !== '' || filterEndDate !== '';
  const activeFilterCount = [filterCategory !== 'ALL', filterWallet !== 'ALL', filterType !== 'ALL', filterStartDate !== '', filterEndDate !== ''].filter(Boolean).length;

  const renderGroup = (group: any) => {
    const isExpanded = expandedMonths.includes(group.label);
    const isFuture = group.orderKey > (new Date().getFullYear() * 100 + new Date().getMonth());
    const isCurrent = group.orderKey === (new Date().getFullYear() * 100 + new Date().getMonth());
    const net = group.totalIncome - group.totalExpense;

    return (
      <div key={group.label} className="tx-card-enter relative">
        {/* Month Header */}
        <button
          onClick={() => toggleMonth(group.label)}
          className="w-full group relative"
        >
          <div className={`
            flex items-center justify-between p-5 rounded-2xl border transition-all duration-300
            ${isCurrent
              ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50 shadow-sm shadow-emerald-100 dark:shadow-emerald-900/20'
              : isFuture
                ? 'bg-violet-50/50 dark:bg-violet-950/20 border-violet-200/70 dark:border-violet-800/30'
                : 'bg-card border-border hover:border-muted-foreground/20'
            }
            hover:shadow-md
          `}>
            <div className="flex items-center gap-4">
              {/* Timeline dot */}
              <div className={`
                relative w-10 h-10 rounded-xl flex items-center justify-center shrink-0
                ${isCurrent
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                  : isFuture
                    ? 'bg-violet-500/90 text-white shadow-lg shadow-violet-500/20'
                    : 'bg-muted text-muted-foreground'
                }
              `}>
                {isFuture ? <Sparkles size={16} /> : isCurrent ? <CalendarDays size={16} /> : <Clock size={16} />}
                {isCurrent && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full animate-pulse" />
                )}
              </div>

              <div className="text-left">
                <h3 className="tx-serif text-xl font-normal text-foreground capitalize tracking-tight">
                  {group.label}
                </h3>
                <div className="flex items-center gap-2 mt-0.5">
                  {isCurrent && (
                    <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                      Mês atual
                    </span>
                  )}
                  {isFuture && (
                    <span className="text-[10px] font-bold uppercase tracking-widest text-violet-600 dark:text-violet-400">
                      Projeção
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {group.transactions.length} transaç{group.transactions.length === 1 ? 'ão' : 'ões'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-5">
              <div className="hidden md:flex items-center gap-6">
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Receitas</p>
                  <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{formatCurrency(group.totalIncome)}</p>
                </div>
                <div className="w-px h-8 bg-border" />
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Despesas</p>
                  <p className="text-sm font-bold text-red-500 dark:text-red-400 tabular-nums">{formatCurrency(group.totalExpense)}</p>
                </div>
                <div className="w-px h-8 bg-border" />
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Saldo</p>
                  <p className={`text-sm font-bold tabular-nums ${net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                    {formatCurrency(net)}
                  </p>
                </div>
              </div>

              {/* Mobile summary */}
              <div className="md:hidden text-right">
                <p className={`text-sm font-bold tabular-nums ${net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                  {net >= 0 ? '+' : ''}{formatCurrency(net)}
                </p>
              </div>

              <div className={`
                w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-300
                ${isExpanded ? 'bg-foreground/5 rotate-0' : 'bg-transparent -rotate-90'}
              `}>
                <ChevronDown size={16} className="text-muted-foreground transition-transform duration-300" />
              </div>
            </div>
          </div>
        </button>

        {/* Expanded content */}
        {isExpanded && (
          <div className="mt-1 ml-5 pl-5 border-l-2 border-border/50 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="py-3">
              <TransactionList
                transactions={group.transactions}
                onTransactionUpdated={fetchData}
                selectedIds={selectedTxIds}
                onToggleSelect={toggleSelection}
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderSectionHeader = (label: string, variant: 'current' | 'future' | 'past') => {
    const colors = {
      current: 'text-emerald-600 dark:text-emerald-400',
      future: 'text-violet-600 dark:text-violet-400',
      past: 'text-muted-foreground',
    };
    const lines = {
      current: 'from-transparent via-emerald-300 dark:via-emerald-700 to-transparent',
      future: 'from-transparent via-violet-300 dark:via-violet-700 to-transparent',
      past: 'from-transparent via-border to-transparent',
    };
    return (
      <div className="flex items-center gap-4 py-2">
        <div className={`h-px flex-1 bg-gradient-to-r ${lines[variant]}`} />
        <span className={`text-[11px] font-bold uppercase tracking-[0.2em] ${colors[variant]}`}>
          {label}
        </span>
        <div className={`h-px flex-1 bg-gradient-to-r ${lines[variant]}`} />
      </div>
    );
  };

  return (
    <div className="tx-page p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
      {/* ── Hero Header ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-6 md:p-8 tx-grain">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-violet-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3" />

        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
            <div>
              <p className="text-emerald-400 text-xs font-bold uppercase tracking-[0.25em] mb-2">Extrato financeiro</p>
              <h1 className="tx-serif text-3xl md:text-4xl text-white tracking-tight" style={{ fontStyle: 'italic' }}>
                Transações
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExportCSV}
                className="text-white/70 hover:text-white hover:bg-white/10 border border-white/10"
              >
                <Download size={14} className="mr-2" />
                Exportar
              </Button>
            </div>
          </div>

          {/* Summary Stats */}
          {!loading && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 tx-stagger">
              <div className="tx-stat-card rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <TrendingUp size={12} className="text-emerald-400" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">Receitas</span>
                </div>
                <p className="text-lg md:text-xl font-bold text-emerald-400 tabular-nums">{formatCurrency(summaryStats.income)}</p>
              </div>

              <div className="tx-stat-card rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-lg bg-red-500/20 flex items-center justify-center">
                    <TrendingDown size={12} className="text-red-400" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">Despesas</span>
                </div>
                <p className="text-lg md:text-xl font-bold text-red-400 tabular-nums">{formatCurrency(summaryStats.expense)}</p>
              </div>

              <div className="tx-stat-card rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-lg bg-sky-500/20 flex items-center justify-center">
                    <ArrowLeftRight size={12} className="text-sky-400" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">Balanço</span>
                </div>
                <p className={`text-lg md:text-xl font-bold tabular-nums ${summaryStats.balance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatCurrency(summaryStats.balance)}
                </p>
              </div>

              <div className="tx-stat-card rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-lg bg-amber-500/20 flex items-center justify-center">
                    <CalendarDays size={12} className="text-amber-400" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">Este mês</span>
                </div>
                <p className="text-lg md:text-xl font-bold text-white tabular-nums">{summaryStats.count}</p>
                <p className="text-[10px] text-white/40 -mt-0.5">transações</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Search & Filter Bar ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar transações..."
              className="pl-10 h-11 rounded-xl bg-card border-border/60 focus-visible:border-emerald-500/50 focus-visible:ring-emerald-500/20 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filter toggle */}
          <Button
            variant={showFilters || activeFilterCount > 0 ? 'default' : 'outline'}
            size="icon"
            className={`h-11 w-11 rounded-xl shrink-0 transition-all ${
              showFilters || activeFilterCount > 0
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20'
                : ''
            }`}
            onClick={() => setShowFilters(v => !v)}
          >
            <SlidersHorizontal size={16} />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </Button>

          {/* Bulk delete */}
          {selectedTxIds.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              className="h-11 rounded-xl shrink-0"
              onClick={() => setIsBulkDeleteModalOpen(true)}
            >
              <Trash2 size={14} className="mr-2" />
              {selectedTxIds.size}
            </Button>
          )}
        </div>

        {/* Collapsible Filter Panel */}
        <div className="tx-filter-panel" data-open={showFilters ? 'true' : 'false'}>
          <div className="grid gap-3 md:grid-cols-4 bg-card p-4 rounded-2xl border border-border/60 shadow-sm mt-2">
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="h-10 rounded-xl">
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
              <SelectTrigger className="h-10 rounded-xl">
                <WalletIcon className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
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
              <SelectTrigger className="h-10 rounded-xl">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos os Tipos</SelectItem>
                <SelectItem value="INCOME">Apenas Receitas</SelectItem>
                <SelectItem value="EXPENSE">Apenas Despesas</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className="h-10 rounded-xl flex-1"
                placeholder="De"
              />
              <span className="text-muted-foreground text-xs">—</span>
              <Input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className="h-10 rounded-xl flex-1"
              />
            </div>

            {isFiltered && (
              <div className="md:col-span-4 flex justify-end">
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl text-xs">
                  <X size={12} className="mr-1.5" /> Limpar filtros
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Transaction Timeline ── */}
      {loading ? (
        <div className="space-y-6 pt-4 tx-stagger">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-20 w-full rounded-2xl" />
              <div className="ml-10 space-y-2">
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-14 w-full rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-10 relative">
          {/* Current Month */}
          {(groupedData.current || isFiltered) && (
            <div className="space-y-4">
              {!isFiltered && renderSectionHeader('Atual', 'current')}
              {isFiltered && renderSectionHeader('Resultados', 'current')}
              {groupedData.current && renderGroup(groupedData.current)}
              {isFiltered && groupedData.past.length === 0 && !groupedData.current && groupedData.future.length === 0 && (
                <div className="text-center py-16">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-muted mb-4">
                    <Search size={24} className="text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground text-sm">Nenhuma transação corresponde aos filtros.</p>
                </div>
              )}
            </div>
          )}

          {/* Future */}
          {!isFiltered && groupedData.future.length > 0 && (
            <div className="space-y-4">
              {renderSectionHeader('Futuras', 'future')}
              <div className="space-y-4 tx-stagger">
                {groupedData.future.map(renderGroup)}
              </div>
            </div>
          )}

          {/* Past */}
          {!isFiltered && groupedData.past.length > 0 && (
            <div className="space-y-4">
              {renderSectionHeader('Passadas', 'past')}
              <div className="space-y-4 tx-stagger">
                {groupedData.past.map(renderGroup)}
              </div>
            </div>
          )}

          {/* Filtered combined results */}
          {isFiltered && (groupedData.past.length > 0 || groupedData.future.length > 0) && (
            <div className="space-y-4 tx-stagger">
              {groupedData.future.map(renderGroup)}
              {groupedData.past.map(renderGroup)}
            </div>
          )}

          {/* Empty State */}
          {groupedData.past.length === 0 && !groupedData.current && groupedData.future.length === 0 && !isFiltered && (
            <div className="text-center py-24">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-muted/50 border-2 border-dashed border-border mb-5">
                <ArrowLeftRight size={28} className="text-muted-foreground" />
              </div>
              <p className="tx-serif text-xl text-muted-foreground" style={{ fontStyle: 'italic' }}>
                Nenhuma transação encontrada
              </p>
              <p className="text-sm text-muted-foreground/60 mt-1">Suas transações aparecerão aqui</p>
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
