import {
  Wallet,
  TrendingUp,
  Target,
  HeartPulse,
  PiggyBank,
  ShoppingCart,
  Sparkles,
} from 'lucide-react';

interface SuggestedQuestionsProps {
  onSelect: (question: string) => void;
}

const suggestions = [
  {
    icon: HeartPulse,
    label: 'Saúde financeira',
    question: 'Como está minha saúde financeira geral?',
    gradient: 'from-rose-500/15 to-pink-500/10 hover:from-rose-500/25 hover:to-pink-500/18',
    iconColor: 'text-rose-500',
  },
  {
    icon: Wallet,
    label: 'Gastos do mês',
    question: 'Como estão meus gastos este mês? Estou gastando mais do que deveria?',
    gradient: 'from-emerald-500/15 to-teal-500/10 hover:from-emerald-500/25 hover:to-teal-500/18',
    iconColor: 'text-emerald-500',
  },
  {
    icon: Target,
    label: 'Orçamento',
    question: 'Estou dentro do orçamento em todas as categorias?',
    gradient: 'from-amber-500/15 to-orange-500/10 hover:from-amber-500/25 hover:to-orange-500/18',
    iconColor: 'text-amber-500',
  },
  {
    icon: PiggyBank,
    label: 'Economia',
    question: 'Onde posso economizar com base nos meus gastos recentes?',
    gradient: 'from-blue-500/15 to-indigo-500/10 hover:from-blue-500/25 hover:to-indigo-500/18',
    iconColor: 'text-blue-500',
  },
  {
    icon: ShoppingCart,
    label: 'Lista de desejos',
    question: 'Vale a pena comprar algum item da minha lista de desejos agora?',
    gradient: 'from-violet-500/15 to-purple-500/10 hover:from-violet-500/25 hover:to-purple-500/18',
    iconColor: 'text-violet-500',
  },
  {
    icon: TrendingUp,
    label: 'Investimentos',
    question: 'Como estão meus investimentos? Deveria investir mais?',
    gradient: 'from-cyan-500/15 to-sky-500/10 hover:from-cyan-500/25 hover:to-sky-500/18',
    iconColor: 'text-cyan-500',
  },
];

export function SuggestedQuestions({ onSelect }: SuggestedQuestionsProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 px-4">
      <div className="text-center">
        <div className="w-18 h-18 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mx-auto mb-5 shadow-xl shadow-purple-500/25 p-4">
          <Sparkles size={32} className="text-white" />
        </div>
        <h2 className="text-2xl font-bold text-foreground tracking-tight">Assistente Financeiro</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-md">
          Pergunte sobre suas finanças, orçamento, investimentos ou lista de desejos
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
        {suggestions.map((s) => (
          <button
            key={s.label}
            onClick={() => onSelect(s.question)}
            className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-gradient-to-br ${s.gradient} border border-transparent hover:border-border/50 transition-all duration-300 text-left group hover:shadow-md hover:-translate-y-0.5`}
          >
            <div className="p-2 rounded-xl bg-white/60 dark:bg-white/10 shadow-sm group-hover:scale-110 transition-transform duration-300">
              <s.icon size={18} className={`shrink-0 ${s.iconColor}`} />
            </div>
            <span className="text-sm font-semibold text-foreground">{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
