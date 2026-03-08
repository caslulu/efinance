import { TrendingUp } from 'lucide-react';
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '@/lib/utils';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export function ExpensesByCategory({ data, onCategoryClick }: { data: any, onCategoryClick: (categoryName: string) => void }) {
  const onPieClick = (eventData: any) => {
    const categoryName = eventData.payload?.name || eventData.name;
    if (!categoryName) return;
    onCategoryClick(categoryName);
  };

  return (
    <div className="dash-card overflow-hidden">
      <div className="px-5 pt-5 pb-2">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <TrendingUp size={15} className="text-emerald-500" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Gastos por Categoria</h3>
        </div>
        <p className="text-[10px] text-muted-foreground ml-[42px]">Clique para ver detalhes • últimos 30d</p>
      </div>
      <div className="px-5 pb-5 h-[280px]">
        {data.expensesByCategory.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.expensesByCategory}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={78}
                paddingAngle={4}
                dataKey="value"
                onClick={onPieClick}
                className="cursor-pointer"
                stroke="none"
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
              >
                {data.expensesByCategory.map((_: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => formatCurrency(Number(value))}
                contentStyle={{
                  borderRadius: '12px',
                  border: '1px solid hsl(var(--border) / 0.5)',
                  boxShadow: '0 8px 30px -8px rgba(0,0,0,0.12)',
                  fontSize: '12px',
                  background: 'hsl(var(--card))',
                  color: 'hsl(var(--foreground))',
                }}
              />
              <Legend iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-xs">Nenhuma despesa.</div>
        )}
      </div>
    </div>
  );
}