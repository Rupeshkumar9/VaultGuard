/**
 * VaultGuard - Zero-Knowledge Password Manager
 * Developed by Rupesh (https://github.com/rupeshkumar9)
 */

import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { isExtension, isNative } from './utils/platform';

if (isExtension) {
  document.documentElement.classList.add('is-extension');
  document.body.classList.add('is-extension');
}

const rootEl = document.getElementById('root');
const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
const isPrerenderedWebRoute =
  !isExtension &&
  !isNative &&
  (pathname === '/' || pathname === '/blog' || pathname === '/blog/' || pathname === '/blog.html');

const appTree = (
  <StrictMode>
    <App />
  </StrictMode>
);

if (isPrerenderedWebRoute && rootEl.hasChildNodes()) {
  hydrateRoot(rootEl, appTree);
} else {
  createRoot(rootEl).render(appTree);
}
