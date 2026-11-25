import { useEffect } from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { CryptoProvider } from './contexts/CryptoContext';
import { VaultProvider } from './contexts/VaultContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import BlogPage from './pages/BlogPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import VaultPage from './pages/VaultPage';
import { isExtension, isNative } from './utils/platform';
import ExtensionSiteAccessGate from './components/common/ExtensionSiteAccessGate';

function AuthShell() {
  return (
    <AuthProvider>
      <CryptoProvider>
        <VaultProvider>
          <Outlet />
        </VaultProvider>
      </CryptoProvider>
    </AuthProvider>
  );
}

function App() {
  const isAppTarget = isExtension || isNative;

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

  if (isAppTarget) {
    return (
      <>
        <ExtensionSiteAccessGate />
        <AuthProvider>
          <CryptoProvider>
            <VaultProvider>
              <HashRouter>
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

  return (
    <BrowserRouter>
      <Routes>
        {/* SSG Public Pages */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/blog" element={<BlogPage />} />
        <Route path="/blog.html" element={<BlogPage />} />

        {/* CSR Authenticated & Auth Routes */}
        <Route element={<AuthShell />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <VaultPage />
              </ProtectedRoute>
            }
          />
          <Route path="/dashbaord" element={<Navigate to="/dashboard" replace />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
