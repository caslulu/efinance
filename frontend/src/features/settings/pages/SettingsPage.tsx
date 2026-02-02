import { useState, useEffect } from 'react';
import { api } from '../../../api/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export const SettingsPage = () => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const res = await api.get('/auth/profile');
      setIsEnabled(res.data.isTwoFactorEnabled);
    } catch (error) {
      console.error('Failed to load profile');
    }
  };

  const handleToggle = async () => {
    setLoading(true);
    try {
      if (isEnabled) {
        await api.post('/auth/2fa/disable');
        setIsEnabled(false);
      } else {
        await api.post('/auth/2fa/enable');
        setIsEnabled(true);
      }
    } catch (error) {
      alert('Falha ao atualizar configurações de 2FA');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Segurança</CardTitle>
          <CardDescription>Gerencie a segurança da sua conta.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>
            <p className="font-medium">Autenticação de Dois Fatores (2FA)</p>
            <p className="text-sm text-gray-500">
              Receba um código de verificação por email ao fazer login.
            </p>
          </div>
          <Button 
            variant={isEnabled ? "destructive" : "default"}
            onClick={handleToggle}
            disabled={loading}
          >
            {isEnabled ? 'Desativar' : 'Ativar'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
