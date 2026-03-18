# Phase 5: The 15-Stage Pipeline UI

> **Goal:** Build the Projects list view and the individual Project detail view, visually rendering the 15-stage pipeline as a vertical timeline with locked/active/future states, file dropzones on the active stage, and a button to open linked files in their native macOS app.
>
> **Depends on:** Phase 4 (projects exist in DB) + Phase 2 (pipeline_stages seeded, DAO layer).

---

## Step 1 — Create the Projects Zustand Store

### What to do

Create `src/stores/useProjectStore.ts`:

```typescript
import { create } from 'zustand';
import type { Project, ProjectAsset, PipelineStage } from '../shared/types';

interface ProjectState {
  projects: Project[];
  isLoading: boolean;
  activeProject: Project | null;           // Currently viewed project
  activeProjectAssets: ProjectAsset[];     // Assets for the active project
  pipelineStages: PipelineStage[];         // All 15 stages (fetched once)

  // Actions
  fetchProjects: () => Promise<void>;
  fetchProjectDetail: (id: string) => Promise<void>;
  fetchPipelineStages: () => Promise<void>;
  setActiveProject: (project: Project | null) => void;
  updateLocalProject: (updated: Project) => void;
  addLocalAsset: (asset: ProjectAsset) => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  isLoading: false,
  activeProject: null,
  activeProjectAssets: [],
  pipelineStages: [],

  fetchProjects: async () => {
    set({ isLoading: true });
    try {
      const projects = await window.api.getProjects();
      set({ projects, isLoading: false });
    } catch (err) {
      console.error('Failed to fetch projects:', err);
      set({ isLoading: false });
    }
  },

  fetchProjectDetail: async (id: string) => {
    try {
      const [project, assets] = await Promise.all([
        window.api.getProject(id),
        window.api.getProjectAssets(id),
      ]);
      set({ activeProject: project, activeProjectAssets: assets });
    } catch (err) {
      console.error('Failed to fetch project detail:', err);
    }
  },

  fetchPipelineStages: async () => {
    try {
      const stages = await window.api.getStages();
      set({ pipelineStages: stages });
    } catch (err) {
      console.error('Failed to fetch pipeline stages:', err);
    }
  },

  setActiveProject: (project) => set({ activeProject: project, activeProjectAssets: [] }),

  updateLocalProject: (updated) => {
    set((state) => ({
      projects: state.projects.map((p) => (p.id === updated.id ? updated : p)),
      activeProject: state.activeProject?.id === updated.id ? updated : state.activeProject,
    }));
  },

  addLocalAsset: (asset) => {
    set((state) => ({
      activeProjectAssets: [...state.activeProjectAssets, asset],
    }));
  },
}));
```

### Also needed: `getStages` IPC method

Add to the IPC bridge chain:

**`electron/main.ts`:**
```typescript
import { getAllStages } from './database/dao';
ipcMain.handle('stage:getAll', async () => { return getAllStages(); });
```

**`electron/preload.ts`:**
```typescript
getStages: () => ipcRenderer.invoke('stage:getAll'),
```

**`src/types/electron.d.ts`:**
```typescript
getStages: () => Promise<import('../shared/types').PipelineStage[]>;
```

---

## Step 2 — Build the Projects List View

### What to do

Replace the placeholder `src/views/ProjectsView.tsx`:

```tsx
import { useEffect } from 'react';
import { useProjectStore } from '../stores/useProjectStore';
import { ProjectCard } from '../components/ProjectCard';

export function ProjectsView() {
  const { projects, isLoading, fetchProjects, activeProject, setActiveProject } =
    useProjectStore();

  useEffect(() => {
    fetchProjects();
  }, []);

  // If a project is selected, show the detail view instead
  if (activeProject) {
    return <ProjectDetailView />;
  }

  return (
    <div className="projects-view">
      <div className="projects-header">
        <h1>Projects</h1>
        <p className="projects-subtitle">
          {projects.length} active composition{projects.length !== 1 ? 's' : ''}
        </p>
      </div>

      {isLoading ? (
        <div className="loading-state">Loading projects…</div>
      ) : projects.length === 0 ? (
        <div className="empty-state">
          <p>No projects yet. Go to the Vault and merge some snippets to create one.</p>
        </div>
      ) : (
        <div className="project-list">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onClick={() => setActiveProject(project)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## Step 3 — Build the ProjectCard Component

### What to do

Create `src/components/ProjectCard.tsx`:

```tsx
import type { Project } from '../shared/types';

