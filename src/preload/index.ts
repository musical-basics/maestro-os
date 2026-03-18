import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

import type {
  Snippet,
  Project,
  ProjectAsset,
  PipelineStage,
  CreateSnippetData,
  LinkAssetData
} from '../shared/types'

// MaestroOS API exposed to the renderer via window.api
const api = {
  // Snippets
  getSnippets: (): Promise<Snippet[]> => ipcRenderer.invoke('snippet:getAll'),
  createSnippet: (data: CreateSnippetData): Promise<Snippet> =>
    ipcRenderer.invoke('snippet:create', data),
  updateSnippet: (
    id: string,
    data: {
      title?: string
      keySignature?: string | null
      bpm?: number | null
      mood?: string | null
    }
  ): Promise<Snippet | null> => ipcRenderer.invoke('snippet:update', id, data),
  deleteSnippet: (id: string): Promise<void> => ipcRenderer.invoke('snippet:delete', id),

  // Projects
  getProjects: (): Promise<Project[]> => ipcRenderer.invoke('project:getAll'),
  getProject: (id: string): Promise<Project | null> => ipcRenderer.invoke('project:getById', id),
  createProject: (data: {
    title: string
    masterDirectory: string
    snippetIds: string[]
  }): Promise<Project> => ipcRenderer.invoke('project:create', data),
  updateProjectStage: (id: string, stageId: number): Promise<void> =>
    ipcRenderer.invoke('project:updateStage', id, stageId),
  deleteProject: (id: string): Promise<void> => ipcRenderer.invoke('project:delete', id),

  // Assets
  linkAsset: (data: LinkAssetData): Promise<ProjectAsset> =>
    ipcRenderer.invoke('asset:link', data),
  getProjectAssets: (projectId: string): Promise<ProjectAsset[]> =>
    ipcRenderer.invoke('asset:getByProject', projectId),

  // Pipeline Stages
  getStages: (): Promise<PipelineStage[]> => ipcRenderer.invoke('stage:getAll'),

  // Dashboard
  getProjectStates: (): Promise<unknown[]> => ipcRenderer.invoke('dashboard:getProjectStates'),

  // File System
  openPath: (filePath: string): Promise<void> => ipcRenderer.invoke('fs:openPath', filePath),
  createDirectory: (dirPath: string): Promise<string> =>
    ipcRenderer.invoke('fs:createDirectory', dirPath),
  getHomeDir: (): Promise<string> => ipcRenderer.invoke('fs:getHomeDir'),

  // Event listeners (for real-time updates from main process)
  onProjectStageChanged: (
    callback: (data: { projectId: string; newStageId: number }) => void
  ): (() => void) => {
    const handler = (_event: unknown, data: { projectId: string; newStageId: number }): void =>
      callback(data)
    ipcRenderer.on('project:stageChanged', handler)
    return () => {
      ipcRenderer.removeListener('project:stageChanged', handler)
    }
  },

  onProjectLastTouchedChanged: (
    callback: (data: { projectId: string; changedPath: string; timestamp: string }) => void
  ): (() => void) => {
    const handler = (
      _event: unknown,
      data: { projectId: string; changedPath: string; timestamp: string }
    ): void => callback(data)
    ipcRenderer.on('project:lastTouchedChanged', handler)
    return () => {
      ipcRenderer.removeListener('project:lastTouchedChanged', handler)
    }
  }
} as const

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
