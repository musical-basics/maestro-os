# Product Requirements Document: Maestro OS (Mac App)

---

## 1. Product Overview & Objective
| Field | Detail |
|-------|--------|
| **Product Name** | Maestro OS (Temporary Name) |
| **Core Philosophy** | A musician's brain is for creating, not project managing. |
| **Primary Goal** | A local-first macOS ERP (Enterprise Resource Planning) tool for musicians that organizes raw audio/MIDI snippets, merges them into Projects, and tracks them through a rigid 15-stage production pipeline. |
| **Core Mechanism** | The app does NOT host large audio files. It uses local file system access to link, track, and watch local `.logicx`, `.sib`, `.wav`, and `.mp4` files on the user's hard drive. |

---

## 2. Core App Objects
### 2.1 The Vault (Snippets)
- The holding pen for unassigned ideas (Voice Memos, MIDI loops, short Sibelius files).
- Snippets can be tagged by Key, BPM, and Mood.
- **Crucial Feature:** Multiple Snippets can be merged to birth a single "Project."

### 2.2 Projects
- The main entity representing a song or piece.
- Always exists in one of the **15 Pipeline Stages**.
- Contains a local directory watcher (e.g., binds to a specific Finder folder where all assets for that piece live).

### 2.3 The Pipeline Stages (State Machine)
1. Idea (Vault)
2. Half-Finished Composition
3. Completed Composition (Sheet Music/MIDI locked)
4. Practicing (Instrumental mastery)
5. Recording (Tracking audio)
6. Audio Editing (Quantizing, comping)
7. Mixing
8. Mastering
9. Video Recording (Performance capture)
10. Video Editing (Syncing mastered audio to video)
11. Thumbnail Creation
12. Description & Metadata Writing
13. Social Media Assets (Shorts/Reels cutdowns)
14. Scheduled/Uploading
15. Released

---

## 3. Core Engine: "Asset Gates" & AI Studio Manager
- **Asset Gates:** The app prevents a project from advancing to Stage 7 (Mixing) unless a bounced `.wav` file has been linked to Stage 6 (Editing). 
- **AI Studio Manager:** A daily dashboard that reads the local database and tells the user exactly what small action is needed today to unblock a project (e.g., *"You have 3 pieces stuck in 'Practicing'. Spend 20 minutes on the B-section of Nocturne No. 4 today."*).