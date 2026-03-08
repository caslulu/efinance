import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { api } from '../../../api/api';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, Lock } from 'lucide-react';
import { FcGoogle } from 'react-icons/fc';

const defaultApiUrl = `${window.location.protocol}//${window.location.hostname}:3000`;
const authBaseUrl = (import.meta.env.VITE_API_URL || defaultApiUrl).replace(/\/+$/, '');

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
  const [loading, setLoading] = useState(false);

  const processedParams = useRef(false);

  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isAuthenticated || processedParams.current) return;

    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    const userIdParam = params.get('userId');
    const requires2FAParam = params.get('requires2FA');

    if (token) {
      processedParams.current = true;
      login(token, { username: 'Usuário' });
      navigate('/', { replace: true });
    } else if (requires2FAParam === 'true' && userIdParam) {
      processedParams.current = true;
      setRequires2FA(true);
      setUserId(Number(userIdParam));
      setSuccess('Verificação em duas etapas necessária.');
      window.history.replaceState({}, document.title, location.pathname);
    }
  }, [location.search, isAuthenticated, login, navigate]);

  useEffect(() => {
    if (location.state?.message) {
      setSuccess(location.state.message);
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  useEffect(() => {
    if (!requires2FA || canResend) return;

    const interval = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [requires2FA, canResend]);

  const handleResend = async () => {
    if (!userId) return;
    setCanResend(false);
    setResendTimer(30);
    setError('');
    try {
      await api.post('/auth/2fa/resend', { userId });
      setSuccess('Novo código enviado para seu email.');
    } catch {
      setError('Falha ao reenviar código. Tente novamente.');
    }
  };

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
        login(res.data.access_token, { username }, rememberMe);
      } catch (err) {
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
        login(res.data.access_token, { username }, rememberMe);
      }
    } catch (err) {
      setError('Falha no login. Verifique suas credenciais.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');

        @keyframes login-float-slow {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(3deg); }
        }
        @keyframes login-float-medium {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-15px) rotate(-2deg); }
        }
        @keyframes login-pulse-glow {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }
        @keyframes login-slide-up {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes login-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .login-page { font-family: 'DM Sans', system-ui, sans-serif; }
        .login-display { font-family: 'Instrument Serif', 'Georgia', serif; }

        .login-float-slow { animation: login-float-slow 8s ease-in-out infinite; }
        .login-float-medium { animation: login-float-medium 6s ease-in-out infinite; }
        .login-pulse-glow { animation: login-pulse-glow 4s ease-in-out infinite; }

        .login-slide-up { animation: login-slide-up 0.6s ease-out forwards; }
        .login-slide-up-d1 { animation: login-slide-up 0.6s ease-out 0.1s forwards; opacity: 0; }
        .login-slide-up-d2 { animation: login-slide-up 0.6s ease-out 0.2s forwards; opacity: 0; }
        .login-slide-up-d3 { animation: login-slide-up 0.6s ease-out 0.3s forwards; opacity: 0; }
        .login-slide-up-d4 { animation: login-slide-up 0.6s ease-out 0.4s forwards; opacity: 0; }
        .login-fade-in { animation: login-fade-in 1s ease-out forwards; }
        .login-fade-in-d1 { animation: login-fade-in 1s ease-out 0.2s forwards; opacity: 0; }
        .login-fade-in-d2 { animation: login-fade-in 1s ease-out 0.4s forwards; opacity: 0; }

        .login-input {
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
        .login-input::placeholder { color: rgba(255, 255, 255, 0.2); }
        .login-input:focus {
          border-color: #34d399;
          background: rgba(52, 211, 153, 0.04);
          box-shadow: 0 0 0 3px rgba(52, 211, 153, 0.08);
        }

        .login-submit {
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
        .login-submit:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 8px 25px rgba(16, 185, 129, 0.3);
        }
        .login-submit:active:not(:disabled) { transform: translateY(0); }
        .login-submit:disabled { opacity: 0.5; cursor: not-allowed; }

        .login-google {
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
        .login-google:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.18);
        }
      `}</style>

      <div className="login-page flex min-h-screen">
        {/* ── Left Panel — Decorative (lg+ only) ── */}
        <div
          className="hidden lg:flex lg:w-[55%] relative overflow-hidden items-center justify-center"
          style={{ background: 'linear-gradient(145deg, #022c22, #064e3b, #065f46)' }}
        >
          {/* Noise texture */}
          <div
            className="absolute inset-0 opacity-[0.15] pointer-events-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`,
            }}
          />

          {/* Grid overlay */}
          <div
            className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
              backgroundSize: '60px 60px',
            }}
          />

          {/* Floating shapes */}
          <div className="absolute top-[12%] left-[8%] w-36 h-36 rounded-full border border-emerald-400/10 login-float-slow" />
          <div className="absolute top-[55%] right-[12%] w-52 h-52 rounded-full border border-emerald-300/[0.06] login-float-medium" />
          <div className="absolute bottom-[18%] left-[22%] w-20 h-20 rounded-full bg-emerald-400/5 login-pulse-glow" />
          <div className="absolute top-[28%] right-[22%] w-72 h-72 rounded-full bg-emerald-500/[0.03] blur-3xl" />
          <div className="absolute bottom-[35%] left-[38%] w-44 h-44 rounded-full bg-teal-400/5 blur-2xl login-float-slow" />

          {/* Diagonal accent line */}
          <div
            className="absolute w-[1px] h-[140%] bg-gradient-to-b from-transparent via-emerald-400/10 to-transparent -rotate-[25deg] right-[30%] -top-[20%]"
          />

          {/* Branding content */}
          <div className="relative z-10 px-16 max-w-xl">
            <div className="mb-10 flex items-center gap-4 login-fade-in">
              <div className="w-14 h-14 rounded-2xl overflow-hidden shadow-2xl border border-emerald-400/20">
                <img src="/logo.png" alt="" className="w-full h-full object-cover scale-[2.2]" />
              </div>
            </div>

            <h1 className="login-display text-[3.5rem] text-white/90 leading-[1.08] mb-6 login-fade-in">
              Suas finanças,
              <br />
              <span className="italic text-emerald-300/80">simplificadas.</span>
            </h1>

            <p className="text-white/35 text-lg leading-relaxed max-w-sm login-fade-in-d1">
              Controle total sobre seus gastos, investimentos e metas financeiras em um só lugar.
            </p>

            <div className="mt-14 flex items-center gap-3 login-fade-in-d2">
              <div className="w-12 h-px bg-emerald-400/25" />
              <span className="text-emerald-400/35 text-[11px] tracking-[0.35em] uppercase">
                Finance Pro
              </span>
            </div>
          </div>
        </div>

        {/* ── Right Panel — Form ── */}
        <div
          className="flex-1 flex items-center justify-center px-6 py-12 relative"
          style={{ background: 'linear-gradient(180deg, #0a0a0a, #111111)' }}
        >
          {/* Top glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-32 bg-emerald-500/5 blur-3xl pointer-events-none" />

          <div className="w-full max-w-[380px] relative">
            {/* Mobile logo */}
            <div className="lg:hidden flex items-center justify-center mb-10 login-slide-up">
              <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-2xl border border-emerald-400/20">
                <img src="/logo.png" alt="Finance Pro" className="w-full h-full object-cover scale-[2.2]" />
              </div>
            </div>

            <div className="login-slide-up">
              <h2 className="login-display text-[1.85rem] text-white/90 mb-1">
                {requires2FA ? 'Verificação' : 'Bem-vindo de volta'}
              </h2>
              <p className="text-white/30 text-sm mb-8">
                {requires2FA
                  ? 'Digite o código enviado para seu email'
                  : 'Entre na sua conta para continuar'}
              </p>
            </div>

            {success && (
              <div className="mb-5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm text-emerald-300 login-slide-up-d1">
                {success}
              </div>
            )}
            {error && (
              <div className="mb-5 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-300 login-slide-up-d1">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {!requires2FA ? (
                <>
                  {/* Username / Email */}
                  <div className="space-y-2 login-slide-up-d1">
                    <label
                      htmlFor="username"
                      className="text-[11px] font-medium text-white/40 uppercase tracking-wider"
                    >
                      Usuário ou Email
                    </label>
                    <input
                      id="username"
                      type="text"
                      className="login-input"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="seu@email.com"
                      required
                    />
                  </div>

                  {/* Password */}
                  <div className="space-y-2 login-slide-up-d2">
                    <div className="flex justify-between items-center">
                      <label
                        htmlFor="password"
                        className="text-[11px] font-medium text-white/40 uppercase tracking-wider"
                      >
                        Senha
                      </label>
                      <Link
                        to="/forgot-password"
                        className="text-[11px] text-emerald-400/50 hover:text-emerald-400 transition-colors"
                      >
                        Esqueceu?
                      </Link>
                    </div>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        className="login-input"
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

                  {/* Remember me */}
                  <div className="flex items-center gap-2.5 login-slide-up-d3">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={rememberMe}
                      onClick={() => setRememberMe(!rememberMe)}
                      className={`w-[15px] h-[15px] rounded border transition-all flex items-center justify-center flex-shrink-0 ${
                        rememberMe
                          ? 'bg-emerald-500 border-emerald-500'
                          : 'border-white/15 hover:border-white/25'
                      }`}
                    >
                      {rememberMe && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path
                            d="M1 4L3.5 6.5L9 1"
                            stroke="white"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </button>
                    <span
                      className="text-sm text-white/30 cursor-pointer select-none"
                      onClick={() => setRememberMe(!rememberMe)}
                    >
                      Lembrar-me
                    </span>
                  </div>
                </>
              ) : (
                /* 2FA code entry */
                <div className="space-y-4 login-slide-up-d1">
                  <div className="space-y-2">
                    <label
                      htmlFor="2fa"
                      className="text-[11px] font-medium text-white/40 uppercase tracking-wider"
                    >
                      Código de Verificação
                    </label>
                    <input
                      id="2fa"
                      type="text"
                      className="login-input"
                      style={{ textAlign: 'center', fontSize: 20, letterSpacing: '0.3em' }}
                      value={twoFactorToken}
                      onChange={(e) => setTwoFactorToken(e.target.value)}
                      placeholder="000000"
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
                      className="text-sm text-emerald-400/60 hover:text-emerald-400 transition-colors disabled:text-white/20 disabled:cursor-not-allowed"
                    >
                      {canResend ? 'Reenviar código' : `Reenviar em ${resendTimer}s`}
                    </button>
                  </div>
                </div>
              )}

              {/* Submit */}
              <div className="pt-2 login-slide-up-d3">
                <button type="submit" className="login-submit" disabled={loading}>
                  <span className="flex items-center justify-center gap-2">
                    {loading
                      ? 'Processando...'
                      : requires2FA
                        ? 'Verificar'
                        : 'Entrar'}
                    {!loading && <ArrowRight size={16} />}
                  </span>
                </button>
              </div>
            </form>

            {!requires2FA && (
              <>
                {/* Divider */}
                <div className="relative my-7 login-slide-up-d4">
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
                  className="login-google login-slide-up-d4"
                >
                  <FcGoogle className="w-[18px] h-[18px]" />
                  <span>Continuar com Google</span>
                </a>

                {/* Register link */}
                <p className="mt-8 text-center text-sm text-white/25 login-slide-up-d4">
                  Não tem uma conta?{' '}
                  <Link
                    to="/register"
                    className="text-emerald-400/70 hover:text-emerald-400 transition-colors"
                  >
                    Criar conta
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
