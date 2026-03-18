import { useState, useRef, useCallback } from 'react'
import type { Snippet } from '../../../shared/types'
import { useVaultStore } from '../stores/useVaultStore'
import { Howl } from 'howler'

interface SnippetCardProps {
  snippet: Snippet
  isSelected: boolean
  onToggleSelect: () => void
}

export function SnippetCard({
  snippet,
  isSelected,
  onToggleSelect
}: SnippetCardProps): React.JSX.Element {
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(snippet.title)
  const [editKey, setEditKey] = useState(snippet.keySignature ?? '')
  const [editBpm, setEditBpm] = useState(snippet.bpm?.toString() ?? '')
  const [editMood, setEditMood] = useState(snippet.mood ?? '')
  const [isPlaying, setIsPlaying] = useState(false)
  const howlRef = useRef<Howl | null>(null)
  const updateSnippetInStore = useVaultStore((s) => s.updateSnippetInStore)
  const removeSnippet = useVaultStore((s) => s.removeSnippet)

  const isAudio = snippet.assetType === 'audio'

  const handlePlay = useCallback(() => {
    if (!isAudio) return

    if (isPlaying && howlRef.current) {
      howlRef.current.stop()
      setIsPlaying(false)
      return
    }

    howlRef.current = new Howl({
      src: [`file://${snippet.filePath}`],
      format: [snippet.filePath.split('.').pop() || 'wav'],
      onend: () => setIsPlaying(false),
      onloaderror: (_id, err) => {
        console.error('Howler load error:', err)
        setIsPlaying(false)
      }
    })
    howlRef.current.play()
    setIsPlaying(true)
  }, [isAudio, isPlaying, snippet.filePath])

  const handleSaveEdit = async (): Promise<void> => {
    const updated = await window.api.updateSnippet(snippet.id, {
      title: editTitle || snippet.title,
      keySignature: editKey || null,
      bpm: editBpm ? parseInt(editBpm, 10) : null,
      mood: editMood || null
    })
    if (updated) {
      updateSnippetInStore(updated)
    }
    setIsEditing(false)
  }

  const handleDelete = async (): Promise<void> => {
    if (howlRef.current) {
      howlRef.current.stop()
    }
    await window.api.deleteSnippet(snippet.id)
    removeSnippet(snippet.id)
  }

  const handleCancelEdit = (): void => {
    setEditTitle(snippet.title)
    setEditKey(snippet.keySignature ?? '')
    setEditBpm(snippet.bpm?.toString() ?? '')
    setEditMood(snippet.mood ?? '')
    setIsEditing(false)
  }

  return (
    <div className={`snippet-card ${isSelected ? 'snippet-card--selected' : ''}`}>
      {/* Selection checkbox */}
      <div className="snippet-card__select" onClick={onToggleSelect}>
        <div className={`checkbox ${isSelected ? 'checkbox--checked' : ''}`}>
          {isSelected && '✓'}
        </div>
      </div>

      <div className="snippet-card__body">
        {isEditing ? (
          /* ─── Edit Mode ─── */
          <div className="snippet-card__edit">
            <input
              className="snippet-card__input"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Title"
              autoFocus
            />
            <div className="snippet-card__edit-row">
              <input
                className="snippet-card__input snippet-card__input--sm"
                value={editKey}
                onChange={(e) => setEditKey(e.target.value)}
                placeholder="Key (e.g., C minor)"
              />
              <input
                className="snippet-card__input snippet-card__input--sm"
                type="number"
                value={editBpm}
                onChange={(e) => setEditBpm(e.target.value)}
                placeholder="BPM"
              />
              <input
                className="snippet-card__input snippet-card__input--sm"
                value={editMood}
                onChange={(e) => setEditMood(e.target.value)}
                placeholder="Mood"
              />
            </div>
            <div className="snippet-card__edit-actions">
              <button className="btn btn--primary btn--sm" onClick={handleSaveEdit}>
                Save
              </button>
              <button className="btn btn--ghost btn--sm" onClick={handleCancelEdit}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          /* ─── View Mode ─── */
          <>
            <div className="snippet-card__header">
              <h3 className="snippet-card__title">{snippet.title}</h3>
              <div className="snippet-card__actions">
                {isAudio && (
                  <button
                    className="btn btn--ghost btn--icon"
                    onClick={handlePlay}
                    title={isPlaying ? 'Stop' : 'Play'}
                  >
                    {isPlaying ? '⏹' : '▶'}
                  </button>
                )}
                <button
                  className="btn btn--ghost btn--icon"
                  onClick={() => setIsEditing(true)}
                  title="Edit"
                >
                  ✏️
                </button>
                <button
                  className="btn btn--ghost btn--icon"
                  onClick={handleDelete}
                  title="Delete"
                >
                  🗑
                </button>
              </div>
            </div>
            <div className="snippet-card__badges">
              <span className="badge badge--type">{snippet.assetType}</span>
              {snippet.keySignature && (
                <span className="badge badge--key">{snippet.keySignature}</span>
              )}
              {snippet.bpm && <span className="badge badge--bpm">{snippet.bpm} BPM</span>}
              {snippet.mood && <span className="badge badge--mood">{snippet.mood}</span>}
            </div>
            <p className="snippet-card__path">{snippet.filePath.split('/').pop()}</p>
          </>
        )}
      </div>
    </div>
  )
}
