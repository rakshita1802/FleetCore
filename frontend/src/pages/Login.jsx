import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { Radio, Lock, Mail, ArrowRight, ShieldCheck, Zap, Sparkles, KeyRound } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const schema = z.object({
  email: z.string().email("Invalid corporate email address"),
  password: z.string().min(1, "Password is required"),
});

const Login = () => {
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema)
  });

  const onSubmit = async (data) => {
    try {
      setError('');
      const res = await api.post('/auth/login', data);
      login(res.data.data);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Authentication failed. Please verify your credentials.');
    }
  };

  const handleQuickFill = (email, password) => {
    setValue('email', email);
    setValue('password', password);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#07090E] text-slate-100 relative overflow-hidden px-4 py-8">
      {/* Background Neon Glow Orbs */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-slate-950 mb-4 shadow-[0_0_30px_rgba(6,182,212,0.4)]">
            <Radio className="w-8 h-8 animate-pulse text-slate-950" />
          </div>
          <h1 className="text-2xl font-bold tracking-wider font-sans bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
            FLEETCORE
          </h1>
          <p className="text-xs font-mono text-cyan-400/80 mt-1 uppercase tracking-widest">
            Enterprise Fleet Telemetry Platform
          </p>
        </div>

        {/* Glassmorphic Auth Card */}
        <div className="glass-panel rounded-3xl p-8 border border-slate-800/90 shadow-2xl relative">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-white font-sans">Command Center Access</h2>
            <p className="text-xs text-slate-400 font-sans mt-0.5">Authenticate with your corporate credentials</p>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-sans flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label className="block text-xs font-mono uppercase text-slate-400 mb-1.5 font-medium">Corporate Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input 
                  type="email" 
                  {...register('email')} 
                  placeholder="admin@cit.edu"
                  className="w-full glass-input rounded-xl pl-10 pr-3 py-2.5 text-sm text-white placeholder-slate-600 font-sans" 
                />
              </div>
              {errors.email && <p className="mt-1 text-[11px] text-rose-400 font-mono">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-slate-400 mb-1.5 font-medium">Security Key / Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input 
                  type="password" 
                  {...register('password')} 
                  placeholder="••••••••"
                  className="w-full glass-input rounded-xl pl-10 pr-3 py-2.5 text-sm text-white placeholder-slate-600 font-sans" 
                />
              </div>
              {errors.password && <p className="mt-1 text-[11px] text-rose-400 font-mono">{errors.password.message}</p>}
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting} 
              className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-sm shadow-[0_0_25px_-5px_rgba(6,182,212,0.5)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                  <span>AUTHENTICATING...</span>
                </>
              ) : (
                <>
                  <span>INITIALIZE SESSION</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Fill Matrix */}
          <div className="mt-6 pt-5 border-t border-slate-800/80">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-cyan-400" />
                Quick Demo Access
              </span>
              <span className="text-[10px] font-mono text-cyan-400">1-CLICK LOGIN</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickFill('admin@cit.edu', 'Admin@12345')}
                className="p-2 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-cyan-500/40 text-left transition-all group"
              >
                <div className="text-[11px] font-bold text-white group-hover:text-cyan-400">Executive Admin</div>
                <div className="text-[10px] font-mono text-slate-400 truncate">admin@cit.edu</div>
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('manager@cit.edu', 'Admin@12345')}
                className="p-2 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-cyan-500/40 text-left transition-all group"
              >
                <div className="text-[11px] font-bold text-white group-hover:text-cyan-400">Fleet Manager</div>
                <div className="text-[10px] font-mono text-slate-400 truncate">manager@cit.edu</div>
              </button>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center mt-6 text-xs text-slate-400">
          Require a new enterprise tenant?{' '}
          <Link to="/register" className="text-cyan-400 hover:text-cyan-300 font-semibold underline underline-offset-4">
            Register Organization
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
