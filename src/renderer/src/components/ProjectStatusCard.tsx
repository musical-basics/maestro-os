import type { ProjectStatus } from '../../../shared/types'
import { useProjectStore } from '../stores/useProjectStore'
import { useAppStore } from '../stores/useAppStore'

interface ProjectStatusCardProps {
  status: ProjectStatus
}

export function ProjectStatusCard({ status }: ProjectStatusCardProps): React.JSX.Element {
  const setActiveProject = useProjectStore((s) => s.setActiveProject)
  const setView = useAppStore((s) => s.setView)

  const handleClick = async (): Promise<void> => {
    const project = await window.api.getProject(status.projectId)
    if (project) {
      setActiveProject(project)
      setView('projects')
    }
  }

  const statusClass = status.isTouchedToday
    ? 'status-card--active'
    : status.isStale
      ? 'status-card--stale'
      : 'status-card--normal'

  return (
    <div className={`status-card ${statusClass}`} onClick={handleClick}>
      <div className="status-card__header">
        <h3 className="status-card__title">{status.projectTitle}</h3>
        <span className="status-card__days">
          {status.isTouchedToday
            ? '🟢 Active today'
            : status.isStale
              ? `🟡 ${status.daysSinceLastTouch}d idle`
              : `${status.daysSinceLastTouch}d ago`}
        </span>
      </div>

      <div className="status-card__stage">
        <span className="badge badge--type">
          Stage {status.currentStageId}: {status.currentStageName}
        </span>
      </div>

      <div className="status-card__progress">
        <div className="progress-bar">
          <div
            className="progress-bar__fill"
            style={{ width: `${Math.round((status.currentStageId / 15) * 100)}%` }}
          />
        </div>
        <span className="progress-bar__label">
          {Math.round((status.currentStageId / 15) * 100)}%
        </span>
      </div>

      <p className="status-card__recommendation">{status.recommendation}</p>
    </div>
  )
}
