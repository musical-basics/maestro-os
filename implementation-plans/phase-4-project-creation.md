# Phase 4: Project Creation & Folder Generation

> **Goal:** Implement the snippet-merging flow where users select multiple Vault snippets, name a new project, auto-generate a local macOS folder, create the project record in SQLite, and link the snippets to it.
>
> **Depends on:** Phase 3 (Vault with multi-select working) + Phase 2 (database with all tables + `createProject` DAO).

---

## Step 1 — Wire the "Merge into New Project" Button

### What to do

In `src/views/VaultView.tsx`, wire the existing merge button to open a modal:

```tsx
import { useState } from 'react';
import { MergeProjectModal } from '../components/MergeProjectModal';

// Inside VaultView component:
const [showMergeModal, setShowMergeModal] = useState(false);

// In the JSX, update the merge button:
{selectedSnippetIds.size >= 2 && (
  <button
    className="merge-button"
    onClick={() => setShowMergeModal(true)}
  >
    Merge {selectedSnippetIds.size} Snippets into New Project
  </button>
)}

{showMergeModal && (
  <MergeProjectModal
    selectedSnippetIds={Array.from(selectedSnippetIds)}
    onClose={() => setShowMergeModal(false)}
    onSuccess={() => {
      setShowMergeModal(false);
      // Clear snippet selection after merge
      useVaultStore.getState().clearSelection();
    }}
  />
)}
```

### Why
The merge button only appears when 2+ snippets are selected (designed in Phase 3). This step connects it to the modal UI.

---

## Step 2 — Build the Merge Project Modal

### What to do

Create `src/components/MergeProjectModal.tsx`:

```tsx
import { useState } from 'react';

interface Props {
  selectedSnippetIds: string[];
  onClose: () => void;
  onSuccess: () => void;
}

export function MergeProjectModal({ selectedSnippetIds, onClose, onSuccess }: Props) {
  const [title, setTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    // Validate title
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Please enter a project name.');
      return;
    }

    // Sanitize title for folder name: replace spaces with underscores, remove special chars
    const folderName = trimmedTitle
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_-]/g, '');

    if (!folderName) {
      setError('Project name must contain at least one alphanumeric character.');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      // 1. Create the master directory on disk via IPC
      //    Path: ~/Music/MaestroOS/{FolderName}/
      const homeDir = await window.api.getHomeDir(); // NOTE: Need to add this IPC method
      const masterDir = `${homeDir}/Music/MaestroOS/${folderName}`;
      await window.api.createDirectory(masterDir);

      // 2. Create the project record in SQLite + link snippets
      const project = await window.api.createProject({
        title: trimmedTitle,
        masterDirectory: masterDir,
        snippetIds: selectedSnippetIds,
      });

      console.log('Project created:', project);
      onSuccess();
    } catch (err) {
      console.error('Failed to create project:', err);
      setError('Failed to create project. Check console for details.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Create New Project</h2>
        <p className="modal-subtitle">
          Merging {selectedSnippetIds.length} snippets into a new project.
        </p>

        <label className="modal-label" htmlFor="project-title">
          Project Name
        </label>
        <input
          id="project-title"
          type="text"
          className="modal-input"
          placeholder='e.g., "Neon Sonata"'
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          autoFocus
          disabled={isCreating}
        />

        {error && <p className="modal-error">{error}</p>}

        <div className="modal-actions">
          <button className="btn btn--secondary" onClick={onClose} disabled={isCreating}>
            Cancel
          </button>
          <button className="btn btn--primary" onClick={handleCreate} disabled={isCreating}>
            {isCreating ? 'Creating…' : 'Create Project'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Styling requirements
- **modal-overlay**: Full-screen semi-transparent backdrop (`rgba(0,0,0,0.6)`).
- **modal-content**: Centered card, `var(--color-bg-secondary)` background, max-width 480px.
- **modal-input**: Dark input with `var(--color-bg-tertiary)` background, `var(--color-border)` border, focus ring using `var(--color-accent)`.

---

## Step 3 — Add the `getHomeDir` IPC Method

### What to do

The modal needs the user's home directory to construct `~/Music/MaestroOS/...`. Add a new IPC handler:

**In `electron/main.ts`:**
```typescript
import os from 'os';

