export function ProjectsView(): React.JSX.Element {
  return (
    <div className="projects-view">
      <div className="view-header">
        <h1>Projects</h1>
        <p>All active compositions and their current pipeline stage.</p>
      </div>
      <div className="empty-state">
        <div className="empty-state__icon">🎵</div>
        <p className="empty-state__text">
          No projects yet. Go to the Vault, select two or more snippets, and merge them to create
          your first composition.
        </p>
      </div>
    </div>
  )
}
