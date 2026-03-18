import { useEffect, useState, useCallback } from 'react'
import { useProjectStore } from '../stores/useProjectStore'
import { PipelineStageRow } from '../components/PipelineStageRow'
import type { PipelineStage, ProjectAsset, Project } from '../../../shared/types'

export function ProjectDetailView(): React.JSX.Element {
  const activeProject = useProjectStore((s) => s.activeProject)
  const setActiveProject = useProjectStore((s) => s.setActiveProject)
  const removeProject = useProjectStore((s) => s.removeProject)
  const updateProjectInStore = useProjectStore((s) => s.updateProjectInStore)
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [assets, setAssets] = useState<ProjectAsset[]>([])

  const loadData = useCallback(async () => {
    if (!activeProject) return
    const [stageData, assetData] = await Promise.all([
      window.api.getStages(),
      window.api.getProjectAssets(activeProject.id)
    ])
    setStages(stageData)
    setAssets(assetData)
  }, [activeProject])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Listen for real-time stage changes from the main process
  useEffect(() => {
    const cleanup = window.api.onProjectStageChanged((data) => {
      if (activeProject && data.projectId === activeProject.id) {
        const updated: Project = { ...activeProject, currentStageId: data.newStageId }
        updateProjectInStore(updated)
        setActiveProject(updated)
        loadData()
      }
    })
    return cleanup
  }, [activeProject, updateProjectInStore, setActiveProject, loadData])

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

  const handleStageAdvanced = async (): Promise<void> => {
    // Refresh data after an asset was linked and stage was advanced
    const updatedProject = await window.api.getProject(activeProject.id)
    if (updatedProject) {
      updateProjectInStore(updatedProject)
      setActiveProject(updatedProject)
    }
    await loadData()
  }

  const handleMarkComplete = async (stageId: number): Promise<void> => {
    await window.api.updateProjectStage(activeProject.id, stageId + 1)
    const updatedProject = await window.api.getProject(activeProject.id)
    if (updatedProject) {
      updateProjectInStore(updatedProject)
      setActiveProject(updatedProject)
    }
    await loadData()
  }

  const getAssetForStage = (stageId: number): ProjectAsset | null => {
    return assets.find((a) => a.stageId === stageId) || null
  }

  const getStageStatus = (stageId: number): 'completed' | 'active' | 'locked' => {
    if (stageId < activeProject.currentStageId) return 'completed'
    if (stageId === activeProject.currentStageId) return 'active'
    return 'locked'
  }

  const isReleased = activeProject.currentStageId > 15

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
            {isReleased
              ? '🎉 Released!'
              : `Stage ${activeProject.currentStageId} of 15 • ${Math.round((activeProject.currentStageId / 15) * 100)}% complete`}
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
            projectId={activeProject.id}
            onOpenFile={handleOpenFile}
            onStageAdvanced={handleStageAdvanced}
            onMarkComplete={handleMarkComplete}
          />
        ))}
      </div>
    </div>
  )
}
