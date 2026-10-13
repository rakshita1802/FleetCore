import React, { useState, useEffect } from 'react';
import { ScrollText, RefreshCw, Filter, Eye, ChevronLeft, ChevronRight, X, Shield, Terminal } from 'lucide-react';
import { auditApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

const AUDIT_ACTION_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'LOGIN_SUCCESS', label: 'Login Success' },
  { value: 'LOGIN_FAILED', label: 'Login Failed' },
  { value: 'USER_CREATED', label: 'User Created' },
  { value: 'USER_UPDATED', label: 'User Updated' },
  { value: 'USER_ROLE_CHANGED', label: 'Role Changed' },
  { value: 'USER_ACTIVATED', label: 'User Activated' },
  { value: 'USER_DEACTIVATED', label: 'User Deactivated' },
  { value: 'VEHICLE_CREATED', label: 'Vehicle Created' },
  { value: 'DRIVER_CREATED', label: 'Driver Created' },
  { value: 'MAINTENANCE_CREATED', label: 'Maintenance Scheduled' },
  { value: 'MAINTENANCE_COMPLETED', label: 'Maintenance Completed' },
  { value: 'ALERT_ACKNOWLEDGED', label: 'Alert Acknowledged' },
  { value: 'ALERT_RESOLVED', label: 'Alert Resolved' },
  { value: 'REPORT_EXPORTED', label: 'Report Exported' }
];

const AuditLogs = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [selectedLogMetadata, setSelectedLogMetadata] = useState(null);

  const fetchLogs = async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      const res = await auditApi.getLogs({
        action: actionFilter || undefined,
        entityType: entityFilter || undefined,
        page,
        limit: 20
      });

      setLogs(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch audit records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1);
  }, [actionFilter, entityFilter]);

  const getActionBadgeColor = (action) => {
    if (action.includes('LOGIN_SUCCESS')) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    if (action.includes('LOGIN_FAILED')) return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    if (action.includes('ROLE_CHANGED') || action.includes('DEACTIVATED')) return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    if (action.includes('USER_CREATED') || action.includes('ACTIVATED')) return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
    if (action.includes('ALERT_RESOLVED') || action.includes('COMPLETED')) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    return 'bg-slate-800 text-slate-300 border-slate-700';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white font-sans">Audit Ledger & Security Trail</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              IMMUTABLE
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            Chronicle of authentication events, user administration, state mutations, and telemetry exports.
          </p>
        </div>
        <button
          onClick={() => fetchLogs(pagination.page)}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-mono transition-colors border border-slate-700"
        >
          <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
          <span>REFRESH LOGS</span>
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono">
          {error}
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="glass-panel rounded-2xl p-4 border border-slate-800/80 flex flex-wrap gap-3 items-center font-mono text-xs">
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="glass-input rounded-xl px-3 py-2 text-xs text-white bg-slate-900"
        >
          {AUDIT_ACTION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-slate-900">{opt.label}</option>
          ))}
        </select>

        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="glass-input rounded-xl px-3 py-2 text-xs text-white bg-slate-900"
        >
          <option value="" className="bg-slate-900">All Entity Types</option>
          <option value="USER" className="bg-slate-900">USER</option>
          <option value="VEHICLE" className="bg-slate-900">VEHICLE</option>
          <option value="DRIVER" className="bg-slate-900">DRIVER</option>
          <option value="TRIP" className="bg-slate-900">TRIP</option>
          <option value="MAINTENANCE_RECORD" className="bg-slate-900">MAINTENANCE_RECORD</option>
          <option value="ALERT" className="bg-slate-900">ALERT</option>
          <option value="REPORT" className="bg-slate-900">REPORT</option>
        </select>
      </div>

      {/* Audit Log Table */}
      <div className="glass-panel rounded-2xl border border-slate-800/80 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800/80 text-xs">
            <thead className="bg-slate-900/60 font-mono text-[10px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-6 py-3.5 text-left">Timestamp (UTC)</th>
                <th className="px-6 py-3.5 text-left">Actor / Authenticated User</th>
                <th className="px-6 py-3.5 text-left">Action Event</th>
                <th className="px-6 py-3.5 text-left">Target Entity & ID</th>
                <th className="px-6 py-3.5 text-left">Client IP</th>
                <th className="px-6 py-3.5 text-right">Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300 font-sans">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-500 font-mono">
                    STREAMING IMMUTABLE AUDIT EVENTS...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-500 font-mono">
                    NO AUDIT RECORDS MATCH CURRENT FILTER PARAMETERS
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-850/40 transition-colors">
                    <td className="px-6 py-4 font-mono text-slate-400 whitespace-nowrap text-[11px]">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      {log.user ? (
                        <div>
                          <div className="font-semibold text-white">{log.user.name}</div>
                          <div className="text-[10px] font-mono text-cyan-400">{log.user.email} &bull; {log.user.role}</div>
                        </div>
                      ) : (
                        <span className="text-[11px] font-mono text-slate-500 italic">SYSTEM PROCESS</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold border ${getActionBadgeColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-white font-mono text-xs">{log.entityType}</span>
                      {log.entityId && (
                        <div className="font-mono text-[10px] text-slate-500 truncate max-w-[140px]">{log.entityId}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-400 text-xs">
                      {log.ipAddress || '::1'}
                    </td>
                    <td className="px-6 py-4 text-right font-mono">
                      {log.metadata ? (
                        <button
                          onClick={() => setSelectedLogMetadata(log)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700"
                        >
                          <Eye className="w-3.5 h-3.5 text-cyan-400" />
                          <span>META</span>
                        </button>
                      ) : (
                        <span className="text-slate-600 text-xs">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-6 py-3 bg-slate-900/40 border-t border-slate-800/80 flex items-center justify-between font-mono text-xs text-slate-400">
            <span>
              SHOWING {logs.length} OF {pagination.total} AUDIT RECORDS
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => fetchLogs(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="px-3 py-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40"
              >
                PREV
              </button>
              <span className="px-3 py-1 bg-slate-850 rounded-lg text-cyan-400 font-bold">
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => fetchLogs(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="px-3 py-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40"
              >
                NEXT
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal: View Metadata */}
      {selectedLogMetadata && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="glass-panel rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-700 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold font-mono text-white">Event Payload Inspector</h3>
              </div>
              <button
                onClick={() => setSelectedLogMetadata(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-[#05070B] text-cyan-400 p-4 rounded-xl font-mono text-xs overflow-x-auto max-h-80 border border-slate-800 shadow-inner">
              <pre>{JSON.stringify(selectedLogMetadata.metadata, null, 2)}</pre>
            </div>

            <div className="flex justify-end font-mono text-xs">
              <button
                onClick={() => setSelectedLogMetadata(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogs;
