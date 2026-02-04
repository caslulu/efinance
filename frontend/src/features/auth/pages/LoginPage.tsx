import { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { api } from '../../../api/api';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

export const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [requires2FA, setRequires2FA] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const [resendDelay, setResendDelay] = useState(30);
  const [loading, setLoading] = useState(false);
  
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (requires2FA && resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    } else if (resendTimer === 0) {
      setCanResend(true);
    }
    return () => clearInterval(interval);
  }, [requires2FA, resendTimer]);

  const handleResend = async () => {
    setCanResend(false);
    const newDelay = resendDelay + 30;
    setResendDelay(newDelay);
    setResendTimer(newDelay);
    
    try {
      await api.post('/auth/2fa/resend', { userId });
      setSuccess('Novo código enviado.');
    } catch (err) {
      setError('Falha ao reenviar código.');
    }
  };

  useEffect(() => {
    if (location.state?.message) {
      setSuccess(location.state.message);
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleCapsLock = (e: React.KeyboardEvent) => {
    setIsCapsLockOn(e.getModifierState('CapsLock'));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setError('');
    setSuccess('');
    setLoading(true);
    
    if (requires2FA) {
      try {
        const res = await api.post('/auth/2fa/login', { userId, token: twoFactorToken, rememberMe });
        login(res.data.access_token, { username });
      } catch (err: any) {
        setError('Código 2FA inválido.');
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const res = await api.post('/auth/login', { username, password, rememberMe });
      if (res.data.requires2FA) {
        setRequires2FA(true);
        setUserId(res.data.id);
        setSuccess('Um código de verificação foi enviado para seu email.');
      } else {
        login(res.data.access_token, { username });
      }
    } catch (err: any) {
      setError('Falha no login. Verifique suas credenciais.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-2xl font-bold">
            {requires2FA ? 'Código de Verificação' : 'Entrar'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {success && <div className="mb-4 rounded bg-green-100 p-2 text-sm text-green-700">{success}</div>}
          {error && <div className="mb-4 rounded bg-red-100 p-2 text-sm text-red-600">{error}</div>}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {!requires2FA ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="username">Usuário ou Email</Label>
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2 relative">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={handleCapsLock}
                      onKeyUp={handleCapsLock}
                      onFocus={() => setIsPasswordFocused(true)}
                      onBlur={() => setIsPasswordFocused(false)}
                      className="pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700 focus:outline-none"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {isCapsLockOn && isPasswordFocused && (
                    <p className="absolute -bottom-5 left-0 text-xs font-semibold text-orange-600">
                      Caps Lock ativado
                    </p>
                  )}
                </div>
                
                <div className="flex items-center space-x-2 py-2">
                  <Checkbox 
                    id="rememberMe" 
                    checked={rememberMe} 
                    onCheckedChange={(checked) => setRememberMe(!!checked)} 
                  />
                  <label
                    htmlFor="rememberMe"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    Lembrar-me
                  </label>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="2fa">Código Recebido por Email</Label>
                  <Input
                    id="2fa"
                    type="text"
                    value={twoFactorToken}
                    onChange={(e) => setTwoFactorToken(e.target.value)}
                    placeholder="000000"
                    className="text-center text-lg tracking-widest"
                    maxLength={6}
                    required
                    autoFocus
                  />
                </div>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={!canResend}
                    className="text-sm text-blue-600 hover:underline disabled:text-gray-400 disabled:no-underline"
                  >
                    {canResend ? 'Reenviar código' : `Reenviar em ${resendTimer}s`}
                  </button>
                </div>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Processando...' : (requires2FA ? 'Verificar' : 'Entrar')}
            </Button>
          </form>
          
          {!requires2FA && (
            <div className="mt-4 text-center space-y-2">
              <div>
                <Link to="/forgot-password" size="sm" className="text-sm text-blue-600 hover:underline">
                  Esqueci minha senha
                </Link>
              </div>
              <div>
                <p className="text-sm text-gray-600">
                  Não tem uma conta?{' '}
                  <Link to="/register" className="text-blue-600 hover:underline">
                    Criar conta
                  </Link>
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
