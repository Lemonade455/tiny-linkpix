import Database from 'better-sqlite3';

export function initDb(sqlitePath) {
  const db = new Database(sqlitePath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      path TEXT NOT NULL,
      mimetype TEXT NOT NULL,
      size INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      hits INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_files_slug ON files(slug);
  `);
  return db;
}

export function insertFile(db, { slug, path, mimetype, size }) {
  const stmt = db.prepare(
    `INSERT INTO files (slug, path, mimetype, size, created_at)
     VALUES (@slug, @path, @mimetype, @size, strftime('%s','now'))`
  );
  return stmt.run({ slug, path, mimetype, size });
}

export function getBySlug(db, slug) {
  return db.prepare(`SELECT * FROM files WHERE slug = ?`).get(slug);
}

export function incrementHits(db, slug) {
  db.prepare(`UPDATE files SET hits = hits + 1 WHERE slug = ?`).run(slug);
}

export function slugExists(db, slug) {
  return !!db.prepare(`SELECT 1 FROM files WHERE slug = ?`).get(slug);
}
