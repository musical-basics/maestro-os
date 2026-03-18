# Phase 3: The Vault & Snippet Ingestion

> **Goal:** Build the Vault UI for browsing unassigned creative ideas, implement native drag-and-drop from Finder to ingest audio/MIDI files, wire up the IPC handlers to persist snippets to SQLite, and enable instant audio playback.
>
> **Depends on:** Phase 1 (app shell with VaultView placeholder) + Phase 2 (database with snippets table + DAO layer).

---

## Step 1 — Create the Vault Zustand Store

### What to do

Create `src/stores/useVaultStore.ts`:

```typescript
import { create } from 'zustand';
import type { Snippet } from '../shared/types';

interface VaultState {
  snippets: Snippet[];
  isLoading: boolean;
  selectedSnippetIds: Set<string>;   // For multi-select (used in Phase 4)
  currentlyPlayingId: string | null; // For audio playback

  // Actions
  fetchSnippets: () => Promise<void>;
  addSnippet: (snippet: Snippet) => void;
  removeSnippet: (id: string) => void;
  toggleSelectSnippet: (id: string) => void;
  clearSelection: () => void;
  setCurrentlyPlaying: (id: string | null) => void;
}

export const useVaultStore = create<VaultState>((set, get) => ({
  snippets: [],
  isLoading: false,
  selectedSnippetIds: new Set(),
  currentlyPlayingId: null,

  fetchSnippets: async () => {
    set({ isLoading: true });
    try {
      const snippets = await window.api.getSnippets();
      set({ snippets, isLoading: false });
    } catch (err) {
      console.error('Failed to fetch snippets:', err);
      set({ isLoading: false });
    }
  },

  addSnippet: (snippet) => {
    set((state) => ({ snippets: [snippet, ...state.snippets] }));
  },

  removeSnippet: (id) => {
    set((state) => ({
      snippets: state.snippets.filter((s) => s.id !== id),
      selectedSnippetIds: (() => {
        const next = new Set(state.selectedSnippetIds);
        next.delete(id);
        return next;
      })(),
    }));
  },

  toggleSelectSnippet: (id) => {
    set((state) => {
      const next = new Set(state.selectedSnippetIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedSnippetIds: next };
    });
  },

  clearSelection: () => set({ selectedSnippetIds: new Set() }),

  setCurrentlyPlaying: (id) => set({ currentlyPlayingId: id }),
}));
```

### Why
This store manages all Vault UI state: the snippet list, loading states, multi-selection (needed for Phase 4 "Merge into Project"), and which snippet is currently playing audio.

---

## Step 2 — Wire Up the IPC Handlers (Main Process)

### What to do

In `electron/main.ts`, replace the Phase 1 TODO stubs for snippets with real implementations using the DAO:

```typescript
import { getAllSnippets, createSnippet, deleteSnippet } from './database/dao';

ipcMain.handle('snippet:getAll', async () => {
  return getAllSnippets();
});

ipcMain.handle('snippet:create', async (_event, data) => {
  return createSnippet(data);
});

ipcMain.handle('snippet:delete', async (_event, id: string) => {
  deleteSnippet(id);
});
```

### Critical detail
The DAO functions (from Phase 2) handle UUID generation, SQL execution, and snake_case→camelCase mapping. The IPC handlers are thin pass-throughs.

---

## Step 3 — Build the Vault UI

### What to do

Replace the placeholder `src/views/VaultView.tsx` with the full implementation:

```tsx
// src/views/VaultView.tsx
import { useEffect } from 'react';
import { useVaultStore } from '../stores/useVaultStore';
import { SnippetCard } from '../components/SnippetCard';
import { DropZone } from '../components/DropZone';

export function VaultView() {
  const { snippets, isLoading, fetchSnippets, selectedSnippetIds } = useVaultStore();

  useEffect(() => {
    fetchSnippets();
  }, []);

  return (
    <div className="vault-view">
      {/* Page Header */}
      <div className="vault-header">
        <h1>The Vault</h1>
        <p className="vault-subtitle">
          Your holding pen for unassigned ideas. Drag files from Finder to add them.
        </p>
        {selectedSnippetIds.size >= 2 && (
          <button className="merge-button">
            Merge {selectedSnippetIds.size} Snippets into New Project
          </button>
        )}
      </div>

      {/* Drag-and-Drop Zone */}
      <DropZone />

      {/* Snippet Grid */}
      {isLoading ? (
        <div className="loading-state">Loading snippets…</div>
      ) : snippets.length === 0 ? (
        <div className="empty-state">
          <p>No snippets yet. Drag audio or MIDI files here to get started.</p>
        </div>
      ) : (
        <div className="snippet-grid">
          {snippets.map((snippet) => (
            <SnippetCard key={snippet.id} snippet={snippet} />
          ))}
        </div>
      )}
    </div>
  );
}
```

