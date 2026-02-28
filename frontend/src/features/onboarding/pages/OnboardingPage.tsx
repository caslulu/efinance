import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CurrencyInput } from '@/components/CurrencyInput';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateWallet } from '@/hooks';
import { Wallet, CheckCircle2 } from 'lucide-react';

export const OnboardingPage = () => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [type, setType] = useState<"BANK" | "PHYSICAL" | "MEAL_VOUCHER" | "INVESTMENT" | "OTHER">('BANK');
  const [balance, setBalance] = useState('');
  const createWallet = useCreateWallet();
  const navigate = useNavigate();

  const handleNext = async () => {
    if (step === 1) {
      setStep(2);
    } else if (step === 2) {
      if (!name || !type || !balance) return;
      
      try {
        await createWallet.mutateAsync({
          name,
          type,
          actual_cash: Number(balance),
        });
        setStep(3);
      } catch (error) {
        console.error("Failed to create initial wallet", error);
      }
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg border-2 shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/50 text-blue-600 rounded-full flex items-center justify-center mb-4">
            {step === 3 ? <CheckCircle2 size={32} /> : <Wallet size={32} />}
          </div>
          <CardTitle className="text-2xl">
            {step === 1 && 'Bem-vindo ao FinanceApp!'}
            {step === 2 && 'Sua Primeira Carteira'}
            {step === 3 && 'Tudo Pronto!'}
          </CardTitle>
          <CardDescription className="text-base mt-2">
            {step === 1 && 'Vamos configurar seu controle financeiro em apenas um passo.'}
            {step === 2 && 'Crie sua conta principal para começar a gerenciar seu dinheiro.'}
            {step === 3 && 'Sua conta foi configurada com sucesso. Vamos começar!'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Carteira</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Nubank, Itaú, Carteira Física..."
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Tipo</Label>
                <Select value={type} onValueChange={(val: any) => setType(val)}>
                  <SelectTrigger id="type">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BANK">Conta Bancária</SelectItem>
                    <SelectItem value="PHYSICAL">Dinheiro Físico</SelectItem>
                    <SelectItem value="MEAL_VOUCHER">Vale Alimentação/Refeição</SelectItem>
                    <SelectItem value="INVESTMENT">Conta de Investimento</SelectItem>
                    <SelectItem value="OTHER">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="balance">Saldo Atual (R$)</Label>
                <CurrencyInput
                  id="balance"
                  value={balance}
                  onValueChange={setBalance}
                  placeholder="0,00"
                />
              </div>
            </div>
          )}

          <div className="pt-4 flex justify-end gap-3 border-t">
            {step === 2 && (
              <Button variant="ghost" onClick={() => setStep(1)}>
                Voltar
              </Button>
            )}
            <Button 
              className="w-full sm:w-auto" 
              onClick={handleNext}
              disabled={step === 2 && (!name || !type || !balance || createWallet.isPending)}
            >
              {step === 1 ? 'Começar' : step === 2 ? (createWallet.isPending ? 'Criando...' : 'Criar Carteira') : 'Ir para o Dashboard'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};