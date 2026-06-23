import React, { createContext, useState, useEffect, useContext } from 'react';
import { api, setToken, clearToken } from '../services/api';
import { localDb } from '../services/localDb';
import { isNative, isExtension } from '../utils/platform';

const AuthContext = createContext(null);
const AUTH_CACHE_KEY = 'vaultguard_cached_user';

const getMinimalUser = (user) => {
  if (!user) return null;
  return {
    id: user.id || user._id,
    email: user.email,
  };
};

const getCachedUser = () => {
  try {
    const cached = localStorage.getItem(AUTH_CACHE_KEY);
    const user = cached ? JSON.parse(cached) : null;
    const minimalUser = getMinimalUser(user);
    if (minimalUser && JSON.stringify(user) !== JSON.stringify(minimalUser)) {
      localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(minimalUser));
    }
    return minimalUser;
  } catch (error) {
    console.warn('Failed to read cached auth user:', error);
    localStorage.removeItem(AUTH_CACHE_KEY);
    return null;
  }
};

const cacheUser = (user) => {
  const minimalUser = getMinimalUser(user);
  if (!minimalUser) return;
  localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(minimalUser));
  if (isNative) {
    localDb.saveUserProfile(user);
  }
};

const clearCachedUser = () => {
  localStorage.removeItem(AUTH_CACHE_KEY);
  if (isNative) {
    localDb.clearUserProfile();
  }
};

export const AuthProvider = ({ children }) => {
  const cachedUser = getCachedUser();
  const [user, setUser] = useState(cachedUser);
  const [isAuthenticated, setIsAuthenticated] = useState(!!cachedUser);
  const [isLoading, setIsLoading] = useState(!cachedUser);

  // Use cached user metadata immediately, then refresh the real server session in the background.
  useEffect(() => {
    let isMounted = true;

    const checkExtensionSession = async () => {
      try {
        const response = await chrome.runtime.sendMessage({ action: 'GET_STATUS' });
        if (!isMounted) return;
        if (response && response.isUnlocked && response.user) {
          setUser(response.user);
          setIsAuthenticated(true);
        } else {
          setUser(null);
          setIsAuthenticated(false);
        }
      } catch (err) {
        console.error('Failed to query extension background session:', err);
        if (isMounted) {
          setUser(null);
          setIsAuthenticated(false);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    const loadCachedProfile = async () => {
      if (!cachedUser || !isNative) return;

      const profile = await localDb.getUserProfile();
      if (isMounted && profile) {
        setUser({
          ...cachedUser,
          ...profile,
        });
      }
    };

    const checkSession = async () => {
      try {
        const response = await api.get('/auth/me');
        if (!isMounted) return;

        if (response.success && response.user) {
          // Token is read from cookies by backend. If successful, set local session.
          if (response.token) {
            setToken(response.token);
          }
          cacheUser(response.user);
          setUser(response.user);
          setIsAuthenticated(true);
        }
      } catch (error) {
        if (!isMounted) return;

        if (isNative) {
          if (cachedUser) {
            // Render cached vault data while a sleeping/free backend wakes or when offline.
            console.log('Using cached local session while server auth is unavailable.');
            setUser(cachedUser);
            setIsAuthenticated(true);
          } else {
            // Mobile offline fallback: check if we have a user profile saved in IndexedDB
            try {
              const profile = await localDb.getUserProfile();
              if (profile) {
                console.log('Using cached IndexedDB profile for offline mobile auth.');
                const minimalUser = getMinimalUser(profile);
                setUser({
                  ...minimalUser,
                  ...profile,
                });
                setIsAuthenticated(true);
              } else {
                console.log('No active session or cached profile found.');
                setUser(null);
                setIsAuthenticated(false);
              }
            } catch (dbErr) {
              console.error('Failed to query localDb for offline auth:', dbErr);
              setUser(null);
              setIsAuthenticated(false);
            }
          }
        } else {
          // Web offline logic: do not support offline authentication
          console.log('Server auth unavailable and offline access disabled for web.');
          setUser(null);
          setIsAuthenticated(false);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    if (isExtension) {
      checkExtensionSession();
      return () => {
        isMounted = false;
      };
    }

    loadCachedProfile();
    checkSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (email, password) => {
    setIsLoading(true);
    try {
      if (isExtension) {
        const response = await chrome.runtime.sendMessage({
          action: 'UNLOCK_VAULT',
          email,
          masterPassword: password,
          rememberVault: true,
        });
        if (response.success) {
          setUser(response.user);
          setIsAuthenticated(true);
          return response;
        } else {
          throw new Error(response.error || 'Invalid credentials.');
        }
      }

      const response = await api.post('/auth/login', { email, password });
      if (response.success) {
        setToken(response.token);
        cacheUser(response.user);
        setUser(response.user);
        setIsAuthenticated(true);
        return response;
      }
    } catch (error) {
      setIsAuthenticated(false);
      setUser(null);
      clearToken();
      clearCachedUser();
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email, password, masterPasswordHint) => {
    setIsLoading(true);
    try {
      if (isExtension) {
        const response = await api.post('/auth/register', { 
          email, 
          password, 
          masterPasswordHint 
        });
        if (response.success) {
          await chrome.runtime.sendMessage({
            action: 'UNLOCK_VAULT',
            email,
            masterPassword: password,
            rememberVault: true,
          });
          setUser(response.user);
          setIsAuthenticated(true);
          return response;
        }
      }

      const response = await api.post('/auth/register', { 
        email, 
        password, 
        masterPasswordHint 
      });
      if (response.success) {
        setToken(response.token);
        cacheUser(response.user);
        setUser(response.user);
        setIsAuthenticated(true);
        return response;
      }
    } catch (error) {
      setIsAuthenticated(false);
      setUser(null);
      clearToken();
      clearCachedUser();
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      if (isExtension) {
        await chrome.runtime.sendMessage({ action: 'LOCK_VAULT' });
      } else {
        await api.post('/auth/logout');
      }
    } catch (error) {
      console.error('Logout request failed:', error);
    } finally {
      clearToken();
      clearCachedUser();
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
