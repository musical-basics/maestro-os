import { useEffect, useCallback } from 'react'
import { useVaultStore } from '../stores/useVaultStore'
import { DropZone, getExtension } from '../components/DropZone'
import { SnippetCard } from '../components/SnippetCard'
import type { CreateSnippetData } from '../../../shared/types'

export function VaultView(): React.JSX.Element {
  const { snippets, selectedIds, isLoading, fetchSnippets, toggleSelect, clearSelection, selectAll } =
    useVaultStore()
  const addSnippet = useVaultStore((s) => s.addSnippet)

  useEffect(() => {
    fetchSnippets()
  }, [fetchSnippets])

  const handleFilesDropped = useCallback(
    async (files: { name: string; path: string; type: string }[]) => {
      for (const file of files) {
        const ext = getExtension(file.name)
        const data: CreateSnippetData = {
          title: file.name.replace(ext, ''),
          filePath: file.path,
          assetType: file.type as CreateSnippetData['assetType'],
          keySignature: null,
          bpm: null,
          mood: null
        }
        try {
          const snippet = await window.api.createSnippet(data)
          addSnippet(snippet)
        } catch (err) {
          console.error('Failed to create snippet:', err)
        }
      }
    },
    [addSnippet]
  )

  const hasSelection = selectedIds.size > 0

  return (
    <div className="vault-view">
      <div className="view-header">
        <div className="view-header__row">
          <div>
            <h1>The Vault</h1>
            <p>Your holding pen for unassigned ideas. Drag audio or MIDI files here from Finder.</p>
          </div>
          {snippets.length > 0 && (
            <div className="view-header__actions">
              {hasSelection ? (
                <>
                  <span className="selection-count">{selectedIds.size} selected</span>
                  <button className="btn btn--ghost btn--sm" onClick={clearSelection}>
                    Clear
                  </button>
                </>
              ) : (
                <button className="btn btn--ghost btn--sm" onClick={selectAll}>
                  Select All
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <DropZone onFilesDropped={handleFilesDropped} />

      {isLoading ? (
        <div className="loading-state">Loading snippets…</div>
      ) : snippets.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">📦</div>
          <p className="empty-state__text">
            No snippets yet. Drag audio, MIDI, or video files from Finder into the drop zone above
            to get started.
          </p>
        </div>
      ) : (
        <div className="snippet-grid">
          {snippets.map((snippet) => (
            <SnippetCard
              key={snippet.id}
              snippet={snippet}
              isSelected={selectedIds.has(snippet.id)}
              onToggleSelect={() => toggleSelect(snippet.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
