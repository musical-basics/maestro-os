import type { Project } from '../../../shared/types'
import { useProjectStore } from '../stores/useProjectStore'

interface ProjectCardProps {
  project: Project
}

function getStageLabel(stageId: number): string {
  const labels: Record<number, string> = {
    1: 'Idea',
    2: 'Half-Finished',
    3: 'Completed Comp.',
    4: 'Practicing',
    5: 'Recording',
    6: 'Audio Editing',
    7: 'Mixing',
    8: 'Mastering',
    9: 'Video Recording',
    10: 'Video Editing',
    11: 'Thumbnail',
    12: 'Description',
    13: 'Social Media',
    14: 'Uploading',
    15: 'Released'
  }
  return labels[stageId] || `Stage ${stageId}`
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function ProjectCard({ project }: ProjectCardProps): React.JSX.Element {
  const setActiveProject = useProjectStore((s) => s.setActiveProject)

  const progress = Math.round((project.currentStageId / 15) * 100)

  return (
    <div className="project-card" onClick={() => setActiveProject(project)}>
      <div className="project-card__header">
        <h3 className="project-card__title">{project.title}</h3>
        <span className="project-card__time">{getTimeAgo(project.lastTouchedAt)}</span>
      </div>
      <div className="project-card__stage">
        <span className="badge badge--type">
          Stage {project.currentStageId}: {getStageLabel(project.currentStageId)}
        </span>
      </div>
      <div className="project-card__progress">
        <div className="progress-bar">
          <div className="progress-bar__fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="progress-bar__label">{progress}%</span>
      </div>
    </div>
  )
}

export { getStageLabel, getTimeAgo }
