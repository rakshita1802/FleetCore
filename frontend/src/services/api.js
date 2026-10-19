import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true // Important for refresh cookies
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (!originalRequest) {
      return Promise.reject(error);
    }

    // Never intercept auth endpoints to prevent deadlocks
    if (
      originalRequest.url?.includes('/auth/login') ||
      originalRequest.url?.includes('/auth/register') ||
      originalRequest.url?.includes('/auth/refresh') ||
      originalRequest.url?.includes('/auth/logout')
    ) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers['Authorization'] = 'Bearer ' + token;
          return api(originalRequest);
        }).catch(err => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
        const { data } = await axios.post(`${baseURL}/auth/refresh`, {}, { withCredentials: true });
        const token = data?.data?.accessToken;
        
        if (token) {
          localStorage.setItem('accessToken', token);
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          originalRequest.headers['Authorization'] = `Bearer ${token}`;
          processQueue(null, token);
          return api(originalRequest);
        } else {
          throw new Error('No access token returned from refresh');
        }
      } catch (err) {
        processQueue(err, null);
        localStorage.removeItem('accessToken');
        delete api.defaults.headers.common['Authorization'];
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export const telemetryApi = {
  getAll: (params) => api.get('/telemetry', { params }),
  getById: (id) => api.get(`/telemetry/${id}`),
  getByVehicle: (vehicleId, params) => api.get(`/vehicles/${vehicleId}/telemetry`, { params }),
  getByTrip: (tripId, params) => api.get(`/trips/${tripId}/telemetry`, { params })
};

export const maintenanceApi = {
  getSummary: () => api.get('/maintenance/summary'),
  getDue: (params) => api.get('/maintenance/due', { params }),
  getSchedules: (params) => api.get('/maintenance/schedules', { params }),
  createSchedule: (data) => api.post('/maintenance/schedules', data),
  updateSchedule: (id, data) => api.patch(`/maintenance/schedules/${id}`, data),
  deleteSchedule: (id) => api.delete(`/maintenance/schedules/${id}`),
  getRecords: (params) => api.get('/maintenance/records', { params }),
  createRecord: (data) => api.post('/maintenance/records', data),
  startRecord: (id, data) => api.post(`/maintenance/records/${id}/start`, data),
  completeRecord: (id, data) => api.post(`/maintenance/records/${id}/complete`, data),
  cancelRecord: (id, data) => api.post(`/maintenance/records/${id}/cancel`, data),
  getVehicleDetails: (vehicleId) => api.get(`/maintenance/vehicles/${vehicleId}`),
  evaluate: () => api.post('/maintenance/evaluate')
};

export const alertsApi = {
  getAll: (params) => api.get('/alerts', { params }),
  getById: (id) => api.get(`/alerts/${id}`),
  acknowledge: (id, data) => api.post(`/alerts/${id}/acknowledge`, data),
  resolve: (id, data) => api.post(`/alerts/${id}/resolve`, data)
};

export const adminApi = {
  getOverview: () => api.get('/admin/overview'),
  getSystemHealth: () => api.get('/admin/system'),
  getUsers: (params) => api.get('/admin/users', { params }),
  getUserById: (id) => api.get(`/admin/users/${id}`),
  createUser: (data) => api.post('/admin/users', data),
  updateUser: (id, data) => api.patch(`/admin/users/${id}`, data),
  changeRole: (id, role) => api.patch(`/admin/users/${id}/role`, { role }),
  activateUser: (id) => api.post(`/admin/users/${id}/activate`),
  deactivateUser: (id) => api.post(`/admin/users/${id}/deactivate`)
};

export const reportsApi = {
  getPreview: (type, params) => api.get(`/reports/${type}`, { params }),
  exportSync: (type, params) => api.get(`/reports/${type}/export`, { params, responseType: 'blob' }),
  exportAsync: (type, data) => api.post(`/reports/${type}/export`, data),
  getJobStatus: (jobId) => api.get(`/reports/jobs/${jobId}`)
};

export const auditApi = {
  getLogs: (params) => api.get('/audit', { params })
};

export const observabilityApi = {
  getHealth: () => api.get('/health'),
  getLive: () => api.get('/health/live'),
  getReady: () => api.get('/health/ready'),
  getJobs: () => api.get('/health/jobs')
};

export const simulatorApi = {
  getStatus: () => api.get('/simulator/status'),
  start: () => api.post('/simulator/start'),
  stop: () => api.post('/simulator/stop'),
  setSpeed: (multiplier) => api.post('/simulator/speed', { multiplier }),
  reset: () => api.post('/simulator/reset')
};

export const geofencesApi = {
  getAll: () => api.get('/geofences'),
  create: (data) => api.post('/geofences', data),
  update: (id, data) => api.patch(`/geofences/${id}`, data),
  delete: (id) => api.delete(`/geofences/${id}`),
  getBreaches: (params) => api.get('/geofences/breaches', { params }),
  resolveBreach: (id) => api.post(`/geofences/breaches/${id}/resolve`)
};

export const sustainabilityApi = {
  getMetrics: (params) => api.get('/sustainability/metrics', { params }),
  compareVehicles: (vehicleIdA, vehicleIdB) => api.get('/sustainability/compare', { params: { vehicleIdA, vehicleIdB } }),
  clearCache: () => api.post('/sustainability/cache/clear')
};

export default api;

