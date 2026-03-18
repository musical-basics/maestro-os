# User Flow & Sequence Logic

---

## 1. The "Idea to Project" Flow (Snippet Merging)
1. User drags two Voice Memos (`.m4a`) directly from Finder into the **Vault** tab of the app.
2. The app copies/links the file paths and creates two Snippet records in local SQLite.
3. User selects both Snippets and clicks **"Merge into New Project"**.
4. The app prompts the user for a Project Name (e.g., "Neon Sonata").
5. The app automatically creates a new master folder on the user's hard drive (`~/Music/MaestroOS/Neon_Sonata/`).
6. The app moves the project to **Stage 2: Half-Finished Composition**.

---

## 2. The Daily "Studio Manager" Flow
1. User opens the app at 9:00 AM.
2. The app runs a `CheckProjectStates()` function against the SQLite database.
3. The app displays the **Dashboard**, highlighting bottlenecks based on the 15-stage pipeline constraints.
    * *Notification:* "The audio for 'Neon Sonata' was mastered 3 days ago, but no Video files are linked. Time to set up the camera."
4. User clicks on "Neon Sonata". 
5. The app opens the Project View, showing the 15 stages. Stages 1-8 are green (locked). Stage 9 (Video Recording) is active.
6. The user drags a `.mp4` file into the Stage 9 dropzone.
7. The app verifies the file type, links the path, and unlocks Stage 10 (Video Editing).

---

## 3. The "File Watcher" Automation Flow
1. User is in **Stage 6: Audio Editing** for a project.
2. They open the linked `.logicx` file via a button inside the app.
3. They work in Logic Pro for 2 hours and hit Save.
4. The background `chokidar` file watcher detects the timestamp change on the `.logicx` file.
5. The app automatically updates the "Last Touched" metadata for that project, preventing the AI Studio Manager from nagging them about it the next day.