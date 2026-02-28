import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import { CategoryIcon } from '@/components/IconPicker';
import { formatCurrency } from '@/lib/utils';

export function TopGrowingCategories({ data }: { data: any }) {
  return (
    <Card className="border-t-4 border-t-violet-500">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <TrendingUp size={18} className="text-violet-500" />
          Categorias em Alta
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.topGrowingCategories && data.topGrowingCategories.length > 0 ? (
            data.topGrowingCategories.map((item: any) => (
              <div key={item.name} className="p-3 rounded-lg border bg-violet-50/50">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <CategoryIcon name={item.icon} className="h-4 w-4 text-violet-600" />
                    <p className="text-xs font-bold text-gray-900 truncate">{item.name}</p>
                  </div>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">
                    +{item.growthPercent}%
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  +{formatCurrency(item.growth)} vs mês anterior
                </p>
              </div>
            ))
          ) : (
            <div className="text-center py-4 text-muted-foreground text-xs italic">Sem crescimento relevante nas categorias.</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}