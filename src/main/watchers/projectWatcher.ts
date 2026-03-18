import { watch, type FSWatcher } from 'chokidar'
import { BrowserWindow } from 'electron'
import * as dao from '../database/dao'
import type { Project } from '../../shared/types'

let watcher: FSWatcher | null = null

/**
 * Start watching all active project directories.
 * When a file changes inside ~/Music/MaestroOS/{ProjectName}/,
 * we update the project's last_touched_at timestamp in the DB
 * and notify the renderer via IPC.
 *
 * This is the heartbeat that keeps the dashboard fresh and
 * detects when a musician is actively working on a composition.
 */
export function startProjectWatchers(): void {
  const projects = dao.getAllProjects()
  if (projects.length === 0) return

  const watchPaths = projects.map((p) => p.masterDirectory)

  watcher = watch(watchPaths, {
    persistent: true,
    ignoreInitial: true,
    depth: 3, // Don't crawl too deep
    // Ignore common system/hidden files
    ignored: [
      /(^|[/\\])\../, // dotfiles
      '**/node_modules/**',
      '**/Thumbs.db',
      '**/.DS_Store'
    ],
    // Debounce rapid changes (e.g., DAW auto-save)
    awaitWriteFinish: {
      stabilityThreshold: 500,
      pollInterval: 100
    }
  })

  watcher.on('change', (changedPath) => {
    handleFileChange(changedPath, projects)
  })

  watcher.on('add', (changedPath) => {
    handleFileChange(changedPath, projects)
  })
}

function handleFileChange(changedPath: string, projects: Project[]): void {
  // Find which project this file belongs to
  const project = projects.find((p) => changedPath.startsWith(p.masterDirectory))
  if (!project) return

  // Update the timestamp in the database
  dao.updateProjectLastTouched(project.id)

  // Notify all renderer windows
  const now = new Date().toISOString()
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send('project:lastTouchedChanged', {
      projectId: project.id,
      changedPath,
      timestamp: now
    })
  })
}

/**
 * Add a new project directory to the watcher.
 * Called after project creation.
 */
export function addProjectToWatcher(directory: string): void {
  if (watcher) {
    watcher.add(directory)
  }
}

/**
 * Remove a project directory from the watcher.
 * Called after project deletion.
 */
export function removeProjectFromWatcher(directory: string): void {
  if (watcher) {
    watcher.unwatch(directory)
  }
}

/**
 * Stop all watchers. Called on app quit.
 */
export function stopProjectWatchers(): void {
  if (watcher) {
    watcher.close()
    watcher = null
  }
}
