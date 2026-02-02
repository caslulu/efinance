import { useState } from 'react';
import { api } from '../../../api/api';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');
    
    try {
      await api.post('/auth/forgot-password', { email });
      setMessage('Foi enviado um link de recuperação no seu email.');
    } catch (err: any) {
      if (err.response?.status === 404) {
        setError('Email não encontrado');
      } else {
        setError('Falha ao solicitar recuperação. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-2xl font-bold">Recuperar Senha</CardTitle>
        </CardHeader>
        <CardContent>
          {message && <div className="mb-4 rounded bg-green-100 p-2 text-sm text-green-700">{message}</div>}
          {error && <div className="mb-4 rounded bg-red-100 p-2 text-sm text-red-600">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar Link'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center">
          <Link to="/login" className="text-sm text-blue-600 hover:underline">
            Voltar para o Login
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
};
