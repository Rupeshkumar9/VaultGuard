import React, { createContext, useState, useEffect, useContext } from 'react';
import { api, setToken, clearToken } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check auth session on startup
  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await api.get('/auth/me');
        if (response.success && response.user) {
          // Token is read from cookies by backend. If successful, set local session.
          if (response.token) {
            setToken(response.token);
          }
          setUser(response.user);
          setIsAuthenticated(true);
        }
      } catch (error) {
        // Silent failure (expected if not logged in or cookie expired)
        console.log('No active session found.');
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
  }, []);

  const login = async (email, password) => {
    setIsLoading(true);
    try {
      const response = await api.post('/auth/login', { email, password });
      if (response.success) {
        setToken(response.token);
        setUser(response.user);
        setIsAuthenticated(true);
        return response;
      }
    } catch (error) {
      setIsAuthenticated(false);
      setUser(null);
      clearToken();
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email, password, masterPasswordHint) => {
    setIsLoading(true);
    try {
      const response = await api.post('/auth/register', { 
        email, 
        password, 
        masterPasswordHint 
      });
      if (response.success) {
        setToken(response.token);
        setUser(response.user);
        setIsAuthenticated(true);
        return response;
      }
    } catch (error) {
      setIsAuthenticated(false);
      setUser(null);
      clearToken();
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout request failed:', error);
    } finally {
      clearToken();
      setUser(null);
      setIsAuthenticated(false);
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
