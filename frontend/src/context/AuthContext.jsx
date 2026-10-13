import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { disconnectSocket } from '../services/socket';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const initAuth = async () => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        try {
          const res = await api.get('/auth/me');
          if (isMounted) setUser(res.data.data);
        } catch (err) {
          localStorage.removeItem('accessToken');
          delete api.defaults.headers.common['Authorization'];
          disconnectSocket();
          if (isMounted) setUser(null);
        }
      }
      if (isMounted) setLoading(false);
    };

    // Safety timeout in case network request hangs
    const timer = setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 4000);

    initAuth().finally(() => {
      clearTimeout(timer);
    });

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);

  const login = (data) => {
    disconnectSocket();
    localStorage.setItem('accessToken', data.accessToken);
    api.defaults.headers.common['Authorization'] = `Bearer ${data.accessToken}`;
    setUser(data.user);
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // ignore
    } finally {
      disconnectSocket();
      localStorage.removeItem('accessToken');
      delete api.defaults.headers.common['Authorization'];
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
