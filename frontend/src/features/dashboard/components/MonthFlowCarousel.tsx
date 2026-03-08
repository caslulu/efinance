import { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export function MonthFlowCarousel({ data }: { data: any }) {
  const carouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (data?.monthFlow && carouselRef.current) {
      const currentMonthIndex = data.monthFlow.findIndex((m: any, i: number) =>
        !m.isProjected && (i === data.monthFlow.length - 1 || data.monthFlow[i + 1]?.isProjected)
      );
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

  return (
    <div className="dash-card overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <TrendingUp size={15} className="text-emerald-500" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Fluxo de Despesas</h3>
          <span className="text-[10px] text-muted-foreground">24 meses</span>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => scroll('left')}
            className="w-8 h-8 rounded-xl border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={() => scroll('right')}
            className="w-8 h-8 rounded-xl border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
      <div className="px-5 pb-5">
        <div ref={carouselRef} className="flex gap-3 overflow-x-hidden py-1 px-0.5">
          {data.monthFlow.map((month: any, i: number) => {
            const isCurrent = !month.isProjected && data.monthFlow[i + 1]?.isProjected;
            return (
              <div
                key={i}
                className={`min-w-[136px] p-3.5 rounded-2xl border flex flex-col items-center justify-center gap-1 transition-all duration-300
                  ${month.isProjected
                    ? 'bg-emerald-500/[0.04] border-dashed border-emerald-500/15'
                    : 'bg-card border-border/40 hover:border-border'}
                  ${isCurrent ? 'ring-2 ring-emerald-500/40 ring-offset-2 ring-offset-background shadow-lg shadow-emerald-500/5' : ''}`}
              >
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{month.name}</span>
                <span className={`text-base font-bold tabular-nums ${month.isProjected ? 'text-emerald-500' : 'text-foreground'}`}>
                  {formatCurrency(month.value)}
                </span>
                <span className={`text-[9px] font-medium ${month.isProjected ? 'text-emerald-500/60' : 'text-muted-foreground'}`}>
                  {month.isProjected ? 'Projetado' : 'Realizado'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}