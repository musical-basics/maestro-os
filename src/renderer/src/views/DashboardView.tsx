import { useEffect, useState } from 'react'
import type { ProjectStatus } from '../../../shared/types'
import { ProjectStatusCard } from '../components/ProjectStatusCard'

export function DashboardView(): React.JSX.Element {
  const [statuses, setStatuses] = useState<ProjectStatus[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        const data = (await window.api.getProjectStates()) as ProjectStatus[]
        setStatuses(data)
      } catch (err) {
        console.error('Failed to load dashboard:', err)
      } finally {
        setIsLoading(false)
      }
    }
    load()

    // Listen for real-time changes
    const cleanupStage = window.api.onProjectStageChanged(() => load())
    const cleanupTouch = window.api.onProjectLastTouchedChanged(() => load())

    return () => {
      cleanupStage()
      cleanupTouch()
    }
  }, [])

  const activeToday = statuses.filter((s) => s.isTouchedToday)
  const stale = statuses.filter((s) => s.isStale)
  const normal = statuses.filter((s) => !s.isTouchedToday && !s.isStale)

  return (
    <div className="dashboard-view">
      <div className="view-header">
        <h1>Dashboard</h1>
        <p>Your active compositions at a glance. Focus on what needs attention.</p>
      </div>

      {isLoading ? (
        <div className="loading-state">Loading dashboard…</div>
      ) : statuses.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">🎹</div>
          <p className="empty-state__text">
            No active projects. Head to the Vault, drop some snippets, and merge them into a project
            to get started.
          </p>
        </div>
      ) : (
        <div className="dashboard-sections">
          {activeToday.length > 0 && (
            <section className="dashboard-section">
              <h2 className="dashboard-section__title">
                🟢 Active Today <span className="dashboard-section__count">{activeToday.length}</span>
              </h2>
              <div className="dashboard-grid">
                {activeToday.map((s) => (
                  <ProjectStatusCard key={s.projectId} status={s} />
                ))}
              </div>
            </section>
          )}

          {stale.length > 0 && (
            <section className="dashboard-section">
              <h2 className="dashboard-section__title">
                🟡 Needs Attention <span className="dashboard-section__count">{stale.length}</span>
              </h2>
              <div className="dashboard-grid">
                {stale.map((s) => (
                  <ProjectStatusCard key={s.projectId} status={s} />
                ))}
              </div>
            </section>
          )}

          {normal.length > 0 && (
            <section className="dashboard-section">
              <h2 className="dashboard-section__title">
                📋 In Progress <span className="dashboard-section__count">{normal.length}</span>
              </h2>
              <div className="dashboard-grid">
                {normal.map((s) => (
                  <ProjectStatusCard key={s.projectId} status={s} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
