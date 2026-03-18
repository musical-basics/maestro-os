import { useEffect } from 'react'
import { useProjectStore } from '../stores/useProjectStore'
import { ProjectCard } from '../components/ProjectCard'
import { ProjectDetailView } from './ProjectDetailView'

export function ProjectsView(): React.JSX.Element {
  const { projects, activeProject, isLoading, fetchProjects } = useProjectStore()

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  // If a project is selected, show the detail view
  if (activeProject) {
    return <ProjectDetailView />
  }

  return (
    <div className="projects-view">
      <div className="view-header">
        <h1>Projects</h1>
        <p>All active compositions and their current pipeline stage.</p>
      </div>

      {isLoading ? (
        <div className="loading-state">Loading projects…</div>
      ) : projects.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">🎵</div>
          <p className="empty-state__text">
            No projects yet. Go to the Vault, select some snippets, and merge them to create your
            first composition.
          </p>
        </div>
      ) : (
        <div className="project-grid">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  )
}
