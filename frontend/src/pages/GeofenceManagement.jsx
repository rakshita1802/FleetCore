import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Polygon, Circle, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { 
  ShieldAlert, 
  MapPin, 
  Plus, 
  Trash2, 
  RotateCcw, 
  Check, 
  AlertTriangle, 
  CheckCircle2, 
  Radio, 
  Navigation, 
  Zap, 
  Compass, 
  SlidersHorizontal, 
  Layers, 
  Eye, 
  EyeOff, 
  Crosshair, 
  Gauge, 
  Sparkles,
  Info
} from 'lucide-react';
import { geofencesApi } from '../services/api';
import api from '../services/api';
import { connectSocket } from '../services/socket';

// Fix Leaflet marker asset paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Marker icon for moving vehicles with heading support
const createVehicleIcon = (status, registrationNumber, heading = 0, speed = 0) => {
  const isOnline = status === 'ONLINE';
  const isMoving = (speed || 0) > 3;
  const coreColor = isOnline ? '#10B981' : '#64748B';

  const html = `
    <div class="relative flex items-center justify-center" style="width: 32px; height: 32px;">
      ${isOnline && isMoving ? `<div class="radar-ring" style="background: rgba(16, 185, 129, 0.4);"></div>` : ''}
      <div style="background-color: ${coreColor}; width: 18px; height: 18px; border-radius: 50%; border: 2px solid #ffffff; display: flex; align-items: center; justify-content: center; z-index: 10;">
        ${isMoving ? `
          <svg style="transform: rotate(${heading || 0}deg); width: 10px; height: 10px; fill: #ffffff;" viewBox="0 0 24 24">
            <polygon points="12,2 22,21 12,17 2,21" />
          </svg>
        ` : `
          <div style="width: 5px; height: 5px; border-radius: 50%; background: #ffffff;"></div>
        `}
      </div>
      <div style="position: absolute; bottom: -16px; white-space: nowrap; font-size: 9px; font-weight: 700; font-family: monospace; color: #F1F5F9; background: rgba(15, 23, 42, 0.9); padding: 1px 4px; border-radius: 3px; border: 1px solid rgba(255,255,255,0.15); pointer-events: none;">
        ${registrationNumber || 'VEH'}
      </div>
    </div>
  `;

  return L.divIcon({
    className: 'custom-radar-marker',
    html,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18]
  });
};

// Interactive Map Drawing Listener
function MapDrawingHandler({ isDrawing, onAddPoint }) {
  useMapEvents({
    click(e) {
      if (isDrawing) {
        onAddPoint([e.latlng.lat, e.latlng.lng]);
      }
    }
  });
  return null;
}

