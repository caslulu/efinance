import { BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { formatCurrency } from '@/lib/utils';

export function HistoryProjectionChart({ data }: { data: any }) {
  return (
    <div className="dash-card overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <BarChart3 size={15} className="text-blue-500" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Histórico & Projeção</h3>
        </div>
      </div>
      <div className="px-5 pb-5 h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.monthFlow}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border) / 0.3)" />
            <XAxis
              dataKey="name"
              fontSize={9}
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis hide />
            <Tooltip
              formatter={(value) => formatCurrency(Number(value))}
              cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
              contentStyle={{
                borderRadius: '12px',
                border: '1px solid hsl(var(--border) / 0.5)',
                boxShadow: '0 8px 30px -8px rgba(0,0,0,0.12)',
                fontSize: '12px',
                background: 'hsl(var(--card))',
                color: 'hsl(var(--foreground))',
              }}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="#3b82f6">
              {data.monthFlow.map((entry: any, index: number) => (
                <Cell key={`cell-${index}`} fill={entry.isProjected ? '#93c5fd' : '#3b82f6'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}