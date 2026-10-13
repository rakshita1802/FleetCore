import React, { useState, useEffect } from 'react';
import { Users, Plus, Search, Filter, ShieldCheck, ShieldAlert, CheckCircle2, UserCheck, AlertTriangle, X, Lock, Mail, User } from 'lucide-react';
import { adminApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

const AdminUsers = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Form states
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'VIEWER'
  });
  const [selectedNewRole, setSelectedNewRole] = useState('VIEWER');
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState(null);

  const fetchUsers = async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      const res = await adminApi.getUsers({
        search: search || undefined,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
        page,
        limit: 10
      });

      setUsers(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch user accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(1);
  }, [roleFilter, statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchUsers(1);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      setModalLoading(true);
      setModalError(null);
      await adminApi.createUser(createForm);
      setShowCreateModal(false);
      setCreateForm({ name: '', email: '', password: '', role: 'VIEWER' });
      setActionSuccess('User account provisioned successfully.');
      fetchUsers(1);
    } catch (err) {
      setModalError(err.response?.data?.message || err.response?.data?.errors?.[0]?.message || 'Failed to create user');
    } finally {
      setModalLoading(false);
    }
  };

  const handleChangeRole = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;
    try {
      setModalLoading(true);
      setModalError(null);
      await adminApi.changeRole(selectedUser.id, selectedNewRole);
      setShowRoleModal(false);
      setSelectedUser(null);
      setActionSuccess(`User role updated to ${selectedNewRole}`);
      fetchUsers(pagination.page);
    } catch (err) {
      setModalError(err.response?.data?.message || 'Failed to change role');
    } finally {
      setModalLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!selectedUser) return;
    try {
      setModalLoading(true);
      setModalError(null);
      if (selectedUser.status === 'ACTIVE') {
        await adminApi.deactivateUser(selectedUser.id);
        setActionSuccess(`User ${selectedUser.email} has been deactivated and active sessions revoked.`);
      } else {
        await adminApi.activateUser(selectedUser.id);
        setActionSuccess(`User ${selectedUser.email} has been reactivated.`);
      }
      setShowStatusModal(false);
      setSelectedUser(null);
      fetchUsers(pagination.page);
    } catch (err) {
      setModalError(err.response?.data?.message || 'Failed to change account status');
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white font-sans">User Administration & RBAC</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              DIRECTORY
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            Manage authorized users, assign operational roles, and enforce security policies for {currentUser?.company?.name}.
          </p>
        </div>
        <button
          onClick={() => {
            setModalError(null);
            setShowCreateModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs font-mono shadow-[0_0_20px_-3px_rgba(6,182,212,0.4)] transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>PROVISION USER</span>
        </button>
      </div>

      {actionSuccess && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono flex justify-between items-center">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-400 hover:text-emerald-300">&times;</button>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono">
          {error}
        </div>
      )}

      {/* Filter Bar */}
      <div className="glass-panel rounded-2xl p-4 border border-slate-800/80 flex flex-col md:flex-row gap-3 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="flex-1 w-full flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name or corporate email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full glass-input rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 font-sans"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-mono border border-slate-700 transition-colors"
          >
            SEARCH
          </button>
        </form>

        <div className="flex gap-3 w-full md:w-auto font-mono text-xs">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="glass-input rounded-xl px-3 py-2 text-xs text-white bg-slate-900"
          >
            <option value="" className="bg-slate-900">All Roles</option>
            <option value="ADMIN" className="bg-slate-900">ADMIN</option>
            <option value="FLEET_MANAGER" className="bg-slate-900">FLEET_MANAGER</option>
            <option value="DRIVER" className="bg-slate-900">DRIVER</option>
            <option value="VIEWER" className="bg-slate-900">VIEWER</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="glass-input rounded-xl px-3 py-2 text-xs text-white bg-slate-900"
          >
            <option value="" className="bg-slate-900">All Statuses</option>
            <option value="ACTIVE" className="bg-slate-900">ACTIVE</option>
            <option value="INACTIVE" className="bg-slate-900">INACTIVE</option>
          </select>
        </div>
      </div>

      {/* User Table */}
      <div className="glass-panel rounded-2xl border border-slate-800/80 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800/80 text-xs">
            <thead className="bg-slate-900/60 font-mono text-[10px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-6 py-3.5 text-left">User Identity</th>
                <th className="px-6 py-3.5 text-left">Role Access</th>
                <th className="px-6 py-3.5 text-left">Status</th>
                <th className="px-6 py-3.5 text-left">Enrolled Date</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-slate-500 font-mono">
                    FETCHING USER DIRECTORY...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-slate-500 font-mono">
                    NO USERS MATCHING CRITERIA
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isSelf = u.id === currentUser?.id;
                  return (
                    <tr key={u.id} className="hover:bg-slate-850/40 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shadow-inner shrink-0">
                            {u.name?.charAt(0)?.toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-white font-sans flex items-center gap-1.5">
                              {u.name} {isSelf && <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950 px-1.5 py-0.2 rounded border border-cyan-800">(YOU)</span>}
                            </div>
                            <div className="text-[11px] font-mono text-slate-400">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold border ${
                          u.role === 'ADMIN' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                          u.role === 'FLEET_MANAGER' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' :
                          u.role === 'DRIVER' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                          'bg-slate-800 text-slate-400 border-slate-700'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold border ${
                          u.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}>
                          {u.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-slate-400">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2 font-mono">
                        <button
                          onClick={() => {
                            setSelectedUser(u);
                            setSelectedNewRole(u.role);
                            setModalError(null);
                            setShowRoleModal(true);
                          }}
                          className="px-2.5 py-1 text-[11px] font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700"
                        >
                          Change Role
                        </button>

                        <button
                          onClick={() => {
                            setSelectedUser(u);
                            setModalError(null);
                            setShowStatusModal(true);
                          }}
                          disabled={isSelf}
                          title={isSelf ? "You cannot deactivate your own account" : ""}
                          className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors border ${
                            isSelf ? 'opacity-30 cursor-not-allowed bg-slate-800 text-slate-500 border-transparent' :
                            u.status === 'ACTIVE'
                              ? 'text-rose-400 bg-rose-950/40 hover:bg-rose-900/60 border-rose-800/50'
                              : 'text-emerald-400 bg-emerald-950/40 hover:bg-emerald-900/60 border-emerald-800/50'
                          }`}
                        >
                          {u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-6 py-3 bg-slate-900/40 border-t border-slate-800/80 flex items-center justify-between font-mono text-xs text-slate-400">
            <span>
              SHOWING {users.length} OF {pagination.total} USERS
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => fetchUsers(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="px-3 py-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40"
              >
                PREV
              </button>
              <span className="px-3 py-1 bg-slate-850 rounded-lg text-cyan-400 font-bold">
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => fetchUsers(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="px-3 py-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40"
              >
                NEXT
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Create User */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="glass-panel rounded-3xl max-w-md w-full p-6 sm:p-8 border border-slate-700 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white font-sans">Provision New User Account</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">&times;</button>
            </div>
            
            {modalError && (
              <div className="p-3 bg-rose-500/10 text-rose-400 rounded-xl text-xs border border-rose-500/20 font-mono">
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-3">
              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="Jane Smith"
                  className="w-full glass-input rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-1">Corporate Email</label>
                <input
                  type="email"
                  required
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  placeholder="jane.smith@cit.edu"
                  className="w-full glass-input rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-1">Temporary Security Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  placeholder="Min. 8 characters"
                  className="w-full glass-input rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-1">Role Allocation</label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                  className="w-full glass-input rounded-xl px-3 py-2 text-xs text-white bg-slate-900 font-sans"
                >
                  <option value="VIEWER" className="bg-slate-900">VIEWER (Read-only)</option>
                  <option value="DRIVER" className="bg-slate-900">DRIVER (Assigned vehicle trips)</option>
                  <option value="FLEET_MANAGER" className="bg-slate-900">FLEET_MANAGER (Operations, vehicles, reports)</option>
                  <option value="ADMIN" className="bg-slate-900">ADMIN (Full company administration)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-xl disabled:opacity-50"
                >
                  {modalLoading ? 'CREATING...' : 'CREATE ACCOUNT'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Change Role */}
      {showRoleModal && selectedUser && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="glass-panel rounded-3xl max-w-md w-full p-6 sm:p-8 border border-slate-700 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white font-sans">Modify Role Permissions</h3>
            <p className="text-xs text-slate-400">
              Modifying role for <strong className="text-cyan-400">{selectedUser.name}</strong> ({selectedUser.email}).
            </p>

            {modalError && (
              <div className="p-3 bg-rose-500/10 text-rose-400 rounded-xl text-xs border border-rose-500/20 font-mono">
                {modalError}
              </div>
            )}

            <form onSubmit={handleChangeRole} className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-1">Select New Role</label>
                <select
                  value={selectedNewRole}
                  onChange={(e) => setSelectedNewRole(e.target.value)}
                  className="w-full glass-input rounded-xl px-3 py-2 text-xs text-white bg-slate-900 font-sans"
                >
                  <option value="VIEWER" className="bg-slate-900">VIEWER</option>
                  <option value="DRIVER" className="bg-slate-900">DRIVER</option>
                  <option value="FLEET_MANAGER" className="bg-slate-900">FLEET_MANAGER</option>
                  <option value="ADMIN" className="bg-slate-900">ADMIN</option>
                </select>
              </div>

              {selectedUser.role === 'ADMIN' && selectedNewRole !== 'ADMIN' && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl text-xs font-mono">
                  <strong>Warning:</strong> You are demoting an administrator. System safeguards will block this if this is the final active administrator.
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => setShowRoleModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-xl disabled:opacity-50"
                >
                  {modalLoading ? 'SAVING...' : 'CONFIRM ROLE'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Status Confirmation */}
      {showStatusModal && selectedUser && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="glass-panel rounded-3xl max-w-md w-full p-6 sm:p-8 border border-slate-700 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white font-sans">
              {selectedUser.status === 'ACTIVE' ? 'Deactivate User Account' : 'Reactivate User Account'}
            </h3>

            {modalError && (
              <div className="p-3 bg-rose-500/10 text-rose-400 rounded-xl text-xs border border-rose-500/20 font-mono">
                {modalError}
              </div>
            )}

            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              {selectedUser.status === 'ACTIVE' ? (
                <>
                  Are you sure you want to deactivate <strong className="text-white">{selectedUser.name}</strong> ({selectedUser.email})?
                  This will immediately revoke active refresh tokens and block portal access.
                </>
              ) : (
                <>
                  Are you sure you want to reactivate <strong className="text-white">{selectedUser.name}</strong> ({selectedUser.email})?
                </>
              )}
            </p>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800 font-mono text-xs">
              <button
                type="button"
                onClick={() => setShowStatusModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={handleToggleStatus}
                disabled={modalLoading}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 ${
                  selectedUser.status === 'ACTIVE' 
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-[0_0_15px_-3px_rgba(244,63,94,0.4)]' 
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-[0_0_15px_-3px_rgba(16,185,129,0.4)]'
                }`}
              >
                {modalLoading ? 'PROCESSING...' : (selectedUser.status === 'ACTIVE' ? 'DEACTIVATE ACCOUNT' : 'ACTIVATE ACCOUNT')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
