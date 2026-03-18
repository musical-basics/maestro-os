# Stack & Dependencies: Maestro OS (macOS Local-First)

## 🏗 Core Architecture
* **Desktop Framework:** Electron + Vite
  * *Why:* Electron gives the app native access to the macOS file system via Node.js (`fs`, `path`). Vite ensures hot-reloading is lightning fast during development. Your AI agents (Antigravity/Cursor) know Electron perfectly.
* **Frontend:** React + Tailwind CSS
  * *Why:* Rapid UI development. Tailwind is perfect for building a sleek, dark-mode native Mac aesthetic (matching Logic Pro or Final Cut).
* **Database (Local):** `better-sqlite3`
  * *Why:* Since it's a Mac app tracking local file paths (`/Users/name/Music/...`), the database should live locally on the user's machine. Zero latency, no internet required, and completely private.
* **Database (Cloud - Optional Sync):** Supabase
  * *Why:* Used strictly for user authentication, subscription billing (Stripe integration), and backing up the lightweight SQLite metadata so they don't lose their project states if their Mac dies.

## 🛠 File System & Native Dependencies
* **Local File Access:** Node.js `fs` & `chokidar`
  * *Why:* `chokidar` is a file-watching library. If the user edits a Logic file, the app instantly detects the "Last Modified" timestamp change and marks the project as "Actively worked on today."
* **Audio Playback:** `howler.js` (or native HTML5 Audio)
  * *Why:* For instant playback of local Snippets directly in the Vault without opening iTunes/Music.
* **State Management:** `zustand`
  * *Why:* To manage the complex UI states of the 15-stage pipeline drag-and-drop interface.