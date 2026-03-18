import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import os from 'os'
import fs from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

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
      sandbox: false // Required for better-sqlite3 native module
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

// Snippet Handlers (Phase 3)
ipcMain.handle('snippet:getAll', async () => {
  /* TODO Phase 3 */
  return []
})
ipcMain.handle('snippet:create', async (_event, _data) => {
  /* TODO Phase 3 */
  return null
})
ipcMain.handle('snippet:delete', async (_event, _id: string) => {
  /* TODO Phase 3 */
})

// Project Handlers (Phase 4–5)
ipcMain.handle('project:getAll', async () => {
  /* TODO Phase 4 */
  return []
})
ipcMain.handle('project:getById', async (_event, _id: string) => {
  /* TODO Phase 4 */
  return null
})
ipcMain.handle('project:create', async (_event, _data) => {
  /* TODO Phase 4 */
  return null
})
ipcMain.handle('project:updateStage', async (_event, _id: string, _stageId: number) => {
  /* TODO Phase 6 */
})

// Asset Handlers (Phase 6)
ipcMain.handle('asset:link', async (_event, _data) => {
  /* TODO Phase 6 */
  return null
})
ipcMain.handle('asset:getByProject', async (_event, _projectId: string) => {
  /* TODO Phase 6 */
  return []
})

// Pipeline Stages (Phase 5)
ipcMain.handle('stage:getAll', async () => {
  /* TODO Phase 5 */
  return []
})

// Dashboard (Phase 8)
ipcMain.handle('dashboard:getProjectStates', async () => {
  /* TODO Phase 8 */
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
