import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ROUTE_TITLES = {
  '/blog': 'The VaultGuard Journal — Security Guides & Product Updates',
  '/blog.html': 'The VaultGuard Journal — Security Guides & Product Updates',
  '/dashboard': 'VaultGuard — Dashboard',
  '/login': 'Log In — VaultGuard',
  '/register': 'Create Account — VaultGuard',
};

export default function RouteTitleSync({ isAppTarget = false }) {
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
