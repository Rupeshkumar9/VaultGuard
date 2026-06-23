import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.resolve(__dirname, 'dist');
const destDir = path.resolve(__dirname, '../extension/react-dist');

try {
  // Clear old destination directory if it exists
  if (fs.existsSync(destDir)) {
    fs.rmSync(destDir, { recursive: true, force: true });
  }
  fs.mkdirSync(destDir, { recursive: true });

  // Copy dist recursively using native fs.cpSync (Node v16.7.0+)
  fs.cpSync(srcDir, destDir, { recursive: true });
  console.log(`\n✨ Successfully copied built assets from client/dist to extension/react-dist!\n`);
} catch (err) {
  console.error('❌ Failed to copy built assets to extension folder:', err);
  process.exit(1);
}
