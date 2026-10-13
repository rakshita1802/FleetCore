import React, { useState, useEffect } from 'react';
import { Cpu, RefreshCw, Server, Database, Activity, CheckCircle2, AlertCircle, Layers, Zap, Clock, Terminal } from 'lucide-react';
import { adminApi, observabilityApi } from '../services/api';

const SystemHealth = () => {
  const [systemData, setSystemData] = useState(null);
  const [liveness, setLiveness] = useState(null);
  const [readiness, setReadiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  const fetchHealth = async () => {
    try {
      setLoading(true);
      setError(null);

      const [sysRes, liveRes, readyRes] = await Promise.all([
        adminApi.getSystemHealth(),
        observabilityApi.getLive(),
        observabilityApi.getReady().catch(err => ({ data: err.response?.data || { status: 'not_ready' } }))
      ]);

      setSystemData(sysRes.data.data);
      setLiveness(liveRes.data);
      setReadiness(readyRes.data);
      setLastRefreshed(new Date());
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch observability health metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    let interval;
    if (autoRefresh) {
      interval = setInterval(fetchHealth, 30000);
    }
    return () => clearInterval(interval);
  }, [autoRefresh]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white font-sans">Production System Observability</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              CLUSTER TELEMETRY
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            Real-time infrastructure probes, memory profiles, BullMQ queue depth, and route latency telemetry.
          </p>
        </div>
        <div className="flex items-center gap-3 font-mono text-xs">
          <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-cyan-500"
            />
            <span className="text-[11px]">AUTO-REFRESH (30S)</span>
          </label>
          <button
            onClick={fetchHealth}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors border border-slate-700"
          >
            <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
            <span>{loading ? 'POLLING...' : 'REFRESH'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono">
          {error}
        </div>
      )}

      {/* Probes Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Liveness */}
        <div className="glass-panel rounded-2xl p-5 border border-slate-800/80 space-y-2">
          <div className="text-[10px] font-mono uppercase text-slate-400">Liveness Probe (/live)</div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-xl font-bold font-mono text-white capitalize">{liveness?.status || 'Alive'}</span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono pt-1 border-t border-slate-800/60">
            PID: <span className="text-cyan-400">{liveness?.pid || '-'}</span> &bull; Uptime: {liveness?.uptime || 0}s
          </div>
        </div>

        {/* Readiness */}
        <div className="glass-panel rounded-2xl p-5 border border-slate-800/80 space-y-2">
          <div className="text-[10px] font-mono uppercase text-slate-400">Readiness Probe (/ready)</div>
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${readiness?.status === 'ready' ? 'bg-emerald-400' : 'bg-rose-500'}`}></span>
            <span className="text-xl font-bold font-mono text-white capitalize">{readiness?.status || 'Ready'}</span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono pt-1 border-t border-slate-800/60">
            MySQL: <span className="text-emerald-400">{readiness?.checks?.database ? 'READY' : 'OFFLINE'}</span> &bull; Redis: <span className="text-emerald-400">{readiness?.checks?.redis ? 'READY' : 'OFFLINE'}</span>
          </div>
        </div>

        {/* Database */}
        <div className="glass-panel rounded-2xl p-5 border border-slate-800/80 space-y-2">
          <div className="text-[10px] font-mono uppercase text-slate-400">MySQL Database (Port 3307)</div>
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${systemData?.database?.status === 'connected' ? 'bg-emerald-400' : 'bg-rose-500'}`}></span>
            <span className="text-xl font-bold font-mono text-white capitalize">{systemData?.database?.status || 'Connected'}</span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono pt-1 border-t border-slate-800/60">
            Engine: InnoDB &bull; Prisma 6.x
          </div>
        </div>

        {/* Redis */}
        <div className="glass-panel rounded-2xl p-5 border border-slate-800/80 space-y-2">
          <div className="text-[10px] font-mono uppercase text-slate-400">Redis Cache & Pub/Sub</div>
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${systemData?.redis?.status === 'connected' ? 'bg-emerald-400' : 'bg-rose-500'}`}></span>
            <span className="text-xl font-bold font-mono text-white capitalize">{systemData?.redis?.status || 'Connected'}</span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono pt-1 border-t border-slate-800/60">
            Telemetry Store & BullMQ Core
          </div>
        </div>
      </div>

      {/* API Metrics & Process Memory */}
      {systemData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* API Request Performance */}
          <div className="glass-panel rounded-2xl p-6 border border-slate-800/80 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
                <h3 className="font-mono text-sm font-bold uppercase text-white">HTTP Request Metrics & Throughput</h3>
              </div>
              <span className="text-xs font-mono bg-slate-800 text-cyan-400 px-2.5 py-1 rounded-lg border border-slate-700">
                Avg: {systemData.api?.avgLatencyMs || 0}ms
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center text-xs font-mono">
              <div className="p-3 bg-emerald-950/40 text-emerald-400 rounded-xl border border-emerald-500/20">
                <div className="text-xl font-bold">{systemData.api?.statusCodes?.['2xx'] || 0}</div>
                <div className="text-[9px] uppercase text-emerald-500">2xx Success</div>
              </div>
              <div className="p-3 bg-cyan-950/40 text-cyan-400 rounded-xl border border-cyan-500/20">
                <div className="text-xl font-bold">{systemData.api?.statusCodes?.['3xx'] || 0}</div>
                <div className="text-[9px] uppercase text-cyan-500">3xx Redirect</div>
              </div>
              <div className="p-3 bg-amber-950/40 text-amber-400 rounded-xl border border-amber-500/20">
                <div className="text-xl font-bold">{systemData.api?.statusCodes?.['4xx'] || 0}</div>
                <div className="text-[9px] uppercase text-amber-500">4xx Client Err</div>
              </div>
              <div className="p-3 bg-rose-950/40 text-rose-400 rounded-xl border border-rose-500/20">
                <div className="text-xl font-bold">{systemData.api?.statusCodes?.['5xx'] || 0}</div>
                <div className="text-[9px] uppercase text-rose-500">5xx Server Err</div>
              </div>
            </div>

            {/* Normalized Route Latency Table */}
            <div className="overflow-x-auto max-h-56">
              <table className="min-w-full text-left text-xs font-mono">
                <thead className="bg-slate-900/60 text-slate-400 uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Route Pattern</th>
                    <th className="py-2.5 px-3 text-center">Requests</th>
                    <th className="py-2.5 px-3 text-right">Avg Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {Object.entries(systemData.api?.routes || {}).map(([route, m]) => (
                    <tr key={route} className="hover:bg-slate-850/40">
                      <td className="py-2 px-3 text-cyan-400 truncate max-w-xs">{route}</td>
                      <td className="py-2 px-3 text-center font-bold text-white">{m.count}</td>
                      <td className="py-2 px-3 text-right text-slate-300">{m.avgDurationMs}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Process & BullMQ Queues */}
          <div className="space-y-6">
            {/* Process Info */}
            <div className="glass-panel rounded-2xl p-6 border border-slate-800/80 space-y-3">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-cyan-400" />
                <h3 className="font-mono text-sm font-bold uppercase text-white">V8 Runtime & Heap Allocation</h3>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs font-mono">
                <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                  <div className="text-slate-500 text-[10px] uppercase">Node.js</div>
                  <div className="font-bold text-white mt-1">{systemData.process?.nodeVersion}</div>
                </div>
                <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                  <div className="text-slate-500 text-[10px] uppercase">Heap Used</div>
                  <div className="font-bold text-cyan-400 mt-1">{systemData.process?.memory?.heapUsedMb} MB</div>
                </div>
                <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                  <div className="text-slate-500 text-[10px] uppercase">RSS Allocated</div>
                  <div className="font-bold text-white mt-1">{systemData.process?.memory?.rssMb} MB</div>
                </div>
              </div>
            </div>

            {/* BullMQ Breakdown */}
            <div className="glass-panel rounded-2xl p-6 border border-slate-800/80 space-y-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                <h3 className="font-mono text-sm font-bold uppercase text-white">BullMQ Worker Queue Depth</h3>
              </div>
              <div className="space-y-2">
                {Object.entries(systemData.queues || {}).map(([qName, qInfo]) => (
                  <div key={qName} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <span className="font-bold uppercase text-white">{qName}</span>
                      <span className="text-[9px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                        {qInfo.status}
                      </span>
                    </div>
                    {qInfo.counts && (
                      <div className="flex gap-3 text-slate-400 text-xs">
                        <span>Wait: <strong className="text-white">{qInfo.counts.waiting || 0}</strong></span>
                        <span>Active: <strong className="text-cyan-400">{qInfo.counts.active || 0}</strong></span>
                        <span>Failed: <strong className={qInfo.counts.failed > 0 ? 'text-rose-400' : 'text-slate-400'}>{qInfo.counts.failed || 0}</strong></span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemHealth;
