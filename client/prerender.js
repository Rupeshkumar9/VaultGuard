import fs from 'fs';
import path from 'path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'url';
import { build } from 'vite';
import { parseMarkdownDocument } from './src/utils/frontmatter.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(currentDir, 'dist');
const ssgOutDir = path.resolve(currentDir, 'dist-ssg');
const blogContentDir = path.resolve(currentDir, 'src/content/blog');

const CSR_SHELL_FILES = [
  { outFile: 'dashboard/index.html', title: 'VaultGuard — Dashboard', rewriteRootAssets: true },
];

function escapeHtmlAttr(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function serializeJsonForHtml(data) {
  return JSON.stringify(data)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026');
}

function rewriteAssetPathsForSubdir(html) {
  return html.replace(/(href|src)=["']\.\/(assets\/[^"']+)["']/g, '$1="/$2"');
}

function readAllBlogPosts() {
  if (!fs.existsSync(blogContentDir)) return [];

  return fs
    .readdirSync(blogContentDir)
    .filter((fileName) => fileName.endsWith('.md'))
    .sort()
    .map((fileName) => {
      const raw = fs.readFileSync(path.join(blogContentDir, fileName), 'utf-8');
      const { meta, body } = parseMarkdownDocument(raw);
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
        body,
      };
    });
}

function injectIntoTemplate(template, { html, meta }, { rewriteRootAssets, initialPost }) {
  let output = template.replace('<div id="root"></div>', `<div id="root">${html}</div>`);

  output = output.replace(
    /<title>[\s\S]*?<\/title>/i,
    `<title>${meta.title}</title>`
  );

  const descriptionTag = `<meta name="description" content="${escapeHtmlAttr(meta.description)}" />`;
  if (/<meta\s+name=["']description["'][^>]*>/i.test(output)) {
    output = output.replace(/<meta\s+name=["']description["'][^>]*>/i, descriptionTag);
  } else {
    output = output.replace('</head>', `    ${descriptionTag}\n  </head>`);
  }

  if (initialPost) {
    const payloadScript = `<script id="__VG_BLOG_POST__" type="application/json">${serializeJsonForHtml(initialPost)}</script>`;
    output = output.replace('</body>', `    ${payloadScript}\n  </body>`);
  }

  return rewriteRootAssets ? rewriteAssetPathsForSubdir(output) : output;
}

function buildCsrShell(template, { title, rewriteRootAssets }) {
  const output = template.replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`);
  return rewriteRootAssets ? rewriteAssetPathsForSubdir(output) : output;
}

async function runPrerender() {
  const indexHtmlPath = path.join(distDir, 'index.html');
  if (!fs.existsSync(indexHtmlPath)) {
    throw new Error(`Missing built client HTML at ${indexHtmlPath}. Run "vite build" first.`);
  }

  const templateHtml = fs.readFileSync(indexHtmlPath, 'utf-8');
  if (!templateHtml.includes('<div id="root"></div>')) {
    throw new Error('dist/index.html is already pre-rendered. Run "vite build" before "node prerender.js".');
  }

  fs.rmSync(path.join(distDir, 'blog.html'), { force: true });

  for (const shell of CSR_SHELL_FILES) {
    const shellHtml = buildCsrShell(templateHtml, shell);
    const outPath = path.join(distDir, shell.outFile);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, shellHtml, 'utf-8');
    console.log(`🧩 Created CSR shell -> dist/${shell.outFile}`);
  }

  const blogPosts = readAllBlogPosts();
  const ssgTargets = [
    { route: '/', outFile: 'index.html', rewriteRootAssets: true, initialPost: null },
    { route: '/blog', outFile: 'blog/index.html', rewriteRootAssets: true, initialPost: null },
    ...blogPosts.map((post) => ({
      route: `/blog/${post.slug}`,
      outFile: `blog/${post.slug}/index.html`,
      rewriteRootAssets: true,
      initialPost: post,
    })),
  ];

  try {
    await build({
      root: currentDir,
      logLevel: 'silent',
      build: {
        ssr: path.resolve(currentDir, 'src/entry-ssg.jsx'),
        outDir: ssgOutDir,
        emptyOutDir: true,
        rollupOptions: {
          output: {
            format: 'es',
            entryFileNames: 'entry-ssg.mjs',
          },
        },
      },
    });

    const serverEntryUrl = pathToFileURL(path.join(ssgOutDir, 'entry-ssg.mjs')).href;
    const { render } = await import(serverEntryUrl);

    for (const target of ssgTargets) {
      const rendered = render(target.route, target.initialPost);
      const finalHtml = injectIntoTemplate(templateHtml, rendered, target);
      const outPath = path.join(distDir, target.outFile);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, finalHtml, 'utf-8');
      console.log(`⚡ Pre-rendered ${target.route} -> dist/${target.outFile}`);
    }
  } finally {
    fs.rmSync(ssgOutDir, { recursive: true, force: true });
  }
}

runPrerender().catch((err) => {
  console.error('❌ SSG pre-render failed:', err);
  process.exit(1);
});
