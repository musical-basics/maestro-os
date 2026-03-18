import Database from 'better-sqlite3'
import { join } from 'path'
import { app } from 'electron'

let db: Database.Database | null = null

/**
 * Get the SQLite database singleton.
 * The .db file is stored in the macOS app data directory:
 * ~/Library/Application Support/MaestroOS/maestro.db
 */
export function getDatabase(): Database.Database {
  if (db) return db

  const dbPath = join(app.getPath('userData'), 'maestro.db')

  db = new Database(dbPath)

  // WAL mode: better concurrent read performance
  db.pragma('journal_mode = WAL')

  // CRITICAL: Foreign keys are OFF by default in SQLite.
  // Without this, FK constraints are silently ignored.
  db.pragma('foreign_keys = ON')

  return db
}

/**
 * Close the database connection.
 * Called on app quit to prevent file corruption.
 */
export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}
