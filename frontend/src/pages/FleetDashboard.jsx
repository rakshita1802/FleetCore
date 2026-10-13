import React, { useEffect, useState, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, useMap } from 'react-leaflet';
import { Link } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { 
  Truck, 
  Activity, 
  AlertTriangle, 
  PowerOff, 
  Navigation, 
  Radio, 
  Search, 
  SlidersHorizontal, 
  Gauge, 
  Fuel, 
  User, 
  Clock, 
  Crosshair, 
  Compass, 
  Layers, 
  Maximize2,
  Zap,
  MapPin,
  Play,
  Pause,
  RotateCcw,
  FastForward,
  ShieldAlert
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api, { simulatorApi, geofencesApi } from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';

// Fix Leaflet marker asset paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom glowing radar marker for vehicles with dynamic compass heading
const createRadarMarkerIcon = (status, registrationNumber, isSelected, heading = 0, speed = 0) => {
  const isOnline = status === 'ONLINE';
  const isStale = status === 'STALE';
  const isMoving = (speed || 0) > 3;
  
  const ringColor = isOnline ? 'rgba(16, 185, 129, 0.45)' : isStale ? 'rgba(245, 158, 11, 0.4)' : 'rgba(148, 163, 184, 0.3)';
  const coreColor = isOnline ? '#10B981' : isStale ? '#F59E0B' : '#64748B';
  const glowShadow = isOnline ? '0 0 16px #10B981' : isStale ? '0 0 16px #F59E0B' : 'none';
  const borderStyle = isSelected ? 'border: 2px solid #38BDF8; box-shadow: 0 0 22px #38BDF8;' : `border: 2px solid rgba(255,255,255,0.85); box-shadow: ${glowShadow};`;

  const html = `
    <div class="relative flex items-center justify-center" style="width: 40px; height: 40px;">
      ${isOnline && isMoving ? `<div class="radar-ring" style="background: ${ringColor};"></div>` : ''}
      <div style="background-color: ${coreColor}; width: 22px; height: 22px; border-radius: 50%; ${borderStyle}; display: flex; align-items: center; justify-content: center; position: relative; z-index: 10;">
        ${isMoving ? `
          <svg style="transform: rotate(${heading || 0}deg); width: 13px; height: 13px; fill: #ffffff; transition: transform 0.5s ease-out;" viewBox="0 0 24 24">
            <polygon points="12,2 22,21 12,17 2,21" />
          </svg>
        ` : `
          <div style="width: 6px; height: 6px; border-radius: 50%; background: #ffffff;"></div>
        `}
      </div>
      <div style="position: absolute; bottom: -18px; white-space: nowrap; font-size: 10px; font-weight: 700; font-family: monospace; color: #F1F5F9; background: rgba(15, 23, 42, 0.9); padding: 1px 6px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.18); box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.5); pointer-events: none;">
        ${registrationNumber || 'VEH'}
      </div>
    </div>
  `;

  return L.divIcon({
    className: 'custom-radar-marker',
    html: html,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -22]
  });
};

// Component to handle smooth map centering and flying to selected vehicles
function MapFlyToHandler({ selectedVehicle }) {
  const map = useMap();
  useEffect(() => {
    if (selectedVehicle && selectedVehicle.latitude != null && selectedVehicle.longitude != null) {
      map.flyTo([selectedVehicle.latitude, selectedVehicle.longitude], 15, {
        duration: 1.2,
        easeLinearity: 0.25
      });
    }
  }, [selectedVehicle, map]);
  return null;
}

