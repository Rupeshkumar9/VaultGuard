import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { CryptoProvider } from './contexts/CryptoContext';
import { VaultProvider } from './contexts/VaultContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import VaultPage from './pages/VaultPage';
import { isExtension, isNative } from './utils/platform';
import ExtensionSiteAccessGate from './components/common/ExtensionSiteAccessGate';

// Lazy-load web-only marketing/blog pages so they stay out of the main bundle
// and are never loaded in the browser extension or Android app builds.
const LandingPage = lazy(() => import('./pages/LandingPage'));
const BlogPage = lazy(() => import('./pages/BlogPage'));
const BlogPostPage = lazy(() => import('./pages/BlogPostPage'));

const ROUTE_TITLES = {
  '/blog': 'The VaultGuard Journal — Security Guides & Product Updates',
  '/blog.html': 'The VaultGuard Journal — Security Guides & Product Updates',
  '/dashboard': 'VaultGuard — Dashboard',
  '/login': 'Log In — VaultGuard',
  '/register': 'Create Account — VaultGuard',
};

function RouteTitleSync({ isAppTarget }) {
  const { pathname } = useLocation();

  useEffect(() => {
    const normalizedPath = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

    // BlogPostPage sets its own dynamic title from the article metadata.
    if (normalizedPath.startsWith('/blog/')) return;

    if (normalizedPath === '/') {
      document.title = isAppTarget
        ? 'VaultGuard — Dashboard'
        : 'VaultGuard — Zero-Knowledge Password Manager';
      return;
    }

    const title = ROUTE_TITLES[normalizedPath];
    if (title) {
      document.title = title;
    }
  }, [pathname, isAppTarget]);

  return null;
}

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

  return (
    <BrowserRouter>
      <RouteTitleSync isAppTarget={false} />
      <Suspense
        fallback={
          <div className="min-h-screen bg-bg-dark flex items-center justify-center">
            <div className="w-10 h-10 rounded-full border-4 border-accent-teal/20 border-t-accent-teal animate-spin" />
          </div>
        }
      >
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
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
