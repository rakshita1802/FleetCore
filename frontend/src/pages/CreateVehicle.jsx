import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Truck, ArrowLeft, Fuel, Gauge, Calendar, ShieldCheck, BadgeAlert, Sparkles, CheckCircle2 } from 'lucide-react';
import api from '../services/api';

const createVehicleSchema = z.object({
  registrationNumber: z.string().min(4, "Registration number is required").max(30),
  vin: z.string().optional(),
  make: z.string().min(2, "Make / Manufacturer is required").max(60),
  model: z.string().min(2, "Model is required").max(60),
  year: z.coerce.number().int().min(1990).max(new Date().getFullYear() + 1),
  vehicleType: z.enum(['CAR', 'VAN', 'TRUCK', 'BUS', 'MOTORCYCLE', 'OTHER']),
  fuelType: z.enum(['PETROL', 'DIESEL', 'CNG', 'ELECTRIC', 'HYBRID', 'OTHER']),
  status: z.enum(['ACTIVE', 'INACTIVE', 'MAINTENANCE', 'RETIRED']).default('ACTIVE'),
  odometer: z.coerce.number().min(0, "Odometer must be non-negative").default(0)
});

export default function CreateVehicle() {
  const navigate = useNavigate();
  const [apiError, setApiError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(createVehicleSchema),
    defaultValues: {
      registrationNumber: 'TN 37 ' + String.fromCharCode(65 + Math.floor(Math.random() * 26)) + String.fromCharCode(65 + Math.floor(Math.random() * 26)) + ' ' + Math.floor(1000 + Math.random() * 9000),
      vin: 'MB' + Math.floor(1000000000 + Math.random() * 9000000000),
      make: 'BharatBenz',
      model: '1617R Medium Duty Truck',
      year: new Date().getFullYear(),
      vehicleType: 'TRUCK',
      fuelType: 'DIESEL',
      status: 'ACTIVE',
      odometer: 12500
    }
  });

  const onSubmit = async (data) => {
    setApiError('');
    setSuccessMsg('');
    try {
      const res = await api.post('/vehicles', data);
      if (res.data?.success) {
        setSuccessMsg('Vehicle asset registered successfully in fleet inventory!');
        setTimeout(() => {
          navigate('/vehicles');
        }, 1200);
      }
    } catch (err) {
      setApiError(err.response?.data?.message || err.response?.data?.error || 'Failed to create vehicle');
    }
  };

  const handleQuickPreset = (type) => {
    if (type === 'bus') {
      setValue('registrationNumber', 'TN 38 BR 5520');
      setValue('vin', 'AL9920VIKING' + Math.floor(1000 + Math.random() * 9000));
      setValue('make', 'Ashok Leyland');
      setValue('model', 'Viking 55-Seater Staff Bus');
      setValue('year', 2024);
      setValue('vehicleType', 'BUS');
      setValue('fuelType', 'DIESEL');
      setValue('odometer', 35000);
      setValue('status', 'ACTIVE');
    } else if (type === 'ev') {
      setValue('registrationNumber', 'TN 37 EV 1044');
      setValue('vin', 'TMNEXON' + Math.floor(1000000 + Math.random() * 9000000));
      setValue('make', 'Tata Motors');
      setValue('model', 'Nexon EV Max Express');
      setValue('year', 2024);
      setValue('vehicleType', 'CAR');
      setValue('fuelType', 'ELECTRIC');
      setValue('odometer', 8200);
      setValue('status', 'ACTIVE');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Top Breadcrumb & Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link 
            to="/vehicles" 
            className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <span>Register New Fleet Asset</span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                ASSET ENROLLMENT
              </span>
            </h1>
            <p className="text-xs text-slate-400">Add physical vehicle inventory, manufacturer specs, and CAN bus parameters.</p>
          </div>
        </div>

        {/* Quick Demo Pre-fill */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleQuickPreset('bus')}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-cyan-500/40 text-[11px] font-mono text-cyan-400 flex items-center gap-1.5 transition-all"
          >
            <Sparkles className="w-3 h-3 text-cyan-400" />
            <span>Preset: Staff Bus</span>
          </button>
          <button
            type="button"
            onClick={() => handleQuickPreset('ev')}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-cyan-500/40 text-[11px] font-mono text-emerald-400 flex items-center gap-1.5 transition-all"
          >
            <Sparkles className="w-3 h-3 text-emerald-400" />
            <span>Preset: Campus EV</span>
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
          {/* Registration Number */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-medium text-slate-300 flex items-center justify-between">
              <span>VEHICLE REGISTRATION NUMBER *</span>
              <span className="text-[10px] text-slate-500">Official Plate</span>
            </label>
            <div className="relative">
              <input
                type="text"
                {...register('registrationNumber')}
                placeholder="e.g. TN 37 CY 4501"
                className="w-full glass-input rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 font-mono"
              />
            </div>
            {errors.registrationNumber && (
              <p className="text-[11px] text-rose-400 font-mono">{errors.registrationNumber.message}</p>
            )}
          </div>

          {/* VIN */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-medium text-slate-300 flex items-center justify-between">
              <span>CHASSIS / VIN NUMBER</span>
              <span className="text-[10px] text-slate-500">17-Digit Standard</span>
            </label>
            <div className="relative">
              <input
                type="text"
                {...register('vin')}
                placeholder="e.g. MB12617R123456789"
                className="w-full glass-input rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 font-mono"
              />
            </div>
            {errors.vin && (
              <p className="text-[11px] text-rose-400 font-mono">{errors.vin.message}</p>
            )}
          </div>

          {/* Make */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-medium text-slate-300">
              MANUFACTURER (MAKE) *
            </label>
            <input
              type="text"
              {...register('make')}
              placeholder="e.g. BharatBenz, Tata Motors, Mahindra"
              className="w-full glass-input rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 font-sans"
            />
            {errors.make && (
              <p className="text-[11px] text-rose-400 font-mono">{errors.make.message}</p>
            )}
          </div>

          {/* Model */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-medium text-slate-300">
              VEHICLE MODEL *
            </label>
            <input
              type="text"
              {...register('model')}
              placeholder="e.g. 1617R Medium Duty Truck"
              className="w-full glass-input rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 font-sans"
            />
            {errors.model && (
              <p className="text-[11px] text-rose-400 font-mono">{errors.model.message}</p>
            )}
          </div>

          {/* Manufacturing Year */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-medium text-slate-300">
              MANUFACTURING YEAR *
            </label>
            <input
              type="number"
              {...register('year')}
              placeholder="2024"
              className="w-full glass-input rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 font-mono"
            />
            {errors.year && (
              <p className="text-[11px] text-rose-400 font-mono">{errors.year.message}</p>
            )}
          </div>

          {/* Vehicle Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-medium text-slate-300">
              VEHICLE CLASSIFICATION *
            </label>
            <select
              {...register('vehicleType')}
              className="w-full glass-input rounded-xl px-3.5 py-2.5 text-xs text-white font-mono bg-slate-900 border border-slate-700/80"
            >
              <option value="TRUCK" className="bg-slate-900 text-white">TRUCK (Commercial Heavy/Medium)</option>
              <option value="BUS" className="bg-slate-900 text-white">BUS (Transit / Staff Passenger)</option>
              <option value="VAN" className="bg-slate-900 text-white">VAN (Light Delivery Cargo)</option>
              <option value="CAR" className="bg-slate-900 text-white">CAR (Passenger Sedans/EVs)</option>
              <option value="MOTORCYCLE" className="bg-slate-900 text-white">MOTORCYCLE (Express Dispatch)</option>
              <option value="OTHER" className="bg-slate-900 text-white">OTHER (Special Utility)</option>
            </select>
          </div>

          {/* Fuel Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-medium text-slate-300">
              POWERTRAIN / FUEL TYPE *
            </label>
            <select
              {...register('fuelType')}
              className="w-full glass-input rounded-xl px-3.5 py-2.5 text-xs text-white font-mono bg-slate-900 border border-slate-700/80"
            >
              <option value="DIESEL" className="bg-slate-900 text-white">DIESEL (Heavy Duty)</option>
              <option value="PETROL" className="bg-slate-900 text-white">PETROL (Light Motor)</option>
              <option value="ELECTRIC" className="bg-slate-900 text-emerald-400">ELECTRIC (Zero Emissions EV)</option>
              <option value="CNG" className="bg-slate-900 text-cyan-400">CNG (Clean Compressed Gas)</option>
              <option value="HYBRID" className="bg-slate-900 text-teal-400">HYBRID (ICE + Battery)</option>
            </select>
          </div>

          {/* Initial Odometer */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-medium text-slate-300 flex items-center justify-between">
              <span>INITIAL ODOMETER (KM)</span>
              <span className="text-[10px] text-slate-500">Service Baseline</span>
            </label>
            <input
              type="number"
              {...register('odometer')}
              placeholder="0"
              className="w-full glass-input rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 font-mono"
            />
            {errors.odometer && (
              <p className="text-[11px] text-rose-400 font-mono">{errors.odometer.message}</p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 border-t border-slate-800/80 flex items-center justify-end gap-3">
          <Link
            to="/vehicles"
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
                <span>REGISTERING ASSET...</span>
              </>
            ) : (
              <>
                <Truck className="w-4 h-4" />
                <span>CONFIRM & REGISTER ASSET</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
