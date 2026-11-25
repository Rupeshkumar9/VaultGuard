import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { build } from 'vite';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(currentDir, 'dist');
const ssgOutDir = path.resolve(currentDir, 'dist-ssg');

const SSG_ROUTES = [
  { route: '/', outFiles: ['index.html'], rewriteRootAssets: false },
  { route: '/blog', outFiles: ['blog.html'], rewriteRootAssets: false },
  { route: '/blog', outFiles: ['blog/index.html'], rewriteRootAssets: true },
];

function escapeHtmlAttr(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
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

  if (rewriteRootAssets) {
    output = output.replace(/(href|src)=["']\.\/(assets\/[^"']+)["']/g, '$1="/$2"');
  }

  return output;
}

async function runPrerender() {
  const indexHtmlPath = path.join(distDir, 'index.html');
  if (!fs.existsSync(indexHtmlPath)) {
    throw new Error(`Missing built client HTML at ${indexHtmlPath}. Run "vite build" first.`);
  }

  const templateHtml = fs.readFileSync(indexHtmlPath, 'utf-8');

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

      for (const relativeOut of target.outFiles) {
        const outPath = path.join(distDir, relativeOut);
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, finalHtml, 'utf-8');
        console.log(`⚡ Pre-rendered ${target.route} -> dist/${relativeOut}`);
      }
    }
  } finally {
    fs.rmSync(ssgOutDir, { recursive: true, force: true });
  }
}

runPrerender().catch((err) => {
  console.error('❌ SSG pre-render failed:', err);
  process.exit(1);
});
