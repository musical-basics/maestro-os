import { create } from 'zustand'

export type View = 'dashboard' | 'vault' | 'projects'

interface AppState {
  currentView: View
  setView: (view: View) => void
}

export const useAppStore = create<AppState>((set) => ({
  currentView: 'dashboard',
  setView: (view) => set({ currentView: view })
}))
