import { useState, useCallback, type DragEvent } from 'react'

interface StageDropzoneProps {
  stageId: number
  gateRequirement: string // Comma-separated extensions, e.g., '.wav' or '.mid,.pdf,.sib,.mscz'
  projectId: string
  onAssetLinked: () => void
}

/**
 * Validates that a dropped file's extension matches one of the accepted gate extensions.
 */
function validateGate(fileName: string, gateRequirement: string): boolean {
  const acceptedExts = gateRequirement.split(',').map((ext) => ext.trim().toLowerCase())
  const fileExt = fileName.lastIndexOf('.') >= 0
    ? fileName.slice(fileName.lastIndexOf('.')).toLowerCase()
    : ''
  return acceptedExts.includes(fileExt)
}

export function StageDropzone({
  stageId,
  gateRequirement,
  projectId,
  onAssetLinked
}: StageDropzoneProps): React.JSX.Element {
  const [isDragOver, setIsDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLinking, setIsLinking] = useState(false)

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
    setError(null)
  }, [])

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)

      const files = Array.from(e.dataTransfer.files)
      if (files.length === 0) return

      // Only accept the first file (one file per stage)
      const file = files[0]
      const filePath = (file as File & { path: string }).path

      // Validate against gate requirement
      if (!validateGate(file.name, gateRequirement)) {
        const accepted = gateRequirement.split(',').join(' / ')
        setError(`Expected ${accepted} file — got "${file.name.split('.').pop()}"`)
        return
      }

      setIsLinking(true)
      setError(null)

      try {
        const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
        await window.api.linkAsset({
          projectId,
          stageId,
          filePath,
          assetType: ext,
          lastModified: new Date().toISOString()
        })

        // Advance the project to the next stage
        await window.api.updateProjectStage(projectId, stageId + 1)

        onAssetLinked()
      } catch (err) {
        console.error('Failed to link asset:', err)
        setError('Failed to link asset. Please try again.')
      } finally {
        setIsLinking(false)
      }
    },
    [gateRequirement, projectId, stageId, onAssetLinked]
  )

  const acceptedLabel = gateRequirement.split(',').join(' / ')

  return (
    <div
      className={`stage-dropzone ${isDragOver ? 'stage-dropzone--active' : ''} ${error ? 'stage-dropzone--error' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isLinking ? (
        <span className="stage-dropzone__text">Linking...</span>
      ) : (
        <>
          <span className="stage-dropzone__text">
            Drop {acceptedLabel} file here
          </span>
          {error && <span className="stage-dropzone__error">{error}</span>}
        </>
      )}
    </div>
  )
}
