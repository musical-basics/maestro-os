import type { PipelineStage, ProjectAsset } from '../../../shared/types'
import { StageDropzone } from './StageDropzone'

type StageStatus = 'completed' | 'active' | 'locked'

interface PipelineStageRowProps {
  stage: PipelineStage
  status: StageStatus
  asset: ProjectAsset | null
  projectId: string
  onOpenFile?: (filePath: string) => void
  onStageAdvanced?: () => void
  onMarkComplete?: (stageId: number) => void
}

export function PipelineStageRow({
  stage,
  status,
  asset,
  projectId,
  onOpenFile,
  onStageAdvanced,
  onMarkComplete
}: PipelineStageRowProps): React.JSX.Element {
  const statusIcon = {
    completed: '✅',
    active: '🔵',
    locked: '🔒'
  }[status]

  const isConceptual = stage.gateRequirement === null
  const isFileGated = stage.gateRequirement !== null

  return (
    <div className={`stage-row stage-row--${status}`}>
      <div className="stage-row__indicator">
        <span className="stage-row__icon">{statusIcon}</span>
        <div className={`stage-row__line ${status === 'locked' ? 'stage-row__line--dimmed' : ''}`} />
      </div>

      <div className="stage-row__content">
        <div className="stage-row__header">
          <span className="stage-row__number">Stage {stage.id}</span>
          <h4 className="stage-row__name">{stage.stageName}</h4>
        </div>

        {/* Active stage: Show either dropzone or mark-as-complete */}
        {status === 'active' && isFileGated && (
          <StageDropzone
            stageId={stage.id}
            gateRequirement={stage.gateRequirement!}
            projectId={projectId}
            onAssetLinked={() => onStageAdvanced?.()}
          />
        )}

        {status === 'active' && isConceptual && (
          <div className="stage-row__conceptual">
            <p className="stage-row__gate-text">
              This is a conceptual stage — mark as complete when you're done.
            </p>
            <button
              className="btn btn--primary btn--sm"
              onClick={() => onMarkComplete?.(stage.id)}
            >
              ✓ Mark as Complete
            </button>
          </div>
        )}

        {/* Completed stage: Show linked asset */}
        {status === 'completed' && asset && (
          <div className="stage-row__asset">
            <span className="stage-row__asset-name">{asset.filePath.split('/').pop()}</span>
            {onOpenFile && (
              <button
                className="btn btn--ghost btn--icon"
                onClick={() => onOpenFile(asset.filePath)}
                title="Open in external app"
              >
                ↗
              </button>
            )}
          </div>
        )}

        {/* Locked stage: Show nothing extra */}
      </div>
    </div>
  )
}
