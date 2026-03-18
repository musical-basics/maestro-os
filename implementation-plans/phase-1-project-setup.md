# Phase 1: Project Setup & Core Architecture

> **Goal:** Scaffold the local-first macOS desktop app with Electron + Vite + React + TypeScript, install all dependencies, configure styling, wire the IPC bridge, and build the three-view app shell.

---

## Step 0 — Rename Spec Files

Move all spec docs into a `docs/` subfolder with kebab-case naming:

```bash
mkdir -p docs
mv bigpictureplan.md docs/big-picture-plan.md
mv PRD.md docs/prd.md
mv stack.md docs/stack.md
mv datastructure.md docs/data-structure.md
mv userflow.md docs/user-flow.md
```

Update any cross-references inside these files to use the new paths.

---

## Step 1 — Scaffold Electron + Vite + React + TypeScript

1. `cd` into the `MaestroOS/` root directory.
2. Run with `--help` first to check available options:
   ```bash
   pnpm create @electron-vite/create@latest --help
   ```
3. Then scaffold **in the current directory**:
   ```bash
   pnpm create @electron-vite/create@latest ./ -- --template react-ts
   ```
4. Verify the generated structure looks roughly like:
   ```
   MaestroOS/
   ├── electron/          # or src/main/
   │   ├── main.ts        # Electron main process entry
   │   └── preload.ts     # contextBridge preload
   ├── src/               # React renderer
   │   ├── App.tsx
   │   ├── main.tsx
   │   └── ...
   ├── index.html
   ├── package.json
   ├── tsconfig.json
   ├── vite.config.ts
   └── electron-builder.yml
   ```
5. Run `pnpm install`.
6. Run `pnpm dev` — a blank Electron window should appear. **Kill the dev server after confirming.**

---

## Step 2 — Install Core Dependencies

```bash
pnpm add better-sqlite3 chokidar howler zustand
pnpm add -D @types/better-sqlite3 @types/howler tailwindcss @tailwindcss/vite
```

| Package | Purpose | Ref |
|---------|---------|-----|
| `better-sqlite3` | Local SQLite database (Electron Main) | `docs/stack.md` → Database (Local) |
| `chokidar` | File-system watcher for detecting saves | `docs/stack.md` → Local File Access |
| `howler` | Audio playback for Vault Snippets | `docs/stack.md` → Audio Playback |
| `zustand` | State management for pipeline UI & routing | `docs/stack.md` → State Management |
| `tailwindcss` + `@tailwindcss/vite` | Utility CSS for dark-mode native aesthetic | `docs/stack.md` → Frontend |
| `@types/better-sqlite3`, `@types/howler` | TypeScript type definitions | — |

---

## Step 3 — Configure Tailwind CSS & Dark-Mode Theme

1. Add the Tailwind Vite plugin to `vite.config.ts`:
   ```typescript
   import tailwindcss from '@tailwindcss/vite';

   export default defineConfig({
     plugins: [
       react(),
       tailwindcss(),
     ],
   });
   ```

2. In the global CSS file (`src/index.css`), add:
   ```css
   @import "tailwindcss";
   ```

3. Define a dark-mode color palette using CSS custom properties. Target aesthetic: **Logic Pro / Final Cut Pro** — dark grays, subtle blue accents, minimal rounding, monospaced metadata text:
   ```css
   :root {
     --color-bg-primary: #1a1a1e;
     --color-bg-secondary: #242428;
     --color-bg-tertiary: #2c2c30;
     --color-border: #3a3a3e;
     --color-text-primary: #e5e5ea;
     --color-text-secondary: #8e8e93;
     --color-accent: #0a84ff;
     --color-accent-hover: #409cff;
     --color-success: #30d158;
     --color-warning: #ff9f0a;
     --color-danger: #ff453a;
     --font-sans: 'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
     --font-mono: 'SF Mono', 'Fira Code', monospace;
   }
   ```

4. Set `<html class="dark">` in `index.html`. Apply `background-color: var(--color-bg-primary); color: var(--color-text-primary);` to `body`.

---

## Step 4 — Setup the IPC Bridge

### 4a. `electron/main.ts` — Main Process Entry

Create the `BrowserWindow`:
```typescript
const mainWindow = new BrowserWindow({
  width: 1280,
  height: 800,
  titleBarStyle: 'hiddenInset',
  trafficLightPosition: { x: 16, y: 16 },
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: false,  // Required for better-sqlite3
  },
});
```

Register IPC handler stubs (bodies filled in later phases):
```typescript
// Snippet Handlers (Phase 3)
ipcMain.handle('snippet:getAll', async () => { /* TODO Phase 3 */ });
ipcMain.handle('snippet:create', async (_e, data) => { /* TODO Phase 3 */ });
ipcMain.handle('snippet:delete', async (_e, id) => { /* TODO Phase 3 */ });

// Project Handlers (Phase 4–5)
ipcMain.handle('project:getAll', async () => { /* TODO Phase 4 */ });
ipcMain.handle('project:getById', async (_e, id) => { /* TODO Phase 4 */ });
ipcMain.handle('project:create', async (_e, data) => { /* TODO Phase 4 */ });
ipcMain.handle('project:updateStage', async (_e, id, stageId) => { /* TODO Phase 6 */ });

// Asset Handlers (Phase 6)
ipcMain.handle('asset:link', async (_e, data) => { /* TODO Phase 6 */ });
ipcMain.handle('asset:getByProject', async (_e, projectId) => { /* TODO Phase 6 */ });

// File System Handlers (ready now)
ipcMain.handle('fs:openPath', async (_e, filePath) => {
  await shell.openPath(filePath);
});
ipcMain.handle('fs:createDirectory', async (_e, dirPath) => {
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
});
```

