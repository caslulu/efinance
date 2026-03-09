import { useState } from 'react';
import { api } from '../../../api/api';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, Lock } from 'lucide-react';

export const ResetPasswordPage = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const handleCapsLock = (e: React.KeyboardEvent) => {
    setIsCapsLockOn(e.getModifierState('CapsLock'));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError('Token inválido ou ausente.');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas precisam ser iguais');
      return;
    }
    
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword: password });
      navigate('/login', { state: { message: 'Senha alterada com sucesso! Faça login.' } });
    } catch (err) {
      setError('Falha ao redefinir senha. O token pode ter expirado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');

        @keyframes reset-float-slow {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(3deg); }
        }
        @keyframes reset-float-medium {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-15px) rotate(-2deg); }
        }
        @keyframes reset-pulse-glow {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }
        @keyframes reset-slide-up {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes reset-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .reset-page { font-family: 'DM Sans', system-ui, sans-serif; }
        .reset-display { font-family: 'Instrument Serif', 'Georgia', serif; }

        .reset-float-slow { animation: reset-float-slow 8s ease-in-out infinite; }
        .reset-float-medium { animation: reset-float-medium 6s ease-in-out infinite; }
        .reset-pulse-glow { animation: reset-pulse-glow 4s ease-in-out infinite; }

        .reset-slide-up { animation: reset-slide-up 0.6s ease-out forwards; }
        .reset-slide-up-d1 { animation: reset-slide-up 0.6s ease-out 0.1s forwards; opacity: 0; }
        .reset-slide-up-d2 { animation: reset-slide-up 0.6s ease-out 0.2s forwards; opacity: 0; }
        .reset-slide-up-d3 { animation: reset-slide-up 0.6s ease-out 0.3s forwards; opacity: 0; }
        .reset-fade-in { animation: reset-fade-in 1s ease-out forwards; }
        .reset-fade-in-d1 { animation: reset-fade-in 1s ease-out 0.2s forwards; opacity: 0; }
        .reset-fade-in-d2 { animation: reset-fade-in 1s ease-out 0.4s forwards; opacity: 0; }

        .reset-input {
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
        .reset-input::placeholder { color: rgba(255, 255, 255, 0.2); }
        .reset-input:focus {
          border-color: #34d399;
          background: rgba(52, 211, 153, 0.04);
          box-shadow: 0 0 0 3px rgba(52, 211, 153, 0.08);
        }

        .reset-submit {
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
        .reset-submit:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 8px 25px rgba(16, 185, 129, 0.3);
        }
        .reset-submit:active:not(:disabled) { transform: translateY(0); }
        .reset-submit:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>

      <div className="reset-page flex min-h-screen">
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

          <div className="absolute top-[12%] left-[8%] w-36 h-36 rounded-full border border-emerald-400/10 reset-float-slow" />
          <div className="absolute top-[55%] right-[12%] w-52 h-52 rounded-full border border-emerald-300/[0.06] reset-float-medium" />
          <div className="absolute bottom-[18%] left-[22%] w-20 h-20 rounded-full bg-emerald-400/5 reset-pulse-glow" />
          <div className="absolute top-[28%] right-[22%] w-72 h-72 rounded-full bg-emerald-500/[0.03] blur-3xl" />
          <div className="absolute bottom-[35%] left-[38%] w-44 h-44 rounded-full bg-teal-400/5 blur-2xl reset-float-slow" />

          <div
            className="absolute w-[1px] h-[140%] bg-gradient-to-b from-transparent via-emerald-400/10 to-transparent -rotate-[25deg] right-[30%] -top-[20%]"
          />

          <div className="relative z-10 px-16 max-w-xl">
            <div className="mb-10 flex items-center gap-4 reset-fade-in">
              <div className="w-14 h-14 rounded-2xl overflow-hidden shadow-2xl border border-emerald-400/20">
                <img src="/logo.png" alt="" className="w-full h-full object-cover scale-[2.2]" />
              </div>
            </div>

            <h1 className="reset-display text-[3.5rem] text-white/90 leading-[1.08] mb-6 reset-fade-in">
              Nova senha,
              <br />
              <span className="italic text-emerald-300/80">novo começo.</span>
            </h1>

            <p className="text-white/35 text-lg leading-relaxed max-w-sm reset-fade-in-d1">
              Defina uma nova senha segura para proteger sua conta e seus dados financeiros.
            </p>

            <div className="mt-14 flex items-center gap-3 reset-fade-in-d2">
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

          <div className="w-full max-w-[380px] relative">
            {/* Mobile logo */}
            <div className="lg:hidden flex items-center justify-center mb-10 reset-slide-up">
              <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-2xl border border-emerald-400/20">
                <img src="/logo.png" alt="Finance Pro" className="w-full h-full object-cover scale-[2.2]" />
              </div>
            </div>

            <div className="reset-slide-up">
              <h2 className="reset-display text-[1.85rem] text-white/90 mb-1">
                Nova Senha
              </h2>
              <p className="text-white/30 text-sm mb-8">
                Defina sua nova senha de acesso
              </p>
            </div>

            {error && (
              <div className="mb-5 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-300 reset-slide-up-d1">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* New Password */}
              <div className="space-y-2 reset-slide-up-d1">
                <label
                  htmlFor="password"
                  className="text-[11px] font-medium text-white/40 uppercase tracking-wider"
                >
                  Nova Senha
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    className="reset-input"
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

              {/* Confirm Password */}
              <div className="space-y-2 reset-slide-up-d2">
                <label
                  htmlFor="confirmPassword"
                  className="text-[11px] font-medium text-white/40 uppercase tracking-wider"
                >
                  Confirmar Nova Senha
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    className="reset-input"
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

              <div className="pt-2 reset-slide-up-d3">
                <button type="submit" className="reset-submit" disabled={loading}>
                  <span className="flex items-center justify-center gap-2">
                    {loading ? 'Alterando...' : 'Alterar Senha'}
                    {!loading && <ArrowRight size={16} />}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};
