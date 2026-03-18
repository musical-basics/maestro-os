import type { PipelineStage, ProjectAsset } from '../../../shared/types'

type StageStatus = 'completed' | 'active' | 'locked'

interface PipelineStageRowProps {
  stage: PipelineStage
  status: StageStatus
  asset: ProjectAsset | null
  onOpenFile?: (filePath: string) => void
}

export function PipelineStageRow({
  stage,
  status,
  asset,
  onOpenFile
}: PipelineStageRowProps): React.JSX.Element {
  const statusIcon = {
    completed: '✅',
    active: '🔵',
    locked: '🔒'
  }[status]

  const isConceptual = stage.gateRequirement === null

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

        {status === 'active' && (
          <div className="stage-row__gate">
            {isConceptual ? (
              <span className="stage-row__gate-text">
                Conceptual — click "Mark as Complete" when done
              </span>
            ) : (
              <span className="stage-row__gate-text">
                Drop a <code>{stage.gateRequirement}</code> file here to unlock
              </span>
            )}
          </div>
        )}

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
      </div>
    </div>
  )
}
