import React, { useState, useEffect } from 'react';
import { FileText, Download, Zap, Calendar, Filter, ChevronLeft, ChevronRight, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { reportsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

const REPORT_TABS = [
  { key: 'FLEET_UTILIZATION', label: 'Fleet Utilization', description: 'Vehicle mileage, completed trips, utilization rates, and operational readiness' },
  { key: 'TRIPS', label: 'Trip Operations', description: 'Scheduled vs actual times, origins, destinations, driver assignment, and distance' },
  { key: 'MAINTENANCE', label: 'Maintenance History', description: 'Completed service records, parts/labor costs, vendors, and odometer milestones' },
  { key: 'ALERTS', label: 'Operational Alerts', description: 'Maintenance due/overdue alerts, severity levels, acknowledgment, and resolution timeline' }
];

const Reports = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('FLEET_UTILIZATION');
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState('');

  // Export states
  const [exportLoading, setExportLoading] = useState(false);
  const [asyncJob, setAsyncJob] = useState(null);
  const [asyncPolling, setAsyncPolling] = useState(false);

  const fetchPreview = async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      const res = await reportsApi.getPreview(activeTab, {
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        endDate: endDate ? new Date(endDate + 'T23:59:59Z').toISOString() : undefined,
        status: statusFilter || undefined,
        page,
        limit: 15
      });

      setRows(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load report preview');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPreview(1);
  }, [activeTab, startDate, endDate, statusFilter]);

  // Set quick date preset
  const setDatePreset = (days) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  // Synchronous Direct Export
  const handleDirectExport = async () => {
    try {
      setExportLoading(true);
      setError(null);
      const res = await reportsApi.exportSync(activeTab, {
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        endDate: endDate ? new Date(endDate + 'T23:59:59Z').toISOString() : undefined,
        status: statusFilter || undefined
      });

      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `fleetcore_${activeTab.toLowerCase()}_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Direct export failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setExportLoading(false);
    }
  };

  // Asynchronous BullMQ Export
  const handleAsyncExport = async () => {
    try {
      setExportLoading(true);
      setError(null);
      const res = await reportsApi.exportAsync(activeTab, {
        reportType: activeTab,
        filters: {
          startDate: startDate ? new Date(startDate).toISOString() : undefined,
          endDate: endDate ? new Date(endDate + 'T23:59:59Z').toISOString() : undefined,
          status: statusFilter || undefined
        }
      });

      setAsyncJob({
        jobId: res.data.data.jobId,
        status: 'queued',
        downloadUrl: null
      });
      setAsyncPolling(true);
    } catch (err) {
      setError('Failed to queue background report: ' + (err.response?.data?.message || err.message));
    } finally {
      setExportLoading(false);
    }
  };

  // Poll for background report job completion
  useEffect(() => {
    let timer;
    if (asyncPolling && asyncJob?.jobId) {
      timer = setInterval(async () => {
        try {
          const res = await reportsApi.getJobStatus(asyncJob.jobId);
          const jobData = res.data.data;
          setAsyncJob({
            jobId: jobData.jobId,
            status: jobData.state,
            downloadUrl: jobData.downloadUrl,
            rowCount: jobData.result?.rowCount
          });

          if (jobData.state === 'completed' || jobData.state === 'failed') {
            setAsyncPolling(false);
          }
        } catch (err) {
          setAsyncPolling(false);
        }
      }, 2000);
    }
    return () => clearInterval(timer);
  }, [asyncPolling, asyncJob?.jobId]);

  const activeTabMeta = REPORT_TABS.find(t => t.key === activeTab);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white font-sans">Operational Reporting Engine</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              CSV EXPORTS
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            Generate deterministic compliance, operational analytics, and maintenance audit exports.
          </p>
        </div>

        {/* Export Actions */}
        {(user?.role === 'ADMIN' || user?.role === 'FLEET_MANAGER') && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleDirectExport}
              disabled={exportLoading || loading}
              className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs font-mono transition-colors border border-slate-700 flex items-center gap-1.5 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>{exportLoading ? 'EXPORTING...' : 'EXPORT CSV (DIRECT)'}</span>
            </button>
            <button
              onClick={handleAsyncExport}
              disabled={exportLoading || asyncPolling}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs font-mono shadow-[0_0_20px_-3px_rgba(6,182,212,0.4)] transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>{asyncPolling ? 'PROCESSING JOB...' : 'BULLMQ ASYNC EXPORT'}</span>
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono">
          {error}
        </div>
      )}

      {/* Async Job Progress Banner */}
      {asyncJob && (
        <div className="glass-panel rounded-2xl p-4 border border-cyan-500/40 bg-cyan-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {asyncPolling ? (
              <div className="w-5 h-5 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin"></div>
            ) : asyncJob.status === 'completed' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-400" />
            )}
            <div>
              <div className="text-xs font-mono font-bold text-white">
                BullMQ Worker Job: <span className="text-cyan-400 uppercase">{asyncJob.status}</span>
              </div>
              <div className="text-[11px] font-mono text-slate-400">
                Job ID: {asyncJob.jobId} {asyncJob.rowCount !== undefined && `(${asyncJob.rowCount} rows processed)`}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {asyncJob.status === 'completed' && asyncJob.downloadUrl && (
              <a
                href={asyncJob.downloadUrl}
                download
                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-mono font-bold transition-all shadow-md"
              >
                DOWNLOAD CSV ARTIFACT
              </a>
            )}
            <button
              onClick={() => setAsyncJob(null)}
              className="px-2.5 py-1 text-slate-400 hover:text-slate-200 text-xs font-mono"
            >
              DISMISS
            </button>
          </div>
        </div>
      )}

      {/* Report Tabs */}
      <div className="flex border-b border-slate-800 space-x-2 overflow-x-auto">
        {REPORT_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`py-2.5 px-4 font-mono text-xs whitespace-nowrap rounded-t-xl transition-all ${
              activeTab === tab.key
                ? 'bg-slate-900 border-t border-x border-slate-700 text-cyan-400 font-bold shadow-[0_-5px_15px_rgba(6,182,212,0.1)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Description */}
      <div className="text-xs font-mono text-slate-400 italic">
        {activeTabMeta?.description}
      </div>

      {/* Filter Toolbar */}
      <div className="glass-panel rounded-2xl p-4 border border-slate-800/80 flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Date Presets */}
        <div className="flex items-center space-x-2 font-mono text-xs">
          <span className="text-slate-500 uppercase text-[10px]">Range Presets:</span>
          <button
            onClick={() => setDatePreset(7)}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
          >
            7D
          </button>
          <button
            onClick={() => setDatePreset(30)}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
          >
            30D
          </button>
          <button
            onClick={() => setDatePreset(90)}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
          >
            90D
          </button>
        </div>

        {/* Date Pickers */}
        <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">FROM:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="glass-input rounded-xl px-2.5 py-1 text-xs text-white"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">TO:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="glass-input rounded-xl px-2.5 py-1 text-xs text-white"
            />
          </div>

          {activeTab === 'TRIPS' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="glass-input rounded-xl px-2.5 py-1 text-xs text-white bg-slate-900"
            >
              <option value="" className="bg-slate-900">All Trip Statuses</option>
              <option value="PLANNED" className="bg-slate-900">PLANNED</option>
              <option value="IN_PROGRESS" className="bg-slate-900">IN_PROGRESS</option>
              <option value="COMPLETED" className="bg-slate-900">COMPLETED</option>
              <option value="CANCELLED" className="bg-slate-900">CANCELLED</option>
            </select>
          )}

          {activeTab === 'MAINTENANCE' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="glass-input rounded-xl px-2.5 py-1 text-xs text-white bg-slate-900"
            >
              <option value="" className="bg-slate-900">All Maintenance Statuses</option>
              <option value="SCHEDULED" className="bg-slate-900">SCHEDULED</option>
              <option value="IN_PROGRESS" className="bg-slate-900">IN_PROGRESS</option>
              <option value="COMPLETED" className="bg-slate-900">COMPLETED</option>
              <option value="CANCELLED" className="bg-slate-900">CANCELLED</option>
            </select>
          )}

          {activeTab === 'ALERTS' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="glass-input rounded-xl px-2.5 py-1 text-xs text-white bg-slate-900"
            >
              <option value="" className="bg-slate-900">All Alert Statuses</option>
              <option value="OPEN" className="bg-slate-900">OPEN</option>
              <option value="ACKNOWLEDGED" className="bg-slate-900">ACKNOWLEDGED</option>
              <option value="RESOLVED" className="bg-slate-900">RESOLVED</option>
            </select>
          )}
        </div>
      </div>

      {/* Interactive Table Preview */}
      <div className="glass-panel rounded-2xl border border-slate-800/80 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          {activeTab === 'FLEET_UTILIZATION' && (
            <table className="min-w-full divide-y divide-slate-800/80 text-xs">
              <thead className="bg-slate-900/60 font-mono text-[10px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-5 py-3 text-left">Vehicle Asset</th>
                  <th className="px-5 py-3 text-left">Class / Fuel</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-right">Odometer</th>
                  <th className="px-5 py-3 text-center">Missions</th>
                  <th className="px-5 py-3 text-center">Completed</th>
                  <th className="px-5 py-3 text-center">Success Rate</th>
                  <th className="px-5 py-3 text-right">Distance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300 font-sans">
                {loading ? (
                  <tr><td colSpan="8" className="px-6 py-12 text-center text-slate-500 font-mono">LOADING UTILIZATION PREVIEW...</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan="8" className="px-6 py-12 text-center text-slate-500 font-mono">NO VEHICLES MATCHING RANGE</td></tr>
                ) : (
                  rows.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-850/40">
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-white font-mono">{r.registrationNumber}</div>
                        <div className="text-[10px] text-slate-500">{r.make} {r.model} ({r.year})</div>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-slate-400">{r.vehicleType} / {r.fuelType}</td>
                      <td className="px-5 py-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          r.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-cyan-400">{r.odometerKm?.toLocaleString()} km</td>
                      <td className="px-5 py-3.5 text-center font-mono font-semibold text-white">{r.tripCount}</td>
                      <td className="px-5 py-3.5 text-center font-mono text-emerald-400 font-semibold">{r.completedTrips}</td>
                      <td className="px-5 py-3.5 text-center font-mono font-bold text-cyan-300">{r.completionRatePercent}</td>
                      <td className="px-5 py-3.5 text-right font-mono font-bold text-white">{r.totalDistanceKm?.toLocaleString()} km</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'TRIPS' && (
            <table className="min-w-full divide-y divide-slate-800/80 text-xs">
              <thead className="bg-slate-900/60 font-mono text-[10px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-5 py-3 text-left">Trip ID</th>
                  <th className="px-5 py-3 text-left">Vehicle</th>
                  <th className="px-5 py-3 text-left">Driver</th>
                  <th className="px-5 py-3 text-left">Route Transit</th>
                  <th className="px-5 py-3 text-left">Departure</th>
                  <th className="px-5 py-3 text-right">Distance</th>
                  <th className="px-5 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {loading ? (
                  <tr><td colSpan="7" className="px-6 py-12 text-center text-slate-500 font-mono">LOADING TRIP DATA...</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan="7" className="px-6 py-12 text-center text-slate-500 font-mono">NO TRIPS IN RANGE</td></tr>
                ) : (
                  rows.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-850/40">
                      <td className="px-5 py-3.5 font-mono font-bold text-white">{r.tripNumber}</td>
                      <td className="px-5 py-3.5 font-mono text-cyan-400">{r.vehicleRegistration}</td>
                      <td className="px-5 py-3.5">{r.driverName} <span className="text-slate-500 font-mono">({r.driverEmployeeCode})</span></td>
                      <td className="px-5 py-3.5">{r.origin} &rarr; {r.destination}</td>
                      <td className="px-5 py-3.5 font-mono text-slate-400">{r.scheduledStart ? new Date(r.scheduledStart).toLocaleString() : '-'}</td>
                      <td className="px-5 py-3.5 text-right font-mono font-bold text-cyan-300">{r.distanceKm} km</td>
                      <td className="px-5 py-3.5 text-right">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          r.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400' :
                          r.status === 'IN_PROGRESS' ? 'bg-cyan-500/10 text-cyan-400' :
                          r.status === 'CANCELLED' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'
                        }`}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'MAINTENANCE' && (
            <table className="min-w-full divide-y divide-slate-800/80 text-xs">
              <thead className="bg-slate-900/60 font-mono text-[10px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-5 py-3 text-left">Vehicle</th>
                  <th className="px-5 py-3 text-left">Service Type</th>
                  <th className="px-5 py-3 text-left">Completed Date</th>
                  <th className="px-5 py-3 text-right">Odometer</th>
                  <th className="px-5 py-3 text-right">Cost ($)</th>
                  <th className="px-5 py-3 text-left">Vendor</th>
                  <th className="px-5 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {loading ? (
                  <tr><td colSpan="7" className="px-6 py-12 text-center text-slate-500 font-mono">LOADING MAINTENANCE LOGS...</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan="7" className="px-6 py-12 text-center text-slate-500 font-mono">NO SERVICE RECORDS IN RANGE</td></tr>
                ) : (
                  rows.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-850/40">
                      <td className="px-5 py-3.5 font-mono font-bold text-white">{r.vehicleRegistration}</td>
                      <td className="px-5 py-3.5 font-mono text-cyan-400">{r.serviceType}</td>
                      <td className="px-5 py-3.5 font-mono text-slate-400">{r.completedAt ? new Date(r.completedAt).toLocaleDateString() : '-'}</td>
                      <td className="px-5 py-3.5 text-right font-mono text-slate-300">{r.odometerKm ? `${r.odometerKm.toLocaleString()} km` : '-'}</td>
                      <td className="px-5 py-3.5 text-right font-mono font-bold text-emerald-400">${Number(r.cost || 0).toFixed(2)}</td>
                      <td className="px-5 py-3.5 text-slate-400">{r.vendor || '-'}</td>
                      <td className="px-5 py-3.5 text-right">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          r.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                        }`}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'ALERTS' && (
            <table className="min-w-full divide-y divide-slate-800/80 text-xs">
              <thead className="bg-slate-900/60 font-mono text-[10px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-5 py-3 text-left">Vehicle</th>
                  <th className="px-5 py-3 text-left">Alert Type</th>
                  <th className="px-5 py-3 text-left">Severity</th>
                  <th className="px-5 py-3 text-left">Event Description</th>
                  <th className="px-5 py-3 text-left">Timestamp</th>
                  <th className="px-5 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {loading ? (
                  <tr><td colSpan="6" className="px-6 py-12 text-center text-slate-500 font-mono">LOADING AUDIT ALERTS...</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan="6" className="px-6 py-12 text-center text-slate-500 font-mono">NO ACTIVE ALERTS IN RANGE</td></tr>
                ) : (
                  rows.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-850/40">
                      <td className="px-5 py-3.5 font-mono font-bold text-white">{r.vehicleRegistration}</td>
                      <td className="px-5 py-3.5 font-mono text-cyan-400">{r.type}</td>
                      <td className="px-5 py-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          r.severity === 'CRITICAL' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                          r.severity === 'WARNING' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                          'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                        }`}>
                          {r.severity}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-white">{r.title}</div>
                        <div className="text-[11px] text-slate-400">{r.message}</div>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-slate-400">{new Date(r.createdAt).toLocaleString()}</td>
                      <td className="px-5 py-3.5 text-right">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          r.status === 'RESOLVED' ? 'bg-slate-800 text-slate-400' :
                          r.status === 'ACKNOWLEDGED' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-rose-500/10 text-rose-400'
                        }`}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-5 py-3 bg-slate-900/40 border-t border-slate-800/80 flex items-center justify-between font-mono text-xs text-slate-400">
            <span>
              SHOWING {rows.length} OF {pagination.total} ENTRIES
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => fetchPreview(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="px-3 py-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40"
              >
                PREV
              </button>
              <span className="px-3 py-1 bg-slate-850 rounded-lg text-cyan-400 font-bold">
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => fetchPreview(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="px-3 py-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40"
              >
                NEXT
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;
