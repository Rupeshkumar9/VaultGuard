import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CryptoProvider, useCrypto } from './contexts/CryptoContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import { VaultProvider } from './contexts/VaultContext';
import VaultPage from './pages/VaultPage';

function App() {
  return (
    <AuthProvider>
      <CryptoProvider>
        <VaultProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Protected Routes */}
              <Route path="/" element={<ProtectedRoute> <VaultPage /> </ProtectedRoute>} />

              {/* Redirect any other path to / */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </VaultProvider>
      </CryptoProvider>
    </AuthProvider>
  );
}

export default App;

