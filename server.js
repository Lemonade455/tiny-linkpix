import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb, insertFile, getBySlug, incrementHits, slugExists } from './db.js';
import rateLimit from 'express-rate-limit';
import mime from 'mime-types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ENV
const PORT = parseInt(process.env.PORT || '3000', 10);
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const UPLOAD_TOKEN = process.env.UPLOAD_TOKEN || '';
const MAX_FILE_MB = parseInt(process.env.MAX_FILE_MB || '25', 10);
const ALLOWED_MIME = (process.env.ALLOWED_MIME || 'image/jpeg,image/png,image/webp,image/gif')
  .split(',')
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);
const SQLITE_PATH = process.env.SQLITE_PATH || '/data/db.sqlite';
const DATA_DIR = process.env.DATA_DIR || '/data/uploads';
const SLUG_REGEX = new RegExp(process.env.SLUG_REGEX || '^[a-z0-9-]{3,64}$');

// PREP
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = initDb(SQLITE_PATH);

const app = express();
app.disable('x-powered-by');
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limit
const limiter = rateLimit({
  windowMs: (parseInt(process.env.RATE_WINDOW_MIN || '1', 10)) * 60 * 1000,
  max: parseInt(process.env.RATE_MAX || '60', 10),
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Multer temp dir
const upload = multer({
  dest: path.join(__dirname, 'tmp'),
  limits: { fileSize: MAX_FILE_MB * 1024 * 1024, files: 1 }
});

// Static test UI
app.use(express.static(path.join(__dirname, 'public')));

// Health
app.get('/healthz', (req, res) => res.json({ ok: true, ts: Date.now() }));

// Upload (token protected)
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!UPLOAD_TOKEN) {
      return res.status(500).json({ error: 'UPLOAD_TOKEN is not configured' });
    }
    const token = req.header('x-upload-token') || req.body.token;
    if (token !== UPLOAD_TOKEN) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const desiredSlug = (req.body.slug || '').trim().toLowerCase();
    if (!SLUG_REGEX.test(desiredSlug)) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: 'Invalid slug format' });
    }
    if (slugExists(db, desiredSlug)) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(409).json({ error: 'Slug already exists' });
    }

    if (!req.file) return res.status(400).json({ error: 'Missing file' });

    const detectedMime = (req.file.mimetype || '').toLowerCase();
    if (!ALLOWED_MIME.includes(detectedMime)) {
      fs.unlink(req.file.path, () => {});
      return res.status(415).json({ error: 'Unsupported media type' });
    }

    let ext = mime.extension(detectedMime);
    if (!ext) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: 'Cannot derive file extension' });
    }

    const finalName = `${desiredSlug}.${ext}`;
    const finalPath = path.join(DATA_DIR, finalName);
    await fs.promises.rename(req.file.path, finalPath);

    insertFile(db, {
      slug: desiredSlug,
      path: finalPath,
      mimetype: detectedMime,
      size: req.file.size
    });

    const publicUrl = `${BASE_URL}/${desiredSlug}`;
    return res.status(201).json({ ok: true, slug: desiredSlug, url: publicUrl });
  } catch (err) {
    console.error(err);
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(500).json({ error: 'Internal error' });
  }
});

// Resolve slug to image
app.get('/:slug', async (req, res) => {
  try {
    const slug = (req.params.slug || '').toLowerCase();
    if (!SLUG_REGEX.test(slug)) return res.status(404).end();
    const row = getBySlug(db, slug);
    if (!row) return res.status(404).send('Not found');
    incrementHits(db, slug);
    res.setHeader('Content-Type', row.mimetype);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.sendFile(path.resolve(row.path));
  } catch (err) {
    console.error(err);
    return res.status(500).send('Internal error');
  }
});

app.listen(PORT, () => {
  console.log(`Tiny-LinkPix listening on :${PORT} (BASE_URL=${BASE_URL})`);
});
