# Phase 8: AI Studio Manager Dashboard & Cloud Sync

> **Goal:** Build the daily "Studio Manager" dashboard that analyzes all projects, identifies bottlenecks, and generates actionable recommendations. Then wire optional Supabase cloud sync for auth, billing, and lightweight metadata backup. Finally, package the app for distribution.
>
> **Depends on:** All previous phases (especially Phase 7 for `last_touched_at` accuracy).

---

## Step 1 — Build the `CheckProjectStates()` Query

### What to do

Create `electron/database/studioManager.ts`:

```typescript
import { getDatabase } from './connection';

export interface ProjectStatus {
  projectId: string;
  projectTitle: string;
  currentStageId: number;
  currentStageName: string;
  gateRequirement: string | null;
  lastTouchedAt: string;
  daysSinceLastTouch: number;
  isStale: boolean;           // true if last_touched_at > 1 day ago
  isTouchedToday: boolean;    // true if touched within the last 24 hours
  recommendation: string;     // Human-readable action prompt
}

/**
 * Analyzes all active projects (not Released) and returns a status report
 * for each one, including AI-generated actionable recommendations.
 */
export function checkProjectStates(): ProjectStatus[] {
  const db = getDatabase();

  const rows = db.prepare(`
    SELECT
      p.id                    AS project_id,
      p.title                 AS project_title,
      p.current_stage_id      AS current_stage_id,
      ps.stage_name           AS current_stage_name,
      ps.gate_requirement     AS gate_requirement,
      p.last_touched_at       AS last_touched_at,
      CAST(
        (julianday('now') - julianday(p.last_touched_at)) AS INTEGER
      )                       AS days_since_last_touch
    FROM projects p
    JOIN pipeline_stages ps ON p.current_stage_id = ps.id
    WHERE p.current_stage_id < 15
    ORDER BY
      days_since_last_touch DESC,
      p.current_stage_id ASC
  `).all() as Array<{
    project_id: string;
    project_title: string;
    current_stage_id: number;
    current_stage_name: string;
    gate_requirement: string | null;
    last_touched_at: string;
    days_since_last_touch: number;
  }>;

  return rows.map((row) => {
    const daysSince = row.days_since_last_touch;
    const isTouchedToday = daysSince < 1;
    const isStale = daysSince >= 1;

    // Generate a human-readable recommendation based on the current stage and staleness
    const recommendation = generateRecommendation(
      row.project_title,
      row.current_stage_name,
      row.gate_requirement,
      daysSince,
      row.current_stage_id,
    );

    return {
      projectId: row.project_id,
      projectTitle: row.project_title,
      currentStageId: row.current_stage_id,
      currentStageName: row.current_stage_name,
      gateRequirement: row.gate_requirement,
      lastTouchedAt: row.last_touched_at,
      daysSinceLastTouch: daysSince,
      isStale,
      isTouchedToday,
      recommendation,
    };
  });
}

/**
 * Generates a human-readable, actionable prompt for a given project status.
 * The tone should be encouraging but specific — tell the user exactly
 * what one small action they can take today.
 */
function generateRecommendation(
  title: string,
  stageName: string,
  gateRequirement: string | null,
  daysSince: number,
  stageId: number,
): string {
  // If touched today, don't nag
  if (daysSince < 1) {
    return `Great work! You've been active on "${title}" today.`;
  }

  const daysText = daysSince === 1 ? '1 day' : `${daysSince} days`;

  // Recommendations based on stage type
  if (gateRequirement) {
    // File-gated stage — tell the user what file to create/link
    const actionMap: Record<string, string> = {
      '.mid': 'finish the MIDI composition and export a .mid file',
      '.logicx': 'open Logic Pro and work on the project file',
      '.wav': 'bounce a .wav export from your DAW',
      '.mp4': 'record or edit the video and export an .mp4',
      '.png': 'create a thumbnail image (.png)',
    };
    const specificAction = actionMap[gateRequirement] || `create a ${gateRequirement} file`;
    return `"${title}" has been stuck in "${stageName}" for ${daysText}. To unblock it: ${specificAction}, then drag it into the app.`;
  }

  // Conceptual stage — tell the user to mark it as done
  const conceptualActionMap: Record<number, string> = {
    1: 'review your idea and decide if it\'s worth developing',
    2: 'spend 20 minutes developing the composition further',
    4: 'practice the piece for 15–30 minutes today',
    12: 'write the description and fill in the metadata',
    14: 'schedule the upload and hit publish',
  };

  const action = conceptualActionMap[stageId] || `work on the "${stageName}" step`;
  return `"${title}" has been in "${stageName}" for ${daysText}. Today's micro-action: ${action}, then mark the stage as complete.`;
}
```

### Critical details
- **`julianday('now') - julianday(p.last_touched_at)`** — this is the SQLite way to calculate day differences.
- **Ordering**: Stalest projects first (most days since last touch), then by lowest stage. This means the most neglected, least-progressed projects appear at the top.
- **Released projects (Stage 15) are excluded** — they don't need attention.
- **Projects touched today are included** but shown as "Great work!" with no nagging.

---

## Step 2 — Wire the Dashboard IPC Handler

### What to do

**In `electron/main.ts`:**
```typescript
import { checkProjectStates } from './database/studioManager';

