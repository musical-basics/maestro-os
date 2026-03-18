# Phase 6: Asset Gates & Drag-and-Drop Constraints

> **Goal:** Enforce the rule engine that governs pipeline progression. Files dropped on the active stage are validated against the `gate_requirement`, linked as project assets, and cause the project to advance to the next stage. Conceptual stages get a "Mark as Complete" button instead.
>
> **Depends on:** Phase 5 (pipeline UI with `PipelineStageRow` rendering active/locked/completed states) + Phase 2 (DAO with `linkAsset`, `updateProjectStage`).

---

## Step 1 — Build the Stage Dropzone Component

### What to do

Create `src/components/StageDropzone.tsx`:

```tsx
import { useState, useCallback } from 'react';
import { useProjectStore } from '../stores/useProjectStore';
import type { PipelineStage } from '../shared/types';

interface Props {
  stage: PipelineStage;
  projectId: string;
}

export function StageDropzone({ stage, projectId }: Props) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
    setError(null);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    setError(null);

    const files = Array.from(e.dataTransfer.files);

    if (files.length === 0) return;
    if (files.length > 1) {
      setError('Please drop only one file at a time.');
      return;
    }

    const file = files[0];
    const filePath = (file as any).path as string;

    if (!filePath) {
      setError('Could not read the file path. Try dragging from Finder.');
      return;
    }

    // ─── GATE VALIDATION ───────────────────────────────────────
    // Extract the file extension and compare against the gate requirement
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    const requiredExtension = stage.gateRequirement;

    if (!requiredExtension) {
      setError('This is a conceptual stage — use "Mark as Complete" instead.');
      return;
    }

    if (fileExtension !== requiredExtension) {
      setError(
        `Wrong file type. This stage requires a "${requiredExtension}" file, ` +
        `but you dropped a "${fileExtension}" file.`
      );
      return;
    }

    // ─── LINK ASSET + ADVANCE STAGE ────────────────────────────
    setIsProcessing(true);
    try {
      // 1. Link the file as a project asset
      const asset = await window.api.linkAsset({
        projectId,
        stageId: stage.id,
        filePath,
        assetType: fileExtension,
        lastModified: new Date().toISOString(),
      });

      // 2. Advance the project to the next stage
      const nextStageId = stage.id + 1;
      if (nextStageId <= 15) {
        await window.api.updateProjectStage(projectId, nextStageId);
      }

      // 3. Update local state so UI reflects changes immediately
      const store = useProjectStore.getState();
      store.addLocalAsset(asset);

      // Re-fetch the project to get the updated current_stage_id
      await store.fetchProjectDetail(projectId);
      // Also refresh the project list for the progress bar
      await store.fetchProjects();

    } catch (err) {
      console.error('Failed to link asset:', err);
      setError('Failed to link the file. Check the console for details.');
    } finally {
      setIsProcessing(false);
    }
  }, [stage, projectId]);

  return (
    <div
      className={`stage-dropzone ${isDragOver ? 'stage-dropzone--active' : ''} ${error ? 'stage-dropzone--error' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isProcessing ? (
        <p className="stage-dropzone__text">Linking file…</p>
      ) : error ? (
        <p className="stage-dropzone__error">{error}</p>
      ) : (
        <p className="stage-dropzone__text">
          Drop a <code>{stage.gateRequirement}</code> file here to unlock the next stage
        </p>
      )}
    </div>
  );
}
```

### Critical details
- **Single file only** — one asset per stage drop. If the user drops multiple files, show an error.
- **Extension validation** — the file's extension must exactly match `stage.gateRequirement`. Reject mismatches with a clear error message telling the user what's expected.
- **State sync** — after linking, re-fetch the project detail so the timeline UI immediately reflects the new stage. No window refresh required.
- **Stage 15 guard** — don't try to advance past stage 15 (terminal state).

---

## Step 2 — Wire the Asset IPC Handlers

### What to do

In `electron/main.ts`, replace the Phase 1 TODO stubs:

```typescript
import { linkAsset, getAssetsByProject, updateProjectStage } from './database/dao';

ipcMain.handle('asset:link', async (_event, data) => {
  return linkAsset(data);
});

ipcMain.handle('asset:getByProject', async (_event, projectId: string) => {
  return getAssetsByProject(projectId);
});

ipcMain.handle('project:updateStage', async (_event, id: string, stageId: number) => {
  updateProjectStage(id, stageId);
});
```

---

## Step 3 — Integrate StageDropzone into PipelineStageRow

### What to do

In `src/components/PipelineStageRow.tsx`, replace the dropzone placeholder with the real `StageDropzone` component:

```tsx
import { StageDropzone } from './StageDropzone';

