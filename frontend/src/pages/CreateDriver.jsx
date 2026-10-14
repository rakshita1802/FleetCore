import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { UserCheck, ArrowLeft, ShieldCheck, Phone, CreditCard, BadgeAlert, Sparkles, CheckCircle2 } from 'lucide-react';
import api from '../services/api';

const createDriverSchema = z.object({
  employeeCode: z.string().min(2, "Employee Code must be at least 2 characters").max(50),
  name: z.string().min(2, "Full Name is required").max(100),
  licenseNumber: z.string().min(5, "Valid Driving License Number is required").max(50),
  licenseExpiry: z.string().min(1, "License expiry date is required"),
  phone: z.string().min(8, "Valid phone number is required").max(20),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).default('ACTIVE')
});

export default function CreateDriver() {
  const navigate = useNavigate();
  const [apiError, setApiError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(createDriverSchema),
    defaultValues: {
      employeeCode: 'DRV-' + Math.floor(100 + Math.random() * 900),
      name: '',
      licenseNumber: 'TN38-' + new Date().getFullYear() + '-' + Math.floor(10000 + Math.random() * 90000),
      licenseExpiry: new Date(Date.now() + 365 * 4 * 24 * 3600 * 1000).toISOString().slice(0, 10),
      phone: '+91 9842',
      status: 'ACTIVE'
    }
  });

  const onSubmit = async (data) => {
    setApiError('');
    setSuccessMsg('');
    try {
      const payload = {
        ...data,
        licenseExpiry: new Date(data.licenseExpiry).toISOString()
      };
      const res = await api.post('/drivers', payload);
      if (res.data?.success) {
        setSuccessMsg('Driver operator enrolled successfully into fleet roster!');
        setTimeout(() => {
          navigate('/drivers');
        }, 1200);
      }
    } catch (err) {
      setApiError(err.response?.data?.message || err.response?.data?.error || 'Failed to create driver record');
    }
  };

  const handleQuickPreset = (type) => {
    if (type === 'senior') {
      setValue('name', 'P. Senthil Nathan');
      setValue('employeeCode', 'DRV-108');
      setValue('licenseNumber', 'TN37-2017-0058291');
      setValue('phone', '+91 98421 88776');
      setValue('licenseExpiry', '2029-08-15');
      setValue('status', 'ACTIVE');
    } else if (type === 'heavy') {
      setValue('name', 'R. Manickam');
      setValue('employeeCode', 'DRV-109');
      setValue('licenseNumber', 'TN38-2020-0089123');
      setValue('phone', '+91 98422 77665');
      setValue('licenseExpiry', '2030-12-31');
      setValue('status', 'ACTIVE');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Top Breadcrumb & Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link 
            to="/drivers" 
            className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <span>Enroll Commercial Driver</span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                PERSONNEL ONBOARDING
              </span>
            </h1>
            <p className="text-xs text-slate-400">Register verified driver credentials, commercial license compliance, and contact records.</p>
          </div>
        </div>

        {/* Quick Demo Pre-fill */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleQuickPreset('senior')}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-cyan-500/40 text-[11px] font-mono text-cyan-400 flex items-center gap-1.5 transition-all"
          >
            <Sparkles className="w-3 h-3 text-cyan-400" />
            <span>Preset: Senior Operator</span>
          </button>
          <button
            type="button"
            onClick={() => handleQuickPreset('heavy')}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-cyan-500/40 text-[11px] font-mono text-indigo-400 flex items-center gap-1.5 transition-all"
          >
            <Sparkles className="w-3 h-3 text-indigo-400" />
            <span>Preset: Heavy Transit</span>
          </button>
        </div>
      </div>

      {apiError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono flex items-center gap-2 animate-in fade-in">
          <BadgeAlert className="w-4 h-4 shrink-0" />
          <span>{apiError}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Glass Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="glass-panel rounded-2xl p-6 border border-slate-800/80 space-y-6 shadow-2xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Employee Code */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-medium text-slate-300 flex items-center justify-between">
              <span>EMPLOYEE BADGE CODE *</span>
              <span className="text-[10px] text-slate-500">Unique Code</span>
            </label>
            <div className="relative">
              <input
                type="text"
                {...register('employeeCode')}
                placeholder="e.g. DRV-108"
                className="w-full glass-input rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 font-mono"
              />
            </div>
            {errors.employeeCode && (
              <p className="text-[11px] text-rose-400 font-mono">{errors.employeeCode.message}</p>
            )}
          </div>

          {/* Full Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-medium text-slate-300">
              FULL LEGAL NAME *
            </label>
            <div className="relative">
              <input
                type="text"
                {...register('name')}
                placeholder="e.g. P. Senthil Nathan"
                className="w-full glass-input rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 font-sans"
              />
            </div>
            {errors.name && (
              <p className="text-[11px] text-rose-400 font-mono">{errors.name.message}</p>
            )}
          </div>

          {/* License Number */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-medium text-slate-300 flex items-center justify-between">
              <span>COMMERCIAL DRIVING LICENSE *</span>
              <span className="text-[10px] text-slate-500">RTO Format</span>
            </label>
            <div className="relative">
              <input
                type="text"
                {...register('licenseNumber')}
                placeholder="e.g. TN38-2018-0045129"
                className="w-full glass-input rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 font-mono"
              />
            </div>
            {errors.licenseNumber && (
              <p className="text-[11px] text-rose-400 font-mono">{errors.licenseNumber.message}</p>
            )}
          </div>

          {/* License Expiry */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-medium text-slate-300">
              LICENSE EXPIRY DATE *
            </label>
            <div className="relative">
              <input
                type="date"
                {...register('licenseExpiry')}
                className="w-full glass-input rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 font-mono"
              />
            </div>
            {errors.licenseExpiry && (
              <p className="text-[11px] text-rose-400 font-mono">{errors.licenseExpiry.message}</p>
            )}
          </div>

          {/* Phone Contact */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-medium text-slate-300">
              MOBILE CONTACT NUMBER *
            </label>
            <div className="relative">
              <input
                type="text"
                {...register('phone')}
                placeholder="+91 98421 12345"
                className="w-full glass-input rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 font-mono"
              />
            </div>
            {errors.phone && (
              <p className="text-[11px] text-rose-400 font-mono">{errors.phone.message}</p>
            )}
          </div>

          {/* Operator Status */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-medium text-slate-300">
              OPERATIONAL STATUS
            </label>
            <select
              {...register('status')}
              className="w-full glass-input rounded-xl px-3.5 py-2.5 text-xs text-white font-mono bg-slate-900 border border-slate-700/80"
            >
              <option value="ACTIVE" className="bg-slate-900 text-emerald-400">ACTIVE (Eligible for trip dispatch)</option>
              <option value="INACTIVE" className="bg-slate-900 text-slate-400">INACTIVE (Off-duty / On leave)</option>
              <option value="SUSPENDED" className="bg-slate-900 text-rose-400">SUSPENDED (Safety review)</option>
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 border-t border-slate-800/80 flex items-center justify-end gap-3">
          <Link
            to="/drivers"
            className="px-5 py-2.5 rounded-xl border border-slate-800 hover:border-slate-700 bg-slate-900/60 hover:bg-slate-900 text-slate-400 hover:text-white text-xs font-mono transition-all"
          >
            CANCEL
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-[0_0_20px_-3px_rgba(6,182,212,0.4)] transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                <span>ENROLLING DRIVER...</span>
              </>
            ) : (
              <>
                <UserCheck className="w-4 h-4" />
                <span>CONFIRM & ENROLL OPERATOR</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
