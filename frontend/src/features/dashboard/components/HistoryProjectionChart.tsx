import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { formatCurrency } from '@/lib/utils';

export function HistoryProjectionChart({ data }: { data: any }) {
  return (
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
              formatter={(value) => formatCurrency(Number(value))}
              cursor={{ fill: '#f1f5f9' }}
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="#3b82f6">
              {data.monthFlow.map((entry: any, index: number) => (
                <Cell key={`cell-${index}`} fill={entry.isProjected ? '#93c5fd' : '#3b82f6'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}