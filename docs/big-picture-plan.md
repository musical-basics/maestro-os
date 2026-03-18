Maestro OS: 40-Step Implementation Plan
Phase 1: Project Setup & Core Architecture
Objective: Scaffold the local-first macOS desktop environment and frontend tooling.

Initialize Application: Scaffold an Electron + Vite + React + TypeScript boilerplate. Ensure Vite hot-reloading is configured. [Ref: Stack & Dependencies.md -> Core Architecture]

Install Core Dependencies: Install better-sqlite3, chokidar, howler.js, zustand, and tailwindcss. [Ref: Stack & Dependencies.md -> File System & Native Dependencies]

Configure Styling: Set up Tailwind CSS. Establish a global dark-mode theme to perfectly mimic a native macOS aesthetic (similar to Logic Pro/Final Cut). [Ref: Stack & Dependencies.md -> Frontend]

Setup IPC Bridge: Configure Electron's main.ts and preload.ts with strict contextIsolation. Expose Node.js fs (file system) and path securely to the frontend via a typed window.api. [Ref: Stack & Dependencies.md -> Desktop Framework]

Scaffold App Shell: Create the core React layout with a persistent sidebar navigating to three primary views: Dashboard (Studio Manager), Vault (Snippets), and Projects. [Ref: PRD.md -> 2. Core App Objects]

Phase 2: Database Initialization & Typings
Objective: Build the offline SQLite database and establish strict full-stack type safety.

Define TypeScript Interfaces: Create a shared types.ts file exporting the exact Snippet, Project, and ProjectAsset interfaces. [Ref: Database Schema & Data Structure.md -> 1. Core TypeScript Interfaces]

Initialize SQLite: Configure better-sqlite3 in the Electron Main process to create a local .db file in the user's protected macOS application data directory. [Ref: Stack & Dependencies.md -> Database (Local)]

Create Core Tables: Write SQL initialization scripts to create the snippets and projects tables. [Ref: Database Schema & Data Structure.md -> 2. SQLite Tables]

Create Relational Tables: Write SQL scripts to create the project_snippets (Many-to-Many junction), pipeline_stages, and project_assets tables. [Ref: Database Schema & Data Structure.md -> 2. SQLite Tables]

Seed Pipeline Stages: Create a database seed script to populate the pipeline_stages lookup table with the 15 rigid stages and their specific gate_requirements (e.g., .wav, .logicx, NULL). [Ref: PRD.md -> 2.3 The Pipeline Stages]

Phase 3: The Vault & Snippet Ingestion
Objective: Handle the holding pen for unassigned creative ideas and local file ingestion.

State Management: Initialize a zustand store to manage global UI routing and cache fetched Vault Snippets. [Ref: Stack & Dependencies.md -> State Management]

Build Vault UI: Create the Vault React view, displaying a grid/list of unassigned ideas with badges for Key, BPM, and Mood. [Ref: PRD.md -> 2.1 The Vault]

Native Drag & Drop: Implement an HTML5 dropzone in the Vault that accepts audio/MIDI files natively dragged from macOS Finder. [Ref: User Flow & Sequence Logic.md -> 1. The "Idea to Project" Flow]

Snippet Ingestion Logic: Write the IPC handler to catch dropped files, extract their absolute local paths, generate a UUID (Node.crypto), and insert a record into the snippets SQLite table. [Ref: Database Schema & Data Structure.md -> Table: snippets]

Audio Playback Integration: Implement howler.js (or native HTML5 Audio) in the Vault to allow instant playback of local audio Snippets without opening iTunes. [Ref: Stack & Dependencies.md -> Audio Playback]

Phase 4: Project Creation & Folder Generation
Objective: Implement the Snippet merging flow and automate macOS directory generation.

Snippet Multi-Select UI: Build UI state in the Vault to allow users to click and select multiple Snippets simultaneously. [Ref: User Flow & Sequence Logic.md -> 1. The "Idea to Project" Flow]

Merge Trigger & Modal: Create the "Merge into New Project" button and a modal to prompt the user for a new Project Title (e.g., "Neon Sonata"). [Ref: User Flow & Sequence Logic.md -> 1. The "Idea to Project" Flow]

Folder Automation (fs): Write a Node.js script in the Main process to automatically generate a master local folder for the project on the user's hard drive (e.g., ~/Music/MaestroOS/[Project_Name]/). [Ref: User Flow & Sequence Logic.md -> 1. The "Idea to Project" Flow]

Project DB Transaction: Insert the new Project record into SQLite (saving the master_directory path), and set current_stage_id to 2 (Half-Finished Composition). [Ref: Database Schema & Data Structure.md -> Table: projects]

