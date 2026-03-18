import { ElectronAPI } from '@electron-toolkit/preload'

interface MaestroAPI {
  // Snippets
  getSnippets: () => Promise<unknown[]>
  createSnippet: (data: unknown) => Promise<unknown>
  deleteSnippet: (id: string) => Promise<void>

  // Projects
  getProjects: () => Promise<unknown[]>
  getProject: (id: string) => Promise<unknown>
  createProject: (data: unknown) => Promise<unknown>
  updateProjectStage: (id: string, stageId: number) => Promise<void>

  // Assets
  linkAsset: (data: unknown) => Promise<unknown>
  getProjectAssets: (projectId: string) => Promise<unknown[]>

  // Pipeline Stages
  getStages: () => Promise<unknown[]>

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