ipcMain.handle('fs:getHomeDir', async () => {
  return os.homedir();
});
```

**In `electron/preload.ts`:**
```typescript
getHomeDir: () => ipcRenderer.invoke('fs:getHomeDir'),
```

**In `src/types/electron.d.ts`:**
```typescript
getHomeDir: () => Promise<string>;
```

---

## Step 4 — Wire the Project Creation IPC Handler

### What to do

In `electron/main.ts`, replace the `project:create` stub:

```typescript
import { createProject } from './database/dao';
import fs from 'fs';

ipcMain.handle('project:create', async (_event, data: {
  title: string;
  masterDirectory: string;
  snippetIds: string[];
}) => {
  // Ensure the master directory exists (idempotent)
  fs.mkdirSync(data.masterDirectory, { recursive: true });

  // Create project in DB + link snippets (see Phase 2 DAO)
  return createProject(data.title, data.masterDirectory, data.snippetIds);
});
```

### Critical details
- The DAO `createProject()` function (from Phase 2) does three things in a single transaction:
  1. Inserts a `projects` row with `current_stage_id = 2` (Half-Finished Composition).
  2. Inserts rows into `project_snippets` for each selected snippet.
  3. Returns the full `Project` object.
- `current_stage_id` starts at **2** (not 1) because Stage 1 is "Idea (Vault)" — by merging snippets, the user has already moved past the idea phase.
- `fs.mkdirSync(dirPath, { recursive: true })` is safe to call even if the directory already exists.

---

## Step 5 — Also Wire `project:getAll` and `project:getById`

### What to do

While we're here, wire the remaining project IPC handlers:

```typescript
import { getAllProjects, getProjectById } from './database/dao';

ipcMain.handle('project:getAll', async () => {
  return getAllProjects();
});

ipcMain.handle('project:getById', async (_event, id: string) => {
  return getProjectById(id);
});
```

### Why
Phase 5 will need these to build the Projects list view and project detail view. Wiring them now means Phase 5 can focus purely on UI.

---

## Step 6 — (Optional) Navigate to Projects View on Success

### What to do

After a project is successfully created, automatically switch the user to the Projects view:

In the `onSuccess` callback within `VaultView.tsx`:
```typescript
import { useAppStore } from '../stores/useAppStore';

onSuccess={() => {
  setShowMergeModal(false);
  useVaultStore.getState().clearSelection();
  // Navigate to Projects view so the user can see their new project
  useAppStore.getState().setView('projects');
}}
```

---

## Files Created / Modified

| Action | File | Purpose |
|--------|------|---------|
| NEW | `src/components/MergeProjectModal.tsx` | Modal for naming + creating a project from snippets |
| MODIFY | `src/views/VaultView.tsx` | Wire merge button → open modal, navigate on success |
| MODIFY | `electron/main.ts` | Wire `project:create`, `project:getAll`, `project:getById`, `fs:getHomeDir` IPC handlers |
| MODIFY | `electron/preload.ts` | Add `getHomeDir` to bridge |
| MODIFY | `src/types/electron.d.ts` | Add `getHomeDir` type |

## Verification

1. `pnpm dev` → Navigate to Vault → Select 2+ snippets → "Merge" button appears.
2. Click "Merge" → modal opens with title input.
3. Enter "Neon Sonata" → click "Create Project".
4. **Folder check**: Open Finder → navigate to `~/Music/MaestroOS/` → verify `Neon_Sonata/` folder was created.
5. **DB check**: Open `maestro.db` in a SQLite viewer:
   - `projects` table should have one row with `title = "Neon Sonata"`, `current_stage_id = 2`.
   - `project_snippets` table should have rows linking the project to the selected snippets.
6. **Navigation**: After creation, the app should navigate to the Projects view.
7. **Edge cases**:
   - Try creating a project with an empty name → error message should appear.
   - Try creating a project with special characters in the name → folder name should be sanitized.