// Replace this block in the JSX:
// OLD:
// {status === 'active' && stage.gateRequirement && (
//   <div className="pipeline-row__dropzone-placeholder">...</div>
// )}

// NEW:
{status === 'active' && stage.gateRequirement && (
  <StageDropzone stage={stage} projectId={projectId} />
)}
```

---

## Step 4 — Implement "Mark as Complete" for Conceptual Stages

### What to do

Conceptual stages have `gateRequirement = null` (stages 1, 2, 4, 12, 14, 15). These cannot accept file drops — instead, the user clicks a button to manually advance.

In `src/components/PipelineStageRow.tsx`, replace the disabled button:

```tsx
// Replace the disabled "Mark as Complete" button:
{status === 'active' && !stage.gateRequirement && (
  <button
    className="btn btn--secondary pipeline-row__complete-btn"
    onClick={async () => {
      const nextStageId = stage.id + 1;
      if (nextStageId <= 15) {
        await window.api.updateProjectStage(projectId, nextStageId);
        const store = useProjectStore.getState();
        await store.fetchProjectDetail(projectId);
        await store.fetchProjects();
      }
    }}
  >
    ✓ Mark as Complete
  </button>
)}
```

### Critical details
- For **Stage 15 (Released)**: This is the terminal state. When a project reaches Stage 15, there is no "Mark as Complete" button — the project is done. You can add a "🎉 Released!" badge instead.
- For **Stage 1 (Idea/Vault)**: Projects start at Stage 2 after merging (per Phase 4), so Stage 1 should always appear as "completed". But the logic handles it correctly regardless.

---

## Step 5 — State Syncing via IPC Events (Real-Time UI Updates)

### What to do

This step ensures the frontend stays in sync without requiring explicit re-fetches after every change.

**In `electron/main.ts`**, after updating the stage, emit an event to the renderer:

```typescript
ipcMain.handle('project:updateStage', async (_event, id: string, stageId: number) => {
  updateProjectStage(id, stageId);
  // Notify renderer that project state changed
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send('project:stageChanged', { projectId: id, newStageId: stageId });
  });
});
```

**In `electron/preload.ts`**, expose a listener:
```typescript
onProjectStageChanged: (callback: (data: { projectId: string; newStageId: number }) => void) => {
  ipcRenderer.on('project:stageChanged', (_event, data) => callback(data));
  // Return cleanup function
  return () => {
    ipcRenderer.removeAllListeners('project:stageChanged');
  };
},
```

**In `src/types/electron.d.ts`:**
```typescript
onProjectStageChanged: (callback: (data: { projectId: string; newStageId: number }) => void) => () => void;
```

**In `ProjectDetailView.tsx`**, subscribe to the event:
```tsx
useEffect(() => {
  const cleanup = window.api.onProjectStageChanged(async (data) => {
    if (data.projectId === activeProject?.id) {
      await fetchProjectDetail(data.projectId);
    }
  });
  return cleanup;
}, [activeProject?.id]);
```

### Why
This pattern (main process → renderer event) is important for Phase 7 (file watchers), where background events in the main process need to update the UI without the user initiating an action.

---

## Files Created / Modified

| Action | File | Purpose |
|--------|------|---------|
| NEW | `src/components/StageDropzone.tsx` | Gate-validated file dropzone for active pipeline stages |
| MODIFY | `src/components/PipelineStageRow.tsx` | Replace placeholder dropzone + wire "Mark as Complete" |
| MODIFY | `electron/main.ts` | Wire `asset:link`, `asset:getByProject`, `project:updateStage` + emit stage change events |
| MODIFY | `electron/preload.ts` | Add `onProjectStageChanged` listener bridge |
| MODIFY | `src/types/electron.d.ts` | Add `onProjectStageChanged` type |
| MODIFY | `src/views/ProjectDetailView.tsx` | Subscribe to `project:stageChanged` events |

## Verification

1. `pnpm dev` → open a project → Stage 2 should be active.
2. **Gate pass**: Drag a valid file (e.g., `.mid` if stage 3 requires `.mid`) onto the active stage dropzone → stage should advance, timeline should update immediately.
3. **Gate reject**: Drag a `.txt` file onto the active stage → error message: "Wrong file type. This stage requires a '.mid' file, but you dropped a '.txt' file."
4. **Conceptual stage**: Advance to Stage 4 (Practicing, gate = null) → "Mark as Complete" button should appear. Click it → Stage 5 becomes active.
5. **Persistence**: Quit the app, reopen → the project should show the same stage and linked assets.
6. **Open linked file**: Click the "↗" button on a linked asset → the file opens in its native macOS app (Logic Pro, Sibelius, etc.).