interface Props {
  project: Project;
  onClick: () => void;
}

export function ProjectCard({ project, onClick }: Props) {
  // Calculate relative time for "last touched"
  const lastTouched = getRelativeTime(project.lastTouchedAt);

  return (
    <div className="project-card" onClick={onClick}>
      <div className="project-card__info">
        <h3 className="project-card__title">{project.title}</h3>
        <p className="project-card__stage">
          Stage {project.currentStageId}/15
        </p>
      </div>
      <div className="project-card__meta">
        <span className="project-card__last-touched">
          Last touched: {lastTouched}
        </span>
        {/* Visual progress bar */}
        <div className="project-card__progress">
          <div
            className="project-card__progress-fill"
            style={{ width: `${(project.currentStageId / 15) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// Helper: "2 hours ago", "3 days ago", etc.
function getRelativeTime(isoTimestamp: string): string {
  const now = Date.now();
  const then = new Date(isoTimestamp).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(isoTimestamp).toLocaleDateString();
}
```

### Styling requirements
- Card: Horizontal layout, `var(--color-bg-tertiary)` background, clickable with hover effect.
- Progress bar: Thin bar at the bottom, `var(--color-success)` fill for completed portion.
- Last touched: Dimmed text using `var(--color-text-secondary)`.

---

## Step 4 — Build the Project Detail View (Pipeline Timeline)

### What to do

Create `src/views/ProjectDetailView.tsx`:

```tsx
import { useEffect } from 'react';
import { useProjectStore } from '../stores/useProjectStore';
import { PipelineStageRow } from '../components/PipelineStageRow';

export function ProjectDetailView() {
  const {
    activeProject,
    activeProjectAssets,
    pipelineStages,
    fetchProjectDetail,
    fetchPipelineStages,
    setActiveProject,
  } = useProjectStore();

  useEffect(() => {
    if (activeProject) {
      fetchProjectDetail(activeProject.id);
    }
    if (pipelineStages.length === 0) {
      fetchPipelineStages();
    }
  }, [activeProject?.id]);

  if (!activeProject) return null;

  return (
    <div className="project-detail">
      {/* Back Button */}
      <button
        className="btn btn--ghost back-button"
        onClick={() => setActiveProject(null)}
      >
        ← Back to Projects
      </button>

      {/* Project Header */}
      <div className="project-detail__header">
        <h1>{activeProject.title}</h1>
        <p className="project-detail__subtitle">
          Stage {activeProject.currentStageId}/15 •
          Last touched: {activeProject.lastTouchedAt}
        </p>
      </div>

      {/* 15-Stage Pipeline Timeline */}
      <div className="pipeline-timeline">
        {pipelineStages.map((stage) => {
          const stageAssets = activeProjectAssets.filter(
            (a) => a.stageId === stage.id
          );
          let stageStatus: 'completed' | 'active' | 'locked';

          if (stage.id < activeProject.currentStageId) {
            stageStatus = 'completed';
          } else if (stage.id === activeProject.currentStageId) {
            stageStatus = 'active';
          } else {
            stageStatus = 'locked';
          }

          return (
            <PipelineStageRow
              key={stage.id}
              stage={stage}
              assets={stageAssets}
              status={stageStatus}
              projectId={activeProject.id}
            />
          );
        })}
      </div>
    </div>
  );
}
```

---

## Step 5 — Build the PipelineStageRow Component

### What to do

Create `src/components/PipelineStageRow.tsx`:

```tsx
import type { PipelineStage, ProjectAsset } from '../shared/types';

interface Props {
  stage: PipelineStage;
  assets: ProjectAsset[];
  status: 'completed' | 'active' | 'locked';
  projectId: string;
}

export function PipelineStageRow({ stage, assets, status, projectId }: Props) {
  const handleOpenFile = (filePath: string) => {
    window.api.openPath(filePath);
  };

  return (
    <div className={`pipeline-row pipeline-row--${status}`}>
      {/* Timeline connector (vertical line) */}
      <div className="pipeline-row__connector">
        <div className={`pipeline-row__dot pipeline-row__dot--${status}`}>
          {status === 'completed' && '✓'}
          {status === 'active' && stage.id}
          {status === 'locked' && stage.id}
        </div>
      </div>

      {/* Stage Content */}
      <div className="pipeline-row__content">
        <div className="pipeline-row__header">
          <h3 className="pipeline-row__title">{stage.stageName}</h3>
          {stage.gateRequirement && (
            <span className="pipeline-row__gate">
              Requires: {stage.gateRequirement}
            </span>
          )}
          {!stage.gateRequirement && status === 'active' && (
            <span className="pipeline-row__gate pipeline-row__gate--manual">
              Manual completion
            </span>
          )}
        </div>

        {/* Linked Assets (for completed/active stages) */}
        {assets.length > 0 && (
          <div className="pipeline-row__assets">
            {assets.map((asset) => (
              <div key={asset.id} className="asset-chip">
                <span className="asset-chip__name">
                  {asset.filePath.split('/').pop()}
                </span>
                <button
                  className="asset-chip__open"
                  onClick={() => handleOpenFile(asset.filePath)}
                  title="Open in default app"
                >
                  ↗
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Dropzone: ONLY on the currently active stage (built in Phase 6) */}
        {status === 'active' && stage.gateRequirement && (
          <div className="pipeline-row__dropzone-placeholder">
            Drop a <code>{stage.gateRequirement}</code> file here to unlock the next stage
          </div>
        )}

        {/* "Mark as Complete" button for conceptual stages (built in Phase 6) */}
        {status === 'active' && !stage.gateRequirement && (
          <button className="btn btn--secondary pipeline-row__complete-btn" disabled>
            Mark as Complete (Phase 6)
          </button>
        )}
      </div>
    </div>
  );
}
```

### Styling requirements — visual differentiation is critical

| Status | Dot Color | Row Opacity | Background |
|--------|-----------|-------------|------------|
| `completed` | `var(--color-success)` (green) with checkmark | Full (1.0) | Subtle green tint |
| `active` | `var(--color-accent)` (blue) pulsing glow | Full (1.0) | `var(--color-bg-tertiary)` |
| `locked` | `var(--color-text-secondary)` (gray) | Dimmed (0.5) | None |

The timeline should have a vertical line connecting all dots, creating a continuous visual flow.

---

## Step 6 — Native "Open File" Button

### What to do

The `handleOpenFile` function in `PipelineStageRow` already calls `window.api.openPath(filePath)`, which is wired to `shell.openPath()` in the main process (from Phase 1).

This means:
- Clicking the "↗" button on a `.logicx` asset → opens Logic Pro.
- Clicking it on a `.sib` asset → opens Sibelius.
- Clicking it on a `.mp4` asset → opens QuickTime/VLC.

**No additional code needed** — this was wired in Phase 1, Step 4.

---

## Files Created / Modified

| Action | File | Purpose |
|--------|------|---------|
| NEW | `src/stores/useProjectStore.ts` | Projects state: list, active project, assets, stages |
| NEW | `src/components/ProjectCard.tsx` | Project card with progress bar + relative time |
| NEW | `src/views/ProjectDetailView.tsx` | Project detail with 15-stage pipeline timeline |
| NEW | `src/components/PipelineStageRow.tsx` | Individual pipeline stage row (completed/active/locked) |
| MODIFY | `src/views/ProjectsView.tsx` | Replace placeholder, add detail view routing |
| MODIFY | `electron/main.ts` | Wire `stage:getAll` IPC handler |
| MODIFY | `electron/preload.ts` | Add `getStages` to bridge |
| MODIFY | `src/types/electron.d.ts` | Add `getStages` type |

## Verification

1. `pnpm dev` → Navigate to Projects view → project created in Phase 4 should appear as a card.
2. Click the project card → detail view opens with 15 stages.
3. **Visual check**: Stage 1 should be green (completed). Stage 2 (Half-Finished Composition) should be blue/active. Stages 3–15 should be gray/locked.
4. **Open file**: If any assets are linked, click the "↗" button → file opens in its native macOS app.
5. **Back button**: Click "← Back to Projects" → returns to the project list.
