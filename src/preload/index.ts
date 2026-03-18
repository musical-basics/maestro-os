import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// MaestroOS API exposed to the renderer via window.api
const api = {
  // Snippets
  getSnippets: (): Promise<unknown[]> => ipcRenderer.invoke('snippet:getAll'),
  createSnippet: (data: unknown): Promise<unknown> => ipcRenderer.invoke('snippet:create', data),
  deleteSnippet: (id: string): Promise<void> => ipcRenderer.invoke('snippet:delete', id),

  // Projects
  getProjects: (): Promise<unknown[]> => ipcRenderer.invoke('project:getAll'),
  getProject: (id: string): Promise<unknown> => ipcRenderer.invoke('project:getById', id),
  createProject: (data: unknown): Promise<unknown> => ipcRenderer.invoke('project:create', data),
  updateProjectStage: (id: string, stageId: number): Promise<void> =>
    ipcRenderer.invoke('project:updateStage', id, stageId),

  // Assets
  linkAsset: (data: unknown): Promise<unknown> => ipcRenderer.invoke('asset:link', data),
  getProjectAssets: (projectId: string): Promise<unknown[]> =>
    ipcRenderer.invoke('asset:getByProject', projectId),

  // Pipeline Stages
  getStages: (): Promise<unknown[]> => ipcRenderer.invoke('stage:getAll'),

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
