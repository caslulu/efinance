import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export function MonthFlowCarousel({ data }: { data: any }) {
  const carouselRef = useRef<HTMLDivElement>(null);

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

  return (
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
        <div ref={carouselRef} className="flex gap-4 overflow-x-hidden py-2 px-1">
          {data.monthFlow.map((month: any, i: number) => (
            <div key={i} className={`min-w-[140px] p-3 rounded-lg border flex flex-col items-center justify-center transition-all ${month.isProjected ? 'bg-blue-900/20 border-blue-100 border-dashed' : 'bg-card shadow-sm border-border'
              } ${!month.isProjected && data.monthFlow[i + 1]?.isProjected ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}>
              <span className="text-[10px] font-bold text-muted-foreground uppercase">{month.name}</span>
              <span className={`text-base font-bold ${month.isProjected ? 'text-blue-500' : 'text-foreground'}`}>{formatCurrency(month.value)}</span>
              <span className="text-[9px] text-muted-foreground">{month.isProjected ? 'Projetado' : 'Realizado'}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}