### Layout requirements
- **snippet-grid**: CSS Grid, 3–4 columns depending on window width (`grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))`).
- **merge-button**: Only visible when 2+ snippets are selected. Styled with `var(--color-accent)`. This button's click handler is wired in Phase 4.
- **empty-state**: Centered, dimmed text with a visual hint to drag files.

---

## Step 4 — Build the SnippetCard Component

### What to do

Create `src/components/SnippetCard.tsx`:

```tsx
import type { Snippet } from '../shared/types';
import { useVaultStore } from '../stores/useVaultStore';

interface Props {
  snippet: Snippet;
}

export function SnippetCard({ snippet }: Props) {
  const { selectedSnippetIds, toggleSelectSnippet, currentlyPlayingId, setCurrentlyPlaying } =
    useVaultStore();
  const isSelected = selectedSnippetIds.has(snippet.id);
  const isPlaying = currentlyPlayingId === snippet.id;

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation(); // Don't trigger selection
    if (isPlaying) {
      setCurrentlyPlaying(null);
      // Stop howler playback (see Step 6)
    } else {
      setCurrentlyPlaying(snippet.id);
      // Start howler playback (see Step 6)
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await window.api.deleteSnippet(snippet.id);
    useVaultStore.getState().removeSnippet(snippet.id);
  };

  return (
    <div
      className={`snippet-card ${isSelected ? 'snippet-card--selected' : ''}`}
      onClick={() => toggleSelectSnippet(snippet.id)}
    >
      {/* Selection Indicator */}
      <div className="snippet-card__checkbox">
        {isSelected && <span>✓</span>}
      </div>

      {/* Title */}
      <h3 className="snippet-card__title">{snippet.title}</h3>

      {/* Metadata Badges */}
      <div className="snippet-card__badges">
        <span className="badge badge--type">{snippet.assetType}</span>
        {snippet.keySignature && (
          <span className="badge badge--key">{snippet.keySignature}</span>
        )}
        {snippet.bpm && (
          <span className="badge badge--bpm">{snippet.bpm} BPM</span>
        )}
      </div>

      {/* Actions */}
      <div className="snippet-card__actions">
        {snippet.assetType === 'audio' && (
          <button onClick={handlePlay} className="btn-icon">
            {isPlaying ? '⏹' : '▶'}
          </button>
        )}
        <button onClick={handleDelete} className="btn-icon btn-icon--danger">
          🗑
        </button>
      </div>
    </div>
  );
}
```

### Styling requirements
- Card appearance: `var(--color-bg-tertiary)` background, subtle border, rounded corners.
- Selected state: `var(--color-accent)` border, slight background tint.
- Badges: Small pills styled with `var(--font-mono)` for key/BPM, colored badges for asset type.
- Hover: Slight elevation or brightness change.

---

## Step 5 — Implement Native Drag-and-Drop from Finder

### What to do

Create `src/components/DropZone.tsx`:

