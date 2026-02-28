import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '@/lib/utils';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export function ExpensesByCategory({ data, onCategoryClick }: { data: any, onCategoryClick: (categoryName: string) => void }) {
  const onPieClick = (eventData: any) => {
    const categoryName = eventData.payload?.name || eventData.name;
    if (!categoryName) return;
    onCategoryClick(categoryName);
  };

  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <TrendingUp className="h-4 w-4 text-blue-500" />
          Gastos por Categoria (30d)
        </CardTitle>
        <p className="text-[11px] text-muted-foreground italic">Dica: clique para ver detalhes</p>
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
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
              >
                {data.expensesByCategory.map((_: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Nenhuma despesa.</div>
        )}
      </CardContent>
    </Card>
  );
}