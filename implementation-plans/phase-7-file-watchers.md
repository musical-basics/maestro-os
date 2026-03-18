# Phase 7: Background Watchers & Automation

> **Goal:** Use `chokidar` to watch all active project directories and linked asset files in the background. When a user saves a file in an external app (e.g., Logic Pro), the app automatically detects the modification and updates the project's `last_touched_at` timestamp — so the AI Studio Manager (Phase 8) knows the user worked on it today.
>
> **Depends on:** Phase 6 (assets linked to projects, stage advancement working) + Phase 2 (DAO `updateProjectLastTouched`).

---

## Step 1 — Create the File Watcher Manager

### What to do

Create `electron/watchers/fileWatcherManager.ts`:

```typescript
import chokidar from 'chokidar';
import { getDatabase } from '../database/connection';
import { updateProjectLastTouched } from '../database/dao';
import { BrowserWindow } from 'electron';

// Map of projectId → chokidar.FSWatcher
const projectWatchers = new Map<string, chokidar.FSWatcher>();

/**
 * Start watching all paths associated with a project:
 * 1. The project's master directory (recursive)
 * 2. All individual linked asset file paths
 */
export function watchProject(projectId: string, masterDirectory: string, assetPaths: string[]): void {
  // If already watching this project, stop the old watcher first
  unwatchProject(projectId);

  // Combine all paths to watch
  const pathsToWatch: string[] = [
    masterDirectory,   // Watch the entire project folder
    ...assetPaths,     // Also explicitly watch linked files outside the master dir
  ];

  const watcher = chokidar.watch(pathsToWatch, {
    persistent: true,
    ignoreInitial: true,        // Don't fire events for existing files on startup
    awaitWriteFinish: {         // Wait for write to complete before firing (important!)
      stabilityThreshold: 1000, // Wait 1 second after last change
      pollInterval: 100,
    },
    depth: 5,                   // Limit recursion depth to avoid watching too deep
    ignored: [
      /(^|[\/\\])\../,          // Ignore dotfiles (.DS_Store, etc.)
      /node_modules/,
    ],
  });

  // ─── Event Handler: File Changed ───────────────────────────
  watcher.on('change', (changedPath: string) => {
    console.log(`[FileWatcher] Change detected for project ${projectId}: ${changedPath}`);

    // Update the project's last_touched_at timestamp in SQLite
    updateProjectLastTouched(projectId);

    // Also update the specific asset's last_modified if it's a linked asset
    const db = getDatabase();
    db.prepare(
      'UPDATE project_assets SET last_modified = CURRENT_TIMESTAMP WHERE project_id = ? AND file_path = ?'
    ).run(projectId, changedPath);

    // Notify the renderer so the UI updates without a refresh
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('project:lastTouchedChanged', {
        projectId,
        changedPath,
        timestamp: new Date().toISOString(),
      });
    });
  });

  // ─── Event Handler: New File Added ─────────────────────────
  watcher.on('add', (addedPath: string) => {
    console.log(`[FileWatcher] New file detected in project ${projectId}: ${addedPath}`);
    // Update last_touched_at (a new file means the user is working on it)
    updateProjectLastTouched(projectId);
  });

  watcher.on('error', (error: Error) => {
    console.error(`[FileWatcher] Error for project ${projectId}:`, error);
  });

  projectWatchers.set(projectId, watcher);
  console.log(`[FileWatcher] Now watching project ${projectId}: ${pathsToWatch.length} path(s)`);
}

/**
 * Stop watching a specific project.
 */
export function unwatchProject(projectId: string): void {
  const watcher = projectWatchers.get(projectId);
  if (watcher) {
    watcher.close();
    projectWatchers.delete(projectId);
    console.log(`[FileWatcher] Stopped watching project ${projectId}`);
  }
}

/**
 * Stop all watchers (called on app quit).
 */
export function unwatchAll(): void {
  for (const [projectId, watcher] of projectWatchers.entries()) {
    watcher.close();
    console.log(`[FileWatcher] Stopped watching project ${projectId}`);
  }
  projectWatchers.clear();
}

/**
 * Re-scan the database and start/refresh watchers for all active projects.
 * Called on app startup and after project creation/deletion.
 */
export function syncAllWatchers(): void {
  const db = getDatabase();

  // Get all projects that are NOT at Stage 15 (Released = done, no need to watch)
  const projects = db.prepare(
    'SELECT id, master_directory FROM projects WHERE current_stage_id < 15'
  ).all() as { id: string; master_directory: string }[];

  // For each project, get its linked asset paths
  for (const project of projects) {
    const assets = db.prepare(
      'SELECT file_path FROM project_assets WHERE project_id = ?'
    ).all(project.id) as { file_path: string }[];

    const assetPaths = assets.map((a) => a.file_path);

    watchProject(project.id, project.master_directory, assetPaths);
  }

  // Stop watching any projects that no longer exist or are released
  const activeProjectIds = new Set(projects.map((p) => p.id));
  for (const watchedId of projectWatchers.keys()) {
    if (!activeProjectIds.has(watchedId)) {
      unwatchProject(watchedId);
    }
  }

  console.log(`[FileWatcher] Synced watchers for ${projects.length} active project(s)`);
}
```

