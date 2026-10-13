import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, Plus, Search, ShieldCheck, UserCheck, Edit3, Trash2, Eye, Award } from 'lucide-react';
import api from '../services/api';

const Drivers = () => {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchDrivers();
  }, []);

  const fetchDrivers = async () => {
    try {
      const { data } = await api.get('/drivers');
      setDrivers(data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch drivers');
    } finally {
      setLoading(false);
    }
  };

  const archiveDriver = async (id) => {
    if (!window.confirm("Are you sure you want to archive this driver record?")) return;
    try {
      await api.delete(`/drivers/${id}`);
      fetchDrivers();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to archive');
    }
  };

  const filteredDrivers = drivers.filter(d => 
    (d.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (d.employeeCode || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (d.licenseNumber || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400 font-mono text-sm gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin"></div>
        <span>LOADING DRIVER ROSTER...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-white font-sans">Driver Personnel Roster</h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              {drivers.length} OPERATORS
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-sans">Operator licensing compliance, driving behavior scores, and status.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search driver name, code..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="glass-input rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 font-sans w-64"
            />
          </div>
          <Link 
            to="/drivers/new" 
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-[0_0_20px_-3px_rgba(6,182,212,0.4)] transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>ENROLL DRIVER</span>
          </Link>
        </div>
      </div>

      {filteredDrivers.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 text-center border border-slate-800">
          <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-400 font-sans">No drivers found matching criteria.</p>
        </div>
      ) : (
        <div className="glass-panel rounded-2xl border border-slate-800/80 overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800/80">
              <thead className="bg-slate-900/60 font-mono text-[11px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-6 py-3.5 text-left">Operator / ID</th>
                  <th className="px-6 py-3.5 text-left">License Number</th>
                  <th className="px-6 py-3.5 text-left">License Compliance</th>
                  <th className="px-6 py-3.5 text-left">Operational Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {filteredDrivers.map(d => (
                  <tr key={d.id} className="hover:bg-slate-850/40 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-xs font-bold text-white shadow-inner">
                          {d.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-white font-sans">{d.name}</div>
                          <div className="text-[10px] font-mono text-cyan-400">{d.employeeCode}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-mono text-slate-300 text-xs">
                      {d.licenseNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 inline-flex text-[10px] font-mono font-bold rounded-lg border ${
                        d.licenseStatus === 'VALID' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        d.licenseStatus === 'EXPIRED' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 
                        'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>
                        {d.licenseStatus ? d.licenseStatus.replace('_', ' ') : 'PENDING'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 inline-flex text-[10px] font-mono font-bold rounded-lg border ${
                        d.status === 'ACTIVE' 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-xs font-medium space-x-2 font-mono">
                      <Link 
                        to={`/drivers/${d.id}`} 
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>VIEW</span>
                      </Link>
                      <Link 
                        to={`/drivers/${d.id}/edit`} 
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-950/40 hover:bg-cyan-900/60 text-cyan-400 transition-colors border border-cyan-800/50"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>EDIT</span>
                      </Link>
                      <button 
                        onClick={() => archiveDriver(d.id)} 
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 transition-colors border border-rose-800/50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>ARCHIVE</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Drivers;
