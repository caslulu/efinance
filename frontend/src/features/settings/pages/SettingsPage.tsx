import { useState } from 'react';
import { api } from '../../../api/api';
import { useAuth } from '../../../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, CheckCircle2 } from 'lucide-react';

export const SettingsPage = () => {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setErrorMsg('As novas senhas não coincidem');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await api.patch('/users/profile', {
        currentPassword: passwordData.currentPassword,
        password: passwordData.newPassword,
      });
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setSuccessMsg('Senha alterada com sucesso!');
    } catch (error: any) {
      setErrorMsg(error.response?.data?.message || 'Falha ao alterar senha');
    } finally {
      setLoading(false);
    }
  };

  const handle2FAToggle = async () => {
    setLoading(true);
    try {
      if (user?.isTwoFactorEnabled) {
        await api.post('/auth/2fa/disable');
      } else {
        await api.post('/auth/2fa/enable');
      }
      await refreshUser();
      setSuccessMsg(`2FA ${user?.isTwoFactorEnabled ? 'desativado' : 'ativado'} com sucesso!`);
    } catch (error) {
      setErrorMsg('Falha ao atualizar configurações de 2FA');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground text-gray-500">Gerencie as preferências de segurança da sua conta.</p>
      </div>

      {(successMsg || errorMsg) && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${successMsg ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {successMsg ? <CheckCircle2 size={20} /> : <Shield size={20} />}
          <p className="text-sm font-medium">{successMsg || errorMsg}</p>
        </div>
      )}
      <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Alterar Senha</CardTitle>
              <CardDescription>Recomendamos o uso de uma senha forte que você não use em outros sites.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordUpdate} className="space-y-4 max-w-md">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Senha Atual</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nova Senha</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    required
                  />
                </div>
                <div className="pt-2">
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Atualizando...' : 'Atualizar Senha'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="text-blue-600" size={20} />
                Autenticação de Dois Fatores
              </CardTitle>
              <CardDescription>Adicione uma camada extra de segurança à sua conta.</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="max-w-[80%]">
                <p className="font-medium">2FA via Email</p>
                <p className="text-sm text-gray-500">
                  Ao ativar, solicitaremos um código enviado ao seu email sempre que você fizer login de um novo dispositivo.
                </p>
              </div>
              <Button 
                variant={user?.isTwoFactorEnabled ? "destructive" : "default"}
                onClick={handle2FAToggle}
                disabled={loading}
              >
                {user?.isTwoFactorEnabled ? 'Desativar' : 'Ativar'}
              </Button>
            </CardContent>
          </Card>
        </div>
    </div>
  );
};