### Critical details
- **`awaitWriteFinish`** is essential — without it, chokidar fires the `change` event mid-write when the user hits Cmd+S. The 1-second stabilization threshold ensures the write is fully complete.
- **`ignoreInitial: true`** prevents a flood of events when the watcher first starts.
- **Released projects (Stage 15) are excluded** — no need to watch finished projects.
- **Both `change` and `add` events** update `last_touched_at`. A new file in the project folder means the user is actively working.

---

## Step 2 — Wire Watchers into App Lifecycle

### What to do

In `electron/main.ts`, add these calls:

```typescript
import { syncAllWatchers, unwatchAll } from './watchers/fileWatcherManager';

app.whenReady().then(() => {
  // ... existing Phase 2 init (schema + seed)
  initializeSchema();
  seedPipelineStages();

  // ... existing Phase 1 window creation
  createWindow();

  // Start file watchers for all active projects
  syncAllWatchers();
});

// Clean up watchers AND database on quit
app.on('will-quit', () => {
  unwatchAll();   // Stop all chokidar watchers
  closeDatabase(); // Close SQLite connection
});
```

### Also re-sync watchers when projects change

After project creation (Phase 4) and asset linking (Phase 6), re-sync watchers:

```typescript
ipcMain.handle('project:create', async (_event, data) => {
  const project = createProject(data.title, data.masterDirectory, data.snippetIds);
  syncAllWatchers(); // Start watching the new project's directory
  return project;
});

ipcMain.handle('asset:link', async (_event, data) => {
  const asset = linkAsset(data);
  syncAllWatchers(); // Refresh watchers to include the new asset path
  return asset;
});
```

---

## Step 3 — Expose the `lastTouchedChanged` Event to Renderer

### What to do

**In `electron/preload.ts`:**
```typescript
onProjectLastTouchedChanged: (
  callback: (data: { projectId: string; changedPath: string; timestamp: string }) => void
) => {
  ipcRenderer.on('project:lastTouchedChanged', (_event, data) => callback(data));
  return () => {
    ipcRenderer.removeAllListeners('project:lastTouchedChanged');
  };
},
```

**In `src/types/electron.d.ts`:**
```typescript
onProjectLastTouchedChanged: (
  callback: (data: { projectId: string; changedPath: string; timestamp: string }) => void
) => () => void;
```

### Then subscribe in the Projects view

In `src/views/ProjectsView.tsx` (or a top-level layout component), listen for last-touched updates:

```tsx
useEffect(() => {
  const cleanup = window.api.onProjectLastTouchedChanged(async (data) => {
    // Refresh the project list to show updated "last touched" times
    await useProjectStore.getState().fetchProjects();
  });
  return cleanup;
}, []);
```

---

## Step 4 — Memory Leak Prevention

### What to do

Ensure watchers are properly managed:

1. **On project deletion** (if implemented): Call `unwatchProject(projectId)` before deleting the DB record.
2. **On app close**: `unwatchAll()` is already called in `will-quit` (Step 2).
3. **Watcher Map cleanup**: The `syncAllWatchers` function already removes watchers for deleted/released projects.
4. **IPC listener cleanup**: All `onProject*` event subscriptions return cleanup functions that must be called in React `useEffect` return.

### Add a `project:delete` handler (optional but recommended)

```typescript
// electron/main.ts
ipcMain.handle('project:delete', async (_event, id: string) => {
  unwatchProject(id); // Stop watching BEFORE deleting
  getDatabase().prepare('DELETE FROM projects WHERE id = ?').run(id);
  // CASCADE will clean up project_snippets and project_assets automatically
});
```

---

## Files Created / Modified

| Action | File | Purpose |
|--------|------|---------|
| NEW | `electron/watchers/fileWatcherManager.ts` | Chokidar watcher manager: watch/unwatch/sync |
| MODIFY | `electron/main.ts` | Call `syncAllWatchers()` on startup, re-sync on project create/asset link, `unwatchAll()` on quit |
| MODIFY | `electron/preload.ts` | Add `onProjectLastTouchedChanged` listener |
| MODIFY | `src/types/electron.d.ts` | Add `onProjectLastTouchedChanged` type |
| MODIFY | `src/views/ProjectsView.tsx` | Subscribe to last-touched-changed events |

## Verification

1. `pnpm dev` → check console: should see `[FileWatcher] Synced watchers for N active project(s)`.
2. **Timestamp test**:
   a. Open a project detail view → note the "Last Touched" timestamp.
   b. Open the project's linked `.logicx` file via the "↗" button.
   c. In Logic Pro, make any edit and hit Cmd+S.
   d. After ~1 second, the "Last Touched" timestamp in the app should update automatically.
3. **Console check**: You should see `[FileWatcher] Change detected for project <id>: <path>`.
4. **New file test**: Create a new file inside the project's master directory in Finder → "Last Touched" should update.
5. **Quit test**: Quit the app → no console errors about leaked file handles or unclosed watchers.
