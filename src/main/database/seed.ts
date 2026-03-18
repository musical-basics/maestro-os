import { getDatabase } from './connection'

/**
 * Seed the pipeline_stages table with the 15 rigid stages.
 * Only runs if the table is empty (prevents duplicate rows on re-launch).
 *
 * Gate requirements follow the user's architectural decisions:
 * - Stage 3: .mid,.pdf,.sib,.mscz (sheet music is as valid as MIDI)
 * - Stage 6: .logicx,.als,.ptx (Logic, Ableton, Pro Tools)
 * - Stage 11: .png,.jpg
 * - Stage 13: .mp4,.mov
 * - null = conceptual stage — user clicks "Mark as Complete"
 */
export function seedPipelineStages(): void {
  const db = getDatabase()

  const count = db.prepare('SELECT COUNT(*) as n FROM pipeline_stages').get() as { n: number }
  if (count.n > 0) return

  const insert = db.prepare(
    'INSERT INTO pipeline_stages (id, stage_name, gate_requirement) VALUES (?, ?, ?)'
  )

  const stages: [number, string, string | null][] = [
    [1, 'Idea (Vault)', null],
    [2, 'Half-Finished Composition', null],
    [3, 'Completed Composition', '.mid,.pdf,.sib,.mscz'],
    [4, 'Practicing', null],
    [5, 'Recording', '.wav'],
    [6, 'Audio Editing', '.logicx,.als,.ptx'],
    [7, 'Mixing', '.wav'],
    [8, 'Mastering', '.wav'],
    [9, 'Video Recording', '.mp4'],
    [10, 'Video Editing', '.mp4'],
    [11, 'Thumbnail Creation', '.png,.jpg'],
    [12, 'Description & Metadata Writing', null],
    [13, 'Social Media Assets', '.mp4,.mov'],
    [14, 'Scheduled/Uploading', null],
    [15, 'Released', null]
  ]

  const insertMany = db.transaction(() => {
    for (const [id, name, gate] of stages) {
      insert.run(id, name, gate)
    }
  })

  insertMany()
}
