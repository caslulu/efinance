import { useState, useEffect } from 'react';
import { api } from '../../../api/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export const SettingsPage = () => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [token, setToken] = useState('');
  const [showModal, setShowModal] = useState(false);
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
    if (isEnabled) {
      try {
        await api.post('/auth/2fa/disable');
        setIsEnabled(false);
      } catch (error) {
        alert('Falha ao desativar 2FA');
      }
    } else {
      try {
        setLoading(true);
        const res = await api.get('/auth/2fa/generate');
        setQrCode(res.data.qrCode);
        setShowModal(true);
      } catch (error) {
        alert('Falha ao gerar QR Code');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleEnableConfirm = async () => {
    try {
      await api.post('/auth/2fa/enable', { token });
      setIsEnabled(true);
      setShowModal(false);
      setToken('');
      setQrCode('');
    } catch (error) {
      alert('Código inválido');
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
              Adicione uma camada extra de segurança à sua conta.
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

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar 2FA</DialogTitle>
            <DialogDescription>
              Escaneie o QR Code abaixo com seu aplicativo autenticador (Google Authenticator, Authy, etc.) e digite o código gerado.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col items-center gap-4 py-4">
            {qrCode && <img src={qrCode} alt="QR Code 2FA" className="w-48 h-48 border rounded" />}
            
            <div className="w-full max-w-sm space-y-2">
              <Label htmlFor="token">Código de Verificação</Label>
              <Input 
                id="token" 
                placeholder="000000" 
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="text-center text-lg tracking-widest"
                maxLength={6}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleEnableConfirm} disabled={!token || token.length < 6}>Verificar e Ativar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
