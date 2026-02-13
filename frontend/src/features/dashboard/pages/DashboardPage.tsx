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
  CalendarDays
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export const DashboardPage = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
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

  // Scroll to current month (middle of flow) after load
  useEffect(() => {
    if (data?.monthFlow && carouselRef.current) {
      const currentMonthIndex = data.monthFlow.findIndex((m: any) => !m.isProjected);
      if (currentMonthIndex === -1) return;
      
      // Wait a bit for layout
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

  if (loading) return <div className="p-8 text-center text-gray-500">Carregando painel...</div>;
  if (!data || !data.monthFlow) return <div className="p-8 text-center text-red-500">Falha ao carregar dados do dashboard.</div>;

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

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

      {/* Invoice/Expense Carousel */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp size={20} className="text-blue-500" />
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
                className={`min-w-[150px] p-4 rounded-lg border flex flex-col items-center justify-center transition-all ${
                  month.isProjected 
                    ? 'bg-blue-50/50 border-blue-100 border-dashed' 
                    : 'bg-white shadow-sm border-gray-200'
                } ${!month.isProjected && data.monthFlow[i+1]?.isProjected ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
              >
                <span className="text-xs font-medium text-muted-foreground uppercase">{month.name}</span>
                <span className={`text-lg font-bold ${month.isProjected ? 'text-blue-400' : 'text-gray-900'}`}>
                  {formatCurrency(month.value)}
                </span>
                <span className="text-[10px] mt-1 text-muted-foreground">
                  {month.isProjected ? 'Projetado' : 'Realizado'}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Expenses by Category */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Gastos por Categoria (30 dias)
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[350px]">
            {data.expensesByCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.expensesByCategory}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {data.expensesByCategory.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Nenhuma despesa registrada no período.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cashflow Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Histórico e Projeção</CardTitle>
          </CardHeader>
          <CardContent className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthFlow}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
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
  );
};
