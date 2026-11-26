/**
 * VaultGuard - Zero-Knowledge Password Manager
 * Developed by Rupesh (https://github.com/rupeshkumar9)
 */

import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import './index.css';
import { isExtension, isNative } from './utils/platform';
import { getBlogPostMeta } from './utils/blogLoader';

if (isExtension) {
  document.documentElement.classList.add('is-extension');
  document.body.classList.add('is-extension');
}

const rootEl = document.getElementById('root');
const isAppTarget = isExtension || isNative;
const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
const normalizedPath = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
const blogPostSlug = normalizedPath.startsWith('/blog/')
  ? normalizedPath.slice('/blog/'.length)
  : '';
const isKnownBlogPost = Boolean(
  blogPostSlug && !blogPostSlug.includes('/') && getBlogPostMeta(blogPostSlug)
);

const isPrerenderedWebRoute =
  !isAppTarget &&
  (normalizedPath === '/' ||
    normalizedPath === '/blog' ||
    normalizedPath === '/blog.html' ||
    isKnownBlogPost);

async function bootstrap() {
  const { default: TargetApp } = isAppTarget
    ? await import('./routes/AppTargetRoutes.jsx')
    : await import('./routes/WebAppRoutes.jsx');

  const appTree = (
    <StrictMode>
      <TargetApp />
    </StrictMode>
  );

  if (isPrerenderedWebRoute && rootEl.hasChildNodes()) {
    hydrateRoot(rootEl, appTree);
  } else {
    createRoot(rootEl).render(appTree);
  }
}

bootstrap();
