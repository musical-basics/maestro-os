import { useState, useCallback, type DragEvent } from 'react'

interface DropZoneProps {
  onFilesDropped: (files: { name: string; path: string; type: string }[]) => void
  children?: React.ReactNode
}

const ACCEPTED_EXTENSIONS = new Set([
  // Audio
  '.wav',
  '.mp3',
  '.m4a',
  '.aac',
  '.flac',
  '.ogg',
  '.aiff',
  // MIDI
  '.mid',
  '.midi',
  // Sheet Music
  '.pdf',
  '.sib',
  '.mscz',
  // Video
  '.mp4',
  '.mov',
  '.avi',
  '.mkv'
])

function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.')
  return lastDot >= 0 ? filename.slice(lastDot).toLowerCase() : ''
}

function getAssetType(ext: string): 'audio' | 'midi' | 'sheet' | 'video' {
  if (['.mid', '.midi'].includes(ext)) return 'midi'
  if (['.pdf', '.sib', '.mscz'].includes(ext)) return 'sheet'
  if (['.mp4', '.mov', '.avi', '.mkv'].includes(ext)) return 'video'
  return 'audio'
}

export function DropZone({ onFilesDropped, children }: DropZoneProps): React.JSX.Element {
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)

      const droppedFiles = Array.from(e.dataTransfer.files)
      const valid = droppedFiles
        .filter((file) => {
          const ext = getExtension(file.name)
          return ACCEPTED_EXTENSIONS.has(ext)
        })
        .map((file) => ({
          name: file.name,
          path: (file as File & { path: string }).path, // Electron adds .path
          type: getAssetType(getExtension(file.name))
        }))

      if (valid.length > 0) {
        onFilesDropped(valid)
      }
    },
    [onFilesDropped]
  )

  return (
    <div
      className={`dropzone ${isDragOver ? 'dropzone--active' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children || (
        <div className="dropzone__content">
          <span className="dropzone__icon">📂</span>
          <p className="dropzone__text">Drag audio, MIDI, or video files from Finder</p>
          <p className="dropzone__hint">.wav, .mp3, .m4a, .mid, .pdf, .mp4, .mov and more</p>
        </div>
      )}
    </div>
  )
}

export { getAssetType, getExtension }
