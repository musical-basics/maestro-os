import { ElectronAPI } from '@electron-toolkit/preload'
import type {
  Snippet,
  Project,
  ProjectAsset,
  PipelineStage,
  CreateSnippetData,
  LinkAssetData
} from '../shared/types'

interface MaestroAPI {
  // Snippets
  getSnippets: () => Promise<Snippet[]>
  createSnippet: (data: CreateSnippetData) => Promise<Snippet>
  updateSnippet: (
    id: string,
    data: {
      title?: string
      keySignature?: string | null
      bpm?: number | null
      mood?: string | null
    }
  ) => Promise<Snippet | null>
  deleteSnippet: (id: string) => Promise<void>

  // Projects
  getProjects: () => Promise<Project[]>
  getProject: (id: string) => Promise<Project | null>
  createProject: (data: {
    title: string
    masterDirectory: string
    snippetIds: string[]
  }) => Promise<Project>
  updateProjectStage: (id: string, stageId: number) => Promise<void>
  deleteProject: (id: string) => Promise<void>

  // Assets
  linkAsset: (data: LinkAssetData) => Promise<ProjectAsset>
  getProjectAssets: (projectId: string) => Promise<ProjectAsset[]>

  // Pipeline Stages
  getStages: () => Promise<PipelineStage[]>

  // Dashboard
  getProjectStates: () => Promise<unknown[]>

  // File System
  openPath: (filePath: string) => Promise<void>
  createDirectory: (dirPath: string) => Promise<string>
  getHomeDir: () => Promise<string>

  // Event listeners
  onProjectStageChanged: (
    callback: (data: { projectId: string; newStageId: number }) => void
  ) => () => void
  onProjectLastTouchedChanged: (
    callback: (data: { projectId: string; changedPath: string; timestamp: string }) => void
  ) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: MaestroAPI
  }
}
