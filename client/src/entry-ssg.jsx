import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import PublicRoutes from './routes/PublicRoutes';

const ROUTE_META = {
  '/': {
    title: 'VaultGuard — Zero-Knowledge Password Manager',
    description:
      'Organize credentials, generate passwords, and use autofill across web, browser extension, and Android—with a vault you can manage your way.',
  },
  '/blog': {
    title: 'The VaultGuard Journal — Security Guides & Product Updates',
    description:
      'Practical guidance, product notes, and open-source insights for a more considered digital life.',
  },
};

export function render(url) {
  const html = renderToString(
    <StrictMode>
      <StaticRouter location={url}>
        <PublicRoutes />
      </StaticRouter>
    </StrictMode>
  );

  const meta = ROUTE_META[url] || ROUTE_META['/'];
  return { html, meta };
}
