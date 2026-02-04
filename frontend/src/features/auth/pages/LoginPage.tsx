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
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    const userIdParam = params.get('userId');
    const requires2FAParam = params.get('requires2FA');

    if (token) {
      login(token, { username: 'Usuário' }); 
      navigate('/');
    } else if (requires2FAParam === 'true' && userIdParam) {
      setRequires2FA(true);
      setUserId(Number(userIdParam));
      setSuccess('Verificação em duas etapas necessária.');
      window.history.replaceState({}, document.title, location.pathname);
    }
  }, [location, login, navigate]);

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
            <>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-gray-500">Ou continue com</span>
                </div>
              </div>

              <a
                className="flex w-full items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Google
              </a>

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
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};