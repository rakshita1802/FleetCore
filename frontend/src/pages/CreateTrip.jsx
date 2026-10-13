import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Navigation, ArrowLeft, MapPin, Calendar, Truck, User, Send, Sparkles } from 'lucide-react';
import api from '../services/api';

const createTripSchema = z.object({
  vehicleId: z.string().uuid("Please select a vehicle"),
  driverId: z.string().uuid("Please select a driver"),
  originName: z.string().min(1, "Origin is required").max(255),
  originLatitude: z.coerce.number().min(-90).max(90),
  originLongitude: z.coerce.number().min(-180).max(180),
  destinationName: z.string().min(1, "Destination is required").max(255),
  destinationLatitude: z.coerce.number().min(-90).max(90),
  destinationLongitude: z.coerce.number().min(-180).max(180),
  scheduledStartAt: z.string().min(1, "Scheduled start date is required"),
  scheduledEndAt: z.string().optional(),
  odometerStart: z.coerce.number().min(0),
  notes: z.string().max(1000).optional()
}).refine(data => {
  if (data.scheduledEndAt) {
    return new Date(data.scheduledEndAt) > new Date(data.scheduledStartAt);
  }
  return true;
}, {
  message: "End time must be after start time",
  path: ["scheduledEndAt"]
});

export default function CreateTrip() {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [apiError, setApiError] = useState('');
  
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(createTripSchema),
    defaultValues: {
      originName: 'CIT Coimbatore Depot',
      originLatitude: 11.0283,
      originLongitude: 77.0275,
      destinationName: 'Coimbatore Airport Cargo Terminal',
      destinationLatitude: 11.0298,
      destinationLongitude: 77.0434,
      odometerStart: 45000,
      scheduledStartAt: new Date(Date.now() + 3600000).toISOString().slice(0, 16)
    }
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [vRes, dRes] = await Promise.all([
          api.get('/vehicles', { params: { limit: 100, status: 'ACTIVE' } }),
          api.get('/drivers', { params: { limit: 100, status: 'ACTIVE' } })
        ]);
        setVehicles(vRes.data.data);
        setDrivers(dRes.data.data);
      } catch (err) {
        setApiError('Failed to load form data');
      }
    };
    fetchData();
  }, []);

  const onSubmit = async (data) => {
    try {
      setApiError('');
      data.scheduledStartAt = new Date(data.scheduledStartAt).toISOString();
      if (data.scheduledEndAt) data.scheduledEndAt = new Date(data.scheduledEndAt).toISOString();
      else delete data.scheduledEndAt;

      const res = await api.post('/trips', data);
      navigate(`/trips/${res.data.data.id}`);
    } catch (err) {
      setApiError(err.response?.data?.message || 'Failed to dispatch trip');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/trips')} 
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white font-sans">Dispatch Route Mission</h1>
            <p className="text-xs text-slate-400 mt-0.5">Provision trip manifest, assign asset & operator, configure route waypoints.</p>
          </div>
        </div>
      </div>

      {apiError && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono">
          {apiError}
        </div>
      )}

      {/* Form Container */}
      <form onSubmit={handleSubmit(onSubmit)} className="glass-panel rounded-2xl p-6 sm:p-8 border border-slate-800/80 space-y-6">
        
        {/* Asset & Driver Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-mono uppercase text-slate-400 mb-1.5 font-medium flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-cyan-400" />
              Assigned Vehicle
            </label>
            <select 
              {...register("vehicleId")} 
              className="w-full glass-input rounded-xl px-3 py-2.5 text-xs text-white bg-slate-900 font-sans"
            >
              <option value="" className="bg-slate-900 text-slate-400">Select Vehicle Asset...</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id} className="bg-slate-900 text-white">
                  {v.registrationNumber} ({v.make} {v.model})
                </option>
              ))}
            </select>
            {errors.vehicleId && <p className="text-rose-400 text-[11px] font-mono mt-1">{errors.vehicleId.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-mono uppercase text-slate-400 mb-1.5 font-medium flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-indigo-400" />
              Dispatched Driver
            </label>
            <select 
              {...register("driverId")} 
              className="w-full glass-input rounded-xl px-3 py-2.5 text-xs text-white bg-slate-900 font-sans"
            >
              <option value="" className="bg-slate-900 text-slate-400">Select Certified Driver...</option>
              {drivers.map(d => (
                <option key={d.id} value={d.id} className="bg-slate-900 text-white">
                  {d.name} ({d.employeeCode})
                </option>
              ))}
            </select>
            {errors.driverId && <p className="text-rose-400 text-[11px] font-mono mt-1">{errors.driverId.message}</p>}
          </div>
        </div>

        {/* Waypoints Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
          {/* Origin */}
          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-3">
            <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs font-bold uppercase">
              <MapPin className="w-4 h-4" />
              <span>Origin Waypoint</span>
            </div>
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Origin Label</label>
              <input 
                type="text" 
                {...register("originName")} 
                className="w-full glass-input rounded-xl px-3 py-2 text-xs text-white font-sans" 
              />
              {errors.originName && <p className="text-rose-400 text-[10px] font-mono mt-1">{errors.originName.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-mono text-slate-500 mb-0.5">Latitude</label>
                <input 
                  type="number" 
                  step="any" 
                  {...register("originLatitude")} 
                  className="w-full glass-input rounded-xl px-2.5 py-1.5 text-xs font-mono text-white" 
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-slate-500 mb-0.5">Longitude</label>
                <input 
                  type="number" 
                  step="any" 
                  {...register("originLongitude")} 
                  className="w-full glass-input rounded-xl px-2.5 py-1.5 text-xs font-mono text-white" 
                />
              </div>
            </div>
          </div>

          {/* Destination */}
          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-3">
            <div className="flex items-center gap-2 text-rose-400 font-mono text-xs font-bold uppercase">
              <MapPin className="w-4 h-4" />
              <span>Destination Waypoint</span>
            </div>
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Destination Label</label>
              <input 
                type="text" 
                {...register("destinationName")} 
                className="w-full glass-input rounded-xl px-3 py-2 text-xs text-white font-sans" 
              />
              {errors.destinationName && <p className="text-rose-400 text-[10px] font-mono mt-1">{errors.destinationName.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-mono text-slate-500 mb-0.5">Latitude</label>
                <input 
                  type="number" 
                  step="any" 
                  {...register("destinationLatitude")} 
                  className="w-full glass-input rounded-xl px-2.5 py-1.5 text-xs font-mono text-white" 
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-slate-500 mb-0.5">Longitude</label>
                <input 
                  type="number" 
                  step="any" 
                  {...register("destinationLongitude")} 
                  className="w-full glass-input rounded-xl px-2.5 py-1.5 text-xs font-mono text-white" 
                />
              </div>
            </div>
          </div>
        </div>

        {/* Schedule & Odometer */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-mono uppercase text-slate-400 mb-1.5 font-medium">Scheduled Departure</label>
            <input 
              type="datetime-local" 
              {...register("scheduledStartAt")} 
              className="w-full glass-input rounded-xl px-3 py-2 text-xs text-white font-mono" 
            />
            {errors.scheduledStartAt && <p className="text-rose-400 text-[10px] font-mono mt-1">{errors.scheduledStartAt.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-mono uppercase text-slate-400 mb-1.5 font-medium">Expected Arrival (Optional)</label>
            <input 
              type="datetime-local" 
              {...register("scheduledEndAt")} 
              className="w-full glass-input rounded-xl px-3 py-2 text-xs text-white font-mono" 
            />
            {errors.scheduledEndAt && <p className="text-rose-400 text-[10px] font-mono mt-1">{errors.scheduledEndAt.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-mono uppercase text-slate-400 mb-1.5 font-medium">Odometer Start (km)</label>
            <input 
              type="number" 
              {...register("odometerStart")} 
              className="w-full glass-input rounded-xl px-3 py-2 text-xs text-white font-mono" 
            />
            {errors.odometerStart && <p className="text-rose-400 text-[10px] font-mono mt-1">{errors.odometerStart.message}</p>}
          </div>
        </div>

        <div>
          <label className="block text-xs font-mono uppercase text-slate-400 mb-1.5 font-medium">Mission Manifest / Dispatch Notes</label>
          <textarea 
            rows="2" 
            {...register("notes")} 
            placeholder="Payload details, special cargo handling instructions..."
            className="w-full glass-input rounded-xl px-3 py-2 text-xs text-white font-sans"
          ></textarea>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
          <button 
            type="button" 
            onClick={() => navigate('/trips')} 
            className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-mono"
          >
            DISCARD
          </button>
          <button 
            type="submit" 
            disabled={isSubmitting} 
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs font-mono shadow-[0_0_20px_-3px_rgba(6,182,212,0.5)] flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span>DISPATCH MISSION</span>
          </button>
        </div>
      </form>
    </div>
  );
}
