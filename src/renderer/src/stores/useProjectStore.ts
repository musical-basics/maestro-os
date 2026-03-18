import { create } from 'zustand'
import type { Project } from '../../../shared/types'

interface ProjectState {
  projects: Project[]
  activeProject: Project | null
  isLoading: boolean
  fetchProjects: () => Promise<void>
  setActiveProject: (project: Project | null) => void
  addProject: (project: Project) => void
  removeProject: (id: string) => void
  updateProjectInStore: (project: Project) => void
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  activeProject: null,
  isLoading: false,

  fetchProjects: async () => {
    set({ isLoading: true })
    try {
      const projects = await window.api.getProjects()
      set({ projects, isLoading: false })
    } catch (err) {
      console.error('Failed to fetch projects:', err)
      set({ isLoading: false })
    }
  },

  setActiveProject: (project) => set({ activeProject: project }),

  addProject: (project) => {
    set((state) => ({ projects: [project, ...state.projects] }))
  },

  removeProject: (id) => {
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      activeProject: state.activeProject?.id === id ? null : state.activeProject
    }))
  },

  updateProjectInStore: (project) => {
    set((state) => ({
      projects: state.projects.map((p) => (p.id === project.id ? project : p)),
      activeProject: state.activeProject?.id === project.id ? project : state.activeProject
    }))
  }
}))
