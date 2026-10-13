import React from 'react';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Truck, 
  UserCheck, 
  Link2, 
  Navigation, 
  Activity, 
  Wrench, 
  BarChart3, 
  FileText, 
  ShieldAlert, 
  Users, 
  ScrollText, 
  Cpu, 
  LogOut, 
  Radio, 
  Signal, 
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Vehicles from './pages/Vehicles';
import Drivers from './pages/Drivers';
import Assignments from './pages/Assignments';
import Trips from './pages/Trips';
import TripDetails from './pages/TripDetails';
import CreateTrip from './pages/CreateTrip';
import Telemetry from './pages/Telemetry';
import FleetDashboard from './pages/FleetDashboard';
import AnalyticsDashboard from './pages/AnalyticsDashboard';
import Maintenance from './pages/Maintenance';
import Reports from './pages/Reports';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsers from './pages/AdminUsers';
import AuditLogs from './pages/AuditLogs';
import SystemHealth from './pages/SystemHealth';
import GeofenceManagement from './pages/GeofenceManagement';

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  const navItem = (to, icon, label, badge) => {
    const active = isActive(to);
    const IconComponent = icon;
    return (
      <Link
        to={to}
        className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
          active
            ? 'bg-gradient-to-r from-cyan-500/20 to-blue-600/10 text-cyan-400 border border-cyan-500/30 shadow-[0_0_15px_-3px_rgba(6,182,212,0.25)]'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 hover:border hover:border-slate-700/50'
        }`}
      >
        <div className={`flex items-center justify-center transition-colors ${
          active ? 'text-cyan-400' : 'text-slate-400 group-hover:text-cyan-400'
        }`}>
          <IconComponent className="w-4 h-4" />
        </div>
        <span className="flex-1 truncate">{label}</span>
        {badge && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            {badge}
          </span>
        )}
        {active && (
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-cyan-400 rounded-l-full shadow-[0_0_8px_#22d3ee]" />
        )}
      </Link>
    );
  };

  return (
    <div className="flex h-screen bg-[#07090E] text-slate-100 overflow-hidden select-none">
      {/* Sidebar */}
      <aside className="w-64 bg-[#0B0F17]/90 backdrop-blur-xl border-r border-slate-800/80 flex flex-col justify-between shrink-0 z-20">
        <div className="flex flex-col h-full overflow-hidden">
          {/* Logo & Platform Info */}
          <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-slate-950 shadow-[0_0_20px_-3px_rgba(6,182,212,0.6)]">
                <Radio className="w-5 h-5 text-slate-950 animate-pulse" />
              </div>
              <div>
                <h1 className="text-base font-bold tracking-wider bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent font-sans flex items-center gap-1.5">
                  FLEETCORE
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/60 uppercase">PRO</span>
                </h1>
                <p className="text-[10px] font-mono text-cyan-400/80 tracking-tight flex items-center gap-1 mt-0.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  TELEMETRY ACTIVE
                </p>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
            {user?.role === 'DRIVER' ? (
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 px-3 mb-2 font-semibold flex items-center justify-between">
                  <span>Driver Portal</span>
                  <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/60 uppercase">ON CAB</span>
                </div>
                <div className="space-y-1">
                  {navItem('/', Truck, 'My Vehicle & Cockpit', 'CAB')}
                  {navItem('/trips', Navigation, 'My Assigned Trips', 'ACTIVE')}
                  {navItem('/telemetry', Activity, 'Vehicle Diagnostics')}
                </div>
              </div>
            ) : (
              <>
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 px-3 mb-2 font-semibold">
                    Fleet Operations
                  </div>
                  <div className="space-y-1">
                    {navItem('/', LayoutDashboard, 'Live Dashboard', 'LIVE')}
                    {navItem('/geofences', ShieldAlert, 'Geofence Zones', 'GEO')}
                    {navItem('/vehicles', Truck, 'Vehicles')}
                    {navItem('/drivers', UserCheck, 'Drivers')}
                    {navItem('/assignments', Link2, 'Assignments')}
                    {navItem('/trips', Navigation, 'Trips & Routes')}
                    {navItem('/telemetry', Activity, 'Telemetry Hub')}
                    {navItem('/maintenance', Wrench, 'Maintenance')}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 px-3 mb-2 font-semibold">
                    Intelligence & Reports
                  </div>
                  <div className="space-y-1">
                    {navItem('/analytics', BarChart3, 'Fleet Analytics')}
                    {navItem('/reports', FileText, 'Export Reports')}
                  </div>
                </div>

                {(user?.role === 'ADMIN' || user?.role === 'FLEET_MANAGER') && (
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 px-3 mb-2 font-semibold">
                      Administration
                    </div>
                    <div className="space-y-1">
                      {navItem('/admin', ShieldAlert, 'Admin Control')}
                      {user?.role === 'ADMIN' && navItem('/admin/users', Users, 'User Directory')}
                      {navItem('/admin/audit', ScrollText, 'Audit Ledger')}
                      {user?.role === 'ADMIN' && navItem('/admin/system', Cpu, 'System Health')}
                    </div>
                  </div>
                )}
              </>
            )}
          </nav>

          {/* User Profile Footer */}
          <div className="p-3 border-t border-slate-800/80 bg-slate-900/40 backdrop-blur-md">
            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-800/40 border border-slate-700/50">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shadow-inner shrink-0">
                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <div className="truncate">
                  <p className="text-xs font-semibold text-slate-200 truncate">{user?.name || 'Operator'}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-slate-800 text-cyan-400 border border-slate-700 uppercase">
                      {user?.role || 'USER'}
                    </span>
                    <span className="text-[10px] text-slate-400 truncate max-w-[70px]">
                      {user?.company?.name || 'Fleet'}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={handleLogout}
                title="Sign Out"
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors border border-transparent hover:border-rose-500/20"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Execution Canvas */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-gradient-to-b from-[#080B11] to-[#04060A]">
        {/* Top Header */}
        <header className="h-14 bg-[#0B0F17]/60 backdrop-blur-md border-b border-slate-800/80 flex items-center justify-between px-6 shrink-0 z-10">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
              <span className="text-slate-500">FleetCore</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
              <span className="text-cyan-400 font-mono">
                {user?.role === 'DRIVER'
                  ? (location.pathname === '/' ? 'DRIVER CAB & VEHICLE HUD' : location.pathname.replace('/', '').toUpperCase())
                  : (location.pathname === '/' ? 'LIVE COMMAND CENTER' : location.pathname.replace('/', '').toUpperCase())
                }
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Live Socket Streaming Beacon */}
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>TELEMETRY STREAM: 5000ms</span>
            </div>

            {/* Quick Status Tag */}
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-800/60 border border-slate-700/60 text-[11px] font-mono text-slate-300">
              <Signal className="w-3.5 h-3.5 text-cyan-400" />
              <span>{user?.role === 'DRIVER' ? 'ACTIVE DRIVER' : 'COIMBATORE HUB'}</span>
            </div>
          </div>
        </header>

        {/* Dynamic Route Viewport */}
        <main className="flex-1 overflow-y-auto p-6 text-slate-100">
          {children}
        </main>
      </div>
    </div>
  );
};

const Placeholder = ({ title }) => (
  <div className="glass-panel rounded-2xl p-12 flex flex-col items-center justify-center text-center border border-slate-800/80 min-h-[400px]">
    <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-4 shadow-[0_0_30px_-5px_rgba(6,182,212,0.3)]">
      <Sparkles className="w-8 h-8 animate-pulse" />
    </div>
    <h3 className="text-xl font-bold text-white mb-2 font-sans tracking-tight">{title}</h3>
    <p className="text-sm text-slate-400 max-w-md font-sans">
      This telemetry subsystem is active and operating under autonomous protocols.
    </p>
  </div>
);

function AppRoutes() {
  const adminManagerViewer = ['ADMIN', 'FLEET_MANAGER', 'VIEWER'];
  const adminManager = ['ADMIN', 'FLEET_MANAGER'];

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="*" element={
        <ProtectedRoute>
          <Layout>
            <Routes>
              <Route path="/" element={<FleetDashboard />} />
              <Route path="/dashboard" element={<FleetDashboard />} />
              <Route path="/geofences" element={<ProtectedRoute allowedRoles={adminManagerViewer}><GeofenceManagement /></ProtectedRoute>} />
              <Route path="/vehicles" element={<ProtectedRoute allowedRoles={adminManagerViewer}><Vehicles /></ProtectedRoute>} />
              <Route path="/vehicles/new" element={<ProtectedRoute allowedRoles={adminManager}><Placeholder title="Add Vehicle Form" /></ProtectedRoute>} />
              <Route path="/vehicles/:id" element={<ProtectedRoute allowedRoles={adminManagerViewer}><Placeholder title="Vehicle Details" /></ProtectedRoute>} />
              <Route path="/vehicles/:id/edit" element={<ProtectedRoute allowedRoles={adminManager}><Placeholder title="Edit Vehicle Form" /></ProtectedRoute>} />
              <Route path="/drivers" element={<ProtectedRoute allowedRoles={adminManagerViewer}><Drivers /></ProtectedRoute>} />
              <Route path="/drivers/new" element={<ProtectedRoute allowedRoles={adminManager}><Placeholder title="Add Driver Form" /></ProtectedRoute>} />
              <Route path="/drivers/:id" element={<ProtectedRoute allowedRoles={adminManagerViewer}><Placeholder title="Driver Details" /></ProtectedRoute>} />
              <Route path="/drivers/:id/edit" element={<ProtectedRoute allowedRoles={adminManager}><Placeholder title="Edit Driver Form" /></ProtectedRoute>} />
              <Route path="/assignments" element={<ProtectedRoute allowedRoles={adminManagerViewer}><Assignments /></ProtectedRoute>} />
              <Route path="/trips" element={<Trips />} />
              <Route path="/trips/new" element={<ProtectedRoute allowedRoles={adminManager}><CreateTrip /></ProtectedRoute>} />
              <Route path="/trips/:id" element={<TripDetails />} />
              <Route path="/telemetry" element={<Telemetry />} />
              <Route path="/maintenance" element={<ProtectedRoute allowedRoles={adminManagerViewer}><Maintenance /></ProtectedRoute>} />
              <Route path="/analytics" element={<ProtectedRoute allowedRoles={adminManagerViewer}><AnalyticsDashboard /></ProtectedRoute>} />
              <Route path="/alerts" element={<ProtectedRoute allowedRoles={adminManagerViewer}><Maintenance /></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute allowedRoles={adminManagerViewer}><Reports /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute allowedRoles={adminManager}><AdminDashboard /></ProtectedRoute>} />
              <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['ADMIN']}><AdminUsers /></ProtectedRoute>} />
              <Route path="/admin/audit" element={<ProtectedRoute allowedRoles={adminManager}><AuditLogs /></ProtectedRoute>} />
              <Route path="/admin/system" element={<ProtectedRoute allowedRoles={['ADMIN']}><SystemHealth /></ProtectedRoute>} />
              <Route path="*" element={<Placeholder title="404 - Module Not Found" />} />
            </Routes>
          </Layout>
        </ProtectedRoute>
      } />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;
