export function VaultView(): React.JSX.Element {
  return (
    <div className="vault-view">
      <div className="view-header">
        <h1>The Vault</h1>
        <p>Your holding pen for unassigned ideas. Drag audio or MIDI files here from Finder.</p>
      </div>
      <div className="empty-state">
        <div className="empty-state__icon">📦</div>
        <p className="empty-state__text">
          No snippets yet. Drag audio, MIDI, or video files from Finder into this area to get
          started.
        </p>
      </div>
    </div>
  )
}
