import { getDatabase } from './connection'

/**
 * Create all tables if they don't exist.
 * Safe to call on every app launch — CREATE TABLE IF NOT EXISTS is a no-op if tables exist.
 *
 * IMPORTANT: pipeline_stages must be created BEFORE projects,
 * because projects.current_stage_id has a FK to pipeline_stages.id.
 */
export function initializeSchema(): void {
  const db = getDatabase()

  db.exec(`
    -----------------------------------------------------------
    -- 1. pipeline_stages: The 15 rigid stages (lookup/enum)
    --    Created FIRST because projects references it via FK.
    -----------------------------------------------------------
    CREATE TABLE IF NOT EXISTS pipeline_stages (
      id               INTEGER PRIMARY KEY,
      stage_name       TEXT NOT NULL,
      gate_requirement TEXT  -- NULL = conceptual stage (manual "Mark as Complete")
                             -- Comma-separated extensions for multi-ext gates
                             -- e.g., '.mid,.pdf,.sib,.mscz'
    );

    -----------------------------------------------------------
    -- 2. snippets: Holding pen for unassigned creative ideas
    -----------------------------------------------------------
    CREATE TABLE IF NOT EXISTS snippets (
      id            TEXT PRIMARY KEY,
      title         TEXT NOT NULL,
      file_path     TEXT NOT NULL UNIQUE,
      asset_type    TEXT NOT NULL CHECK(asset_type IN ('audio', 'midi', 'sheet', 'video')),
      key_signature TEXT,
      bpm           INTEGER,
      mood          TEXT,
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -----------------------------------------------------------
    -- 3. projects: Master tracker for active compositions
    -----------------------------------------------------------
    CREATE TABLE IF NOT EXISTS projects (
      id               TEXT PRIMARY KEY,
      title            TEXT NOT NULL,
      current_stage_id INTEGER NOT NULL DEFAULT 1,
      master_directory TEXT NOT NULL,
      last_touched_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (current_stage_id) REFERENCES pipeline_stages(id)
    );

    -----------------------------------------------------------
    -- 4. project_snippets: Many-to-Many junction table
    --    Links snippets to projects. Snippets STAY in the Vault
    --    after merging — they can be reused across projects.
    -----------------------------------------------------------
    CREATE TABLE IF NOT EXISTS project_snippets (
      project_id TEXT NOT NULL,
      snippet_id TEXT NOT NULL,
      PRIMARY KEY (project_id, snippet_id),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (snippet_id) REFERENCES snippets(id) ON DELETE CASCADE
    );

    -----------------------------------------------------------
    -- 5. project_assets: Files linked to satisfy Asset Gates
    -----------------------------------------------------------
    CREATE TABLE IF NOT EXISTS project_assets (
      id            TEXT PRIMARY KEY,
      project_id    TEXT NOT NULL,
      stage_id      INTEGER NOT NULL,
      file_path     TEXT NOT NULL,
      asset_type    TEXT NOT NULL,
      last_modified DATETIME NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (stage_id) REFERENCES pipeline_stages(id)
    );
  `)
}
