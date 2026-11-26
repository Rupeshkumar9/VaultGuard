import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';
import { CryptoProvider } from '../contexts/CryptoContext';
import { VaultProvider } from '../contexts/VaultContext';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import LandingPage from '../pages/LandingPage';
import BlogPage from '../pages/BlogPage';
import BlogPostPage from '../pages/BlogPostPage';
import LoginPage from '../pages/LoginPage';
import RegisterPage from '../pages/RegisterPage';
import VaultPage from '../pages/VaultPage';
import RouteTitleSync from './RouteTitleSync';

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

export default function WebAppRoutes() {
  return (
    <BrowserRouter>
      <RouteTitleSync isAppTarget={false} />
      <Routes>
        {/* SSG Public Pages */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/blog" element={<BlogPage />} />
        <Route path="/blog.html" element={<BlogPage />} />
        <Route path="/blog/:slug" element={<BlogPostPage />} />

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
