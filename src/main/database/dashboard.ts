import { getDatabase } from './connection'
import type { ProjectStatus } from '../../shared/types'

/**
 * Get all project statuses for the dashboard.
 * Calculates days since last touch, staleness, and AI-like recommendations.
 *
 * Staleness rules:
 * - Touched today → Green, "Currently working"
 * - 1-3 days → Normal
 * - 4-7 days → Stale (Yellow warning)
 * - 8+ days → Very stale (Red warning)
 */
export function getProjectStates(): ProjectStatus[] {
  const db = getDatabase()

  const rows = db
    .prepare(
      `SELECT
        p.id as project_id,
        p.title as project_title,
        p.current_stage_id,
        ps.stage_name as current_stage_name,
        ps.gate_requirement,
        p.last_touched_at,
        p.created_at
      FROM projects p
      JOIN pipeline_stages ps ON p.current_stage_id = ps.id
      ORDER BY p.last_touched_at DESC`
    )
    .all() as Record<string, unknown>[]

  const now = Date.now()

  return rows.map((row) => {
    const lastTouched = new Date(row.last_touched_at as string).getTime()
    const daysSince = Math.floor((now - lastTouched) / (1000 * 60 * 60 * 24))
    const isStale = daysSince >= 4
    const isTouchedToday = daysSince === 0

    const recommendation = generateRecommendation(
      row.current_stage_id as number,
      row.current_stage_name as string,
      row.gate_requirement as string | null,
      daysSince
    )

    return {
      projectId: row.project_id as string,
      projectTitle: row.project_title as string,
      currentStageId: row.current_stage_id as number,
      currentStageName: row.current_stage_name as string,
      gateRequirement: (row.gate_requirement as string) ?? null,
      lastTouchedAt: row.last_touched_at as string,
      daysSinceLastTouch: daysSince,
      isStale,
      isTouchedToday,
      recommendation
    }
  })
}

function generateRecommendation(
  stageId: number,
  stageName: string,
  gateReq: string | null,
  daysSince: number
): string {
  if (daysSince === 0) return `Keep going! You're making progress on "${stageName}".`

  if (daysSince >= 8)
    return `⚠️ Haven't touched this in ${daysSince} days. Consider picking it back up or archiving.`
  if (daysSince >= 4)
    return `It's been ${daysSince} days — try spending 15 minutes on "${stageName}" today.`

  if (gateReq) {
    const exts = gateReq.split(',').join(' or ')
    return `Drop a ${exts} file to advance past "${stageName}".`
  }

  // Conceptual stage
  if (stageId <= 4) return `Focus on the creative work. Mark "${stageName}" complete when ready.`
  if (stageId <= 8) return `Time to refine the production. "${stageName}" is a critical phase.`
  if (stageId <= 13) return `Almost there! "${stageName}" is part of the final push.`
  return `You're in the home stretch. Release it when ready!`
}
