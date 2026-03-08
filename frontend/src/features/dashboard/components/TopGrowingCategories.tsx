import { TrendingUp } from 'lucide-react';
import { CategoryIcon } from '@/components/IconPicker';
import { formatCurrency } from '@/lib/utils';

export function TopGrowingCategories({ data }: { data: any }) {
  return (
    <div className="dash-card overflow-hidden">
      <div className="px-5 pt-5 pb-4 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-violet-500/10 flex items-center justify-center">
          <TrendingUp size={15} className="text-violet-500" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">Categorias em Alta</h3>
      </div>
      <div className="px-5 pb-5 space-y-2.5">
        {data.topGrowingCategories && data.topGrowingCategories.length > 0 ? (
          data.topGrowingCategories.map((item: any) => (
            <div key={item.name} className="p-3.5 rounded-xl bg-violet-500/[0.04] border border-violet-500/10 hover:border-violet-500/20 transition-colors">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                    <CategoryIcon name={item.icon} className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                  </div>
                  <p className="text-xs font-semibold text-foreground truncate">{item.name}</p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 whitespace-nowrap">
                  +{item.growthPercent}%
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5 ml-[38px]">
                +{formatCurrency(item.growth)} vs mês anterior
              </p>
            </div>
          ))
        ) : (
          <div className="text-center py-6 text-muted-foreground text-xs">Sem crescimento relevante nas categorias.</div>
        )}
      </div>
    </div>
  );
}