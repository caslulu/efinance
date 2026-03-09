import { useState, useEffect, useMemo } from 'react';
import { api } from '../../../api/api';
import { getErrorMessage } from '@/lib/utils';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, Lock, UserPlus } from 'lucide-react';
import { FcGoogle } from 'react-icons/fc';
import { useAuth } from '../../../context/AuthContext';

const defaultApiUrl = `${window.location.protocol}//${window.location.hostname}:3000`;
const authBaseUrl = (import.meta.env.VITE_API_URL || defaultApiUrl).replace(/\/+$/, '');

const getStrength = (password: string) => {
  if (!password) return { score: 0, label: '', color: '' };
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  if (score <= 1) return { score: 1, label: 'Fraca', color: 'bg-red-500' };
  if (score <= 2) return { score: 2, label: 'Média', color: 'bg-orange-500' };
  if (score <= 3) return { score: 3, label: 'Forte', color: 'bg-yellow-500' };
  return { score: 4, label: 'Muito Forte', color: 'bg-emerald-500' };
};

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

  const strength = useMemo(() => getStrength(password), [password]);

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
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');

        @keyframes reg-float-slow {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(3deg); }
        }
        @keyframes reg-float-medium {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-15px) rotate(-2deg); }
        }
        @keyframes reg-pulse-glow {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }
        @keyframes reg-slide-up {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes reg-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .reg-page { font-family: 'DM Sans', system-ui, sans-serif; }
        .reg-display { font-family: 'Instrument Serif', 'Georgia', serif; }

        .reg-float-slow { animation: reg-float-slow 8s ease-in-out infinite; }
        .reg-float-medium { animation: reg-float-medium 6s ease-in-out infinite; }
        .reg-pulse-glow { animation: reg-pulse-glow 4s ease-in-out infinite; }

        .reg-slide-up { animation: reg-slide-up 0.6s ease-out forwards; }
        .reg-slide-up-d1 { animation: reg-slide-up 0.6s ease-out 0.1s forwards; opacity: 0; }
        .reg-slide-up-d2 { animation: reg-slide-up 0.6s ease-out 0.2s forwards; opacity: 0; }
        .reg-slide-up-d3 { animation: reg-slide-up 0.6s ease-out 0.3s forwards; opacity: 0; }
        .reg-slide-up-d4 { animation: reg-slide-up 0.6s ease-out 0.4s forwards; opacity: 0; }
        .reg-fade-in { animation: reg-fade-in 1s ease-out forwards; }
        .reg-fade-in-d1 { animation: reg-fade-in 1s ease-out 0.2s forwards; opacity: 0; }
        .reg-fade-in-d2 { animation: reg-fade-in 1s ease-out 0.4s forwards; opacity: 0; }

        .reg-input {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 14px 16px;
          color: #f0f0f0;
          font-size: 15px;
          transition: all 0.3s ease;
          width: 100%;
          outline: none;
          font-family: 'DM Sans', system-ui, sans-serif;
        }
        .reg-input::placeholder { color: rgba(255, 255, 255, 0.2); }
        .reg-input:focus {
          border-color: #34d399;
          background: rgba(52, 211, 153, 0.04);
          box-shadow: 0 0 0 3px rgba(52, 211, 153, 0.08);
        }

        .reg-submit {
          background: linear-gradient(135deg, #059669, #10b981);
          color: white;
          border: none;
          border-radius: 12px;
          padding: 14px;
          font-size: 15px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s ease;
          width: 100%;
          font-family: 'DM Sans', system-ui, sans-serif;
        }
        .reg-submit:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 8px 25px rgba(16, 185, 129, 0.3);
        }
        .reg-submit:active:not(:disabled) { transform: translateY(0); }
        .reg-submit:disabled { opacity: 0.5; cursor: not-allowed; }

        .reg-google {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 12px;
          color: rgba(255, 255, 255, 0.8);
          font-size: 14px;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          text-decoration: none;
          font-family: 'DM Sans', system-ui, sans-serif;
        }
        .reg-google:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.18);
        }

        .reg-input[type="date"]::-webkit-calendar-picker-indicator {
          filter: invert(0.7);
        }
      `}</style>

      <div className="reg-page flex min-h-screen">
        {/* Left Panel — Decorative (lg+ only) */}
        <div
          className="hidden lg:flex lg:w-[55%] relative overflow-hidden items-center justify-center"
          style={{ background: 'linear-gradient(145deg, #022c22, #064e3b, #065f46)' }}
        >
          <div
            className="absolute inset-0 opacity-[0.15] pointer-events-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`,
            }}
          />

          <div
            className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
              backgroundSize: '60px 60px',
            }}
          />

          <div className="absolute top-[12%] left-[8%] w-36 h-36 rounded-full border border-emerald-400/10 reg-float-slow" />
          <div className="absolute top-[55%] right-[12%] w-52 h-52 rounded-full border border-emerald-300/[0.06] reg-float-medium" />
          <div className="absolute bottom-[18%] left-[22%] w-20 h-20 rounded-full bg-emerald-400/5 reg-pulse-glow" />
          <div className="absolute top-[28%] right-[22%] w-72 h-72 rounded-full bg-emerald-500/[0.03] blur-3xl" />
          <div className="absolute bottom-[35%] left-[38%] w-44 h-44 rounded-full bg-teal-400/5 blur-2xl reg-float-slow" />

          <div
            className="absolute w-[1px] h-[140%] bg-gradient-to-b from-transparent via-emerald-400/10 to-transparent -rotate-[25deg] right-[30%] -top-[20%]"
          />

          <div className="relative z-10 px-16 max-w-xl">
            <div className="mb-10 flex items-center gap-4 reg-fade-in">
              <div className="w-14 h-14 rounded-2xl overflow-hidden shadow-2xl border border-emerald-400/20">
                <img src="/logo.png" alt="" className="w-full h-full object-cover scale-[2.2]" />
              </div>
            </div>

            <h1 className="reg-display text-[3.5rem] text-white/90 leading-[1.08] mb-6 reg-fade-in">
              Comece sua
              <br />
              <span className="italic text-emerald-300/80">jornada financeira.</span>
            </h1>

            <p className="text-white/35 text-lg leading-relaxed max-w-sm reg-fade-in-d1">
              Crie sua conta e tenha controle total sobre seus gastos, investimentos e metas.
            </p>

            <div className="mt-14 flex items-center gap-3 reg-fade-in-d2">
              <div className="w-12 h-px bg-emerald-400/25" />
              <span className="text-emerald-400/35 text-[11px] tracking-[0.35em] uppercase">
                Finance Pro
              </span>
            </div>
          </div>
        </div>

        {/* Right Panel — Form */}
        <div
          className="flex-1 flex items-center justify-center px-6 py-12 relative"
          style={{ background: 'linear-gradient(180deg, #0a0a0a, #111111)' }}
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-32 bg-emerald-500/5 blur-3xl pointer-events-none" />

          <div className="w-full max-w-[400px] relative">
            {/* Mobile logo */}
            <div className="lg:hidden flex items-center justify-center mb-10 reg-slide-up">
              <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-2xl border border-emerald-400/20">
                <img src="/logo.png" alt="Finance Pro" className="w-full h-full object-cover scale-[2.2]" />
              </div>
            </div>

            <div className="reg-slide-up">
              <h2 className="reg-display text-[1.85rem] text-white/90 mb-1">
                {isVerifying ? 'Verificação' : 'Criar conta'}
              </h2>
              <p className="text-white/30 text-sm mb-8">
                {isVerifying
                  ? 'Digite o código enviado para seu email'
                  : 'Preencha os dados para começar'}
              </p>
            </div>

            {error && (
              <div className="mb-5 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-300 reg-slide-up-d1">
                {error}
              </div>
            )}

            {isVerifying ? (
              <form onSubmit={handleVerification} className="space-y-5">
                <div className="space-y-4 reg-slide-up-d1">
                  <p className="text-sm text-white/40 text-center">
                    Enviamos um código de verificação para <span className="text-emerald-300/80">{email}</span>.
                  </p>
                  <div className="space-y-2">
                    <label htmlFor="code" className="text-[11px] font-medium text-white/40 uppercase tracking-wider">
                      Código de Verificação
                    </label>
                    <input
                      id="code"
                      type="text"
                      className="reg-input"
                      style={{ textAlign: 'center', fontSize: 20, letterSpacing: '0.3em' }}
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                      placeholder="000000"
                      maxLength={6}
                      required
                      autoFocus
                    />
                  </div>
                </div>
                <div className="pt-2 reg-slide-up-d2">
                  <button type="submit" className="reg-submit" disabled={loading}>
                    <span className="flex items-center justify-center gap-2">
                      {loading ? 'Verificando...' : 'Verificar e Entrar'}
                      {!loading && <ArrowRight size={16} />}
                    </span>
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Username */}
                <div className="space-y-2 reg-slide-up-d1">
                  <label htmlFor="username" className="text-[11px] font-medium text-white/40 uppercase tracking-wider">
                    Usuário
                  </label>
                  <input
                    id="username"
                    type="text"
                    className="reg-input"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="seu_usuario"
                    required
                  />
                </div>

                {/* Email */}
                <div className="space-y-2 reg-slide-up-d1">
                  <label htmlFor="email" className="text-[11px] font-medium text-white/40 uppercase tracking-wider">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    className="reg-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                  />
                </div>

                {/* Full Name */}
                <div className="space-y-2 reg-slide-up-d2">
                  <label htmlFor="fullName" className="text-[11px] font-medium text-white/40 uppercase tracking-wider">
                    Nome Completo <span className="text-white/20 normal-case tracking-normal">(opcional)</span>
                  </label>
                  <input
                    id="fullName"
                    type="text"
                    className="reg-input"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Seu nome completo"
                  />
                </div>

                {/* Birth Date */}
                <div className="space-y-2 reg-slide-up-d2">
                  <label htmlFor="birthDate" className="text-[11px] font-medium text-white/40 uppercase tracking-wider">
                    Data de Nascimento <span className="text-white/20 normal-case tracking-normal">(opcional)</span>
                  </label>
                  <input
                    id="birthDate"
                    type="date"
                    className="reg-input"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                  />
                </div>

                {/* Password */}
                <div className="space-y-2 reg-slide-up-d3">
                  <label htmlFor="password" className="text-[11px] font-medium text-white/40 uppercase tracking-wider">
                    Senha
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      className="reg-input"
                      style={{ paddingRight: 44 }}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={handleCapsLock}
                      onKeyUp={handleCapsLock}
                      onFocus={() => setIsPasswordFocused(true)}
                      onBlur={() => setIsPasswordFocused(false)}
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-4 text-white/20 hover:text-white/50 transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {isCapsLockOn && isPasswordFocused && (
                    <p className="text-xs text-amber-400/80 flex items-center gap-1.5 mt-1">
                      <Lock size={11} />
                      Caps Lock ativado
                    </p>
                  )}
                </div>

                {/* Password Strength */}
                {password && (
                  <div className="space-y-1.5 reg-slide-up-d3">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((level) => (
                        <div
                          key={level}
                          className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                            level <= strength.score ? strength.color : 'bg-white/[0.06]'
                          }`}
                        />
                      ))}
                    </div>
                    <p className={`text-xs font-medium ${
                      strength.score <= 1 ? 'text-red-400' :
                      strength.score <= 2 ? 'text-orange-400' :
                      strength.score <= 3 ? 'text-yellow-400' : 'text-emerald-400'
                    }`}>
                      Força: {strength.label}
                    </p>
                  </div>
                )}

                {/* Confirm Password */}
                <div className="space-y-2 reg-slide-up-d3">
                  <label htmlFor="confirmPassword" className="text-[11px] font-medium text-white/40 uppercase tracking-wider">
                    Confirmar Senha
                  </label>
                  <div className="relative">
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      className="reg-input"
                      style={{ paddingRight: 44 }}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-4 text-white/20 hover:text-white/50 transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Submit */}
                <div className="pt-2 reg-slide-up-d4">
                  <button type="submit" className="reg-submit" disabled={loading}>
                    <span className="flex items-center justify-center gap-2">
                      {loading ? 'Criando Conta...' : 'Criar Conta'}
                      {!loading && <UserPlus size={16} />}
                    </span>
                  </button>
                </div>
              </form>
            )}

            {!isVerifying && (
              <>
                {/* Divider */}
                <div className="relative my-7 reg-slide-up-d4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/[0.06]" />
                  </div>
                  <div className="relative flex justify-center">
                    <span
                      className="px-4 text-[11px] text-white/20 uppercase tracking-widest"
                      style={{ background: '#0e0e0e' }}
                    >
                      ou
                    </span>
                  </div>
                </div>

                {/* Google OAuth */}
                <a
                  href={`${authBaseUrl}/auth/google`}
                  className="reg-google reg-slide-up-d4"
                >
                  <FcGoogle className="w-[18px] h-[18px]" />
                  <span>Continuar com Google</span>
                </a>

                {/* Login link */}
                <p className="mt-8 text-center text-sm text-white/25 reg-slide-up-d4">
                  Já tem uma conta?{' '}
                  <Link
                    to="/login"
                    className="text-emerald-400/70 hover:text-emerald-400 transition-colors"
                  >
                    Entrar
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