export default function GeofenceManagement() {
  const [geofences, setGeofences] = useState([]);
  const [breaches, setBreaches] = useState([]);
  const [vehicles, setVehicles] = useState({});
  const [loading, setLoading] = useState(true);
  
  // Drawing Mode State
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState([]);
  const [showSaveModal, setShowSaveModal] = useState(false);

  // Form State for New Geofence
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    rule: 'NO_ENTRY',
    speedLimitKph: 40,
    color: '#EF4444'
  });

  // Recent Live Breach Toast Notification
  const [latestBreachToast, setLatestBreachToast] = useState(null);

  // Fetch geofences and breaches
  const loadData = async () => {
    try {
      const [gfRes, breachesRes, liveFleetRes] = await Promise.all([
        geofencesApi.getAll(),
        geofencesApi.getBreaches({ limit: 20 }),
        api.get('/fleet/live').catch(() => ({ data: { data: [] } }))
      ]);

      if (gfRes.data?.data) setGeofences(gfRes.data.data);
      if (breachesRes.data?.data) setBreaches(breachesRes.data.data);
      
      const vMap = {};
      (liveFleetRes.data?.data || []).forEach(v => {
        vMap[v.vehicleId] = v;
      });
      setVehicles(vMap);
    } catch (err) {
      console.error('Failed to load geofence data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Connect WebSocket for live vehicle updates & geofence breaches
    const token = localStorage.getItem('accessToken');
    const socket = connectSocket(token);

    const handleVehicleUpdate = (update) => {
      setVehicles(prev => ({
        ...prev,
        [update.vehicleId]: {
          ...prev[update.vehicleId],
          ...update
        }
      }));
    };

    const handleGeofenceBreach = (payload) => {
      const { breach } = payload;
      setBreaches(prev => [breach, ...prev]);
      setLatestBreachToast(breach);
      setTimeout(() => setLatestBreachToast(null), 7000);
    };

    socket.on('fleet:vehicle:update', handleVehicleUpdate);
    socket.on('geofence:breach', handleGeofenceBreach);

    return () => {
      socket.off('fleet:vehicle:update', handleVehicleUpdate);
      socket.off('geofence:breach', handleGeofenceBreach);
    };
  }, []);

  // Handle map drawing click
  const handleAddPoint = (point) => {
    setDrawingPoints(prev => [...prev, point]);
  };

  const handleStartDrawing = () => {
    setIsDrawing(true);
    setDrawingPoints([]);
  };

  const handleCancelDrawing = () => {
    setIsDrawing(false);
    setDrawingPoints([]);
    setShowSaveModal(false);
  };

  const handleFinishDrawing = () => {
    if (drawingPoints.length < 3) {
      alert('Please click at least 3 points on the map to define a geofence polygon.');
      return;
    }
    setShowSaveModal(true);
  };

  const handleSaveGeofence = async (e) => {
    e.preventDefault();
    try {
      await geofencesApi.create({
        name: formData.name,
        description: formData.description,
        type: 'POLYGON',
        rule: formData.rule,
        speedLimitKph: formData.rule === 'SPEED_LIMIT' ? Number(formData.speedLimitKph) : null,
        color: formData.color,
        coordinates: drawingPoints,
        isActive: true
      });

      handleCancelDrawing();
      setFormData({ name: '', description: '', rule: 'NO_ENTRY', speedLimitKph: 40, color: '#EF4444' });
      await loadData();
    } catch (err) {
      console.error('Failed to create geofence:', err);
      alert('Failed to save geofence perimeter.');
    }
  };

  const handleToggleGeofenceActive = async (gf) => {
    try {
      await geofencesApi.update(gf.id, { isActive: !gf.isActive });
      setGeofences(prev => prev.map(g => g.id === gf.id ? { ...g, isActive: !g.isActive } : g));
    } catch (err) {
      console.error('Failed to toggle geofence active status:', err);
    }
  };

  const handleDeleteGeofence = async (id) => {
    if (!window.confirm('Delete this geofence perimeter?')) return;
    try {
      await geofencesApi.delete(id);
      setGeofences(prev => prev.filter(g => g.id !== id));
    } catch (err) {
      console.error('Failed to delete geofence:', err);
    }
  };

  const handleResolveBreach = async (breachId) => {
    try {
      await geofencesApi.resolveBreach(breachId);
      setBreaches(prev => prev.map(b => b.id === breachId ? { ...b, resolved: true } : b));
    } catch (err) {
      console.error('Failed to resolve breach:', err);
    }
  };

  const activeGeofences = geofences.filter(g => g.isActive);
  const unresolvedBreaches = breaches.filter(b => !b.resolved);
  const vehicleList = Object.values(vehicles);

  return (
    <div className="space-y-6">
      {/* Real-time Breach Floating Alert Toast */}
      {latestBreachToast && (
        <div className="fixed top-20 right-8 z-[1000] max-w-md p-4 rounded-2xl bg-rose-950/95 border border-rose-500/80 shadow-[0_0_30px_rgba(244,63,94,0.4)] text-white backdrop-blur-xl animate-bounce">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/40">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-rose-300 uppercase">LIVE GEOFENCE BREACH</span>
                <span className="text-[10px] font-mono text-rose-400">JUST NOW</span>
              </div>
              <p className="text-sm font-bold text-white mt-1">
                {latestBreachToast.geofence?.name || 'Restricted Boundary'}
              </p>
              <p className="text-xs text-rose-200/90 mt-0.5">
                Vehicle <span className="font-mono font-bold">{latestBreachToast.vehicle?.registrationNumber || 'VEHICLE'}</span> entered unauthorized zone at {latestBreachToast.speedKph?.toFixed(0) || 0} km/h.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-white font-sans">
              Geofence Perimeter Command
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              POLYGON ENGINE
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            Visual polygon perimeter boundary definition, real-time intrusion monitoring, and automated breach alerting.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          {!isDrawing ? (
            <button
              onClick={handleStartDrawing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-xs font-bold bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition-all shadow-[0_0_15px_rgba(6,182,212,0.4)]"
            >
              <Plus className="w-4 h-4" />
              <span>DRAW CUSTOM GEOFENCE</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-amber-400 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 animate-pulse">
                Click map to drop points ({drawingPoints.length} vertices)
              </span>
              <button
                onClick={handleFinishDrawing}
                disabled={drawingPoints.length < 3}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                <span>SAVE PERIMETER</span>
              </button>
              <button
                onClick={handleCancelDrawing}
                className="px-3 py-1.5 rounded-xl font-mono text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-all"
              >
                CANCEL
              </button>
            </div>
          )}
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="glass-card rounded-2xl p-4 border border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-semibold uppercase text-slate-400">Total Zones</span>
            <Layers className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-white">{geofences.length}</div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">Defined Coimbatore Perimeters</div>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-emerald-950/50 bg-emerald-950/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-semibold uppercase text-emerald-400">Active Monitoring</span>
            <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-emerald-400">{activeGeofences.length}</div>
          <div className="text-[10px] text-emerald-500/80 font-mono mt-0.5">Live Radar Enforced</div>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-rose-950/50 bg-rose-950/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-semibold uppercase text-rose-400">Active Breaches</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-rose-400">{unresolvedBreaches.length}</div>
          <div className="text-[10px] text-rose-400/80 font-mono mt-0.5">Pending Operator Review</div>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-indigo-950/50 bg-indigo-950/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-semibold uppercase text-indigo-400">Fleet Units Scanned</span>
            <Navigation className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-indigo-400">{vehicleList.length}</div>
          <div className="text-[10px] text-indigo-400/80 font-mono mt-0.5">Live Ingestion Telemetry</div>
        </div>
      </div>

      {/* Main Grid: Map & Geofence Roster */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Map View (8 Cols) */}
        <div className="lg:col-span-8 flex flex-col space-y-4">
          <div className="glass-panel rounded-2xl border border-slate-800/80 overflow-hidden relative shadow-2xl" style={{ height: '580px' }}>
            
            {/* Map Top Bar */}
            <div className="absolute top-4 left-4 z-[400] flex items-center gap-2">
              <div className="glass-card px-3 py-1.5 rounded-xl border border-slate-700/80 flex items-center gap-2 text-xs font-mono text-slate-200">
                <Compass className="w-3.5 h-3.5 text-cyan-400 animate-spin" style={{ animationDuration: '10s' }} />
                <span>COIMBATORE GEOFENCE RADAR</span>
              </div>
              {isDrawing && (
                <div className="glass-card px-3 py-1.5 rounded-xl border border-amber-500/40 bg-amber-950/70 text-amber-300 text-xs font-mono flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                  <span>DRAWING MODE ACTIVE</span>
                </div>
              )}
            </div>

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

                <MapDrawingHandler isDrawing={isDrawing} onAddPoint={handleAddPoint} />

                {/* Render Existing Geofences */}
                {geofences.map(gf => {
                  if (!gf.coordinates) return null;
                  const isGfActive = gf.isActive;
                  const color = gf.color || '#EF4444';

                  if (gf.type === 'POLYGON' && Array.isArray(gf.coordinates)) {
                    return (
                      <Polygon
                        key={gf.id}
                        positions={gf.coordinates}
                        pathOptions={{
                          color: color,
                          fillColor: color,
                          fillOpacity: isGfActive ? 0.22 : 0.05,
                          weight: isGfActive ? 2 : 1,
                          dashArray: isGfActive ? undefined : '5, 5'
                        }}
                      >
                        <Popup>
                          <div className="p-1 space-y-1.5 text-xs min-w-[200px]">
                            <div className="flex items-center justify-between border-b border-slate-700 pb-1">
                              <span className="font-bold text-white font-mono">{gf.name}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                                isGfActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'
                              }`}>
                                {isGfActive ? 'ACTIVE' : 'DISABLED'}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-300">
                              <div>Rule: <strong className="text-cyan-400 font-mono">{gf.rule}</strong></div>
                              {gf.speedLimitKph && (
                                <div>Speed Limit: <strong className="text-amber-400 font-mono">{gf.speedLimitKph} km/h</strong></div>
                              )}
                              <p className="text-[10px] text-slate-400 mt-1">{gf.description}</p>
                            </div>
                          </div>
                        </Popup>
                      </Polygon>
                    );
                  }
                  return null;
                })}

                {/* Render In-Progress Drawing Polygon */}
                {isDrawing && drawingPoints.length > 0 && (
                  <>
                    <Polygon
                      positions={drawingPoints}
                      pathOptions={{
                        color: formData.color || '#38BDF8',
                        fillColor: formData.color || '#38BDF8',
                        fillOpacity: 0.2,
                        weight: 2,
                        dashArray: '4, 4'
                      }}
                    />
                    {drawingPoints.map((pt, idx) => (
                      <Circle
                        key={idx}
                        center={pt}
                        radius={50}
                        pathOptions={{ color: '#38BDF8', fillColor: '#38BDF8', fillOpacity: 0.8 }}
                      />
                    ))}
                  </>
                )}

                {/* Render Live Moving Vehicles */}
                {vehicleList.map(v => {
                  if (v.latitude == null || v.longitude == null) return null;
                  return (
                    <Marker
                      key={v.vehicleId}
                      position={[v.latitude, v.longitude]}
                      icon={createVehicleIcon(v.status, v.registrationNumber, v.heading, v.speedKph)}
                    >
                      <Popup>
                        <div className="text-xs space-y-1.5 p-1 min-w-[190px]">
                          <div className="flex items-center justify-between border-b border-slate-700 pb-1">
                            <span className="font-bold text-cyan-400 font-mono">{v.registrationNumber}</span>
                            <span className="text-[10px] font-mono text-slate-400">{v.speedKph?.toFixed(0) || 0} km/h</span>
                          </div>
                          <div className="text-[11px] text-slate-300 space-y-1">
                            <div>Heading: <strong className="text-cyan-300 font-mono">{v.heading || 0}°</strong></div>
                            <div>Fuel: <strong className="text-amber-400 font-mono">{v.fuelLevel?.toFixed(1) || 0}%</strong></div>
                            <div>Driver: <strong className="text-white">{v.driverName || 'Unassigned'}</strong></div>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
            </div>
          </div>

          {/* Breach Activity Feed */}
          <div className="glass-panel rounded-2xl p-5 border border-slate-800/80 bg-[#0B0F17]/95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 animate-pulse" />
                <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                  Live Intrusion & Breach Activity Ledger
                </h3>
              </div>
              <span className="text-xs font-mono text-slate-400">
                {unresolvedBreaches.length} UNRESOLVED
              </span>
            </div>

            <div className="mt-3 space-y-2.5 max-h-[200px] overflow-y-auto pr-1">
              {breaches.length === 0 ? (
                <div className="text-center py-6 text-xs font-mono text-slate-500">
                  NO GEOFENCE VIOLATIONS RECORDED &bull; PERIMETERS SECURE
                </div>
              ) : (
                breaches.map(b => (
                  <div 
                    key={b.id}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs font-mono transition-all ${
                      !b.resolved 
                        ? 'bg-rose-950/25 border-rose-500/40 text-rose-200 shadow-[0_0_15px_-4px_rgba(244,63,94,0.2)]'
                        : 'bg-slate-900/40 border-slate-800/60 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        !b.resolved ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' : 'bg-slate-800 text-slate-400'
                      }`}>
                        <ShieldAlert className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{b.vehicle?.registrationNumber || 'VEHICLE'}</span>
                          <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                            !b.resolved ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-slate-800 text-slate-400'
                          }`}>
                            {b.breachType.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Zone: <strong className="text-slate-200">{b.geofence?.name}</strong> &bull; {b.speedKph?.toFixed(0) || 0} km/h &bull; {new Date(b.createdAt).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>

                    <div>
                      {!b.resolved ? (
                        <button
                          onClick={() => handleResolveBreach(b.id)}
                          className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 transition-all"
                        >
                          RESOLVE
                        </button>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>RESOLVED</span>
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar: Geofence List & Manager (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col h-[820px] glass-panel rounded-2xl border border-slate-800/80 overflow-hidden shadow-2xl">
          <div className="p-4 border-b border-slate-800/80 bg-slate-900/50 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white font-mono tracking-wide">CONFIGURED PERIMETERS</h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                {geofences.length} ZONES
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-sans">
              Toggle live radar enforcement or click to inspect coordinates.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {geofences.map(gf => (
              <div 
                key={gf.id}
                className={`p-3.5 rounded-xl border transition-all ${
                  gf.isActive 
                    ? 'bg-slate-900/60 border-slate-800 hover:border-slate-700 shadow-md' 
                    : 'bg-slate-950/40 border-slate-900 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <span 
                      className="w-3 h-3 rounded-full shrink-0 mt-1 shadow-sm"
                      style={{ backgroundColor: gf.color || '#EF4444' }}
                    />
                    <div>
                      <h4 className="text-xs font-bold text-white font-mono">{gf.name}</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{gf.description}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteGeofence(gf.id)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                    title="Delete Geofence"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between text-[10px] font-mono mt-3 pt-2.5 border-t border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-slate-800/80 text-cyan-400 border border-slate-700/60">
                      {gf.rule}
                    </span>
                    {gf.speedLimitKph && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {gf.speedLimitKph} KM/H
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => handleToggleGeofenceActive(gf)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold transition-all ${
                      gf.isActive 
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                        : 'bg-slate-800 text-slate-500 border border-slate-700'
                    }`}
                  >
                    {gf.isActive ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    <span>{gf.isActive ? 'MONITORING' : 'OFF'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Modal: Save Drawn Geofence */}
      {showSaveModal && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-md glass-panel rounded-2xl border border-cyan-500/30 p-6 shadow-2xl bg-[#0B0F17]/95">
            <h3 className="text-base font-bold text-white font-mono tracking-wide flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-cyan-400" />
              <span>SAVE GEOFENCE BOUNDARY</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1 font-sans">
              Configured with {drawingPoints.length} polygon vertices on Coimbatore map.
            </p>

            <form onSubmit={handleSaveGeofence} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-mono text-slate-300 block mb-1">Zone Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Peelamedu Cargo Corridor"
                  className="w-full glass-input rounded-xl px-3 py-2 text-xs text-white"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-mono text-slate-300 block mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Operational purpose or warning details..."
                  className="w-full glass-input rounded-xl px-3 py-2 text-xs text-white"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-mono text-slate-300 block mb-1">Enforcement Rule</label>
                  <select
                    className="w-full glass-input rounded-xl px-3 py-2 text-xs text-white bg-slate-900"
                    value={formData.rule}
                    onChange={e => setFormData({ ...formData, rule: e.target.value })}
                  >
                    <option value="NO_ENTRY">NO ENTRY (Restricted)</option>
                    <option value="NO_EXIT">NO EXIT (Operating Boundary)</option>
                    <option value="SPEED_LIMIT">SPEED LIMIT (Max km/h)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-mono text-slate-300 block mb-1">Perimeter Color</label>
                  <select
                    className="w-full glass-input rounded-xl px-3 py-2 text-xs text-white bg-slate-900"
                    value={formData.color}
                    onChange={e => setFormData({ ...formData, color: e.target.value })}
                  >
                    <option value="#EF4444">Red (Restricted)</option>
                    <option value="#F59E0B">Amber (Caution)</option>
                    <option value="#10B981">Green (Safe Hub)</option>
                    <option value="#06B6D4">Cyan (IT Corridor)</option>
                    <option value="#8B5CF6">Purple (Warehouse)</option>
                  </select>
                </div>
              </div>

              {formData.rule === 'SPEED_LIMIT' && (
                <div>
                  <label className="text-xs font-mono text-slate-300 block mb-1">Max Speed Limit (km/h)</label>
                  <input
                    type="number"
                    min="10"
                    max="120"
                    className="w-full glass-input rounded-xl px-3 py-2 text-xs text-white"
                    value={formData.speedLimitKph}
                    onChange={e => setFormData({ ...formData, speedLimitKph: e.target.value })}
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleCancelDrawing}
                  className="px-4 py-2 rounded-xl text-xs font-mono text-slate-400 hover:text-white"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-mono font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-all shadow-[0_0_12px_rgba(6,182,212,0.4)]"
                >
                  SAVE &amp; ACTIVATE
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
