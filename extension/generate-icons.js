import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ──── CRC32 Helper ────
const crcTable = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) {
      c = 0xEDB88320 ^ (c >>> 1);
    } else {
      c = c >>> 1;
    }
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return crc ^ -1;
}

// ──── PNG Writer ────
function writePng(width, height, pixels) {
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  
  // 1. IHDR Chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeInt32BE(width, 0);
  ihdrData.writeInt32BE(height, 4);
  ihdrData[8] = 8;      // Bit depth: 8
  ihdrData[9] = 6;      // Color type: RGBA
  ihdrData[10] = 0;     // Compression
  ihdrData[11] = 0;     // Filter
  ihdrData[12] = 0;     // Interlace
  
  const ihdrChunk = createChunk('IHDR', ihdrData);

  // 2. IDAT Chunk (pixels with filter byte '00' at start of each scanline)
  const scanlineLength = width * 4 + 1;
  const rawIdat = Buffer.alloc(height * scanlineLength);
  
  for (let y = 0; y < height; y++) {
    rawIdat[y * scanlineLength] = 0; // Filter type 0
    const pixelOffset = y * width * 4;
    const destOffset = y * scanlineLength + 1;
    pixels.copy(rawIdat, destOffset, pixelOffset, pixelOffset + width * 4);
  }
  
  const compressedIdat = zlib.deflateSync(rawIdat, { level: 9 });
  const idatChunk = createChunk('IDAT', compressedIdat);

  // 3. IEND Chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lengthBuf = Buffer.alloc(4);
  lengthBuf.writeInt32BE(data.length, 0);

  const crcBuf = Buffer.concat([typeBuf, data]);
  const crcValue = crc32(crcBuf);
  const crcOutBuf = Buffer.alloc(4);
  crcOutBuf.writeInt32BE(crcValue, 0);

  return Buffer.concat([lengthBuf, typeBuf, data, crcOutBuf]);
}

// ──── Draw Shield Icon ────
function drawShieldIcon(width, height) {
  const pixels = Buffer.alloc(width * height * 4);
  
  const cx = width / 2;
  const cy = height / 2;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      
      // Normalize coords to [-1, 1] relative to center
      const nx = (x - cx) / (width * 0.45);
      const ny = (y - cy) / (height * 0.45);
      
      let isInsideShield = false;

      // Shield shape equation: flat top, curved sides, pointy bottom
      if (ny >= -0.8 && ny <= 0.8) {
        // Curve top-to-bottom
        const widthAtY = ny < -0.3 
          ? 1.0 // flat-ish top sides
          : 1.0 - Math.pow((ny + 0.3) / 1.1, 2); // taper down
        
        if (Math.abs(nx) <= widthAtY) {
          isInsideShield = true;
        }
      }
      // Top points smoothing
      if (ny < -0.8 && ny >= -0.9) {
        const dip = -0.8 - (0.1 * Math.pow(Math.abs(nx), 2));
        if (ny >= dip && Math.abs(nx) <= 1.0) {
          isInsideShield = true;
        }
      }

      if (isInsideShield) {
        // Neon cyan-to-blue gradient
        const t = (ny + 1) / 2; // [0, 1] top to bottom
        const r = Math.round(0 * (1 - t) + 79 * t);
        const g = Math.round(242 * (1 - t) + 172 * t);
        const b = Math.round(254 * (1 - t) + 254 * t);
        
        // Add a lock icon in the center (dark overlay)
        let isInsideLock = false;
        const lx = nx * 2.2;
        const ly = (ny - 0.05) * 2.2; // center it slightly lower
        
        // Lock body (square/rounded)
        if (Math.abs(lx) <= 0.35 && ly >= -0.1 && ly <= 0.4) {
          isInsideLock = true;
        }
        // Lock shackle (arch)
        if (ly < -0.1 && ly >= -0.45) {
          const rInner = 0.22;
          const rOuter = 0.35;
          const dist = Math.sqrt(lx * lx + (ly + 0.1) * (ly + 0.1));
          if (dist >= rInner && dist <= rOuter && ly <= -0.1) {
            isInsideLock = true;
          }
        }
        // Keyhole (circle + line)
        let isInsideKeyhole = false;
        const kx = lx;
        const ky = ly - 0.15;
        const kDist = Math.sqrt(kx * kx + ky * ky);
        if (kDist <= 0.09) {
          isInsideKeyhole = true;
        }
        if (Math.abs(kx) <= 0.04 && ky > 0.05 && ky <= 0.25) {
          isInsideKeyhole = true;
        }

        if (isInsideKeyhole) {
          // Glow effect inside keyhole (white/cyan)
          pixels[idx] = 0;
          pixels[idx + 1] = 242;
          pixels[idx + 2] = 254;
          pixels[idx + 3] = 255;
        } else if (isInsideLock) {
          // Lock color (dark grey/navy)
          pixels[idx] = 12;
          pixels[idx + 1] = 15;
          pixels[idx + 2] = 18;
          pixels[idx + 3] = 255;
        } else {
          // Shield body gradient
          pixels[idx] = r;
          pixels[idx + 1] = g;
          pixels[idx + 2] = b;
          pixels[idx + 3] = 255;
        }
      } else {
        // Transparent background
        pixels[idx] = 0;
        pixels[idx + 1] = 0;
        pixels[idx + 2] = 0;
        pixels[idx + 3] = 0;
      }
    }
  }
  return pixels;
}

// ──── Generate All Icons ────
const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

const sizes = [16, 48, 128];
sizes.forEach(size => {
  console.log(`Generating icon${size}.png...`);
  const pixels = drawShieldIcon(size, size);
  const pngBuffer = writePng(size, size, pixels);
  fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), pngBuffer);
});

console.log('🎉 All icons generated successfully in extension/icons/');
