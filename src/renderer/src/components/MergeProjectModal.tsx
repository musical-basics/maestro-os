import { useState } from 'react'
import { useVaultStore } from '../stores/useVaultStore'
import { useProjectStore } from '../stores/useProjectStore'
import { useAppStore } from '../stores/useAppStore'

interface MergeProjectModalProps {
  isOpen: boolean
  onClose: () => void
}

export function MergeProjectModal({ isOpen, onClose }: MergeProjectModalProps): React.JSX.Element | null {
  const [title, setTitle] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const selectedIds = useVaultStore((s) => s.selectedIds)
  const snippets = useVaultStore((s) => s.snippets)
  const clearSelection = useVaultStore((s) => s.clearSelection)
  const addProject = useProjectStore((s) => s.addProject)
  const setActiveProject = useProjectStore((s) => s.setActiveProject)
  const setView = useAppStore((s) => s.setView)

  if (!isOpen) return null

  const selectedSnippets = snippets.filter((s) => selectedIds.has(s.id))

  const handleCreate = async (): Promise<void> => {
    if (!title.trim() || selectedSnippets.length < 1) return

    setIsCreating(true)
    try {
      // Create the folder: ~/Music/MaestroOS/{ProjectName}/
      const homeDir = await window.api.getHomeDir()
      const safeName = title.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_')
      const masterDirectory = `${homeDir}/Music/MaestroOS/${safeName}`
      await window.api.createDirectory(masterDirectory)

      // Create the project in the database (starts at Stage 2)
      const project = await window.api.createProject({
        title: title.trim(),
        masterDirectory,
        snippetIds: Array.from(selectedIds)
      })

      addProject(project)
      clearSelection()
      setActiveProject(project)
      setView('projects')
      onClose()
      setTitle('')
    } catch (err) {
      console.error('Failed to create project:', err)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2>Create New Project</h2>
          <button className="btn btn--ghost btn--icon" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal__body">
          <label className="modal__label">
            Project Name
            <input
              className="modal__input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Neon Sonata"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </label>

          <div className="modal__section">
            <p className="modal__section-label">
              Merging {selectedSnippets.length} snippet{selectedSnippets.length !== 1 ? 's' : ''}:
            </p>
            <ul className="modal__snippet-list">
              {selectedSnippets.map((s) => (
                <li key={s.id} className="modal__snippet-item">
                  <span className="badge badge--type">{s.assetType}</span>
                  <span>{s.title}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="modal__info">
            📁 Folder will be created at: <code>~/Music/MaestroOS/{title.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_') || '...'}/</code>
          </p>
        </div>

        <div className="modal__footer">
          <button className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn--primary"
            onClick={handleCreate}
            disabled={!title.trim() || isCreating}
          >
            {isCreating ? 'Creating…' : 'Create Project'}
          </button>
        </div>
      </div>
    </div>
  )
}
