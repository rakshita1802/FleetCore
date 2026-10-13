import React, { useState, useEffect } from 'react';
import api, { maintenanceApi, alertsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { connectSocket } from '../services/socket';

export default function Maintenance() {
  const { user } = useAuth();
  const isPrivileged = user?.role === 'ADMIN' || user?.role === 'FLEET_MANAGER';

  // State
  const [activeTab, setActiveTab] = useState('due'); // 'due' | 'schedules' | 'records' | 'alerts'
  const [summary, setSummary] = useState(null);
  const [dueItems, setDueItems] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [records, setRecords] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Modals
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);

  // Form States
  const [scheduleForm, setScheduleForm] = useState({
    vehicleId: '',
    name: '',
    serviceType: 'OIL_CHANGE',
    triggerType: 'TIME_OR_ODOMETER',
    intervalKm: '',
    intervalDays: '',
    lastServiceAt: '',
    lastServiceOdometer: '',
    description: ''
  });

  const [recordForm, setRecordForm] = useState({
    vehicleId: '',
    scheduleId: '',
    serviceType: 'OIL_CHANGE',
    status: 'SCHEDULED',
    description: '',
    odometerAtService: '',
    cost: '',
    vendor: '',
    notes: ''
  });

  const [completeForm, setCompleteForm] = useState({
    odometerAtService: '',
    cost: '',
    vendor: '',
    notes: ''
  });

  const fetchSummaryAndVehicles = async () => {
    try {
      const [sumRes, vehRes] = await Promise.all([
        maintenanceApi.getSummary(),
        api.get('/vehicles?limit=100')
      ]);
      setSummary(sumRes.data.data);
      setVehicles(vehRes.data.data || []);
    } catch (err) {
      console.error("Failed to load summary", err);
    }
  };

  const fetchTabData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'due') {
        const res = await maintenanceApi.getDue({ limit: 50 });
        setDueItems(res.data.data || []);
      } else if (activeTab === 'schedules') {
        const res = await maintenanceApi.getSchedules({ limit: 50 });
        setSchedules(res.data.data || []);
      } else if (activeTab === 'records') {
        const res = await maintenanceApi.getRecords({ limit: 50 });
        setRecords(res.data.data || []);
      } else if (activeTab === 'alerts') {
        const res = await alertsApi.getAll({ limit: 50 });
        setAlerts(res.data.data || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to load maintenance data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummaryAndVehicles();
  }, []);

  useEffect(() => {
    fetchTabData();
  }, [activeTab]);

  // Real-time Socket.IO alerts integration
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const socket = connectSocket(token);

    const onAlertCreated = (newAlert) => {
      setAlerts(prev => [newAlert, ...prev.filter(a => a.id !== newAlert.id)]);
      setSummary(prev => prev ? { ...prev, openAlertsCount: (prev.openAlertsCount || 0) + 1 } : prev);
      showNotification(`🚨 New Alert: ${newAlert.title}`);
    };

    const onAlertAcknowledged = (updatedAlert) => {
      setAlerts(prev => prev.map(a => a.id === updatedAlert.id ? updatedAlert : a));
    };

    const onAlertResolved = (resolvedAlert) => {
      setAlerts(prev => prev.map(a => a.id === resolvedAlert.id ? resolvedAlert : a));
      setSummary(prev => prev ? { ...prev, openAlertsCount: Math.max(0, (prev.openAlertsCount || 1) - 1) } : prev);
    };

    const onReconnect = () => {
      fetchSummaryAndVehicles();
      fetchTabData();
    };

    if (socket) {
      socket.on('alert:created', onAlertCreated);
      socket.on('alert:acknowledged', onAlertAcknowledged);
      socket.on('alert:resolved', onAlertResolved);
      socket.on('reconnect', onReconnect);
    }

    return () => {
      if (socket) {
        socket.off('alert:created', onAlertCreated);
        socket.off('alert:acknowledged', onAlertAcknowledged);
        socket.off('alert:resolved', onAlertResolved);
        socket.off('reconnect', onReconnect);
      }
    };
  }, [activeTab]);

  const showNotification = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Actions
  const handleEvaluate = async () => {
    setActionLoading(true);
    try {
      const res = await maintenanceApi.evaluate();
      const jobId = res.data.data?.jobId || 'queued';
      showNotification(`✓ Maintenance evaluation dispatched to background queue (Job: ${jobId})`);
      setTimeout(() => {
        fetchSummaryAndVehicles();
        fetchTabData();
      }, 1000);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to enqueue maintenance evaluation");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateSchedule = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const payload = {
        vehicleId: scheduleForm.vehicleId,
        name: scheduleForm.name,
        serviceType: scheduleForm.serviceType,
        triggerType: scheduleForm.triggerType,
        description: scheduleForm.description || null,
        intervalKm: scheduleForm.intervalKm ? parseFloat(scheduleForm.intervalKm) : null,
        intervalDays: scheduleForm.intervalDays ? parseInt(scheduleForm.intervalDays, 10) : null,
        lastServiceAt: scheduleForm.lastServiceAt ? new Date(scheduleForm.lastServiceAt).toISOString() : null,
        lastServiceOdometer: scheduleForm.lastServiceOdometer ? parseFloat(scheduleForm.lastServiceOdometer) : null
      };
      await maintenanceApi.createSchedule(payload);
      showNotification("Maintenance schedule created successfully");
      setShowScheduleModal(false);
      setScheduleForm({
        vehicleId: '',
        name: '',
        serviceType: 'OIL_CHANGE',
        triggerType: 'TIME_OR_ODOMETER',
        intervalKm: '',
        intervalDays: '',
        lastServiceAt: '',
        lastServiceOdometer: '',
        description: ''
      });
      fetchSummaryAndVehicles();
      fetchTabData();
    } catch (err) {
      setError(err.response?.data?.message || (err.response?.data?.errors?.[0]?.message) || "Failed to create schedule");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeactivateSchedule = async (id) => {
    if (!window.confirm("Are you sure you want to deactivate this maintenance schedule?")) return;
    setActionLoading(true);
    try {
      await maintenanceApi.deleteSchedule(id);
      showNotification("Schedule deactivated");
      fetchSummaryAndVehicles();
      fetchTabData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to deactivate schedule");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateRecord = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const payload = {
        vehicleId: recordForm.vehicleId,
        scheduleId: recordForm.scheduleId || null,
        serviceType: recordForm.serviceType,
        status: recordForm.status,
        description: recordForm.description || null,
        odometerAtService: recordForm.odometerAtService ? parseFloat(recordForm.odometerAtService) : null,
        cost: recordForm.cost ? parseFloat(recordForm.cost) : null,
        vendor: recordForm.vendor || null,
        notes: recordForm.notes || null
      };
      await maintenanceApi.createRecord(payload);
      showNotification("Maintenance record created successfully");
      setShowRecordModal(false);
      setRecordForm({
        vehicleId: '',
        scheduleId: '',
        serviceType: 'OIL_CHANGE',
        status: 'SCHEDULED',
        description: '',
        odometerAtService: '',
        cost: '',
        vendor: '',
        notes: ''
      });
      fetchSummaryAndVehicles();
      fetchTabData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create maintenance record");
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartRecord = async (id) => {
    setActionLoading(true);
    try {
      await maintenanceApi.startRecord(id, {});
      showNotification("Maintenance marked as In Progress");
      fetchSummaryAndVehicles();
      fetchTabData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to start maintenance");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteRecord = async (e) => {
    e.preventDefault();
    if (!selectedRecord) return;
    setActionLoading(true);
    try {
      const payload = {
        odometerAtService: completeForm.odometerAtService ? parseFloat(completeForm.odometerAtService) : null,
        cost: completeForm.cost ? parseFloat(completeForm.cost) : null,
        vendor: completeForm.vendor || null,
        notes: completeForm.notes || null
      };
      await maintenanceApi.completeRecord(selectedRecord.id, payload);
      showNotification("Maintenance completed successfully! Schedule & active alerts updated.");
      setShowCompleteModal(false);
      setSelectedRecord(null);
      fetchSummaryAndVehicles();
      fetchTabData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to complete maintenance");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelRecord = async (id) => {
    if (!window.confirm("Are you sure you want to cancel this maintenance service?")) return;
    setActionLoading(true);
    try {
      await maintenanceApi.cancelRecord(id, {});
      showNotification("Maintenance record cancelled");
      fetchSummaryAndVehicles();
      fetchTabData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to cancel maintenance");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcknowledgeAlert = async (id) => {
    setActionLoading(true);
    try {
      await alertsApi.acknowledge(id, { notes: "Acknowledged via dashboard" });
      showNotification("Alert acknowledged");
      fetchSummaryAndVehicles();
      fetchTabData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to acknowledge alert");
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolveAlert = async (id) => {
    setActionLoading(true);
    try {
      await alertsApi.resolve(id, { notes: "Resolved manually by operator" });
      showNotification("Alert marked as resolved");
      fetchSummaryAndVehicles();
      fetchTabData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to resolve alert");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Maintenance & Operational Intelligence</h1>
          <p className="text-sm text-slate-500 mt-1">Rule-based vehicle servicing, due interval detection, and operational alerts</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isPrivileged && (
            <>
              <button
                onClick={handleEvaluate}
                disabled={actionLoading}
                className="px-3.5 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 shadow-sm transition-colors flex items-center gap-1.5"
              >
                <span>⚡</span> Run Due Check
              </button>
              <button
                onClick={() => setShowScheduleModal(true)}
                className="px-3.5 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
              >
                + New Schedule
              </button>
              <button
                onClick={() => setShowRecordModal(true)}
                className="px-3.5 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition-colors"
              >
                + Log Service Record
              </button>
            </>
          )}
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm flex items-center justify-between shadow-sm">
          <span>✓ {successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-900 font-bold">&times;</button>
        </div>
      )}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-sm flex items-center justify-between shadow-sm">
          <span>⚠ {error}</span>
          <button onClick={() => setError(null)} className="text-rose-600 hover:text-rose-900 font-bold">&times;</button>
        </div>
      )}

      {/* Summary KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-rose-600">Overdue Service</div>
            <div className="text-2xl font-bold text-rose-700 mt-1">{summary.overdueCount}</div>
            <div className="text-xs text-rose-500 mt-1">Requires urgent action</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-amber-600">Due Soon</div>
            <div className="text-2xl font-bold text-amber-700 mt-1">{summary.dueSoonCount}</div>
            <div className="text-xs text-amber-500 mt-1">Within 30d / 500km</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-blue-600">Scheduled</div>
            <div className="text-2xl font-bold text-blue-700 mt-1">{summary.scheduledCount}</div>
            <div className="text-xs text-blue-500 mt-1">On regular interval</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-indigo-200 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-indigo-600">In Progress</div>
            <div className="text-2xl font-bold text-indigo-700 mt-1">{summary.inProgressCount}</div>
            <div className="text-xs text-indigo-500 mt-1">Undergoing service</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Completed (30d)</div>
            <div className="text-2xl font-bold text-emerald-700 mt-1">{summary.completedRecentlyCount}</div>
            <div className="text-xs text-emerald-500 mt-1">Serviced assets</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-purple-200 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-purple-600">Open Alerts</div>
            <div className="text-2xl font-bold text-purple-700 mt-1">{summary.openAlertsCount}</div>
            <div className="text-xs text-purple-500 mt-1">Active notifications</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('due')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'due'
                ? 'border-indigo-600 text-indigo-600 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            Due & Overdue Items {dueItems.length > 0 && `(${dueItems.length})`}
          </button>
          <button
            onClick={() => setActiveTab('schedules')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'schedules'
                ? 'border-indigo-600 text-indigo-600 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            Active Schedules
          </button>
          <button
            onClick={() => setActiveTab('records')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'records'
                ? 'border-indigo-600 text-indigo-600 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            Service History & Records
          </button>
          <button
            onClick={() => setActiveTab('alerts')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'alerts'
                ? 'border-indigo-600 text-indigo-600 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            Operational Alerts {alerts.filter(a => a.status === 'OPEN').length > 0 && `(${alerts.filter(a => a.status === 'OPEN').length} Open)`}
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-300 border-t-indigo-600 mb-3"></div>
            <div>Loading maintenance intelligence...</div>
          </div>
        ) : (
          <>
            {/* TAB 1: Due Items */}
            {activeTab === 'due' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-xs uppercase tracking-wider">
                      <th className="p-4">Priority</th>
                      <th className="p-4">Vehicle</th>
                      <th className="p-4">Service</th>
                      <th className="p-4">Status & Reason</th>
                      <th className="p-4">Next Due Date</th>
                      <th className="p-4">Next Due Odo</th>
                      <th className="p-4">Current Odo</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dueItems.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="p-8 text-center text-slate-500">
                          ✓ No maintenance items currently due or overdue. All vehicles are on schedule!
                        </td>
                      </tr>
                    ) : (
                      dueItems.map(item => (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                              item.priority === 'HIGH' ? 'bg-rose-100 text-rose-700 border border-rose-200' :
                              item.priority === 'MEDIUM' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                              'bg-blue-100 text-blue-700 border border-blue-200'
                            }`}>
                              {item.priority}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="font-semibold text-slate-900">{item.vehicle?.registrationNumber}</div>
                            <div className="text-xs text-slate-500">{item.vehicle?.make} {item.vehicle?.model}</div>
                          </td>
                          <td className="p-4">
                            <div className="font-medium text-slate-800">{item.name}</div>
                            <div className="text-xs text-slate-500">{item.serviceType}</div>
                          </td>
                          <td className="p-4">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold mb-1 ${
                              item.dueStatus === 'OVERDUE' ? 'bg-rose-600 text-white' :
                              item.dueStatus === 'UPCOMING' ? 'bg-amber-500 text-white' :
                              'bg-slate-500 text-white'
                            }`}>
                              {item.dueStatus}
                            </span>
                            <div className="text-xs text-slate-600">{item.reason}</div>
                          </td>
                          <td className="p-4 text-slate-700">
                            {item.nextDueAt ? new Date(item.nextDueAt).toLocaleDateString() : '—'}
                          </td>
                          <td className="p-4 text-slate-700">
                            {item.nextDueOdometer != null ? `${item.nextDueOdometer.toLocaleString()} km` : '—'}
                          </td>
                          <td className="p-4 text-slate-700 font-mono">
                            {item.vehicle?.odometer ? `${item.vehicle.odometer.toLocaleString()} km` : '0 km'}
                          </td>
                          <td className="p-4 text-right">
                            {isPrivileged && (
                              <button
                                onClick={() => {
                                  setRecordForm(prev => ({
                                    ...prev,
                                    vehicleId: item.vehicleId,
                                    scheduleId: item.id,
                                    serviceType: item.serviceType,
                                    description: `Service for ${item.name}`
                                  }));
                                  setShowRecordModal(true);
                                }}
                                className="px-3 py-1 text-xs font-semibold rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors"
                              >
                                Log Service
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB 2: Active Schedules */}
            {activeTab === 'schedules' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-xs uppercase tracking-wider">
                      <th className="p-4">Schedule Name</th>
                      <th className="p-4">Vehicle</th>
                      <th className="p-4">Service Type</th>
                      <th className="p-4">Intervals</th>
                      <th className="p-4">Last Service</th>
                      <th className="p-4">Next Due Target</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {schedules.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="p-8 text-center text-slate-500">
                          No maintenance schedules configured yet. Click "+ New Schedule" to set up interval-based maintenance.
                        </td>
                      </tr>
                    ) : (
                      schedules.map(sched => (
                        <tr key={sched.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-4 font-semibold text-slate-900">
                            {sched.name}
                            {sched.description && <div className="text-xs font-normal text-slate-500">{sched.description}</div>}
                          </td>
                          <td className="p-4">
                            <span className="font-mono font-medium text-slate-800">{sched.vehicle?.registrationNumber}</span>
                          </td>
                          <td className="p-4">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-medium">
                              {sched.serviceType}
                            </span>
                          </td>
                          <td className="p-4 text-slate-700 text-xs space-y-0.5">
                            {sched.intervalKm && <div>{sched.intervalKm.toLocaleString()} km</div>}
                            {sched.intervalDays && <div>{sched.intervalDays} days</div>}
                          </td>
                          <td className="p-4 text-slate-600 text-xs">
                            {sched.lastServiceAt ? (
                              <div>
                                <div>{new Date(sched.lastServiceAt).toLocaleDateString()}</div>
                                {sched.lastServiceOdometer != null && <div>@ {sched.lastServiceOdometer.toLocaleString()} km</div>}
                              </div>
                            ) : (
                              'Not recorded'
                            )}
                          </td>
                          <td className="p-4 text-slate-700 text-xs">
                            {sched.nextDueAt && <div>Due: {new Date(sched.nextDueAt).toLocaleDateString()}</div>}
                            {sched.nextDueOdometer != null && <div>Due: {sched.nextDueOdometer.toLocaleString()} km</div>}
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                              sched.dueStatus === 'OVERDUE' ? 'bg-rose-100 text-rose-700' :
                              sched.dueStatus === 'UPCOMING' ? 'bg-amber-100 text-amber-700' :
                              'bg-emerald-100 text-emerald-700'
                            }`}>
                              {sched.dueStatus}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            {isPrivileged && (
                              <button
                                onClick={() => handleDeactivateSchedule(sched.id)}
                                className="text-xs text-rose-600 hover:text-rose-800 font-medium"
                              >
                                Deactivate
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB 3: Service Records */}
            {activeTab === 'records' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-xs uppercase tracking-wider">
                      <th className="p-4">Service Type</th>
                      <th className="p-4">Vehicle</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Odometer</th>
                      <th className="p-4">Cost</th>
                      <th className="p-4">Vendor</th>
                      <th className="p-4">Date</th>
                      <th className="p-4 text-right">Lifecycle Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {records.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="p-8 text-center text-slate-500">
                          No service records recorded yet.
                        </td>
                      </tr>
                    ) : (
                      records.map(rec => (
                        <tr key={rec.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-4">
                            <div className="font-semibold text-slate-900">{rec.serviceType}</div>
                            {rec.description && <div className="text-xs text-slate-500">{rec.description}</div>}
                          </td>
                          <td className="p-4 font-mono font-medium text-slate-800">
                            {rec.vehicle?.registrationNumber}
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                              rec.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                              rec.status === 'IN_PROGRESS' ? 'bg-indigo-100 text-indigo-700' :
                              rec.status === 'CANCELLED' ? 'bg-slate-100 text-slate-600' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {rec.status}
                            </span>
                          </td>
                          <td className="p-4 text-slate-700 font-mono text-xs">
                            {rec.odometerAtService != null ? `${rec.odometerAtService.toLocaleString()} km` : '—'}
                          </td>
                          <td className="p-4 text-slate-700 font-medium text-xs">
                            {rec.cost != null ? `$${parseFloat(rec.cost).toFixed(2)}` : '—'}
                          </td>
                          <td className="p-4 text-slate-600 text-xs">
                            {rec.vendor || 'Internal'}
                          </td>
                          <td className="p-4 text-slate-500 text-xs">
                            {rec.completedAt ? new Date(rec.completedAt).toLocaleDateString() : (rec.startedAt ? new Date(rec.startedAt).toLocaleDateString() : new Date(rec.createdAt).toLocaleDateString())}
                          </td>
                          <td className="p-4 text-right space-x-2">
                            {isPrivileged && (
                              <>
                                {rec.status === 'SCHEDULED' && (
                                  <button
                                    onClick={() => handleStartRecord(rec.id)}
                                    className="px-2.5 py-1 text-xs font-medium rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200"
                                  >
                                    Start
                                  </button>
                                )}
                                {(rec.status === 'SCHEDULED' || rec.status === 'IN_PROGRESS') && (
                                  <button
                                    onClick={() => {
                                      setSelectedRecord(rec);
                                      setCompleteForm({
                                        odometerAtService: rec.odometerAtService || rec.vehicle?.odometer || '',
                                        cost: rec.cost || '',
                                        vendor: rec.vendor || '',
                                        notes: rec.notes || ''
                                      });
                                      setShowCompleteModal(true);
                                    }}
                                    className="px-2.5 py-1 text-xs font-medium rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                                  >
                                    Complete
                                  </button>
                                )}
                                {(rec.status === 'SCHEDULED' || rec.status === 'IN_PROGRESS') && (
                                  <button
                                    onClick={() => handleCancelRecord(rec.id)}
                                    className="px-2 py-1 text-xs font-medium rounded text-slate-500 hover:text-rose-600"
                                  >
                                    Cancel
                                  </button>
                                )}
                              </>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB 4: Alerts */}
            {activeTab === 'alerts' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-xs uppercase tracking-wider">
                      <th className="p-4">Severity</th>
                      <th className="p-4">Alert Title</th>
                      <th className="p-4">Vehicle</th>
                      <th className="p-4">Message</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Created</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {alerts.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="p-8 text-center text-slate-500">
                          ✓ No operational alerts. Everything is running smoothly!
                        </td>
                      </tr>
                    ) : (
                      alerts.map(alt => (
                        <tr key={alt.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                              alt.severity === 'CRITICAL' ? 'bg-rose-600 text-white' :
                              alt.severity === 'WARNING' ? 'bg-amber-500 text-white' :
                              'bg-blue-500 text-white'
                            }`}>
                              {alt.severity}
                            </span>
                          </td>
                          <td className="p-4 font-semibold text-slate-900">{alt.title}</td>
                          <td className="p-4 font-mono text-slate-800">{alt.vehicle?.registrationNumber || 'Fleet-wide'}</td>
                          <td className="p-4 text-slate-600 text-xs max-w-xs truncate">{alt.message}</td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                              alt.status === 'OPEN' ? 'bg-rose-100 text-rose-700' :
                              alt.status === 'ACKNOWLEDGED' ? 'bg-amber-100 text-amber-700' :
                              'bg-emerald-100 text-emerald-700'
                            }`}>
                              {alt.status}
                            </span>
                          </td>
                          <td className="p-4 text-slate-500 text-xs">
                            {new Date(alt.createdAt).toLocaleString()}
                          </td>
                          <td className="p-4 text-right space-x-2">
                            {isPrivileged && (
                              <>
                                {alt.status === 'OPEN' && (
                                  <button
                                    onClick={() => handleAcknowledgeAlert(alt.id)}
                                    className="px-2.5 py-1 text-xs font-medium rounded bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
                                  >
                                    Acknowledge
                                  </button>
                                )}
                                {alt.status !== 'RESOLVED' && (
                                  <button
                                    onClick={() => handleResolveAlert(alt.id)}
                                    className="px-2.5 py-1 text-xs font-medium rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                                  >
                                    Resolve
                                  </button>
                                )}
                              </>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* MODAL: Create Schedule */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-slate-900">Create Maintenance Schedule</h3>
              <button onClick={() => setShowScheduleModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-lg">&times;</button>
            </div>
            <form onSubmit={handleCreateSchedule} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Target Vehicle *</label>
                <select
                  required
                  value={scheduleForm.vehicleId}
                  onChange={e => setScheduleForm({ ...scheduleForm, vehicleId: e.target.value })}
                  className="w-full border rounded-lg p-2 text-sm"
                >
                  <option value="">Select vehicle...</option>
                  {vehicles.filter(v => v.status !== 'RETIRED').map(v => (
                    <option key={v.id} value={v.id}>{v.registrationNumber} ({v.make} {v.model}) - {v.odometer} km</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Schedule Name *</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. 10k km Synthetic Oil Service"
                  value={scheduleForm.name}
                  onChange={e => setScheduleForm({ ...scheduleForm, name: e.target.value })}
                  className="w-full border rounded-lg p-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Service Type *</label>
                  <select
                    value={scheduleForm.serviceType}
                    onChange={e => setScheduleForm({ ...scheduleForm, serviceType: e.target.value })}
                    className="w-full border rounded-lg p-2 text-sm"
                  >
                    <option value="OIL_CHANGE">Oil Change</option>
                    <option value="BRAKE_SERVICE">Brake Service</option>
                    <option value="TIRE_SERVICE">Tire Service / Rotation</option>
                    <option value="BATTERY">Battery Inspection</option>
                    <option value="ENGINE_SERVICE">Engine Service</option>
                    <option value="GENERAL_SERVICE">General Service</option>
                    <option value="INSPECTION">Inspection</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Trigger Mechanism</label>
                  <select
                    value={scheduleForm.triggerType}
                    onChange={e => setScheduleForm({ ...scheduleForm, triggerType: e.target.value })}
                    className="w-full border rounded-lg p-2 text-sm"
                  >
                    <option value="TIME_OR_ODOMETER">Time OR Odometer</option>
                    <option value="ODOMETER">Odometer Only</option>
                    <option value="TIME">Time Only</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Interval (km)</label>
                  <input
                    type="number"
                    placeholder="e.g. 10000"
                    value={scheduleForm.intervalKm}
                    onChange={e => setScheduleForm({ ...scheduleForm, intervalKm: e.target.value })}
                    className="w-full border rounded-lg p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Interval (Days)</label>
                  <input
                    type="number"
                    placeholder="e.g. 180"
                    value={scheduleForm.intervalDays}
                    onChange={e => setScheduleForm({ ...scheduleForm, intervalDays: e.target.value })}
                    className="w-full border rounded-lg p-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Last Service Date</label>
                  <input
                    type="date"
                    value={scheduleForm.lastServiceAt}
                    onChange={e => setScheduleForm({ ...scheduleForm, lastServiceAt: e.target.value })}
                    className="w-full border rounded-lg p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Last Service Odometer (km)</label>
                  <input
                    type="number"
                    placeholder="e.g. 20000"
                    value={scheduleForm.lastServiceOdometer}
                    onChange={e => setScheduleForm({ ...scheduleForm, lastServiceOdometer: e.target.value })}
                    className="w-full border rounded-lg p-2 text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-lg text-sm bg-indigo-600 text-white font-medium hover:bg-indigo-700"
                >
                  {actionLoading ? 'Creating...' : 'Save Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Create Record */}
      {showRecordModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-slate-900">Log Maintenance Service Record</h3>
              <button onClick={() => setShowRecordModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-lg">&times;</button>
            </div>
            <form onSubmit={handleCreateRecord} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Target Vehicle *</label>
                <select
                  required
                  value={recordForm.vehicleId}
                  onChange={e => setRecordForm({ ...recordForm, vehicleId: e.target.value })}
                  className="w-full border rounded-lg p-2 text-sm"
                >
                  <option value="">Select vehicle...</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.registrationNumber} ({v.make} {v.model})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Service Type *</label>
                  <select
                    value={recordForm.serviceType}
                    onChange={e => setRecordForm({ ...recordForm, serviceType: e.target.value })}
                    className="w-full border rounded-lg p-2 text-sm"
                  >
                    <option value="OIL_CHANGE">Oil Change</option>
                    <option value="BRAKE_SERVICE">Brake Service</option>
                    <option value="TIRE_SERVICE">Tire Service / Rotation</option>
                    <option value="BATTERY">Battery</option>
                    <option value="ENGINE_SERVICE">Engine Service</option>
                    <option value="GENERAL_SERVICE">General Service</option>
                    <option value="INSPECTION">Inspection</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Initial Status</label>
                  <select
                    value={recordForm.status}
                    onChange={e => setRecordForm({ ...recordForm, status: e.target.value })}
                    className="w-full border rounded-lg p-2 text-sm"
                  >
                    <option value="SCHEDULED">Scheduled</option>
                    <option value="IN_PROGRESS">In Progress</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  placeholder="e.g. Front brake pad replacement"
                  value={recordForm.description}
                  onChange={e => setRecordForm({ ...recordForm, description: e.target.value })}
                  className="w-full border rounded-lg p-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Vendor / Workshop</label>
                  <input
                    type="text"
                    placeholder="e.g. Official Service Center"
                    value={recordForm.vendor}
                    onChange={e => setRecordForm({ ...recordForm, vendor: e.target.value })}
                    className="w-full border rounded-lg p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Estimated Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={recordForm.cost}
                    onChange={e => setRecordForm({ ...recordForm, cost: e.target.value })}
                    className="w-full border rounded-lg p-2 text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowRecordModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-lg text-sm bg-indigo-600 text-white font-medium hover:bg-indigo-700"
                >
                  {actionLoading ? 'Saving...' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Complete Record */}
      {showCompleteModal && selectedRecord && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-slate-900">Complete Maintenance Service</h3>
              <button onClick={() => setShowCompleteModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-lg">&times;</button>
            </div>
            <form onSubmit={handleCompleteRecord} className="space-y-4">
              <p className="text-xs text-slate-600">
                Marking <strong>{selectedRecord.serviceType}</strong> for vehicle <strong>{selectedRecord.vehicle?.registrationNumber}</strong> as completed. This will advance related schedule intervals and resolve active alerts.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Odometer at Service (km) *</label>
                <input
                  required
                  type="number"
                  step="0.1"
                  placeholder="e.g. 50200"
                  value={completeForm.odometerAtService}
                  onChange={e => setCompleteForm({ ...completeForm, odometerAtService: e.target.value })}
                  className="w-full border rounded-lg p-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Final Service Cost ($)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 185.50"
                  value={completeForm.cost}
                  onChange={e => setCompleteForm({ ...completeForm, cost: e.target.value })}
                  className="w-full border rounded-lg p-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Vendor / Workshop</label>
                <input
                  type="text"
                  placeholder="e.g. Fleet Workshop A"
                  value={completeForm.vendor}
                  onChange={e => setCompleteForm({ ...completeForm, vendor: e.target.value })}
                  className="w-full border rounded-lg p-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Work Notes</label>
                <textarea
                  rows="2"
                  placeholder="Work performed, parts replaced, etc."
                  value={completeForm.notes}
                  onChange={e => setCompleteForm({ ...completeForm, notes: e.target.value })}
                  className="w-full border rounded-lg p-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowCompleteModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-lg text-sm bg-emerald-600 text-white font-medium hover:bg-emerald-700"
                >
                  {actionLoading ? 'Completing...' : 'Confirm Completion'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
