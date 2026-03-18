import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import * as os from 'os'
import * as fs from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { initializeSchema } from './database/schema'
import { seedPipelineStages } from './database/seed'
import { closeDatabase } from './database/connection'
import * as dao from './database/dao'
import type { CreateSnippetData, LinkAssetData } from '../shared/types'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ─── IPC Handlers ─────────────────────────────────────────

// Snippet Handlers
ipcMain.handle('snippet:getAll', async () => {
  return dao.getAllSnippets()
})
ipcMain.handle('snippet:create', async (_event, data: CreateSnippetData) => {
  return dao.createSnippet(data)
})
ipcMain.handle(
  'snippet:update',
  async (
    _event,
    id: string,
    data: { title?: string; keySignature?: string | null; bpm?: number | null; mood?: string | null }
  ) => {
    return dao.updateSnippet(id, data)
  }
)
ipcMain.handle('snippet:delete', async (_event, id: string) => {
  dao.deleteSnippet(id)
})

// Project Handlers
ipcMain.handle('project:getAll', async () => {
  return dao.getAllProjects()
})
ipcMain.handle('project:getById', async (_event, id: string) => {
  return dao.getProjectById(id)
})
ipcMain.handle(
  'project:create',
  async (_event, data: { title: string; masterDirectory: string; snippetIds: string[] }) => {
    return dao.createProject(data.title, data.masterDirectory, data.snippetIds)
  }
)
ipcMain.handle('project:updateStage', async (_event, id: string, stageId: number) => {
  dao.updateProjectStage(id, stageId)
  // Notify all renderer windows about the stage change
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send('project:stageChanged', { projectId: id, newStageId: stageId })
  })
})
ipcMain.handle('project:delete', async (_event, id: string) => {
  dao.deleteProject(id)
})

// Asset Handlers
ipcMain.handle('asset:link', async (_event, data: LinkAssetData) => {
  return dao.linkAsset(data)
})
ipcMain.handle('asset:getByProject', async (_event, projectId: string) => {
  return dao.getAssetsByProject(projectId)
})

// Pipeline Stages
ipcMain.handle('stage:getAll', async () => {
  return dao.getAllStages()
})

// Dashboard (Phase 8 — stub for now, will be replaced)
ipcMain.handle('dashboard:getProjectStates', async () => {
  return []
})

// File System Handlers
ipcMain.handle('fs:openPath', async (_event, filePath: string) => {
  await shell.openPath(filePath)
})
ipcMain.handle('fs:createDirectory', async (_event, dirPath: string) => {
  fs.mkdirSync(dirPath, { recursive: true })
  return dirPath
})
ipcMain.handle('fs:getHomeDir', async () => {
  return os.homedir()
})

// ─── App Lifecycle ────────────────────────────────────────

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.maestroos.app')

  // Initialize the database schema + seed pipeline stages
  initializeSchema()
  seedPipelineStages()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  closeDatabase()
})
