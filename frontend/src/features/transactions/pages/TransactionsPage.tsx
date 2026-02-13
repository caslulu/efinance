import { useEffect, useState, useMemo, useRef } from 'react';
import { api } from '../../../api/api';
import type { Transaction } from '../../../types/Transaction';
import type { Subscription } from '../../../types/Subscription';
import type { Wallet } from '../../../types/Wallet';
import { TransactionList } from '../components/TransactionList';
import { ChevronDown, ChevronRight, Calendar, Search, Filter, X, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const TransactionsPage = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedMonths, setExpandedMonths] = useState<string[]>([]);
  const hasInitialExpanded = useRef(false);

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterWallet, setFilterWallet] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');

  const fetchData = async () => {
    try {
      const [txRes, subRes, walletRes, catRes] = await Promise.all([
        api.get('/transactions'),
        api.get('/subscriptions'),
        api.get('/wallets'),
        api.get('/categories')
      ]);
      
      if (Array.isArray(txRes.data)) setTransactions(txRes.data);
      if (Array.isArray(subRes.data)) setSubscriptions(subRes.data);
      if (Array.isArray(walletRes.data)) setWallets(walletRes.data);
      if (Array.isArray(catRes.data)) setCategories(catRes.data);
    } catch (error) {
      console.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const clearFilters = () => {
    setSearchTerm('');
    setFilterCategory('ALL');
    setFilterWallet('ALL');
    setFilterType('ALL');
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

      return matchesSearch && matchesCategory && matchesWallet && matchesType;
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

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const renderGroup = (group: any) => {
    const isExpanded = expandedMonths.includes(group.label);
    const isFuture = group.orderKey > (new Date().getFullYear() * 100 + new Date().getMonth());

    return (
      <div key={group.label} className="border rounded-xl bg-white overflow-hidden shadow-sm transition-all hover:shadow-md">
        <button 
          onClick={() => toggleMonth(group.label)}
          className="w-full flex items-center justify-between p-4 bg-gray-50/50 hover:bg-gray-50 transition-colors border-b"
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isFuture ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}`}>
              <Calendar size={18} />
            </div>
            <div className="text-left">
              <h3 className="font-bold text-gray-900 capitalize">{group.label}</h3>
              {isFuture && <span className="text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded uppercase font-bold ml-2">Projeção</span>}
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden md:flex gap-4 text-sm">
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground uppercase">Receitas</p>
                <p className="font-bold text-green-600">{formatCurrency(group.totalIncome)}</p>
              </div>
              <div className="text-right border-l pl-4">
                <p className="text-[10px] text-muted-foreground uppercase">Gastos</p>
                <p className="font-bold text-red-600">{formatCurrency(group.totalExpense)}</p>
              </div>
            </div>
            {isExpanded ? <ChevronDown className="text-gray-400" /> : <ChevronRight className="text-gray-400" />}
          </div>
        </button>

        {isExpanded && (
          <div className="p-2 animate-in fade-in slide-in-from-top-1 duration-200">
            <TransactionList transactions={group.transactions} onTransactionUpdated={fetchData} />
          </div>
        )}
      </div>
    );
  };

  const isFiltered = searchTerm !== '' || filterCategory !== 'ALL' || filterWallet !== 'ALL' || filterType !== 'ALL';

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Histórico de Transações</h1>
          {isFiltered && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-red-600 hover:text-red-700 hover:bg-red-50">
              <X size={16} className="mr-2" /> Limpar Filtros
            </Button>
          )}
        </div>

        {/* Filters Bar */}
        <div className="grid gap-4 md:grid-cols-4 bg-white p-4 rounded-xl border shadow-sm">
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
              <Wallet className="h-4 w-4 mr-2 text-muted-foreground" />
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
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10 text-muted-foreground">Carregando transações...</div>
      ) : (
        <div className="space-y-12">
          {/* 1. CURRENT SECTION (TOP) */}
          {(groupedData.current || isFiltered) && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-blue-600 uppercase tracking-wider flex items-center gap-2">
                <div className="h-px flex-1 bg-blue-100"></div>
                {isFiltered ? 'Resultados Encontrados' : 'Atual'}
                <div className="h-px flex-1 bg-blue-100"></div>
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
              <h2 className="text-lg font-bold text-purple-600 uppercase tracking-wider flex items-center gap-2">
                <div className="h-px flex-1 bg-purple-100"></div>
                Futuras
                <div className="h-px flex-1 bg-purple-100"></div>
              </h2>
              <div className="space-y-4">
                {groupedData.future.map(renderGroup)}
              </div>
            </div>
          )}

          {/* 3. PAST SECTION (BOTTOM) */}
          {!isFiltered && groupedData.past.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <div className="h-px flex-1 bg-gray-200"></div>
                Passadas
                <div className="h-px flex-1 bg-gray-200"></div>
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
    </div>
  );
};
