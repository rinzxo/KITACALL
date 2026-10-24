import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Radio, ShieldCheck, LockKey } from '@phosphor-icons/react';

interface LoginPageProps {
  onLoginSuccess: (user: {
    userId: string;
    userName: string;
    email: string;
    avatarUrl?: string | null;
  }) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [isLoadingEmail, setIsLoadingEmail] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 1. Google OAuth Login (Otentikasi Resmi Supabase)
  const handleGoogleLogin = async () => {
    try {
      setIsLoadingGoogle(true);
      setErrorMsg('');
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err: any) {
      console.error('[Google Login Error]:', err);
      setErrorMsg(err.message || 'Gagal masuk dengan Google.');
      setIsLoadingGoogle(false);
    }
  };

  // 2. Email / Password Login (Otentikasi Resmi Supabase)
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    try {
      setIsLoadingEmail(true);
      setErrorMsg('');
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password
      });

      if (error) throw error;

      if (data.user) {
        onLoginSuccess({
          userId: data.user.id,
          userName: data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || 'Pengguna',
          email: data.user.email || '',
          avatarUrl: data.user.user_metadata?.avatar_url || null
        });
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Email atau kata sandi tidak sesuai.');
    } finally {
      setIsLoadingEmail(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 font-sans selection:bg-cyan-500 selection:text-slate-950 relative overflow-hidden">
      {/* Subtle Ambient Brand Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <img
            src="/KitaCall%20Transparan.png"
            alt="KitaCall"
            className="w-16 h-16 object-contain mx-auto mb-3 drop-shadow-[0_0_20px_rgba(0,196,251,0.4)]"
          />
          <h1 className="text-2xl font-black text-white font-tactical tracking-wide">
            Kita<span className="text-cyan-400">Call</span>
          </h1>
          <p className="text-xs text-slate-400 font-mono-lcd mt-1">
            Transceiver Komunikasi Taktis
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl backdrop-blur-md">
          {errorMsg && (
            <div className="mb-4 text-xs font-semibold text-rose-400 bg-rose-950/40 border border-rose-800/60 p-3 rounded-xl flex items-center gap-2">
              <LockKey size={16} weight="bold" className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Google Login Button */}
          <button
            onClick={handleGoogleLogin}
            disabled={isLoadingGoogle}
            type="button"
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white hover:bg-slate-100 rounded-xl text-slate-900 font-bold text-xs shadow-md transition-all disabled:opacity-50 active:scale-[0.98]"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
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
            <span>{isLoadingGoogle ? 'Menghubungkan...' : 'Masuk dengan Google'}</span>
          </button>

          {/* Divider */}
          <div className="my-4 relative flex items-center justify-center">
            <div className="border-t border-slate-800 w-full" />
            <span className="bg-slate-900 px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest absolute font-mono-lcd">
              atau email
            </span>
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleEmailLogin} className="space-y-3">
            <div>
              <label className="block text-slate-400 text-[10px] font-extrabold uppercase tracking-wider mb-1 font-mono-lcd">
                Alamat Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-medium text-white placeholder-slate-600 focus:outline-hidden focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
              />
            </div>

            <div>
              <label className="block text-slate-400 text-[10px] font-extrabold uppercase tracking-wider mb-1 font-mono-lcd">
                Kata Sandi
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-medium text-white placeholder-slate-600 focus:outline-hidden focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={isLoadingEmail}
              className="w-full mt-2 py-3 bg-gradient-to-r from-[#0087FF] to-[#01C4FB] hover:from-[#0077E6] hover:to-[#00B5EA] text-white font-extrabold text-xs rounded-xl shadow-[0_0_20px_rgba(0,135,255,0.35)] transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{isLoadingEmail ? 'Memverifikasi...' : 'Masuk ke Akun'}</span>
            </button>
          </form>
        </div>

        {/* Minimal Footer */}
        <p className="text-[10px] text-slate-600 text-center mt-5 font-mono-lcd tracking-wider">
          KITACALL NETWORK • TACTICAL TRANSCEIVER
        </p>
      </div>
    </div>
  );
};
