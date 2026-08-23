import fs from 'fs';
import os from 'os';
import path from 'path';
import process from 'node:process';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.resolve(__dirname, 'dist');
const extensionDir = path.resolve(__dirname, '../extension');
const reactDistDir = path.join(extensionDir, 'react-dist');
const repoDir = path.resolve(__dirname, '..');

const archives = [
  {
    name: 'Chrome',
    sourceManifest: 'manifest.json',
    output: path.join(repoDir, 'VaultGuard_chrome_latest_ext.zip'),
  },
  {
    name: 'Firefox',
    sourceManifest: 'manifest.firefox.json',
    output: path.join(repoDir, 'VaultGuard_firefox_latest_ext.zip'),
  },
];

function createZip(sourceManifest, outputPath) {
  const stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultguard-extension-'));

  try {
    fs.cpSync(extensionDir, stagingDir, { recursive: true });

    // Each archive must expose exactly one browser manifest under the standard
    // manifest.json filename. The source extension folder keeps both manifests.
    const chromeManifest = path.join(stagingDir, 'manifest.json');
    const firefoxManifest = path.join(stagingDir, 'manifest.firefox.json');
    const selectedManifest = path.join(extensionDir, sourceManifest);

    if (!fs.existsSync(selectedManifest)) {
      throw new Error(`Missing extension manifest: ${selectedManifest}`);
    }

    fs.rmSync(chromeManifest, { force: true });
    fs.rmSync(firefoxManifest, { force: true });
    fs.copyFileSync(selectedManifest, chromeManifest);

    if (process.platform === 'win32') {
      // Use PowerShell's archive cmdlet so ZIP entries use the required
      // forward-slash separators. .NET CreateFromDirectory writes Windows
      // backslashes into entry names, which Firefox does not resolve as paths.
      const quote = (value) => `'${value.replaceAll("'", "''")}'`;
      const command = [
        'Import-Module Microsoft.PowerShell.Archive -ErrorAction Stop',
        `$output = ${quote(outputPath)}`,
        `$source = ${quote(path.join(stagingDir, '*'))}`,
        'Compress-Archive -Path $source -DestinationPath $output -CompressionLevel Optimal -Force',
      ].join('; ');

      execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command], {
        stdio: 'inherit',
      });
    } else {
      execFileSync('zip', ['-qr', outputPath, '.'], {
        cwd: stagingDir,
        stdio: 'inherit',
      });
    }
  } finally {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }
}

try {
  if (!fs.existsSync(srcDir)) {
    throw new Error(`Built client directory does not exist: ${srcDir}`);
  }

  // Refresh the compiled React popup assets used by the extension.
  fs.rmSync(reactDistDir, { recursive: true, force: true });
  fs.mkdirSync(reactDistDir, { recursive: true });
  fs.cpSync(srcDir, reactDistDir, { recursive: true });
  console.log('\n✨ Copied client/dist to extension/react-dist.');

  // Package the complete, freshly built extension for each browser.
  for (const archive of archives) {
    createZip(archive.sourceManifest, archive.output);
    console.log(`📦 Created ${archive.name} archive: ${archive.output}`);
  }

  console.log('');
} catch (err) {
  console.error('❌ Failed to copy built assets or create extension archives:', err);
  process.exit(1);
}
