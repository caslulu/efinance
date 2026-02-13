import { useState, useEffect, useRef } from 'react';
import { api } from '../../../api/api';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  Legend
} from 'recharts';
import { 
  Wallet, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  TrendingUp, 
  Repeat, 
  PiggyBank,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Bell,
  Search
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export const DashboardPage = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isDrilldownOpen, setIsDrilldownOpen] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get('/dashboard')
      .then(res => {
        setData(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch dashboard data', err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (data?.monthFlow && carouselRef.current) {
      const currentMonthIndex = data.monthFlow.findIndex((m: any) => !m.isProjected);
      if (currentMonthIndex === -1) return;
      
      setTimeout(() => {
        if (carouselRef.current) {
          const scrollPos = (currentMonthIndex * 160) - (carouselRef.current.offsetWidth / 2) + 80;
          carouselRef.current.scrollTo({ left: scrollPos, behavior: 'smooth' });
        }
      }, 100);
    }
  }, [data]);

  const scroll = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
      const amt = direction === 'left' ? -320 : 320;
      carouselRef.current.scrollBy({ left: amt, behavior: 'smooth' });
    }
  };

  const onPieClick = (data: any) => {
    if (data.name === 'Outro') {
      setIsDrilldownOpen(true);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Carregando painel...</div>;
  if (!data || !data.monthFlow) return <div className="p-8 text-center text-red-500">Falha ao carregar dados do dashboard.</div>;

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }

  return (
    <div className="p-4 space-y-8 md:p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <div className="text-sm text-muted-foreground bg-white px-3 py-1 rounded-full border shadow-sm flex items-center gap-2">
          <CalendarDays size={14} />
          {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* KPI Cards Row 1 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Saldo Total</CardTitle>
            <Wallet className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(data.totalBalance)}</div>
            <p className="text-xs text-muted-foreground">Soma de todas as carteiras</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Receitas (30d)</CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(data.monthlyIncomes)}</div>
            <p className="text-xs text-muted-foreground">Total recebido no mês</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Assinaturas</CardTitle>
            <Repeat className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{formatCurrency(data.recurringMonthly)}</div>
            <p className="text-xs text-muted-foreground">Custo fixo mensal recorrente</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Taxa de Poupança</CardTitle>
            <PiggyBank className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${data.savingsRate > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {data.savingsRate}%
            </div>
            <p className="text-xs text-muted-foreground">Do que entra vs o que sai</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main flow carousel occupies 2/3 */}
        <div className="lg:col-span-2 space-y-8">
           {/* Invoice/Expense Carousel */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <TrendingUp size={18} className="text-blue-500" />
                Fluxo de Despesas (24 meses)
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => scroll('left')}>
                  <ChevronLeft size={16} />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => scroll('right')}>
                  <ChevronRight size={16} />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div 
                ref={carouselRef}
                className="flex gap-4 overflow-x-hidden py-2 px-1"
              >
                {data.monthFlow.map((month: any, i: number) => (
                  <div 
                    key={i} 
                    className={`min-w-[140px] p-3 rounded-lg border flex flex-col items-center justify-center transition-all ${
                      month.isProjected 
                        ? 'bg-blue-50/50 border-blue-100 border-dashed' 
                        : 'bg-white shadow-sm border-gray-200'
                    } ${!month.isProjected && data.monthFlow[i+1]?.isProjected ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
                  >
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">{month.name}</span>
                    <span className={`text-base font-bold ${month.isProjected ? 'text-blue-500' : 'text-gray-900'}`}>
                      {formatCurrency(month.value)}
                    </span>
                    <span className="text-[9px] text-muted-foreground">
                      {month.isProjected ? 'Projetado' : 'Realizado'}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-8 md:grid-cols-2">
             {/* Expenses by Category */}
            <Card>
              <CardHeader className="pb-0">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                  Gastos por Categoria (30d)
                </CardTitle>
                <p className="text-[11px] text-muted-foreground italic">Dica: clique em 'Outro' para detalhes</p>
              </CardHeader>
              <CardContent className="h-[300px]">
                {data.expensesByCategory.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.expensesByCategory}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        onClick={onPieClick}
                        className="cursor-pointer"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {data.expensesByCategory.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend iconSize={10} wrapperStyle={{ fontSize: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    Nenhuma despesa registrada.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Cashflow Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Histórico & Projeção</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.monthFlow}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis hide />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      cursor={{ fill: '#f1f5f9' }}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar 
                      dataKey="value" 
                      radius={[4, 4, 0, 0]} 
                      fill="#3b82f6"
                    >
                      {data.monthFlow.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.isProjected ? '#93c5fd' : '#3b82f6'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Sidebar - Upcoming Bills occupying 1/3 */}
        <div className="lg:col-span-1">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Bell size={18} className="text-orange-500" />
                Próximas Contas (7 dias)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.upcomingTransactions && data.upcomingTransactions.length > 0 ? (
                  data.upcomingTransactions.map((tx: any) => (
                    <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg border bg-gray-50/50 hover:bg-gray-50 transition-colors">
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-gray-900 line-clamp-1">{tx.TransactionCategory?.name || 'Outro'}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Wallet size={10} />
                            {tx.wallet?.name}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">
                            {formatDate(tx.transaction_date)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-xs font-bold ${tx.transaction_type === 'EXPENSE' ? 'text-red-600' : 'text-green-600'}`}>
                          {tx.transaction_type === 'EXPENSE' ? '-' : '+'} {formatCurrency(Number(tx.value))}
                        </p>
                        {tx.installment_total && (
                          <p className="text-[9px] text-muted-foreground italic">
                            Parc. {tx.installment_number}/{tx.installment_total}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">Nenhuma conta para os próximos 7 dias.</p>
                  </div>
                )}
                <Button variant="ghost" className="w-full text-xs text-blue-600 hover:text-blue-700" onClick={() => window.location.href = '/transactions'}>
                  Ver todas as transações
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Drill-down Dialog for 'Outro' */}
      <Dialog open={isDrilldownOpen} onOpenChange={setIsDrilldownOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2 text-blue-600 mb-2">
              <Search size={20} />
              <DialogTitle>Detalhamento: Categoria Outro</DialogTitle>
            </div>
            <DialogDescription>
              Maiores gastos classificados como 'Outro' nos últimos 30 dias.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 border rounded-md overflow-hidden">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead className="text-[11px] font-bold">Data</TableHead>
                  <TableHead className="text-[11px] font-bold">Carteira</TableHead>
                  <TableHead className="text-[11px] font-bold">Parcela</TableHead>
                  <TableHead className="text-[11px] font-bold text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.outroTransactions && data.outroTransactions.length > 0 ? (
                  data.outroTransactions.map((tx: any) => (
                    <TableRow key={tx.id}>
                      <TableCell className="text-xs">{formatDate(tx.transaction_date)}</TableCell>
                      <TableCell className="text-xs">{tx.wallet?.name}</TableCell>
                      <TableCell className="text-xs italic text-muted-foreground">
                        {tx.installment_total ? `${tx.installment_number}/${tx.installment_total}` : 'À vista'}
                      </TableCell>
                      <TableCell className="text-xs font-bold text-right text-red-600">
                        {formatCurrency(Number(tx.value))}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-4 text-muted-foreground text-xs">
                      Nenhuma transação encontrada.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100 flex items-start gap-2">
            <TrendingUp size={16} className="text-blue-600 mt-0.5 shrink-0" />
            <p className="text-[11px] text-blue-800 leading-relaxed">
              <strong>Dica de Otimização:</strong> Se houver muitos gastos recorrentes aqui, considere criar uma nova categoria em "Categorias" para melhorar seu controle financeiro.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
