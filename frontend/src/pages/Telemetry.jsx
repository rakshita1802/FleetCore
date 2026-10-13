import React, { useState, useEffect } from 'react';
import { Activity, Search, Filter, RefreshCw, ChevronLeft, ChevronRight, X, Compass, Gauge, Fuel, Zap, Clock } from 'lucide-react';
import api from '../services/api';

export default function Telemetry() {
  const [telemetry, setTelemetry] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Filters
  const [vehicleId, setVehicleId] = useState('');
  const [tripId, setTripId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  const fetchTelemetry = async () => {
    try {
      setLoading(true);
      setError('');
      
      const params = { page, limit: 20 };
      if (vehicleId) params.vehicleId = vehicleId;
      if (tripId) params.tripId = tripId;
      if (startTime) params.startTime = new Date(startTime).toISOString();
      if (endTime) params.endTime = new Date(endTime).toISOString();

      const res = await api.get('/telemetry', { params });
      setTelemetry(res.data.data);
      setTotalPages(res.data.pagination.totalPages);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load telemetry stream data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTelemetry();
  }, [page, vehicleId, tripId, startTime, endTime]);

  const handleClearFilters = () => {
    setVehicleId('');
    setTripId('');
    setStartTime('');
    setEndTime('');
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white font-sans">Historical Telemetry Ledger</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              CAN BUS RAW
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            Immutable sensor data stream, high-frequency GPS logs, and engine diagnostic frames.
          </p>
        </div>

        <button 
          onClick={fetchTelemetry}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-mono transition-colors border border-slate-700"
        >
          <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
          <span>REFRESH LEDGER</span>
        </button>
      </div>

      {/* Main Container */}
      <div className="glass-panel rounded-2xl border border-slate-800/80 overflow-hidden shadow-2xl">
        {/* Filters */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-900/50 space-y-3">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-cyan-400" />
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">Packet Query Parameters</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">Vehicle UUID</label>
              <input 
                type="text" 
                placeholder="Filter by vehicle..." 
                className="w-full glass-input rounded-xl px-3 py-2 text-xs text-white font-mono"
                value={vehicleId}
                onChange={(e) => { setVehicleId(e.target.value); setPage(1); }}
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">Trip UUID</label>
              <input 
                type="text" 
                placeholder="Filter by trip..." 
                className="w-full glass-input rounded-xl px-3 py-2 text-xs text-white font-mono"
                value={tripId}
                onChange={(e) => { setTripId(e.target.value); setPage(1); }}
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">Start Time</label>
              <input 
                type="datetime-local" 
                className="w-full glass-input rounded-xl px-3 py-2 text-xs text-white font-mono"
                value={startTime}
                onChange={(e) => { setStartTime(e.target.value); setPage(1); }}
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">End Time</label>
              <div className="flex gap-2">
                <input 
                  type="datetime-local" 
                  className="w-full glass-input rounded-xl px-3 py-2 text-xs text-white font-mono flex-1"
                  value={endTime}
                  onChange={(e) => { setEndTime(e.target.value); setPage(1); }}
                />
                <button 
                  onClick={handleClearFilters} 
                  title="Clear parameters"
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-mono transition-colors border border-slate-700"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {error && <div className="p-4 text-rose-400 bg-rose-500/10 text-xs font-mono">{error}</div>}

        {/* Ledger Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800/80">
            <thead className="bg-slate-900/60 font-mono text-[10px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-5 py-3 text-left">Timestamp (UTC)</th>
                <th className="px-5 py-3 text-left">Geospatial Fix</th>
                <th className="px-5 py-3 text-left">Speed CAN</th>
                <th className="px-5 py-3 text-left">Bearing</th>
                <th className="px-5 py-3 text-left">Fuel Tank</th>
                <th className="px-5 py-3 text-left">Ignition</th>
                <th className="px-5 py-3 text-left">Odometer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs font-mono">
              {loading ? (
                <tr><td colSpan="7" className="px-6 py-12 text-center text-slate-500">QUERYING HIGH-FREQUENCY PACKETS...</td></tr>
              ) : telemetry.length === 0 ? (
                <tr><td colSpan="7" className="px-6 py-12 text-center text-slate-500">NO TELEMETRY EVENTS MATCHING QUERY CRITERIA</td></tr>
              ) : (
                telemetry.map(event => (
                  <tr key={event.id} className="hover:bg-slate-850/40 transition-colors">
                    <td className="px-5 py-3 whitespace-nowrap text-white font-sans">
                      {new Date(event.timestamp).toLocaleString()}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-cyan-400">
                      {event.latitude?.toFixed(5)}, {event.longitude?.toFixed(5)}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-slate-200 font-bold">
                      {event.speedKph?.toFixed(1)} km/h
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-slate-400">
                      {event.heading?.toFixed(0)}°
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-amber-400">
                      {event.fuelLevel?.toFixed(1)}%
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                        event.engineStatus === 'ON' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        event.engineStatus === 'IDLE' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                        'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}>
                        {event.engineStatus}
                      </span>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-slate-300">
                      {event.odometer?.toFixed(1)} km
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-slate-800/80 flex justify-between items-center bg-slate-900/40 font-mono text-xs">
          <span className="text-slate-400">
            PAGE {page} OF {totalPages || 1}
          </span>
          <div className="flex gap-2">
            <button 
              disabled={page === 1} 
              onClick={() => setPage(p => p - 1)}
              className="flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none transition-colors border border-slate-700"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>PREV</span>
            </button>
            <button 
              disabled={page >= totalPages} 
              onClick={() => setPage(p => p + 1)}
              className="flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none transition-colors border border-slate-700"
            >
              <span>NEXT</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
