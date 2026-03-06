import {
  Wallet,
  TrendingUp,
  Target,
  HeartPulse,
  PiggyBank,
  ShoppingCart,
} from 'lucide-react';

interface SuggestedQuestionsProps {
  onSelect: (question: string) => void;
}

const suggestions = [
  {
    icon: HeartPulse,
    label: 'Saúde financeira',
    question: 'Como está minha saúde financeira geral?',
  },
  {
    icon: Wallet,
    label: 'Gastos do mês',
    question: 'Como estão meus gastos este mês? Estou gastando mais do que deveria?',
  },
  {
    icon: Target,
    label: 'Orçamento',
    question: 'Estou dentro do orçamento em todas as categorias?',
  },
  {
    icon: PiggyBank,
    label: 'Economia',
    question: 'Onde posso economizar com base nos meus gastos recentes?',
  },
  {
    icon: ShoppingCart,
    label: 'Lista de desejos',
    question: 'Vale a pena comprar algum item da minha lista de desejos agora?',
  },
  {
    icon: TrendingUp,
    label: 'Investimentos',
    question: 'Como estão meus investimentos? Deveria investir mais?',
  },
];

export function SuggestedQuestions({ onSelect }: SuggestedQuestionsProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-4">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-emerald-500 flex items-center justify-center mx-auto mb-4">
          <HeartPulse size={32} className="text-white" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Assistente Financeiro</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Pergunte sobre suas finanças, orçamento, investimentos ou lista de desejos
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
        {suggestions.map((s) => (
          <button
            key={s.label}
            onClick={() => onSelect(s.question)}
            className="flex items-center gap-3 px-4 py-3 rounded-xl border bg-card hover:bg-accent hover:text-accent-foreground transition-colors text-left group"
          >
            <s.icon
              size={20}
              className="shrink-0 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform"
            />
            <span className="text-sm font-medium">{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
