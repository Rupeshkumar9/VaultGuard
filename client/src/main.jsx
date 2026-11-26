/**
 * VaultGuard - Zero-Knowledge Password Manager
 * Developed by Rupesh (https://github.com/rupeshkumar9)
 */

import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { isExtension, isNative } from './utils/platform';
import { getBlogPostMeta } from './utils/blogLoader';

if (isExtension) {
  document.documentElement.classList.add('is-extension');
  document.body.classList.add('is-extension');
}

const rootEl = document.getElementById('root');
const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
const normalizedPath = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
const blogPostSlug = normalizedPath.startsWith('/blog/')
  ? normalizedPath.slice('/blog/'.length)
  : '';
const isKnownBlogPost = Boolean(
  blogPostSlug && !blogPostSlug.includes('/') && getBlogPostMeta(blogPostSlug)
);

const isPrerenderedWebRoute =
  !isExtension &&
  !isNative &&
  (normalizedPath === '/' ||
    normalizedPath === '/blog' ||
    normalizedPath === '/blog.html' ||
    isKnownBlogPost);

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
