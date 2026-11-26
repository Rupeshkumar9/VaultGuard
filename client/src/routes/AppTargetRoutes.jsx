/* global chrome */

import { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';
import { CryptoProvider } from '../contexts/CryptoContext';
import { VaultProvider } from '../contexts/VaultContext';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import LoginPage from '../pages/LoginPage';
import RegisterPage from '../pages/RegisterPage';
import VaultPage from '../pages/VaultPage';
import { isExtension } from '../utils/platform';
import ExtensionSiteAccessGate from '../components/common/ExtensionSiteAccessGate';
import RouteTitleSync from './RouteTitleSync';

export default function AppTargetRoutes() {
  // Auto-sync client's environment VITE_API_URL to extension background script
  useEffect(() => {
    if (!isExtension) return;

    if (import.meta.env.VITE_API_URL) {
      chrome.runtime.sendMessage({
        action: 'SET_SERVER_URL',
        serverUrl: import.meta.env.VITE_API_URL,
      }).catch((err) => console.error('Failed to sync environment URL to background:', err));
    }

    if (import.meta.env.VITE_FRONTEND_URL) {
      chrome.runtime.sendMessage({
        action: 'SET_FRONTEND_URL',
        frontendUrl: import.meta.env.VITE_FRONTEND_URL,
      }).catch((err) => console.error('Failed to sync frontend URL to background:', err));
    }

    const lockTimeout = localStorage.getItem('vaultguard_lock_timeout') || '5';
    chrome.runtime.sendMessage({ action: 'SET_LOCK_TIMEOUT', lockTimeout })
      .catch((err) => console.error('Failed to sync lock timeout to background:', err));
  }, []);

  return (
    <>
      <ExtensionSiteAccessGate />
      <AuthProvider>
        <CryptoProvider>
          <VaultProvider>
            <HashRouter>
              <RouteTitleSync isAppTarget />
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <VaultPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <VaultPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="/dashbaord" element={<Navigate to="/dashboard" replace />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </HashRouter>
          </VaultProvider>
        </CryptoProvider>
      </AuthProvider>
    </>
  );
}
