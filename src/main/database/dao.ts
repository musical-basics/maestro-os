import { getDatabase } from './connection'
import type {
  Snippet,
  Project,
  ProjectAsset,
  PipelineStage,
  CreateSnippetData,
  LinkAssetData
} from '../../shared/types'
import * as crypto from 'crypto'

// ─── Row Mappers ────────────────────────────────────────────
// SQLite returns snake_case columns. Convert to camelCase interfaces.

function mapSnippetRow(row: Record<string, unknown>): Snippet {
  return {
    id: row.id as string,
    title: row.title as string,
    filePath: row.file_path as string,
    assetType: row.asset_type as Snippet['assetType'],
    keySignature: (row.key_signature as string) ?? null,
    bpm: (row.bpm as number) ?? null,
    mood: (row.mood as string) ?? null,
    createdAt: row.created_at as string
  }
}

function mapProjectRow(row: Record<string, unknown>): Project {
  return {
    id: row.id as string,
    title: row.title as string,
    currentStageId: row.current_stage_id as number,
    masterDirectory: row.master_directory as string,
    lastTouchedAt: row.last_touched_at as string,
    createdAt: row.created_at as string
  }
}

function mapAssetRow(row: Record<string, unknown>): ProjectAsset {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    stageId: row.stage_id as number,
    filePath: row.file_path as string,
    assetType: row.asset_type as string,
    lastModified: row.last_modified as string
  }
}

function mapStageRow(row: Record<string, unknown>): PipelineStage {
  return {
    id: row.id as number,
    stageName: row.stage_name as string,
    gateRequirement: (row.gate_requirement as string) ?? null
  }
}

// ─── Snippets ───────────────────────────────────────────────

export function getAllSnippets(): Snippet[] {
  const rows = getDatabase()
    .prepare('SELECT * FROM snippets ORDER BY created_at DESC')
    .all() as Record<string, unknown>[]
  return rows.map(mapSnippetRow)
}

export function createSnippet(data: CreateSnippetData): Snippet {
  const id = crypto.randomUUID()
  getDatabase()
    .prepare(
      `INSERT INTO snippets (id, title, file_path, asset_type, key_signature, bpm, mood)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(id, data.title, data.filePath, data.assetType, data.keySignature, data.bpm, data.mood)
  return mapSnippetRow(
    getDatabase().prepare('SELECT * FROM snippets WHERE id = ?').get(id) as Record<string, unknown>
  )
}

export function updateSnippet(
  id: string,
  data: { title?: string; keySignature?: string | null; bpm?: number | null; mood?: string | null }
): Snippet | null {
  const db = getDatabase()
  const fields: string[] = []
  const values: unknown[] = []

  if (data.title !== undefined) {
    fields.push('title = ?')
    values.push(data.title)
  }
  if (data.keySignature !== undefined) {
    fields.push('key_signature = ?')
    values.push(data.keySignature)
  }
  if (data.bpm !== undefined) {
    fields.push('bpm = ?')
    values.push(data.bpm)
  }
  if (data.mood !== undefined) {
    fields.push('mood = ?')
    values.push(data.mood)
  }

  if (fields.length === 0) return null

  values.push(id)
  db.prepare(`UPDATE snippets SET ${fields.join(', ')} WHERE id = ?`).run(...values)

  const row = db.prepare('SELECT * FROM snippets WHERE id = ?').get(id) as Record<
    string,
    unknown
  > | null
  return row ? mapSnippetRow(row) : null
}

export function deleteSnippet(id: string): void {
  getDatabase().prepare('DELETE FROM snippets WHERE id = ?').run(id)
}

// ─── Projects ───────────────────────────────────────────────

export function getAllProjects(): Project[] {
  const rows = getDatabase()
    .prepare('SELECT * FROM projects ORDER BY last_touched_at DESC')
    .all() as Record<string, unknown>[]
  return rows.map(mapProjectRow)
}

export function getProjectById(id: string): Project | null {
  const row = getDatabase().prepare('SELECT * FROM projects WHERE id = ?').get(id) as Record<
    string,
    unknown
  > | null
  return row ? mapProjectRow(row) : null
}

export function createProject(
  title: string,
  masterDirectory: string,
  snippetIds: string[]
): Project {
  const db = getDatabase()
  const id = crypto.randomUUID()

  const txn = db.transaction(() => {
    // Insert the project at Stage 2 (Half-Finished Composition)
    // Stage 1 (Idea/Vault) is implicitly completed by the act of merging
    db.prepare(
      `INSERT INTO projects (id, title, current_stage_id, master_directory)
       VALUES (?, ?, 2, ?)`
    ).run(id, title, masterDirectory)

    // Link all selected snippets via the junction table
    const linkStmt = db.prepare(
      'INSERT INTO project_snippets (project_id, snippet_id) VALUES (?, ?)'
    )
    for (const snippetId of snippetIds) {
      linkStmt.run(id, snippetId)
    }
  })

  txn()
  return mapProjectRow(
    db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Record<string, unknown>
  )
}

export function updateProjectStage(projectId: string, newStageId: number): void {
  getDatabase()
    .prepare('UPDATE projects SET current_stage_id = ? WHERE id = ?')
    .run(newStageId, projectId)
}

export function updateProjectLastTouched(projectId: string): void {
  getDatabase()
    .prepare('UPDATE projects SET last_touched_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(projectId)
}

/**
 * Delete a project from the database.
 * CRITICAL: This ONLY deletes the SQLite record (cascading to project_snippets and project_assets).
 * It MUST NEVER delete the actual ~/Music/MaestroOS/{ProjectName}/ folder.
 * If we delete their Logic Pro files, users will riot.
 */
export function deleteProject(id: string): void {
  getDatabase().prepare('DELETE FROM projects WHERE id = ?').run(id)
}

// ─── Assets ─────────────────────────────────────────────────

export function getAssetsByProject(projectId: string): ProjectAsset[] {
  const rows = getDatabase()
    .prepare('SELECT * FROM project_assets WHERE project_id = ?')
    .all(projectId) as Record<string, unknown>[]
  return rows.map(mapAssetRow)
}

export function linkAsset(data: LinkAssetData): ProjectAsset {
  const id = crypto.randomUUID()
  getDatabase()
    .prepare(
      `INSERT INTO project_assets (id, project_id, stage_id, file_path, asset_type, last_modified)
     VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(id, data.projectId, data.stageId, data.filePath, data.assetType, data.lastModified)
  return mapAssetRow(
    getDatabase().prepare('SELECT * FROM project_assets WHERE id = ?').get(id) as Record<
      string,
      unknown
    >
  )
}

// ─── Pipeline Stages ────────────────────────────────────────

export function getAllStages(): PipelineStage[] {
  const rows = getDatabase()
    .prepare('SELECT * FROM pipeline_stages ORDER BY id ASC')
    .all() as Record<string, unknown>[]
  return rows.map(mapStageRow)
}

export function getStageById(id: number): PipelineStage | null {
  const row = getDatabase().prepare('SELECT * FROM pipeline_stages WHERE id = ?').get(id) as Record<
    string,
    unknown
  > | null
  return row ? mapStageRow(row) : null
}
