import { useState, useEffect } from 'react';
import { api } from '../../../api/api';
import { getErrorMessage } from '@/lib/utils';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Eye, EyeOff, LayoutDashboard } from 'lucide-react';
import { FcGoogle } from 'react-icons/fc';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useAuth } from '../../../context/AuthContext';
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';

export const RegisterPage = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [userId, setUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [registerToken, setRegisterToken] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const emailParam = params.get('email');
    const nameParam = params.get('username') || params.get('name');
    const tokenParam = params.get('googleToken');

    if (emailParam) setEmail(emailParam);
    if (nameParam) setUsername(nameParam);
    if (tokenParam) setRegisterToken(tokenParam);
  }, [location]);

  const handleCapsLock = (e: React.KeyboardEvent) => {
    setIsCapsLockOn(e.getModifierState('CapsLock'));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (password !== confirmPassword) {
      setError('As senhas precisam ser iguais');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload: any = { username, email, password, fullName, birthDate };
      if (registerToken) payload.registerToken = registerToken;

      const res = await api.post('/auth/register', payload);

      if (res.data.requiresEmailVerification === false) {
        // Log in directly if verified by Google
        // We need to login user here. Does register return token? No.
        // We need to auto-login.
        // If register returns message only, we can't login.
        // But wait, my register logic in AuthService:
        // if (isVerified) { markVerified... }
        // It returns { message, requiresEmailVerification: false, ... }

        // I should probably change register to return access_token if verified?
        // Or call login endpoint automatically?
        // Let's call login endpoint.
        const loginRes = await api.post('/auth/login', { username, password });
        login(loginRes.data.access_token, { username });
        navigate('/', { state: { message: 'Cadastro via Google concluído!' } });
      } else {
        setUserId(res.data.userId);
        setIsVerifying(true);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Falha no cadastro. Tente novamente.'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || loading) return;

    setLoading(true);
    setError('');

    try {
      const res = await api.post('/auth/verify-email', { userId, token: verificationCode });
      login(res.data.access_token, { username });
      navigate('/', { state: { message: 'Conta verificada com sucesso!' } });
    } catch (err) {
      setError('Código inválido ou expirado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
            <LayoutDashboard size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">FinanceApp</h1>
        </div>
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-center text-2xl font-bold">
              {isVerifying ? 'Verificar Email' : 'Cadastro'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {error && <div className="mb-4 rounded bg-red-100 p-2 text-sm text-red-600">{error}</div>}

            {isVerifying ? (
              <form onSubmit={handleVerification} className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm text-gray-600 text-center">
                    Enviamos um código de verificação para <strong>{email}</strong>.
                  </p>
                  <Label htmlFor="code">Código de Verificação</Label>
                  <Input
                    id="code"
                    type="text"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    placeholder="000000"
                    className="text-center text-lg tracking-widest"
                    maxLength={6}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Verificando...' : 'Verificar e Entrar'}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Usuário</Label>
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
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
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nome Completo (Opcional)</Label>
                  <Input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Seu Nome Completo"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="birthDate">Data de Nascimento (Opcional)</Label>
                  <Input
                    id="birthDate"
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
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
                <PasswordStrengthIndicator password={password} />
                <div className="space-y-2 relative">
                  <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700 focus:outline-none"
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Criando Conta...' : 'Criar Conta'}
                </Button>
              </form>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            {!isVerifying && (
              <>
                <div className="relative w-full">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-gray-500">Ou continue com</span>
                  </div>
                </div>

                <a
                  href={`${(import.meta as any).env?.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000`}/auth/google`}
                  className="flex w-full items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  <FcGoogle className="h-5 w-5" />
                  Google
                </a>

                <p className="text-sm text-gray-600 text-center">
                  Já tem uma conta?{' '}
                  <Link to="/login" className="text-blue-600 hover:underline">
                    Entrar
                  </Link>
                </p>
              </>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};