### 4b. `electron/preload.ts` — Typed Bridge

```typescript
import { contextBridge, ipcRenderer } from 'electron';

const api = {
  getSnippets: () => ipcRenderer.invoke('snippet:getAll'),
  createSnippet: (data: any) => ipcRenderer.invoke('snippet:create', data),
  deleteSnippet: (id: string) => ipcRenderer.invoke('snippet:delete', id),
  getProjects: () => ipcRenderer.invoke('project:getAll'),
  getProject: (id: string) => ipcRenderer.invoke('project:getById', id),
  createProject: (data: any) => ipcRenderer.invoke('project:create', data),
  updateProjectStage: (id: string, stageId: number) =>
    ipcRenderer.invoke('project:updateStage', id, stageId),
  linkAsset: (data: any) => ipcRenderer.invoke('asset:link', data),
  getProjectAssets: (projectId: string) =>
    ipcRenderer.invoke('asset:getByProject', projectId),
  openPath: (filePath: string) => ipcRenderer.invoke('fs:openPath', filePath),
  createDirectory: (dirPath: string) => ipcRenderer.invoke('fs:createDirectory', dirPath),
} as const;

contextBridge.exposeInMainWorld('api', api);
```

### 4c. `src/types/electron.d.ts` — Global Type Declaration

```typescript
interface ElectronAPI {
  getSnippets: () => Promise<import('../shared/types').Snippet[]>;
  createSnippet: (data: Omit<import('../shared/types').Snippet, 'id' | 'createdAt'>) => Promise<import('../shared/types').Snippet>;
  deleteSnippet: (id: string) => Promise<void>;
  getProjects: () => Promise<import('../shared/types').Project[]>;
  getProject: (id: string) => Promise<import('../shared/types').Project>;
  createProject: (data: { title: string; snippetIds: string[] }) => Promise<import('../shared/types').Project>;
  updateProjectStage: (id: string, stageId: number) => Promise<void>;
  linkAsset: (data: Omit<import('../shared/types').ProjectAsset, 'id'>) => Promise<import('../shared/types').ProjectAsset>;
  getProjectAssets: (projectId: string) => Promise<import('../shared/types').ProjectAsset[]>;
  openPath: (filePath: string) => Promise<void>;
  createDirectory: (dirPath: string) => Promise<string>;
}

declare global {
  interface Window {
    api: ElectronAPI;
  }
}
export {};
```

---

## Step 5 — Scaffold the App Shell (Three-View Layout)

### 5a. Zustand View Router

```typescript
// src/stores/useAppStore.ts
import { create } from 'zustand';

type View = 'dashboard' | 'vault' | 'projects';

interface AppState {
  currentView: View;
  setView: (view: View) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentView: 'dashboard',
  setView: (view) => set({ currentView: view }),
}));
```

### 5b. Sidebar Component

Create `src/components/Sidebar.tsx`:
- Persistent left sidebar (~220px wide), always visible.
- Three nav items with icons: **Dashboard** (home), **Vault** (archive), **Projects** (folder).
- Highlight the active view via `useAppStore.currentView`.
- Style: `var(--color-bg-secondary)` background, subtle hover, macOS native feel.

### 5c. Placeholder Views

Create three files:
- `src/views/DashboardView.tsx` → `<h1>Studio Manager</h1>` + placeholder text
- `src/views/VaultView.tsx` → `<h1>The Vault</h1>` + placeholder text
- `src/views/ProjectsView.tsx` → `<h1>Projects</h1>` + placeholder text

### 5d. Wire `App.tsx`

```tsx
import { useAppStore } from './stores/useAppStore';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './views/DashboardView';
import { VaultView } from './views/VaultView';
import { ProjectsView } from './views/ProjectsView';

export default function App() {
  const currentView = useAppStore((s) => s.currentView);
  const ViewComponent = {
    dashboard: DashboardView,
    vault: VaultView,
    projects: ProjectsView,
  }[currentView];

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <Sidebar />
      <main style={{ flex: 1, overflow: 'auto', padding: '2rem' }}>
        <ViewComponent />
      </main>
    </div>
  );
}
```

---

## Files Created / Modified

| Action | File | Purpose |
|--------|------|---------|
| RENAME | `docs/big-picture-plan.md` | From `bigpictureplan.md` |
| RENAME | `docs/prd.md` | From `PRD.md` |
| RENAME | `docs/stack.md` | From `stack.md` |
| RENAME | `docs/data-structure.md` | From `datastructure.md` |
| RENAME | `docs/user-flow.md` | From `userflow.md` |
| SCAFFOLD | `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html` | Template |
| SCAFFOLD | `electron/main.ts` | Electron main + IPC stubs |
| SCAFFOLD | `electron/preload.ts` | Typed `contextBridge` |
| NEW | `src/types/electron.d.ts` | Global `window.api` types |
| NEW | `src/stores/useAppStore.ts` | Zustand view routing |
| NEW | `src/components/Sidebar.tsx` | Sidebar navigation |
| NEW | `src/views/DashboardView.tsx` | Dashboard placeholder |
| NEW | `src/views/VaultView.tsx` | Vault placeholder |
| NEW | `src/views/ProjectsView.tsx` | Projects placeholder |
| NEW | `src/index.css` | Tailwind + CSS theme tokens |

## Verification

1. `pnpm build` → exits 0, no TS errors.
2. `pnpm ls better-sqlite3 chokidar howler zustand tailwindcss` → all listed.
3. `pnpm dev` → dark Electron window with working sidebar navigation between 3 views.