```tsx
import { useState, useCallback } from 'react';
import { useVaultStore } from '../stores/useVaultStore';

// Map file extensions to the assetType enum
function getAssetType(extension: string): 'audio' | 'midi' | 'sheet' | 'video' | null {
  const ext = extension.toLowerCase();
  const audioExts = ['.m4a', '.wav', '.mp3', '.aiff', '.aac', '.flac', '.ogg'];
  const midiExts = ['.mid', '.midi'];
  const sheetExts = ['.sib', '.musx', '.musicxml', '.mxl', '.pdf'];
  const videoExts = ['.mp4', '.mov', '.avi', '.mkv'];

  if (audioExts.includes(ext)) return 'audio';
  if (midiExts.includes(ext)) return 'midi';
  if (sheetExts.includes(ext)) return 'sheet';
  if (videoExts.includes(ext)) return 'video';
  return null;
}

// Extract a human-readable title from a filename
function titleFromFilename(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, '')       // Remove extension
    .replace(/[_-]+/g, ' ')        // Replace underscores/dashes with spaces
    .replace(/\b\w/g, (c) => c.toUpperCase()); // Title Case
}

export function DropZone() {
  const [isDragOver, setIsDragOver] = useState(false);
  const addSnippet = useVaultStore((s) => s.addSnippet);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
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

    const files = Array.from(e.dataTransfer.files);

    for (const file of files) {
      // In Electron, dropped files expose their full local path via .path
      const filePath = (file as any).path as string;
      if (!filePath) {
        console.warn('Dropped file has no local path — ignoring:', file.name);
        continue;
      }

      // Get file extension
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      const assetType = getAssetType(ext);

      if (!assetType) {
        console.warn(`Unsupported file type "${ext}" for file: ${file.name}. Skipping.`);
        // TODO: Show a toast notification to the user
        continue;
      }

      // Create a snippet record via IPC
      const snippet = await window.api.createSnippet({
        title: titleFromFilename(file.name),
        filePath,
        assetType,
        keySignature: null,  // User can edit later
        bpm: null,            // User can edit later
      });

      // Optimistically add to the store
      addSnippet(snippet);
    }
  }, [addSnippet]);

  return (
    <div
      className={`dropzone ${isDragOver ? 'dropzone--active' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="dropzone__content">
        <span className="dropzone__icon">📁</span>
        <p>Drag audio, MIDI, or video files here from Finder</p>
      </div>
    </div>
  );
}
```

### Critical details
- **`(file as any).path`**: In Electron, the HTML5 File object has an extra `.path` property containing the full local filesystem path. This is how we get `/Users/name/Music/memo.m4a`. This does NOT work in a regular browser.
- **Asset type validation**: Only `audio`, `midi`, `sheet`, and `video` types are accepted (from `docs/data-structure.md`). Unknown extensions are rejected.
- **Title generation**: Auto-generates a readable title from the filename. Users can edit it later.

---

## Step 6 — Implement Audio Playback (Howler.js)

### What to do

Create `src/lib/audioPlayer.ts`:

```typescript
import { Howl } from 'howler';

let currentHowl: Howl | null = null;

export function playAudio(filePath: string, onEnd: () => void): void {
  // Stop any currently playing audio first
  stopAudio();

  // Howler needs a file:// URL for local files
  const fileUrl = `file://${filePath}`;

  currentHowl = new Howl({
    src: [fileUrl],
    html5: true,    // Use HTML5 Audio for streaming local files (avoids Web Audio decode issues)
    onend: () => {
      currentHowl = null;
      onEnd();
    },
    onloaderror: (_id, err) => {
      console.error('Howler load error:', err);
      currentHowl = null;
      onEnd();
    },
  });

  currentHowl.play();
}

export function stopAudio(): void {
  if (currentHowl) {
    currentHowl.stop();
    currentHowl.unload();
    currentHowl = null;
  }
}

export function isPlaying(): boolean {
  return currentHowl?.playing() ?? false;
}
```

### Then update `SnippetCard.tsx`

Replace the play/stop TODO comments in the `handlePlay` function:

```typescript
import { playAudio, stopAudio } from '../lib/audioPlayer';

const handlePlay = (e: React.MouseEvent) => {
  e.stopPropagation();
  if (isPlaying) {
    stopAudio();
    setCurrentlyPlaying(null);
  } else {
    setCurrentlyPlaying(snippet.id);
    playAudio(snippet.filePath, () => {
      setCurrentlyPlaying(null);
    });
  }
};
```

### Critical details
- **`html5: true`** is mandatory for local files — Web Audio API cannot decode some formats like `.m4a` directly.
- **`file://` prefix** is required for Howler to resolve local paths.
- **Single playback** — clicking play on snippet B while snippet A is playing stops A first.

---

## Files Created / Modified

| Action | File | Purpose |
|--------|------|---------|
| NEW | `src/stores/useVaultStore.ts` | Vault state: snippets, selection, playback tracking |
| NEW | `src/components/DropZone.tsx` | Drag-and-drop ingestion from Finder |
| NEW | `src/components/SnippetCard.tsx` | Individual snippet card with badges, selection, playback |
| NEW | `src/lib/audioPlayer.ts` | Howler.js audio playback singleton |
| MODIFY | `src/views/VaultView.tsx` | Replace placeholder with full Vault layout |
| MODIFY | `electron/main.ts` | Wire snippet IPC stubs to DAO functions |

## Verification

1. `pnpm dev` → Navigate to Vault view.
2. **Drag test**: Drag a `.m4a` file from Finder into the Vault dropzone → a SnippetCard should appear with a generated title and "audio" badge.
3. **Persistence test**: Quit the app completely (`Cmd+Q`), reopen → the snippet should still appear (fetched from SQLite).
4. **Playback test**: Click the play button on an audio snippet → audio should play. Click again → audio stops.
5. **Rejection test**: Drag a `.txt` or `.zip` file → it should be silently ignored (check console for warning).
6. **Multi-select test**: Click two snippet cards → both should show selected state. The "Merge" button should appear in the header.
