import React from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CryptoProvider, useCrypto } from './contexts/CryptoContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import { VaultProvider } from './contexts/VaultContext';
import VaultPage from './pages/VaultPage';
import { isExtension, isNative } from './utils/platform';

function App() {
  const RouterComponent = (isExtension || isNative) ? HashRouter : BrowserRouter;

  // Auto-sync client's environment VITE_API_URL to extension background script
  React.useEffect(() => {
    if (isExtension && import.meta.env.VITE_API_URL) {
      chrome.runtime.sendMessage({
        action: 'SET_SERVER_URL',
        serverUrl: import.meta.env.VITE_API_URL
      }).catch(err => console.error('Failed to sync environment URL to background:', err));
    }
  }, []);

  return (
    <AuthProvider>
      <CryptoProvider>
        <VaultProvider>
          <RouterComponent>
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Protected Routes */}
              <Route path="/" element={<ProtectedRoute> <VaultPage /> </ProtectedRoute>} />

              {/* Redirect any other path to / */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </RouterComponent>
        </VaultProvider>
      </CryptoProvider>
    </AuthProvider>
  );
}

export default App;

