import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { BarChart3, TrendingUp, Route, CheckCircle2, Clock, Truck, ShieldAlert } from 'lucide-react';

export default function AnalyticsDashboard() {
  const [dateRange, setDateRange] = useState('30days');
  const [overview, setOverview] = useState(null);
  const [trends, setTrends] = useState([]);
  const [utilization, setUtilization] = useState(null);
  const [idleTime, setIdleTime] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAnalytics = async () => {
    setLoading(true);
    setError('');
    
    const end = new Date();
    const start = new Date();
    if (dateRange === '7days') start.setDate(end.getDate() - 7);
    else if (dateRange === '30days') start.setDate(end.getDate() - 30);
    else if (dateRange === 'today') start.setHours(0, 0, 0, 0);

    const query = `?startDate=${start.toISOString()}&endDate=${end.toISOString()}`;

    try {
      const [overviewRes, trendsRes, utilRes, idleRes] = await Promise.all([
        api.get(`/analytics/overview${query}`),
        api.get(`/analytics/trends${query}&groupBy=day`),
        api.get(`/analytics/utilization${query}`),
        api.get(`/analytics/idle-time${query}`)
      ]);

      setOverview(overviewRes.data.data);
      setTrends(trendsRes.data.data);
      setUtilization(utilRes.data.data);
      setIdleTime(idleRes.data.data);
    } catch (err) {
      console.error(err);
      setError('Failed to load fleet intelligence analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  if (loading && !overview) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400 font-mono text-sm gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin"></div>
        <span>COMPUTING FLEET TELEMETRY INTELLIGENCE...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 font-mono text-xs">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white font-sans">Fleet Operations Intelligence</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              ANALYTICS ENGINE
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            Cross-fleet utilization benchmarks, transit efficiency, and telemetry idle times.
          </p>
        </div>

        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="glass-input rounded-xl px-3 py-2 text-xs text-white bg-slate-900 font-mono w-44"
        >
          <option value="today" className="bg-slate-900">Today (24 Hours)</option>
          <option value="7days" className="bg-slate-900">Last 7 Days</option>
          <option value="30days" className="bg-slate-900">Last 30 Days</option>
        </select>
      </div>

      {/* Top Level KPI Cards */}
      {overview && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard 
            title="Total Mileage" 
            value={`${overview.totalDistanceKm.toLocaleString()} km`} 
            subtitle="Cumulative distance traversed across missions"
            glow="glow-cyan"
            accent="text-cyan-400"
          />
          <KpiCard 
            title="Dispatch Completion" 
            value={overview.completionRate !== null ? `${(overview.completionRate * 100).toFixed(1)}%` : 'N/A'} 
            subtitle="Completed vs cancelled mission ratio"
            glow="glow-emerald"
            accent="text-emerald-400"
          />
          <KpiCard 
            title="Asset Utilization" 
            value={`${((utilization?.utilizationRate || 0) * 100).toFixed(1)}%`} 
            subtitle="Percentage of active assets engaged in routes"
            glow="glow-indigo"
            accent="text-indigo-400"
          />
          <KpiCard 
            title="Total Idle Duration" 
            value={`${overview.totalIdleTimeMinutes} min`} 
            subtitle="Telemetry-confirmed stationary engine run-time"
            glow="glow-amber"
            accent="text-amber-400"
          />
        </div>
      )}

      {/* Trip Metric Breakdown Strip */}
      {overview && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <StatBox label="Total Dispatches" value={overview.totalTrips} />
          <StatBox label="Completed" value={overview.completedTrips} color="text-emerald-400" />
          <StatBox label="In Transit" value={overview.inProgressTrips} color="text-cyan-400" />
          <StatBox label="Planned" value={overview.plannedTrips} color="text-slate-300" />
          <StatBox label="Cancelled" value={overview.cancelledTrips} color="text-rose-400" />
        </div>
      )}

      {/* Recharts Trends */}
      {trends.length > 0 && (
        <div className="glass-panel rounded-2xl p-6 border border-slate-800/80">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-bold font-mono uppercase tracking-wider text-white">Daily Transit Trends (Mileage & Trips)</h2>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="flex items-center gap-1 text-cyan-400">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block"></span> Distance (km)
              </span>
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block"></span> Missions
              </span>
            </div>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="period" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(15, 23, 42, 0.95)', 
                    borderColor: 'rgba(255,255,255,0.1)', 
                    borderRadius: '12px',
                    color: '#F1F5F9',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)'
                  }} 
                />
                <Line yAxisId="left" type="monotone" dataKey="distanceKm" name="Distance (km)" stroke="#06B6D4" strokeWidth={3} dot={{ fill: '#06B6D4', r: 3 }} activeDot={{ r: 6 }} />
                <Line yAxisId="right" type="monotone" dataKey="tripCount" name="Trips" stroke="#10B981" strokeWidth={3} dot={{ fill: '#10B981', r: 3 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Asset Usage Rankings & Idle Times */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vehicle Usage */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800/80">
          <div className="flex items-center gap-2 mb-4">
            <Truck className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-bold font-mono uppercase tracking-wider text-white">Asset Mileage & Utilization Ranking</h2>
          </div>
          <div className="overflow-y-auto max-h-72">
            <table className="min-w-full text-xs text-left">
              <thead className="text-[10px] font-mono text-slate-400 uppercase bg-slate-900/60 sticky top-0">
                <tr>
                  <th className="px-4 py-2.5">Asset Registration</th>
                  <th className="px-4 py-2.5">Missions</th>
                  <th className="px-4 py-2.5">Distance</th>
                  <th className="px-4 py-2.5">Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {utilization?.vehicleRankings?.length > 0 ? utilization.vehicleRankings.map((v) => (
                  <tr key={v.vehicleId} className="hover:bg-slate-850/40">
                    <td className="px-4 py-2.5 font-bold text-white">{v.registrationNumber}</td>
                    <td className="px-4 py-2.5 text-slate-300">{v.tripCount}</td>
                    <td className="px-4 py-2.5 text-cyan-400">{v.distanceKm} km</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                        v.utilizationRate > 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {v.utilizationRate > 0 ? 'ENGAGED' : 'IDLE'}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="4" className="px-4 py-6 text-center text-slate-500">NO USAGE DATA RECORDED</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Idle Vehicles */}
        <div className="glass-panel rounded-2xl p-6 border border-slate-800/80">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold font-mono uppercase tracking-wider text-white">Top Stationary Engine Idle Times</h2>
          </div>
          <div className="overflow-y-auto max-h-72">
            <table className="min-w-full text-xs text-left">
              <thead className="text-[10px] font-mono text-slate-400 uppercase bg-slate-900/60 sticky top-0">
                <tr>
                  <th className="px-4 py-2.5">Asset Registration</th>
                  <th className="px-4 py-2.5">Idle Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {idleTime?.vehicleRankings?.length > 0 ? idleTime.vehicleRankings.slice(0, 10).map((v) => (
                  <tr key={v.vehicleId} className="hover:bg-slate-850/40">
                    <td className="px-4 py-2.5 font-bold text-white">{v.registrationNumber}</td>
                    <td className="px-4 py-2.5 text-amber-400 font-bold">{v.idleMinutes} minutes</td>
                  </tr>
                )) : (
                  <tr><td colSpan="2" className="px-4 py-6 text-center text-slate-500">NO IDLE TIME ANOMALIES DETECTED</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

const KpiCard = ({ title, value, subtitle, accent = "text-white" }) => (
  <div className="glass-card rounded-2xl p-5 border border-slate-800/80 flex flex-col justify-between relative overflow-hidden">
    <h3 className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider">{title}</h3>
    <div className={`text-3xl font-bold font-mono mt-2 ${accent}`}>{value}</div>
    {subtitle && <p className="text-[11px] text-slate-500 mt-2 font-sans">{subtitle}</p>}
  </div>
);

const StatBox = ({ label, value, color = "text-white" }) => (
  <div className="glass-panel rounded-xl p-3 border border-slate-800/60 flex flex-col items-center justify-center text-center">
    <div className={`text-xl font-bold font-mono ${color}`}>{value}</div>
    <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mt-1">{label}</div>
  </div>
);
