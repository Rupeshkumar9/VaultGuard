import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { parseMarkdownDocument } from './src/utils/frontmatter.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const blogContentDir = path.resolve(currentDir, 'src/content/blog');

function readBlogIndex() {
  if (!fs.existsSync(blogContentDir)) return [];

  const files = fs
    .readdirSync(blogContentDir)
    .filter((fileName) => fileName.endsWith('.md'))
    .sort();

  const posts = files.map((fileName) => {
    const raw = fs.readFileSync(path.join(blogContentDir, fileName), 'utf-8');
    const { meta } = parseMarkdownDocument(raw);
    const fallbackSlug = fileName.replace(/\.md$/, '');
    return {
      fileName,
      slug: String(meta.slug || fallbackSlug),
      title: String(meta.title || fallbackSlug),
      summary: String(meta.summary || ''),
      topicId: String(meta.topicId || 'security-guides'),
      badge: String(meta.badge || 'JOURNAL'),
      eyebrow: String(meta.eyebrow || 'ARTICLE'),
      ctaLabel: String(meta.ctaLabel || 'Read article'),
      readTime: String(meta.readTime || '4 min read'),
      iconKey: String(meta.iconKey || 'iconShieldCover'),
      publishedAt: String(meta.publishedAt || '2026-01-01'),
      featured: Boolean(meta.featured),
    };
  });

  posts.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return posts;
}

function blogIndexPlugin() {
  const virtualId = 'virtual:blog-index';
  const resolvedVirtualId = '\0' + virtualId;

  return {
    name: 'vaultguard-blog-index',
    resolveId(id) {
      if (id === virtualId) return resolvedVirtualId;
      return null;
    },
    load(id) {
      if (id === resolvedVirtualId) {
        return `export default ${JSON.stringify(readBlogIndex())};`;
      }
      return null;
    },
    configureServer(server) {
      server.watcher.add(blogContentDir);
      const reload = (filePath) => {
        if (!filePath.endsWith('.md')) return;
        const mod = server.moduleGraph.getModuleById(resolvedVirtualId);
        if (mod) {
          server.moduleGraph.invalidateModule(mod);
          server.ws.send({ type: 'full-reload' });
        }
      };
      server.watcher.on('add', reload);
      server.watcher.on('change', reload);
      server.watcher.on('unlink', reload);
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    blogIndexPlugin(),
    react(),
    tailwindcss(),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