Snippet Linking: Insert records into the project_snippets junction table to permanently link the selected Snippet UUIDs to the newly birthed Project. [Ref: Database Schema & Data Structure.md -> Table: project_snippets]

Phase 5: The 15-Stage Pipeline UI
Objective: Visualize the project lifecycle via a rigid visual state machine.

Projects List UI: Build the Projects tab to display a list/grid of all active compositions and their relative last_touched_at time. [Ref: PRD.md -> 2.2 Projects]

Project Detail UI: Build the individual Project View, visually laying out the 15-stage state machine as a vertical timeline or Kanban. [Ref: PRD.md -> 2.3 The Pipeline Stages]

Stage Rendering Logic: Implement visual differentiation for locked (green/completed), active (current stage_id), and future (disabled) stages based on the database. [Ref: User Flow & Sequence Logic.md -> 2. The Daily "Studio Manager" Flow]

Stage Dropzones: Create file dropzones exclusively on the currently active pipeline stage in the UI. [Ref: User Flow & Sequence Logic.md -> 2. The Daily "Studio Manager" Flow]

Native App Launching: Add an "Open File" button next to linked assets that uses Electron's shell.openPath() to launch .logicx or .sib files in their default macOS applications. [Ref: User Flow & Sequence Logic.md -> 3. The "File Watcher" Flow]

Phase 6: Asset Gates & Drag-and-Drop Constraints
Objective: Enforce the rule engine to unlock pipeline progression.

Gate Requirement Validation: Write frontend and IPC validation to ensure dropped files match the current stage's gate_requirement (e.g., rejecting .logicx if a .wav is required). [Ref: PRD.md -> 3. Core Engine]

Asset Linkage (DB): If validation passes, write the IPC method to link the file path to the project and insert a record into the project_assets table. [Ref: Database Schema & Data Structure.md -> Table: project_assets]

Unlock Next Stage: Upon successful asset linkage, execute a SQLite update on the projects table by incrementing current_stage_id by 1 to unlock the next stage. [Ref: User Flow & Sequence Logic.md -> 2. The Daily "Studio Manager" Flow]

Conceptual Stages Handling: Add a manual "Mark as Complete" button for conceptual stages (like Stage 4: Practicing) that have a NULL gate requirement, allowing progression without file uploads. [Ref: Database Schema & Data Structure.md -> Table: pipeline_stages]

State Syncing: Emit an IPC event to update the frontend zustand store so the UI immediately reflects the newly unlocked stage without requiring a window refresh.

Phase 7: Background Watchers & Automation
Objective: Eliminate manual timestamp tracking by watching local macOS files passively.

Chokidar Initialization: Instantiate chokidar in the Electron main process to run silently in the background. [Ref: Stack & Dependencies.md -> Local File Access]

Dynamic Watcher Subscription: Configure chokidar to automatically watch all active master_directory paths and individual linked project_assets loaded from SQLite. [Ref: PRD.md -> 2.2 Projects]

Timestamp Detection: Write the event listener for chokidar's change event to detect when a user hits "Save" (e.g., Cmd+S inside Logic Pro) on a tracked file. [Ref: User Flow & Sequence Logic.md -> 3. The "File Watcher" Flow]

Last Touched DB Update: When a file change is detected, execute a SQLite update to instantly change the last_touched_at timestamp for the parent Project to CURRENT_TIMESTAMP. [Ref: User Flow & Sequence Logic.md -> 3. The "File Watcher" Flow]

Watcher Memory Management: Ensure chokidar watchers are properly added or removed when projects are created, deleted, or when the app is closed to prevent memory leaks.

Phase 8: AI Studio Manager Dashboard & Cloud Sync
Objective: Build the daily bottleneck notification system and prepare for release.

State Evaluation Query: Write the CheckProjectStates() SQLite query to fetch all projects, evaluating their current_stage_id against their last_touched_at timestamp. [Ref: User Flow & Sequence Logic.md -> 2. The Daily "Studio Manager" Flow]

Dashboard UI: Build the daily "Studio Manager" dashboard landing page to display the output of CheckProjectStates(). [Ref: PRD.md -> 3. Core Engine]

AI Bottleneck Logic: Implement the algorithm to generate human-readable actionable prompts (e.g., "Neon Sonata was mastered 3 days ago, link a Video file to unblock Stage 9"). Filter out projects that were touched today. [Ref: PRD.md -> 3. Core Engine]

Cloud Sync/Auth: Integrate Supabase strictly for user authentication, Stripe billing, and a lightweight JSON backup of the SQLite metadata (ensuring NO heavy local audio files are synced). [Ref: Stack & Dependencies.md -> Database (Cloud)]

App Packaging: Configure electron-builder in package.json to package the React frontend, Electron backend, and compiled SQLite binaries into a deployable, standalone macOS .dmg and .app.