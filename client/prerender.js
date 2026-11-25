import fs from 'fs';
import path from 'path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'url';
import { build } from 'vite';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(currentDir, 'dist');
const ssgOutDir = path.resolve(currentDir, 'dist-ssg');

const SSG_ROUTES = [
  { route: '/', outFile: 'index.html', rewriteRootAssets: false },
  { route: '/blog', outFile: 'blog/index.html', rewriteRootAssets: true },
];

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

function rewriteAssetPathsForSubdir(html) {
  return html.replace(/(href|src)=["']\.\/(assets\/[^"']+)["']/g, '$1="/$2"');
}

function injectIntoTemplate(template, { html, meta }, rewriteRootAssets) {
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

  return rewriteRootAssets ? rewriteAssetPathsForSubdir(output) : output;
}

function buildCsrShell(template, { title, rewriteRootAssets }) {
  let output = template.replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`);
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

  // Remove any legacy flat blog.html if present
  fs.rmSync(path.join(distDir, 'blog.html'), { force: true });

  // Emit clean CSR HTML shells for nested app routes before overwriting dist/index.html
  for (const shell of CSR_SHELL_FILES) {
    const shellHtml = buildCsrShell(templateHtml, shell);
    const outPath = path.join(distDir, shell.outFile);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, shellHtml, 'utf-8');
    console.log(`🧩 Created CSR shell -> dist/${shell.outFile}`);
  }

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

    for (const target of SSG_ROUTES) {
      const rendered = render(target.route);
      const finalHtml = injectIntoTemplate(templateHtml, rendered, target.rewriteRootAssets);
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
