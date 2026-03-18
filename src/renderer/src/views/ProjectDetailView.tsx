import { useEffect, useState } from 'react'
import { useProjectStore } from '../stores/useProjectStore'
import { PipelineStageRow } from '../components/PipelineStageRow'
import type { PipelineStage, ProjectAsset } from '../../../shared/types'

export function ProjectDetailView(): React.JSX.Element {
  const activeProject = useProjectStore((s) => s.activeProject)
  const setActiveProject = useProjectStore((s) => s.setActiveProject)
  const removeProject = useProjectStore((s) => s.removeProject)
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [assets, setAssets] = useState<ProjectAsset[]>([])

  useEffect(() => {
    if (!activeProject) return

    const load = async (): Promise<void> => {
      const [stageData, assetData] = await Promise.all([
        window.api.getStages(),
        window.api.getProjectAssets(activeProject.id)
      ])
      setStages(stageData)
      setAssets(assetData)
    }
    load()
  }, [activeProject])

  if (!activeProject) return <div />

  const handleOpenFile = (filePath: string): void => {
    window.api.openPath(filePath)
  }

  const handleOpenFolder = (): void => {
    window.api.openPath(activeProject.masterDirectory)
  }

  const handleDeleteProject = async (): Promise<void> => {
    if (!confirm(`Delete "${activeProject.title}"? The local folder will NOT be deleted.`)) return
    await window.api.deleteProject(activeProject.id)
    removeProject(activeProject.id)
    setActiveProject(null)
  }

  const getAssetForStage = (stageId: number): ProjectAsset | null => {
    return assets.find((a) => a.stageId === stageId) || null
  }

  const getStageStatus = (stageId: number): 'completed' | 'active' | 'locked' => {
    if (stageId < activeProject.currentStageId) return 'completed'
    if (stageId === activeProject.currentStageId) return 'active'
    return 'locked'
  }

  return (
    <div className="project-detail">
      <div className="project-detail__nav">
        <button className="btn btn--ghost btn--sm" onClick={() => setActiveProject(null)}>
          ← Back to Projects
        </button>
      </div>

      <div className="project-detail__header">
        <div>
          <h1>{activeProject.title}</h1>
          <p className="project-detail__subtitle">
            Stage {activeProject.currentStageId} of 15 •{' '}
            {Math.round((activeProject.currentStageId / 15) * 100)}% complete
          </p>
        </div>
        <div className="project-detail__actions">
          <button className="btn btn--secondary btn--sm" onClick={handleOpenFolder}>
            📁 Open Folder
          </button>
          <button className="btn btn--danger btn--sm" onClick={handleDeleteProject}>
            Delete
          </button>
        </div>
      </div>

      <div className="pipeline-timeline">
        {stages.map((stage) => (
          <PipelineStageRow
            key={stage.id}
            stage={stage}
            status={getStageStatus(stage.id)}
            asset={getAssetForStage(stage.id)}
            onOpenFile={handleOpenFile}
          />
        ))}
      </div>
    </div>
  )
}