export default function FleetDashboard() {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState({});
  const [loading, setLoading] = useState(true);
  const [socketStatus, setSocketStatus] = useState('connecting');
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);
  
  // Search and filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Autonomous GPS Simulator State
  const [simStatus, setSimStatus] = useState({
    running: true,
    activeVehicles: 5,
    speedMultiplier: 1,
    tickCount: 0,
    intervalMs: 2500,
    city: 'Coimbatore, Tamil Nadu'
  });
  const [simActionLoading, setSimActionLoading] = useState(false);
  const [geofences, setGeofences] = useState([]);
  const [breachToast, setBreachToast] = useState(null);

  // Fetch simulator status
  const fetchSimulatorStatus = async () => {
    try {
      const res = await simulatorApi.getStatus();
      if (res.data?.success && res.data?.data) {
        setSimStatus(res.data.data);
      }
    } catch (err) {
      console.error("Failed to fetch simulator status", err);
    }
  };

  const handleToggleSimulation = async () => {
    try {
      setSimActionLoading(true);
      if (simStatus?.running) {
        const res = await simulatorApi.stop();
        if (res.data?.success && res.data?.data) setSimStatus(res.data.data);
      } else {
        const res = await simulatorApi.start();
        if (res.data?.success && res.data?.data) setSimStatus(res.data.data);
      }
    } catch (err) {
      console.error("Failed to toggle simulator", err);
    } finally {
      setSimActionLoading(false);
    }
  };

  const handleSetSpeed = async (multiplier) => {
    try {
      setSimActionLoading(true);
      const res = await simulatorApi.setSpeed(multiplier);
      if (res.data?.success && res.data?.data) setSimStatus(res.data.data);
    } catch (err) {
      console.error("Failed to set simulator speed", err);
    } finally {
      setSimActionLoading(false);
    }
  };

  const handleResetSimulation = async () => {
    try {
      setSimActionLoading(true);
      const res = await simulatorApi.reset();
      if (res.data?.success && res.data?.data) setSimStatus(res.data.data);
    } catch (err) {
      console.error("Failed to reset simulator", err);
    } finally {
      setSimActionLoading(false);
    }
  };

  useEffect(() => {
    // 1. Fetch Initial Snapshot
    const fetchSnapshot = async () => {
      try {
        const res = await api.get('/fleet/live');
        const stateMap = {};
        res.data.data.forEach(v => {
          stateMap[v.vehicleId] = v;
        });
        setVehicles(stateMap);
      } catch (err) {
        console.error("Failed to fetch live fleet snapshot", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSnapshot();
    fetchSimulatorStatus();

    // Fetch active geofences for map overlay
    geofencesApi.getAll()
      .then(res => {
        if (res.data?.data) {
          setGeofences(res.data.data.filter(g => g.isActive));
        }
      })
      .catch(() => {});

    // Poll simulator stats periodically
    const simInterval = setInterval(fetchSimulatorStatus, 4000);

    // 2. Connect Live Socket
    const token = localStorage.getItem('accessToken');
    const socket = connectSocket(token);

    const handleConnect = () => {
      setSocketStatus('connected');
      fetchSnapshot();
      fetchSimulatorStatus();
    };

    const handleDisconnect = () => {
      setSocketStatus('disconnected');
    };

    const handleVehicleUpdate = (updateData) => {
      setVehicles(prev => {
        const existing = prev[updateData.vehicleId];
        if (existing && existing.timestamp && updateData.timestamp) {
          if (new Date(updateData.timestamp).getTime() < new Date(existing.timestamp).getTime()) {
            return prev;
          }
        }
        return {
          ...prev,
          [updateData.vehicleId]: {
            ...existing,
            ...updateData
          }
        };
      });
    };

    const handleGeofenceBreach = (payload) => {
      if (payload?.breach) {
        setBreachToast(payload.breach);
        setTimeout(() => setBreachToast(null), 7000);
      }
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('fleet:vehicle:update', handleVehicleUpdate);
    socket.on('geofence:breach', handleGeofenceBreach);

    return () => {
      clearInterval(simInterval);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('fleet:vehicle:update', handleVehicleUpdate);
      socket.off('geofence:breach', handleGeofenceBreach);
      disconnectSocket();
    };
  }, []);

  const vehicleList = Object.values(vehicles);
  
  // Apply filters
  const filteredVehicles = useMemo(() => {
    return vehicleList.filter(v => {
      const matchSearch = (v.registrationNumber || v.vehicleId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (v.make || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (v.model || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (v.driverName || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter === 'ALL' || v.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [vehicleList, searchTerm, statusFilter]);

  // Summaries
  const onlineCount = vehicleList.filter(v => v.status === 'ONLINE').length;
  const staleCount = vehicleList.filter(v => v.status === 'STALE').length;
  const offlineCount = vehicleList.filter(v => v.status === 'OFFLINE').length;
  const activeTripsCount = vehicleList.filter(v => v.tripId).length;

  const selectedVehicle = selectedVehicleId ? vehicles[selectedVehicleId] : (filteredVehicles[0] || null);

  return (
    <div className="space-y-6">
      {/* Real-time Breach Notification Toast Banner */}
      {breachToast && (
        <div className="p-4 rounded-2xl bg-rose-950/90 border border-rose-500/80 shadow-[0_0_25px_rgba(244,63,94,0.35)] flex items-center justify-between gap-3 text-white backdrop-blur-xl animate-bounce">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/40">
              <ShieldAlert className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-rose-300 uppercase">GEOFENCE INTRUSION DETECTED</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-500/30 text-rose-200">PERIMETER ALERT</span>
              </div>
              <p className="text-xs text-white mt-0.5">
                Vehicle <strong className="font-mono">{breachToast.vehicle?.registrationNumber || 'VEHICLE'}</strong> breached <strong className="text-rose-300">{breachToast.geofence?.name || 'Restricted Boundary'}</strong> at {breachToast.speedKph?.toFixed(0) || 0} km/h
              </p>
            </div>
          </div>
          <Link to="/geofences" className="px-3.5 py-1.5 rounded-xl font-mono text-xs font-bold bg-rose-500 hover:bg-rose-400 text-slate-950 transition-all shrink-0">
            INSPECT ZONE
          </Link>
        </div>
      )}

      {/* Top Banner & Quick Telemetry Metrics */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white font-sans">
              Live Fleet Command Center
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              REAL-TIME GPS
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            Real-time geospatial vehicle coordinates, live CAN bus diagnostics, and driver status.
          </p>
        </div>

        {/* Live Status Pill */}
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border backdrop-blur-md text-xs font-mono transition-all ${
            socketStatus === 'connected' 
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400 shadow-[0_0_15px_-3px_rgba(16,185,129,0.3)]' 
              : socketStatus === 'connecting'
              ? 'bg-amber-950/40 border-amber-500/40 text-amber-400 shadow-[0_0_15px_-3px_rgba(245,158,11,0.3)]'
              : 'bg-rose-950/40 border-rose-500/40 text-rose-400 shadow-[0_0_15px_-3px_rgba(244,63,94,0.3)]'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              socketStatus === 'connected' ? 'bg-emerald-400 animate-pulse' :
              socketStatus === 'connecting' ? 'bg-amber-400 animate-ping' : 'bg-rose-500'
            }`}></span>
            <span>
              {socketStatus === 'connected' ? 'LIVE RADAR SYNCHRONIZED' : socketStatus === 'connecting' ? 'CONNECTING TELEMETRY...' : 'STREAM OFFLINE'}
            </span>
          </div>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Total Fleet */}
        <div className="glass-card rounded-2xl p-4 border border-slate-800/80 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400">Total Fleet</span>
            <div className="p-2 rounded-xl bg-slate-800/60 text-slate-300 border border-slate-700/50">
              <Truck className="w-4 h-4 text-cyan-400" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-white">{vehicleList.length}</span>
            <span className="text-[11px] text-slate-500">Assets</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-500 to-transparent"></div>
        </div>

        {/* Online / Active */}
        <div className="glass-card rounded-2xl p-4 border border-emerald-950/50 relative overflow-hidden group bg-gradient-to-br from-[#0A1A17]/60 to-[#070D12]/80">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-emerald-400">Online & Moving</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Activity className="w-4 h-4 animate-pulse" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-emerald-400">{onlineCount}</span>
            <span className="text-[11px] text-emerald-500/80">Streaming</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 to-transparent"></div>
        </div>

        {/* Stale / Idle */}
        <div className="glass-card rounded-2xl p-4 border border-amber-950/50 relative overflow-hidden group bg-gradient-to-br from-[#1A160A]/60 to-[#0F0D07]/80">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-amber-400">Stale / Idle</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-amber-400">{staleCount}</span>
            <span className="text-[11px] text-amber-500/80">&gt; 30s delay</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-500 to-transparent"></div>
        </div>

        {/* Inactive / Depot */}
        <div className="glass-card rounded-2xl p-4 border border-slate-800/80 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400">Offline / Depot</span>
            <div className="p-2 rounded-xl bg-slate-800/60 text-slate-400 border border-slate-700/50">
              <PowerOff className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-slate-400">{offlineCount}</span>
            <span className="text-[11px] text-slate-500">Parked</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-slate-600 to-transparent"></div>
        </div>

        {/* Active Dispatches */}
        <div className="glass-card rounded-2xl p-4 border border-indigo-950/50 relative overflow-hidden group bg-gradient-to-br from-[#0F1123]/60 to-[#070914]/80">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-indigo-400">Active Dispatches</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Navigation className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-indigo-400">{activeTripsCount}</span>
            <span className="text-[11px] text-indigo-500/80">En Route</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-500 to-transparent"></div>
        </div>
      </div>

      {/* Main Command Center Grid: 2/3 Map & Inspector + 1/3 Live Fleet Roster */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Map & Telemetry HUD (8 Cols) */}
        <div className="lg:col-span-8 flex flex-col space-y-4">
          
          {/* Autonomous Live GPS Simulator Control Console */}
          <div className="glass-panel rounded-2xl p-4 border border-cyan-500/30 bg-gradient-to-r from-[#07131D]/90 via-[#0A1726]/90 to-[#0B1E28]/90 shadow-[0_4px_25px_-5px_rgba(6,182,212,0.15)] flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${
                  simStatus?.running 
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.4)]' 
                    : 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                }`}>
                  <Navigation className={`w-5 h-5 ${simStatus?.running ? 'animate-pulse' : ''}`} />
                </div>
                {simStatus?.running && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
                  </span>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold font-mono text-white tracking-wider uppercase">
                    Coimbatore Live GPS Simulator
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                    simStatus?.running 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 animate-pulse' 
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  }`}>
                    {simStatus?.running ? 'AUTONOMOUS ACTIVE' : 'PAUSED'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono mt-0.5">
                  <span className="text-cyan-400 font-bold">{simStatus?.activeVehicles || 0} Vehicles Moving</span>
                  <span>&bull;</span>
                  <span className="hidden sm:inline">Avinashi Rd, IT Corridor, Airport, Trichy Rd</span>
                  {simStatus?.tickCount > 0 && (
                    <>
                      <span>&bull;</span>
                      <span className="text-slate-500">Tick #{simStatus.tickCount}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2.5 ml-auto">
              {/* Play / Pause Toggle Button */}
              <button
                onClick={handleToggleSimulation}
                disabled={simActionLoading}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-mono text-xs font-bold transition-all border ${
                  simStatus?.running
                    ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                    : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                }`}
                title={simStatus?.running ? "Pause vehicle simulation" : "Start autonomous vehicle movement"}
              >
                {simStatus?.running ? (
                  <>
                    <Pause className="w-3.5 h-3.5 fill-current" />
                    <span>PAUSE</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>START RUN</span>
                  </>
                )}
              </button>

              {/* Speed Multipliers */}
              <div className="flex items-center bg-slate-900/80 p-1 rounded-xl border border-slate-700/80">
                {[1, 2, 5].map((mult) => (
                  <button
                    key={mult}
                    onClick={() => handleSetSpeed(mult)}
                    disabled={simActionLoading}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                      simStatus?.speedMultiplier === mult
                        ? 'bg-cyan-500 text-slate-950 shadow-[0_0_10px_rgba(6,182,212,0.5)]'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {mult}x
                  </button>
                ))}
              </div>

              {/* Reset Corridors */}
              <button
                onClick={handleResetSimulation}
                disabled={simActionLoading}
                className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-cyan-400 border border-slate-700/80 transition-all hover:border-cyan-500/40"
                title="Reset vehicles to starting stations"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${simActionLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <div className="glass-panel rounded-2xl border border-slate-800/80 overflow-hidden relative shadow-2xl" style={{ height: '560px' }}>
            {/* Map Overlay Controls */}
            <div className="absolute top-4 left-4 z-[400] flex items-center gap-2">
              <div className="glass-card px-3 py-1.5 rounded-xl border border-slate-700/80 flex items-center gap-2 text-xs font-mono text-slate-200">
                <Compass className="w-3.5 h-3.5 text-cyan-400 animate-spin" style={{ animationDuration: '10s' }} />
                <span>COIMBATORE METROPOLITAN REGION</span>
              </div>
              {simStatus?.running && (
                <div className="glass-card px-2.5 py-1.5 rounded-xl border border-emerald-500/40 bg-emerald-950/60 flex items-center gap-1.5 text-xs font-mono text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  <span>SIMULATING @ {simStatus.speedMultiplier}x</span>
                </div>
              )}
            </div>

            {loading ? (
              <div className="w-full h-full flex flex-col items-center justify-center bg-[#07090E] text-slate-400 gap-3 font-mono text-xs">
                <div className="w-8 h-8 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin"></div>
                <span>INITIALIZING GEOSPATIAL RADAR...</span>
              </div>
            ) : (
              <div className="w-full h-full dark-map">
                <MapContainer 
                  center={[11.0168, 76.9558]} 
                  zoom={12} 
                  style={{ height: '100%', width: '100%' }}
                  zoomControl={false}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; OpenStreetMap'
                  />
                  
                  <MapFlyToHandler selectedVehicle={selectedVehicle} />

                  {/* Active Geofence Perimeters */}
                  {geofences.map(gf => {
                    if (gf.type === 'POLYGON' && Array.isArray(gf.coordinates)) {
                      return (
                        <Polygon
                          key={gf.id}
                          positions={gf.coordinates}
                          pathOptions={{
                            color: gf.color || '#EF4444',
                            fillColor: gf.color || '#EF4444',
                            fillOpacity: 0.18,
                            weight: 1.5,
                            dashArray: '4, 4'
                          }}
                        />
                      );
                    }
                    return null;
                  })}

                  {filteredVehicles.map(v => {
                    if (v.latitude == null || v.longitude == null) return null;
                    const isSelected = selectedVehicle?.vehicleId === v.vehicleId;
                    return (
                      <Marker 
                        key={v.vehicleId} 
                        position={[v.latitude, v.longitude]}
                        icon={createRadarMarkerIcon(v.status, v.registrationNumber, isSelected, v.heading, v.speedKph)}
                        eventHandlers={{
                          click: () => setSelectedVehicleId(v.vehicleId)
                        }}
                      >
                        <Popup>
                          <div className="text-xs space-y-2 p-1 min-w-[210px]">
                            <div className="flex items-center justify-between border-b border-slate-700 pb-1.5">
                              <span className="font-bold text-sm text-cyan-400 font-mono">{v.registrationNumber || v.vehicleId}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold font-mono ${
                                v.status === 'ONLINE' ? 'bg-emerald-500/20 text-emerald-400' :
                                v.status === 'STALE' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-400'
                              }`}>
                                {v.status}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                              <div>Speed: <strong className="text-white font-mono">{v.speedKph?.toFixed(1) || 0} km/h</strong></div>
                              <div>Heading: <strong className="text-cyan-300 font-mono">{v.heading != null ? `${v.heading}°` : 'N/A'}</strong></div>
                              <div>Fuel: <strong className="text-white font-mono">{v.fuelLevel?.toFixed(1) || 0}%</strong></div>
                              <div>Engine: <strong className={v.engineStatus === 'ON' ? 'text-emerald-400' : 'text-slate-400'}>{v.engineStatus || 'OFF'}</strong></div>
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-800/80 pt-1">
                              <span>Driver: <strong className="text-slate-200">{v.driverName || 'Unassigned'}</strong></span>
                              {v.odometer != null && <span className="font-mono text-cyan-400">{v.odometer.toFixed(0)} km</span>}
                            </div>
                            {v.tripId && (
                              <div className="text-[10px] font-mono text-cyan-400/90 pt-1 border-t border-slate-800">
                                Trip: {v.tripId.slice(0, 8)}...
                              </div>
                            )}
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                </MapContainer>
              </div>
            )}
          </div>

          {/* Real-time Vehicle Telemetry HUD Drawer */}
          {selectedVehicle && (
            <div className="glass-panel rounded-2xl p-5 border border-slate-800/80 bg-[#0B0F17]/95">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-white font-mono">{selectedVehicle.registrationNumber || 'VEHICLE'}</h3>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                        selectedVehicle.status === 'ONLINE' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                        selectedVehicle.status === 'STALE' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                        'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}>
                        {selectedVehicle.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">{selectedVehicle.make} {selectedVehicle.model} &bull; {selectedVehicle.vin || 'VIN-UNSPECIFIED'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div className="text-[10px] font-mono text-slate-400 uppercase">GPS Heartbeat</div>
                    <div className="text-xs font-mono text-cyan-400">
                      {selectedVehicle.timestamp ? new Date(selectedVehicle.timestamp).toLocaleTimeString() : 'N/A'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Telemetry Gauge Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                {/* Speed Gauge */}
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span className="font-mono uppercase text-[10px]">Speed &amp; Heading</span>
                    <Gauge className="w-3.5 h-3.5 text-cyan-400" />
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold font-mono text-white">
                        {selectedVehicle.speedKph?.toFixed(1) || '0.0'}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">KM/H</span>
                    </div>
                    {selectedVehicle.heading != null && (
                      <div className="flex items-center gap-1 text-[11px] font-mono text-cyan-400">
                        <Compass className="w-3 h-3 transition-transform duration-500" style={{ transform: `rotate(${selectedVehicle.heading}deg)` }} />
                        <span>{selectedVehicle.heading}°</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Fuel Level */}
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span className="font-mono uppercase text-[10px]">Fuel Tank</span>
                    <Fuel className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-2xl font-bold font-mono text-white">
                      {selectedVehicle.fuelLevel?.toFixed(1) || '0.0'}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">%</span>
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${
                        (selectedVehicle.fuelLevel || 0) > 30 ? 'bg-emerald-400' : 'bg-rose-500'
                      }`}
                      style={{ width: `${Math.min(100, selectedVehicle.fuelLevel || 0)}%` }}
                    />
                  </div>
                </div>

                {/* Engine Ignition */}
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span className="font-mono uppercase text-[10px]">Ignition</span>
                    <Zap className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className={`text-xl font-bold font-mono ${
                      selectedVehicle.engineStatus === 'ON' ? 'text-emerald-400' : 'text-slate-500'
                    }`}>
                      {selectedVehicle.engineStatus || 'OFF'}
                    </span>
                  </div>
                </div>

                {/* Driver */}
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span className="font-mono uppercase text-[10px]">Assigned Driver</span>
                    <User className="w-3.5 h-3.5 text-indigo-400" />
                  </div>
                  <div className="mt-2">
                    <span className="text-sm font-semibold text-white truncate block">
                      {selectedVehicle.driverName || 'No Driver Active'}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {selectedVehicle.tripId ? 'On Active Route' : 'Stationary'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Live Fleet Roster Panel (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col h-[700px] glass-panel rounded-2xl border border-slate-800/80 overflow-hidden shadow-2xl">
          {/* Header & Search */}
          <div className="p-4 border-b border-slate-800/80 bg-slate-900/50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
                <h3 className="text-sm font-bold text-white font-mono tracking-wide">FLEET ROSTER</h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                {filteredVehicles.length} ASSETS
              </span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Search registration, make, driver..." 
                className="w-full glass-input rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 font-sans"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Filter Chips */}
            <div className="grid grid-cols-4 gap-1.5 pt-1">
              {[
                { id: 'ALL', label: 'All' },
                { id: 'ONLINE', label: 'Live' },
                { id: 'STALE', label: 'Idle' },
                { id: 'OFFLINE', label: 'Depot' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`py-1.5 rounded-lg text-[11px] font-mono font-semibold transition-all ${
                    statusFilter === tab.id
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_10px_-2px_rgba(6,182,212,0.3)]'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* Scrollable Vehicle List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {filteredVehicles.map(v => {
              const isSelected = selectedVehicle?.vehicleId === v.vehicleId;
              return (
                <div 
                  key={v.vehicleId} 
                  onClick={() => setSelectedVehicleId(v.vehicleId)}
                  className={`p-3.5 rounded-xl transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-cyan-950/30 border-cyan-500/50 shadow-[0_0_20px_-5px_rgba(6,182,212,0.25)]'
                      : 'bg-slate-900/40 border-slate-800/60 hover:bg-slate-850 hover:border-slate-700'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-sm text-white">{v.registrationNumber || 'UNKNOWN'}</span>
                        {isSelected && <Crosshair className="w-3.5 h-3.5 text-cyan-400 animate-spin" />}
                      </div>
                      <p className="text-[11px] text-slate-400">{v.make} {v.model}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      v.status === 'ONLINE' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      v.status === 'STALE' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                      'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}>
                      {v.status}
                    </span>
                  </div>
                  
                  {v.status !== 'OFFLINE' && v.latitude != null ? (
                    <div className="grid grid-cols-3 gap-2 text-[11px] font-mono bg-slate-950/40 p-2 rounded-lg border border-slate-800/50 mt-2 text-slate-300">
                      <div>
                        <span className="text-[9px] text-slate-400 block uppercase">Speed</span>
                        <span className="font-bold text-white">{v.speedKph?.toFixed(0)} km/h</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 block uppercase">Fuel</span>
                        <span className="font-bold text-amber-400">{v.fuelLevel?.toFixed(0)}%</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 block uppercase">Engine</span>
                        <span className={`font-bold ${v.engineStatus === 'ON' ? 'text-emerald-400' : 'text-slate-400'}`}>
                          {v.engineStatus || 'OFF'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400 mt-2 font-mono italic">
                      Telemetry in standby &bull; Depot
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mt-2.5 pt-2 border-t border-slate-800/60">
                    <span className="truncate max-w-[140px]">
                      Driver: <strong className="text-slate-300">{v.driverName || 'None'}</strong>
                    </span>
                    <span className="flex items-center gap-1.5">
                      {v.speedKph > 5 && v.heading != null && (
                        <span className="text-cyan-400 flex items-center gap-0.5">
                          <Navigation className="w-2.5 h-2.5 inline-block" style={{ transform: `rotate(${v.heading}deg)` }} />
                          <span>{v.heading}°</span>
                        </span>
                      )}
                      <span>
                        {v.timestamp ? new Date(v.timestamp).toLocaleTimeString() : 'No GPS'}
                      </span>
                    </span>
                  </div>
                </div>
              );
            })}

            {filteredVehicles.length === 0 && (
              <div className="text-center py-12 text-xs font-mono text-slate-400">
                NO ASSETS MATCHING CRITERIA
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
