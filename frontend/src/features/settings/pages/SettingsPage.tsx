import { useState } from 'react';
import { api } from '../../../api/api';
import { useAuth } from '../../../context/AuthContext';
import { getErrorMessage } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, CheckCircle2, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useNavigate } from 'react-router-dom';

export const SettingsPage = () => {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

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
    } catch (error) {
      setErrorMsg(getErrorMessage(error, 'Falha ao alterar senha'));
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

  const handleDeleteAccount = async () => {
    setLoading(true);
    try {
      await api.delete('/users/profile');
      await logout();
      navigate('/login');
    } catch (error) {
      setErrorMsg(getErrorMessage(error, 'Falha ao excluir a conta.'));
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
                <div className="relative">
                  <Input
                    id="currentPassword"
                    type={showCurrentPw ? 'text' : 'password'}
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                    required
                  />
                  <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showCurrentPw ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nova Senha</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPw ? 'text' : 'password'}
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    required
                  />
                  <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showNewPw ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <PasswordStrengthIndicator password={passwordData.newPassword} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPw ? 'text' : 'password'}
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    required
                  />
                  <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showConfirmPw ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
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

        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle size={20} />
              Zona de Perigo
            </CardTitle>
            <CardDescription>
              Ações destrutivas que não podem ser desfeitas.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="max-w-[80%]">
              <p className="font-medium">Excluir Conta</p>
              <p className="text-sm text-gray-500">
                Isso excluirá permanentemente sua conta, junto com todas as carteiras, transações e assinaturas associadas.
              </p>
            </div>

            <Button onClick={() => setIsDeleteDialogOpen(true)} variant="destructive" disabled={loading}>
              {loading ? 'Excluindo...' : 'Excluir Conta'}
            </Button>

            <ConfirmDialog
              open={isDeleteDialogOpen}
              title="Excluir Conta Permanentemente?"
              description="Esta ação analisará seus dados e os removerá de nossos servidores. Isso não pode ser desfeito. Tem certeza?"
              confirmLabel="Excluir Permanentemente"
              destructive={true}
              onConfirm={handleDeleteAccount}
              onCancel={() => setIsDeleteDialogOpen(false)}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
