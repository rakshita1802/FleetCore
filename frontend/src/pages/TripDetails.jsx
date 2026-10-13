import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Play, 
  CheckCircle, 
  XCircle, 
  MapPin, 
  Calendar, 
  Clock, 
  Truck, 
  User, 
  Gauge, 
  Fuel, 
  Activity, 
  FileText,
  AlertCircle
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function TripDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [actionError, setActionError] = useState('');
  
  // For completion modal/drawer
  const [showComplete, setShowComplete] = useState(false);
  const [odometerEnd, setOdometerEnd] = useState('');
  const [notes, setNotes] = useState('');

  // Telemetry history
  const [telemetry, setTelemetry] = useState([]);
  const [telemetryLoading, setTelemetryLoading] = useState(false);

  const fetchTrip = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/trips/${id}`);
      setTrip(res.data.data);
      
      setTelemetryLoading(true);
      const telRes = await api.get(`/trips/${id}/telemetry`, { params: { limit: 10, sortOrder: 'desc' } });
      setTelemetry(telRes.data.data);
    } catch (err) {
      setError('Failed to load trip telemetry data');
    } finally {
      setLoading(false);
      setTelemetryLoading(false);
    }
  };

  useEffect(() => {
    fetchTrip();
  }, [id]);

  const handleStart = async () => {
    if (!window.confirm("Initialize and start route transit for this trip?")) return;
    try {
      setActionError('');
      await api.post(`/trips/${id}/start`);
      fetchTrip();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to start trip');
    }
  };

  const handleComplete = async (e) => {
    e.preventDefault();
    try {
      setActionError('');
      await api.post(`/trips/${id}/complete`, { 
        odometerEnd: Number(odometerEnd), 
        notes 
      });
      setShowComplete(false);
      fetchTrip();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to complete trip');
    }
  };

  const handleCancel = async () => {
    if (!window.confirm("Abort this trip dispatch? This action is irreversible.")) return;
    try {
      setActionError('');
      await api.post(`/trips/${id}/cancel`);
      fetchTrip();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to cancel trip');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400 font-mono text-sm gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin"></div>
        <span>INITIALIZING ROUTE TELEMETRY DOSSIER...</span>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="glass-panel rounded-2xl p-12 text-center border border-rose-900/50 text-rose-400">
        <AlertCircle className="w-12 h-12 mx-auto mb-3" />
        <p className="font-mono text-sm">{error || 'Trip record not found.'}</p>
        <button onClick={() => navigate('/trips')} className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-mono">
          Return to Registry
        </button>
      </div>
    );
  }

  const canMutateLifecycle = ['ADMIN', 'FLEET_MANAGER'].includes(user?.role) || user?.role === 'DRIVER';
  const canCancel = ['ADMIN', 'FLEET_MANAGER'].includes(user?.role);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back Button & Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/trips')} 
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-white font-mono">{trip.tripNumber}</h1>
              <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-mono font-bold border ${
                trip.status === 'IN_PROGRESS' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' :
                trip.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                trip.status === 'CANCELLED' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
                'bg-slate-800 text-slate-300 border-slate-700'
              }`}>
                {trip.status}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Route Waypoint Manifest &CAN Bus Audit</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {trip.status === 'PLANNED' && canMutateLifecycle && (
            <button 
              onClick={handleStart} 
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold text-xs shadow-[0_0_20px_-3px_rgba(6,182,212,0.4)] hover:brightness-110 transition-all font-mono"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>START DISPATCH</span>
            </button>
          )}
          {trip.status === 'IN_PROGRESS' && canMutateLifecycle && (
            <button 
              onClick={() => setShowComplete(!showComplete)} 
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-[0_0_20px_-3px_rgba(16,185,129,0.4)] transition-all font-mono"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>COMPLETE TRIP</span>
            </button>
          )}
          {(trip.status === 'PLANNED' || trip.status === 'IN_PROGRESS') && canCancel && (
            <button 
              onClick={handleCancel} 
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 transition-colors border border-rose-800/50 text-xs font-mono"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>ABORT</span>
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono">
          {actionError}
        </div>
      )}

      {/* Complete Trip Drawer */}
      {showComplete && (
        <form onSubmit={handleComplete} className="glass-panel rounded-2xl p-6 border border-emerald-500/40 bg-emerald-950/20 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-mono text-sm font-bold text-emerald-400 uppercase tracking-wide flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Confirm Dispatch Completion
            </h3>
            <span className="text-[11px] font-mono text-slate-400">Odometer Start: {trip.odometerStart} km</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase text-slate-400 mb-1 font-medium">Final Odometer Reading (km) *</label>
              <input 
                type="number" 
                required 
                min={trip.odometerStart}
                className="w-full glass-input rounded-xl px-3 py-2.5 text-xs text-white font-mono"
                value={odometerEnd} 
                onChange={e => setOdometerEnd(e.target.value)} 
                placeholder={`>= ${trip.odometerStart}`}
              />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase text-slate-400 mb-1 font-medium">Driver / Operational Notes</label>
              <input 
                type="text" 
                className="w-full glass-input rounded-xl px-3 py-2.5 text-xs text-white font-sans"
                value={notes} 
                onChange={e => setNotes(e.target.value)} 
                placeholder="Cargo delivered safely, route on time."
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button 
              type="button" 
              onClick={() => setShowComplete(false)} 
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-mono hover:bg-slate-700"
            >
              CANCEL
            </button>
            <button 
              type="submit" 
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs font-mono shadow-lg"
            >
              RECORD COMPLETION
            </button>
          </div>
        </form>
      )}

      {/* Main Details Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Transit & Routing */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800/80 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <MapPin className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">Route Waypoints & Assets</h3>
          </div>

          <div className="space-y-4 text-xs">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <Truck className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] font-mono text-slate-500 uppercase block">Vehicle Asset</span>
                <span className="font-mono font-bold text-white text-sm">{trip.vehicle?.registrationNumber || 'Unknown'}</span>
                <span className="text-slate-400 block text-[11px]">{trip.vehicle?.make} {trip.vehicle?.model}</span>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <User className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] font-mono text-slate-500 uppercase block">Dispatched Operator</span>
                <span className="font-semibold text-white text-sm">{trip.driver?.name || 'Unknown'}</span>
                <span className="text-cyan-400 font-mono block text-[11px]">{trip.driver?.employeeCode}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/60">
                <span className="text-[9px] font-mono text-emerald-400 uppercase block">Origin Dep</span>
                <span className="font-semibold text-white block mt-1">{trip.originName}</span>
                <span className="text-[10px] font-mono text-slate-500">{trip.originLatitude?.toFixed(4)}, {trip.originLongitude?.toFixed(4)}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/60">
                <span className="text-[9px] font-mono text-rose-400 uppercase block">Destination Arr</span>
                <span className="font-semibold text-white block mt-1">{trip.destinationName}</span>
                <span className="text-[10px] font-mono text-slate-500">{trip.destinationLatitude?.toFixed(4)}, {trip.destinationLongitude?.toFixed(4)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Timelines & Distance Audits */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800/80 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <Clock className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">Timelines & Telemetry Odometer</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center p-2.5 rounded-xl bg-slate-900/40 border border-slate-800/60 font-mono">
              <span className="text-slate-400">SCHEDULED DEPARTURE</span>
              <span className="text-white">{new Date(trip.scheduledStartAt).toLocaleString()}</span>
            </div>

            <div className="flex justify-between items-center p-2.5 rounded-xl bg-slate-900/40 border border-slate-800/60 font-mono">
              <span className="text-slate-400">ACTUAL DEPARTURE</span>
              <span className="text-cyan-400">{trip.actualStartAt ? new Date(trip.actualStartAt).toLocaleString() : '—'}</span>
            </div>

            <div className="flex justify-between items-center p-2.5 rounded-xl bg-slate-900/40 border border-slate-800/60 font-mono">
              <span className="text-slate-400">ACTUAL ARRIVAL</span>
              <span className="text-emerald-400">{trip.actualEndAt ? new Date(trip.actualEndAt).toLocaleString() : '—'}</span>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2">
              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-center font-mono">
                <span className="text-[9px] text-slate-500 uppercase block">Odo Start</span>
                <span className="text-sm font-bold text-white">{trip.odometerStart} km</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-center font-mono">
                <span className="text-[9px] text-slate-500 uppercase block">Odo End</span>
                <span className="text-sm font-bold text-white">{trip.odometerEnd ?? '—'} km</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-center font-mono">
                <span className="text-[9px] text-cyan-400 uppercase block">Transit Dist</span>
                <span className="text-sm font-bold text-cyan-400">{trip.distanceKm != null ? `${trip.distanceKm} km` : '—'}</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Telemetry Stream Trail */}
      <div className="glass-panel rounded-2xl border border-slate-800/80 overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-slate-800/80 bg-slate-900/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-white">Live Route Telemetry Packets</h3>
          </div>
          <span className="text-[10px] font-mono text-cyan-400">LATEST {telemetry.length} SAMPLES</span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800/80 text-xs">
            <thead className="bg-slate-900/60 font-mono text-[10px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-5 py-3 text-left">Timestamp</th>
                <th className="px-5 py-3 text-left">Speed (CAN)</th>
                <th className="px-5 py-3 text-left">Fuel Gauge</th>
                <th className="px-5 py-3 text-left">Total Odometer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
              {telemetryLoading ? (
                <tr><td colSpan="4" className="px-5 py-6 text-center text-slate-500">QUERYING TELEMETRY PACKETS...</td></tr>
              ) : telemetry.length === 0 ? (
                <tr><td colSpan="4" className="px-5 py-6 text-center text-slate-500">NO TELEMETRY PACKETS RECORDED FOR THIS TRIP</td></tr>
              ) : (
                telemetry.map(t => (
                  <tr key={t.id} className="hover:bg-slate-850/40">
                    <td className="px-5 py-2.5 whitespace-nowrap text-white">{new Date(t.timestamp).toLocaleTimeString()}</td>
                    <td className="px-5 py-2.5 whitespace-nowrap text-cyan-400 font-bold">{t.speedKph.toFixed(1)} km/h</td>
                    <td className="px-5 py-2.5 whitespace-nowrap text-amber-400">{t.fuelLevel.toFixed(1)}%</td>
                    <td className="px-5 py-2.5 whitespace-nowrap text-slate-300">{t.odometer.toFixed(1)} km</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
