import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ShieldCheck, 
  RefreshCw, 
  Users, 
  Truck, 
  Activity, 
  Wrench, 
  Server, 
  Database, 
  Cpu, 
  Layers, 
  Clock, 
  ChevronRight, 
  ScrollText, 
  FileSpreadsheet, 
  CheckCircle2,
  AlertTriangle,
  Zap
} from 'lucide-react';
import { adminApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

const AdminDashboard = () => {
  const { user } = useAuth();
  const [overview, setOverview] = useState(null);
  const [systemHealth, setSystemHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [overviewRes, systemRes] = await Promise.all([
        adminApi.getOverview(),
        user?.role === 'ADMIN' ? adminApi.getSystemHealth() : Promise.resolve({ data: { data: null } })
      ]);

      setOverview(overviewRes.data.data);
      if (systemRes.data.data) {
        setSystemHealth(systemRes.data.data);
      }
      setLastRefreshed(new Date());
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load administrative overview');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !overview) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400 font-mono text-sm gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin"></div>
        <span>COMPILING ADMINISTRATIVE TELEMETRY OVERVIEW...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white font-sans">Administrative Control Center</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              TENANT CONTROL
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            System infrastructure health, queue workloads, and fleet operations for {user?.company?.name || 'CIT Fleet'}.
          </p>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs">
          <span className="text-slate-400 text-[11px]">
            SYNC: {lastRefreshed.toLocaleTimeString()}
          </span>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors border border-slate-700"
          >
            <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
            <span>{loading ? 'SYNCING...' : 'REFRESH'}</span>
          </button>
          {user?.role === 'ADMIN' && (
            <Link
              to="/admin/users"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold shadow-[0_0_15px_-3px_rgba(6,182,212,0.4)] transition-all"
            >
              <Users className="w-3.5 h-3.5" />
              <span>USER ROSTER</span>
            </Link>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono">
          {error}
        </div>
      )}

      {/* System Infrastructure Health Grid */}
      {systemHealth && (
        <div>
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-400" />
            Platform Infrastructure & Cluster Health
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* API Status */}
            <div className="glass-card rounded-2xl p-3.5 border border-slate-800/80">
              <div className="text-[10px] font-mono text-slate-400 uppercase">Express API</div>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-sm font-bold text-white font-mono">{systemHealth.api?.status || 'Online'}</span>
              </div>
              <div className="text-[10px] font-mono text-cyan-400 mt-1">{systemHealth.api?.avgLatencyMs || 0}ms latency</div>
            </div>

            {/* MySQL Database */}
            <div className="glass-card rounded-2xl p-3.5 border border-slate-800/80">
              <div className="text-[10px] font-mono text-slate-400 uppercase">MySQL Engine</div>
              <div className="mt-1 flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${systemHealth.database?.status === 'connected' ? 'bg-emerald-400' : 'bg-rose-500'}`}></span>
                <span className="text-sm font-bold text-white font-mono">{systemHealth.database?.status || 'Connected'}</span>
              </div>
              <div className="text-[10px] font-mono text-slate-400 mt-1">InnoDB Port 3307</div>
            </div>

            {/* Redis Cache & Bus */}
            <div className="glass-card rounded-2xl p-3.5 border border-slate-800/80">
              <div className="text-[10px] font-mono text-slate-400 uppercase">Redis Telemetry</div>
              <div className="mt-1 flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${systemHealth.redis?.status === 'connected' ? 'bg-emerald-400' : 'bg-rose-500'}`}></span>
                <span className="text-sm font-bold text-white font-mono">{systemHealth.redis?.status || 'Connected'}</span>
              </div>
              <div className="text-[10px] font-mono text-slate-400 mt-1">Sub/Pub Port 6380</div>
            </div>

            {/* BullMQ Background */}
            <div className="glass-card rounded-2xl p-3.5 border border-slate-800/80">
              <div className="text-[10px] font-mono text-slate-400 uppercase">BullMQ Workers</div>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span className="text-sm font-bold text-white font-mono">4 Queues</span>
              </div>
              <div className="text-[10px] font-mono text-slate-400 mt-1">Maintenance & Reports</div>
            </div>

            {/* Process Memory */}
            <div className="glass-card rounded-2xl p-3.5 border border-slate-800/80">
              <div className="text-[10px] font-mono text-slate-400 uppercase">Heap Memory</div>
              <div className="mt-1 text-sm font-bold text-cyan-400 font-mono">
                {systemHealth.process?.memory?.heapUsedMb || 0} MB
              </div>
              <div className="text-[10px] font-mono text-slate-400 mt-1">RSS: {systemHealth.process?.memory?.rssMb || 0} MB</div>
            </div>

            {/* Uptime */}
            <div className="glass-card rounded-2xl p-3.5 border border-slate-800/80">
              <div className="text-[10px] font-mono text-slate-400 uppercase">Core Uptime</div>
              <div className="mt-1 text-sm font-bold text-white font-mono">
                {Math.floor((systemHealth.uptimeSeconds || 0) / 60)} min
              </div>
              <div className="text-[10px] font-mono text-slate-400 mt-1">Node.js Engine</div>
            </div>
          </div>
        </div>
      )}

      {/* Operational Overview KPI Grid */}
      {overview && (
        <div className="space-y-4">
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            Operational Capacity & Tenant Metrics
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Users Card */}
            <div className="glass-panel rounded-2xl p-5 border border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-400 uppercase">User Accounts</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  {overview.users.active} Active
                </span>
              </div>
              <div className="text-3xl font-bold font-mono text-white">{overview.users.total}</div>
              <div className="text-xs font-mono text-slate-400 space-y-1 pt-1 border-t border-slate-800/60">
                <div className="flex justify-between">
                  <span>Admins / Managers:</span>
                  <span className="text-slate-200">{overview.users.byRole.ADMIN} / {overview.users.byRole.FLEET_MANAGER}</span>
                </div>
                <div className="flex justify-between">
                  <span>Drivers / Viewers:</span>
                  <span className="text-slate-200">{overview.users.byRole.DRIVER} / {overview.users.byRole.VIEWER}</span>
                </div>
              </div>
            </div>

            {/* Vehicles Card */}
            <div className="glass-panel rounded-2xl p-5 border border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-400 uppercase">Fleet Inventory</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {overview.vehicles.byStatus.ACTIVE} Active
                </span>
              </div>
              <div className="text-3xl font-bold font-mono text-white">{overview.vehicles.total}</div>
              <div className="text-xs font-mono text-slate-400 space-y-1 pt-1 border-t border-slate-800/60">
                <div className="flex justify-between">
                  <span>In Service:</span>
                  <span className="text-amber-400 font-bold">{overview.vehicles.byStatus.MAINTENANCE || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Depot / Standby:</span>
                  <span className="text-slate-200">{overview.vehicles.byStatus.INACTIVE || 0}</span>
                </div>
              </div>
            </div>

            {/* Operations & Trips */}
            <div className="glass-panel rounded-2xl p-5 border border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-400 uppercase">Active Routes</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  {overview.drivers.byStatus.ACTIVE} Drivers
                </span>
              </div>
              <div className="text-3xl font-bold font-mono text-white">{overview.operations.activeTrips}</div>
              <div className="text-xs font-mono text-slate-400 space-y-1 pt-1 border-t border-slate-800/60">
                <div className="flex justify-between">
                  <span>Missions In Transit:</span>
                  <span className="text-cyan-400 font-bold">{overview.operations.activeTrips}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Drivers:</span>
                  <span className="text-slate-200">{overview.drivers.total}</span>
                </div>
              </div>
            </div>

            {/* Maintenance & Alerts */}
            <div className="glass-panel rounded-2xl p-5 border border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-400 uppercase">Alerts & Service</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                  overview.operations.openAlerts > 0 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                }`}>
                  {overview.operations.openAlerts} Open
                </span>
              </div>
              <div className="text-3xl font-bold font-mono text-white">{overview.operations.maintenanceDue + overview.operations.maintenanceOverdue}</div>
              <div className="text-xs font-mono text-slate-400 space-y-1 pt-1 border-t border-slate-800/60">
                <div className="flex justify-between">
                  <span>Due / Overdue:</span>
                  <span className="text-slate-200">{overview.operations.maintenanceDue} / {overview.operations.maintenanceOverdue}</span>
                </div>
                <div className="flex justify-between">
                  <span>Critical Severity:</span>
                  <span className="text-rose-400 font-bold">{overview.operations.alertsBySeverity.CRITICAL || 0}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BullMQ Queues Performance */}
      {overview?.queues && (
        <div className="glass-panel rounded-2xl border border-slate-800/80 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold font-mono uppercase tracking-wider text-white">BullMQ Worker Queues</h3>
            </div>
            <Link to="/admin/system" className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
              <span>SYSTEM DIAGNOSTICS</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(overview.queues).map(([name, info]) => (
              <div key={name} className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold font-mono uppercase text-slate-300">{name}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                    info.status === 'online' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}>
                    {info.status}
                  </span>
                </div>
                {info.counts && (
                  <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                    <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
                      <div className="font-bold text-white">{info.counts.waiting || 0}</div>
                      <div className="text-[9px] text-slate-400">Waiting</div>
                    </div>
                    <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
                      <div className="font-bold text-cyan-400">{info.counts.active || 0}</div>
                      <div className="text-[9px] text-slate-400">Active</div>
                    </div>
                    <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
                      <div className={`font-bold ${info.counts.failed > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                        {info.counts.failed || 0}
                      </div>
                      <div className="text-[9px] text-slate-400">Failed</div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/reports"
          className="glass-card rounded-2xl p-5 border border-slate-800/80 group"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white group-hover:text-cyan-400 transition-colors font-sans">
              Operational Reporting Engine
            </h3>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
          </div>
          <p className="text-xs text-slate-400 mt-2 font-sans">
            Generate and export fleet utilization, trips, maintenance, and alerts in deterministic CSV format.
          </p>
        </Link>

        {user?.role === 'ADMIN' && (
          <Link
            to="/admin/users"
            className="glass-card rounded-2xl p-5 border border-slate-800/80 group"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white group-hover:text-cyan-400 transition-colors font-sans">
                User & RBAC Administration
              </h3>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
            </div>
            <p className="text-xs text-slate-400 mt-2 font-sans">
              Add users, promote roles, deactivate accounts with built-in last-admin and self-protection safeguards.
            </p>
          </Link>
        )}

        <Link
          to="/admin/audit"
          className="glass-card rounded-2xl p-5 border border-slate-800/80 group"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white group-hover:text-cyan-400 transition-colors font-sans">
              Audit Trail & Security Logs
            </h3>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
          </div>
          <p className="text-xs text-slate-400 mt-2 font-sans">
            Immutable log of administrative operations, logins, user modifications, and operational lifecycle changes.
          </p>
        </Link>
      </div>
    </div>
  );
};

export default AdminDashboard;
