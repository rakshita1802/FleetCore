import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link2, Truck, UserCheck, Unlink, Plus, CheckCircle2, Clock } from 'lucide-react';

const schema = z.object({
  vehicleId: z.string().min(1, "Vehicle is required"),
  driverId: z.string().min(1, "Driver is required")
});

const Assignments = () => {
  const [assignments, setAssignments] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema)
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [assnRes, vehRes, drvRes] = await Promise.all([
        api.get('/assignments'),
        api.get('/vehicles?status=ACTIVE'),
        api.get('/drivers?status=ACTIVE')
      ]);
      setAssignments(assnRes.data.data);
      setVehicles(vehRes.data.data);
      setDrivers(drvRes.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch assignments');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data) => {
    try {
      await api.post('/assignments', data);
      reset();
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to assign vehicle');
    }
  };

  const unassign = async (id) => {
    if (!window.confirm("Are you sure you want to decouple this driver assignment?")) return;
    try {
      await api.post(`/assignments/${id}/unassign`);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to unassign');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400 font-mono text-sm gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin"></div>
        <span>LOADING FLEET ASSIGNMENT MATRIX...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold tracking-tight text-white font-sans">Vehicle-Driver Pairings</h2>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
            {assignments.filter(a => a.isActive).length} ACTIVE PAIRS
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-1 font-sans">Dispatch pairings, driver accountability binding, and assignment history.</p>
      </div>

      {/* Assignment Creation Form */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800/80">
        <div className="flex items-center gap-2 mb-4">
          <Link2 className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wide">Bind New Driver to Vehicle Asset</h3>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-xs font-mono uppercase text-slate-400 mb-1.5 font-medium">Select Vehicle Asset</label>
            <select 
              {...register('vehicleId')} 
              className="w-full glass-input rounded-xl px-3 py-2.5 text-xs text-white bg-slate-900 font-sans"
            >
              <option value="" className="bg-slate-900 text-slate-400">Choose Active Vehicle...</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id} className="bg-slate-900 text-white">
                  {v.registrationNumber} &bull; {v.make} {v.model}
                </option>
              ))}
            </select>
            {errors.vehicleId && <p className="mt-1 text-[11px] text-rose-400 font-mono">{errors.vehicleId.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-mono uppercase text-slate-400 mb-1.5 font-medium">Select Certified Driver</label>
            <select 
              {...register('driverId')} 
              className="w-full glass-input rounded-xl px-3 py-2.5 text-xs text-white bg-slate-900 font-sans"
            >
              <option value="" className="bg-slate-900 text-slate-400">Choose Active Driver...</option>
              {drivers.map(d => (
                <option key={d.id} value={d.id} className="bg-slate-900 text-white">
                  {d.name} &bull; {d.employeeCode}
                </option>
              ))}
            </select>
            {errors.driverId && <p className="mt-1 text-[11px] text-rose-400 font-mono">{errors.driverId.message}</p>}
          </div>

          <div>
            <button 
              type="submit" 
              disabled={isSubmitting} 
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-[0_0_20px_-3px_rgba(6,182,212,0.4)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>COMMIT ASSIGNMENT</span>
            </button>
          </div>
        </form>
      </div>

      {/* Ledger Table */}
      <div className="glass-panel rounded-2xl border border-slate-800/80 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800/80">
            <thead className="bg-slate-900/60 font-mono text-[11px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-6 py-3.5 text-left">Vehicle Asset</th>
                <th className="px-6 py-3.5 text-left">Assigned Driver</th>
                <th className="px-6 py-3.5 text-left">Binding Timestamp</th>
                <th className="px-6 py-3.5 text-left">Status</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-sm">
              {assignments.map(a => (
                <tr key={a.id} className="hover:bg-slate-850/40 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                        <Truck className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-mono font-bold text-white">{a.vehicle?.registrationNumber}</div>
                        <div className="text-[10px] text-slate-400">{a.vehicle?.make} {a.vehicle?.model}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-indigo-400" />
                      <div>
                        <div className="font-semibold text-slate-200">{a.driver?.name}</div>
                        <div className="text-[10px] font-mono text-cyan-400">{a.driver?.employeeCode}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-slate-400">
                    {new Date(a.assignedAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2.5 py-1 inline-flex text-[10px] font-mono font-bold rounded-lg border ${
                      a.isActive 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      {a.isActive ? 'ACTIVE BINDING' : 'HISTORICAL'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-xs font-mono">
                    {a.isActive ? (
                      <button 
                        onClick={() => unassign(a.id)} 
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 transition-colors border border-rose-800/50"
                      >
                        <Unlink className="w-3.5 h-3.5" />
                        <span>UNASSIGN</span>
                      </button>
                    ) : (
                      <span className="text-slate-600 text-xs">Uncoupled</span>
                    )}
                  </td>
                </tr>
              ))}
              {assignments.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-xs font-mono text-slate-500">
                    NO ACTIVE OR HISTORICAL VEHICLE PAIRINGS RECORDED
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Assignments;
