import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { Radio, Building2, User, Mail, Lock, ArrowRight, ShieldCheck } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const schema = z.object({
  name: z.string().min(2, "Name is required"),
  companyName: z.string().min(2, "Organization Name is required"),
  email: z.string().email("Invalid corporate email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"]
});

const Register = () => {
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema)
  });

  const onSubmit = async (data) => {
    try {
      setError('');
      const res = await api.post('/auth/register', data);
      login(res.data.data);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#07090E] text-slate-100 relative overflow-hidden px-4 py-12">
      {/* Background Neon Glow Orbs */}
      <div className="absolute top-1/3 -left-20 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-1/3 -right-20 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-lg relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-slate-950 mb-4 shadow-[0_0_30px_rgba(6,182,212,0.4)]">
            <Radio className="w-8 h-8 animate-pulse text-slate-950" />
          </div>
          <h1 className="text-2xl font-bold tracking-wider font-sans bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
            FLEETCORE
          </h1>
          <p className="text-xs font-mono text-cyan-400/80 mt-1 uppercase tracking-widest">
            Enterprise Fleet Provisioning
          </p>
        </div>

        {/* Glassmorphic Registration Card */}
        <div className="glass-panel rounded-3xl p-8 border border-slate-800/90 shadow-2xl relative">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-white font-sans">Register New Organization</h2>
            <p className="text-xs text-slate-400 font-sans mt-0.5">Deploy dedicated fleet tenant with telemetry stream</p>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-sans flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-1.5 font-medium">Administrator Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text" 
                    {...register('name')} 
                    placeholder="Jane Doe"
                    className="w-full glass-input rounded-xl pl-10 pr-3 py-2.5 text-sm text-white placeholder-slate-600 font-sans" 
                  />
                </div>
                {errors.name && <p className="mt-1 text-[11px] text-rose-400 font-mono">{errors.name.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-1.5 font-medium">Company / Fleet Name</label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text" 
                    {...register('companyName')} 
                    placeholder="Logistics Corp"
                    className="w-full glass-input rounded-xl pl-10 pr-3 py-2.5 text-sm text-white placeholder-slate-600 font-sans" 
                  />
                </div>
                {errors.companyName && <p className="mt-1 text-[11px] text-rose-400 font-mono">{errors.companyName.message}</p>}
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-slate-400 mb-1.5 font-medium">Corporate Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input 
                  type="email" 
                  {...register('email')} 
                  placeholder="admin@organization.com"
                  className="w-full glass-input rounded-xl pl-10 pr-3 py-2.5 text-sm text-white placeholder-slate-600 font-sans" 
                />
              </div>
              {errors.email && <p className="mt-1 text-[11px] text-rose-400 font-mono">{errors.email.message}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-1.5 font-medium">Password</label>
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

              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-1.5 font-medium">Confirm Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input 
                    type="password" 
                    {...register('confirmPassword')} 
                    placeholder="••••••••"
                    className="w-full glass-input rounded-xl pl-10 pr-3 py-2.5 text-sm text-white placeholder-slate-600 font-sans" 
                  />
                </div>
                {errors.confirmPassword && <p className="mt-1 text-[11px] text-rose-400 font-mono">{errors.confirmPassword.message}</p>}
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting} 
              className="w-full mt-4 py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-sm shadow-[0_0_25px_-5px_rgba(6,182,212,0.5)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                  <span>PROVISIONING TENANT...</span>
                </>
              ) : (
                <>
                  <span>CREATE ORGANIZATION</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer info */}
        <div className="text-center mt-6 text-xs text-slate-400">
          Already registered?{' '}
          <Link to="/login" className="text-cyan-400 hover:text-cyan-300 font-semibold underline underline-offset-4">
            Sign in to existing account
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