ipcMain.handle('dashboard:getProjectStates', async () => {
  return checkProjectStates();
});
```

**In `electron/preload.ts`:**
```typescript
getProjectStates: () => ipcRenderer.invoke('dashboard:getProjectStates'),
```

**In `src/types/electron.d.ts`:**
```typescript
// Import the ProjectStatus type or inline it
interface ProjectStatus {
  projectId: string;
  projectTitle: string;
  currentStageId: number;
  currentStageName: string;
  gateRequirement: string | null;
  lastTouchedAt: string;
  daysSinceLastTouch: number;
  isStale: boolean;
  isTouchedToday: boolean;
  recommendation: string;
}

// Add to ElectronAPI:
getProjectStates: () => Promise<ProjectStatus[]>;
```

---

## Step 3 — Build the Dashboard UI

### What to do

Replace the placeholder `src/views/DashboardView.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { useProjectStore } from '../stores/useProjectStore';

// Inline the type (or import from shared)
interface ProjectStatus {
  projectId: string;
  projectTitle: string;
  currentStageId: number;
  currentStageName: string;
  gateRequirement: string | null;
  lastTouchedAt: string;
  daysSinceLastTouch: number;
  isStale: boolean;
  isTouchedToday: boolean;
  recommendation: string;
}

export function DashboardView() {
  const [statuses, setStatuses] = useState<ProjectStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setIsLoading(true);
    try {
      const data = await window.api.getProjectStates();
      setStatuses(data);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const staleProjects = statuses.filter((s) => s.isStale);
  const activeToday = statuses.filter((s) => s.isTouchedToday);

  const handleProjectClick = (projectId: string) => {
    // Navigate to the project detail view
    const project = useProjectStore.getState().projects.find((p) => p.id === projectId);
    if (project) {
      useProjectStore.getState().setActiveProject(project);
      useAppStore.getState().setView('projects');
    }
  };

  if (isLoading) return <div className="loading-state">Analyzing your projects…</div>;

  return (
    <div className="dashboard-view">
      {/* Header */}
      <div className="dashboard-header">
        <h1>Studio Manager</h1>
        <p className="dashboard-subtitle">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      {/* Summary Stats */}
      <div className="dashboard-stats">
        <div className="stat-card">
          <span className="stat-card__number">{statuses.length}</span>
          <span className="stat-card__label">Active Projects</span>
        </div>
        <div className="stat-card stat-card--warning">
          <span className="stat-card__number">{staleProjects.length}</span>
          <span className="stat-card__label">Need Attention</span>
        </div>
        <div className="stat-card stat-card--success">
          <span className="stat-card__number">{activeToday.length}</span>
          <span className="stat-card__label">Touched Today</span>
        </div>
      </div>

      {/* Bottleneck Notifications */}
      {staleProjects.length > 0 && (
        <div className="dashboard-section">
          <h2 className="dashboard-section__title">⚠️ Bottlenecks</h2>
          <div className="bottleneck-list">
            {staleProjects.map((status) => (
              <div
                key={status.projectId}
                className="bottleneck-card"
                onClick={() => handleProjectClick(status.projectId)}
              >
                <div className="bottleneck-card__header">
                  <h3>{status.projectTitle}</h3>
                  <span className={`bottleneck-card__badge ${
                    status.daysSinceLastTouch >= 7 ? 'badge--danger' :
                    status.daysSinceLastTouch >= 3 ? 'badge--warning' :
                    'badge--info'
                  }`}>
                    {status.daysSinceLastTouch}d idle
                  </span>
                </div>
                <p className="bottleneck-card__stage">
                  Stage {status.currentStageId}: {status.currentStageName}
                </p>
                <p className="bottleneck-card__recommendation">
                  💡 {status.recommendation}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Today */}
      {activeToday.length > 0 && (
        <div className="dashboard-section">
          <h2 className="dashboard-section__title">✅ Active Today</h2>
          <div className="active-list">
            {activeToday.map((status) => (
              <div
                key={status.projectId}
                className="active-card"
                onClick={() => handleProjectClick(status.projectId)}
              >
                <h3>{status.projectTitle}</h3>
                <p>Stage {status.currentStageId}: {status.currentStageName}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {statuses.length === 0 && (
        <div className="empty-state">
          <p>No active projects. Head to the Vault to create your first composition.</p>
        </div>
      )}
    </div>
  );
}
```

### Styling requirements
- **stat-card**: Three cards in a horizontal row, each with a big number and a label. Use `var(--color-warning)` for "Need Attention", `var(--color-success)` for "Touched Today".
- **bottleneck-card**: Clickable card with warm background tint. Badge colors: red for 7+ days idle, amber for 3–6 days, blue for 1–2 days.
- **recommendation text**: The 💡 line should stand out — slightly different background, clear font.
- **Clicking a bottleneck card** navigates to that project's detail view.

---

## Step 4 — Cloud Sync with Supabase (Optional)

### What to do

> [!IMPORTANT]
> Supabase integration is **optional** and for future-proofing. The app works 100% offline without it. Do NOT block the rest of the app on this step.

#### 4a. Install Supabase client
```bash
pnpm add @supabase/supabase-js
```

#### 4b. Create `electron/cloud/supabaseClient.ts`
```typescript
import { createClient } from '@supabase/supabase-js';

// These values come from environment variables or a config file
// They should NOT be hardcoded in source code
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const supabase = SUPABASE_URL
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null; // null means cloud sync is disabled

export function isCloudEnabled(): boolean {
  return supabase !== null;
}
```

#### 4c. Use Cases for Supabase (from `docs/stack.md`)

| Use Case | What gets synced | What does NOT get synced |
|----------|-----------------|------------------------|
| **Authentication** | User email, session token | — |
| **Stripe Billing** | Subscription status | Payment details (handled by Stripe) |
| **Metadata Backup** | Project titles, stages, timestamps, snippet metadata | Audio files, MIDI files, video files, Logic Pro files — NOTHING heavy |

#### 4d. Backup Logic

Create `electron/cloud/metadataSync.ts`:

```typescript
import { supabase, isCloudEnabled } from './supabaseClient';
import { getDatabase } from '../database/connection';

/**
 * Backs up lightweight project metadata to Supabase.
 * This is a JSON blob — NOT individual rows.
 * Called periodically (e.g., every 30 minutes) or on app quit.
 */
export async function backupMetadata(userId: string): Promise<void> {
  if (!isCloudEnabled()) return;

  const db = getDatabase();

  const projects = db.prepare('SELECT * FROM projects').all();
  const snippets = db.prepare('SELECT * FROM snippets').all();
  const projectSnippets = db.prepare('SELECT * FROM project_snippets').all();
  const projectAssets = db.prepare('SELECT * FROM project_assets').all();
  // Note: pipeline_stages are static and don't need backup

  const backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    projects,
    snippets,
    projectSnippets,
    projectAssets,
  };

  const { error } = await supabase!
    .from('user_backups')
    .upsert({
      user_id: userId,
      metadata: JSON.stringify(backup),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

  if (error) {
    console.error('[CloudSync] Backup failed:', error);
  } else {
    console.log('[CloudSync] Metadata backup successful');
  }
}

/**
 * Restores project metadata from a Supabase backup.
 * Used when the user sets up the app on a new Mac.
 */
export async function restoreMetadata(userId: string): Promise<boolean> {
  if (!isCloudEnabled()) return false;

  const { data, error } = await supabase!
    .from('user_backups')
    .select('metadata')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    console.error('[CloudSync] Restore failed:', error);
    return false;
  }

  // Parse and rehydrate the local SQLite database
  const backup = JSON.parse(data.metadata);
  // ... insert rows into local tables using transactions
  // (Implementation left to the agent — standard INSERT OR IGNORE pattern)

  console.log('[CloudSync] Metadata restore successful');
  return true;
}
```

#### 4e. Supabase SQL for backup table

> [!CAUTION]
> Do NOT run this migration directly. Provide it to the user. Per user rules, the user must run all database migrations manually.

```sql
-- Supabase SQL (run manually by the user):
CREATE TABLE user_backups (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  metadata JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own backups"
  ON user_backups FOR ALL
  USING (auth.uid() = user_id);
```

---

## Step 5 — App Packaging with electron-builder

### What to do

#### 5a. Install electron-builder
```bash
pnpm add -D electron-builder
```

#### 5b. Configure in `package.json`
```json
{
  "build": {
    "appId": "com.maestroos.app",
    "productName": "Maestro OS",
    "mac": {
      "category": "public.app-category.music",
      "target": ["dmg", "zip"],
      "icon": "build/icon.icns",
      "hardenedRuntime": true,
      "gatekeeperAssess": false
    },
    "dmg": {
      "title": "Maestro OS",
      "iconSize": 100,
      "contents": [
        { "x": 130, "y": 220 },
        { "x": 410, "y": 220, "type": "link", "path": "/Applications" }
      ]
    },
    "files": [
      "dist/**/*",
      "electron/**/*",
      "!node_modules/.cache"
    ],
    "extraResources": [],
    "asar": true
  },
  "scripts": {
    "build:mac": "pnpm build && electron-builder --mac"
  }
}
```

#### 5c. Handle `better-sqlite3` native module
`better-sqlite3` is a native Node.js addon — it must be compiled for the correct Electron version:

```bash
pnpm add -D electron-rebuild
```

Add to `package.json` scripts:
```json
{
  "scripts": {
    "postinstall": "electron-rebuild -f -w better-sqlite3"
  }
}
```

#### 5d. Build the app
```bash
pnpm run build:mac
```

This produces:
- `dist/Maestro OS-x.y.z.dmg` — the distributable installer
- `dist/Maestro OS-x.y.z-mac.zip` — the zipped app bundle

---

## Files Created / Modified

| Action | File | Purpose |
|--------|------|---------|
| NEW | `electron/database/studioManager.ts` | `CheckProjectStates()` query + recommendation generator |
| NEW | `electron/cloud/supabaseClient.ts` | Supabase client singleton (optional) |
| NEW | `electron/cloud/metadataSync.ts` | Backup/restore logic for cloud metadata |
| MODIFY | `src/views/DashboardView.tsx` | Full Studio Manager dashboard with bottleneck cards |
| MODIFY | `electron/main.ts` | Wire `dashboard:getProjectStates` IPC handler |
| MODIFY | `electron/preload.ts` | Add `getProjectStates` to bridge |
| MODIFY | `src/types/electron.d.ts` | Add `ProjectStatus` interface + `getProjectStates` type |
| MODIFY | `package.json` | Add electron-builder config + build scripts |

## Verification

### Dashboard
1. `pnpm dev` → app opens on Dashboard view.
2. With zero projects → shows "No active projects" empty state.
3. Create 2+ projects in the Vault, advance them to different stages.
4. Return to Dashboard → should show stat cards (Active, Need Attention, Touched Today).
5. Projects not touched today should appear as bottleneck cards with specific recommendations.
6. Click a bottleneck card → navigates to that project's detail view.

### Cloud Sync (if configured)
7. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` environment variables.
8. Call `backupMetadata()` → check Supabase `user_backups` table for the JSON blob.
9. Clear local SQLite → call `restoreMetadata()` → local data should be restored.

### App Packaging
10. Run `pnpm run build:mac` → a `.dmg` file should be generated in `dist/`.
11. Open the `.dmg` → drag to Applications → launch from Applications → app works without `pnpm dev`.
