import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Navigation, Plus, Search, MapPin, ArrowRight, Eye, ChevronLeft, ChevronRight, Truck, User } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Trips() {
  const { user } = useAuth();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const fetchTrips = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/trips', {
        params: { page, limit: 10, status: statusFilter, search }
      });
      setTrips(res.data.data);
      setTotalPages(res.data.pagination.totalPages);
    } catch (err) {
      setError('Failed to load trips');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrips();
  }, [page, statusFilter, search]);

  const canCreate = ['ADMIN', 'FLEET_MANAGER'].includes(user?.role);

  const getStatusBadge = (status) => {
    const styles = {
      PLANNED: 'bg-slate-800 text-slate-300 border-slate-700',
      IN_PROGRESS: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.2)]',
      COMPLETED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      CANCELLED: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    };
    return (
      <span className={`px-2.5 py-1 text-[10px] font-mono font-bold rounded-lg border ${styles[status] || 'bg-slate-800 text-slate-400'}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white font-sans">Trip & Dispatch Operations</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              ROUTES
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-sans">Waypoints, route telemetry tracing, manifest dispatch, and completion audits.</p>
        </div>

        {canCreate && (
          <Link 
            to="/trips/new" 
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-[0_0_20px_-3px_rgba(6,182,212,0.4)] transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>DISPATCH NEW TRIP</span>
          </Link>
        )}
      </div>

      {/* Main Ledger Panel */}
      <div className="glass-panel rounded-2xl border border-slate-800/80 overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-slate-800/80 bg-slate-900/50 flex flex-col sm:flex-row gap-4 justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search Trip # or Location..." 
              className="w-full glass-input rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 font-sans"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <select 
            className="glass-input rounded-xl px-3 py-2 text-xs text-white bg-slate-900 font-sans w-full sm:w-48"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <option value="" className="bg-slate-900">All Trip Statuses</option>
            <option value="PLANNED" className="bg-slate-900">Planned</option>
            <option value="IN_PROGRESS" className="bg-slate-900">In Progress</option>
            <option value="COMPLETED" className="bg-slate-900">Completed</option>
            <option value="CANCELLED" className="bg-slate-900">Cancelled</option>
          </select>
        </div>

        {error && <div className="p-4 text-rose-400 bg-rose-500/10 text-xs font-mono">{error}</div>}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800/80">
            <thead className="bg-slate-900/60 font-mono text-[11px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-6 py-3.5 text-left">Trip ID</th>
                <th className="px-6 py-3.5 text-left">Vehicle & Driver</th>
                <th className="px-6 py-3.5 text-left">Route Transit</th>
                <th className="px-6 py-3.5 text-left">Scheduled Time</th>
                <th className="px-6 py-3.5 text-left">Status</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-sm">
              {loading ? (
                <tr><td colSpan="6" className="px-6 py-12 text-center text-xs font-mono text-slate-500">SYNCING TRIPS...</td></tr>
              ) : trips.length === 0 ? (
                <tr><td colSpan="6" className="px-6 py-12 text-center text-xs font-mono text-slate-500">NO TRIPS FOUND MATCHING CRITERIA</td></tr>
              ) : (
                trips.map(trip => (
                  <tr key={trip.id} className="hover:bg-slate-850/40 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap font-mono font-bold text-white text-xs">
                      {trip.tripNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Truck className="w-3.5 h-3.5 text-cyan-400" />
                        <span className="font-mono text-xs text-white">{trip.vehicle?.registrationNumber || 'Unknown'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                        <User className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{trip.driver?.name || 'Unassigned'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs">
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="truncate max-w-[120px]">{trip.originName}</span>
                        <ArrowRight className="w-3 h-3 text-slate-500" />
                        <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        <span className="truncate max-w-[120px]">{trip.destinationName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-slate-400">
                      {new Date(trip.scheduledStartAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(trip.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-xs font-mono">
                      <Link 
                        to={`/trips/${trip.id}`} 
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-cyan-950/40 hover:bg-cyan-900/60 text-cyan-400 transition-colors border border-cyan-800/50"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>INSPECT</span>
                      </Link>
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
