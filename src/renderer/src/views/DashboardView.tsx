export function DashboardView(): React.JSX.Element {
  return (
    <div className="dashboard-view">
      <div className="view-header">
        <h1>Studio Manager</h1>
        <p>Your daily snapshot of what needs attention across all compositions.</p>
      </div>
      <div className="empty-state">
        <div className="empty-state__icon">🎛</div>
        <p className="empty-state__text">
          No active projects yet. Head to the Vault to import some creative ideas and merge them
          into your first project.
        </p>
      </div>
    </div>
  )
}
