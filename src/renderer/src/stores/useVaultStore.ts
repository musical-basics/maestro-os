import { create } from 'zustand'
import type { Snippet } from '../../../shared/types'

interface VaultState {
  snippets: Snippet[]
  selectedIds: Set<string>
  isLoading: boolean
  fetchSnippets: () => Promise<void>
  addSnippet: (snippet: Snippet) => void
  removeSnippet: (id: string) => void
  updateSnippetInStore: (snippet: Snippet) => void
  toggleSelect: (id: string) => void
  clearSelection: () => void
  selectAll: () => void
}

export const useVaultStore = create<VaultState>((set, get) => ({
  snippets: [],
  selectedIds: new Set<string>(),
  isLoading: false,

  fetchSnippets: async () => {
    set({ isLoading: true })
    try {
      const snippets = await window.api.getSnippets()
      set({ snippets, isLoading: false })
    } catch (err) {
      console.error('Failed to fetch snippets:', err)
      set({ isLoading: false })
    }
  },

  addSnippet: (snippet) => {
    set((state) => ({ snippets: [snippet, ...state.snippets] }))
  },

  removeSnippet: (id) => {
    set((state) => ({
      snippets: state.snippets.filter((s) => s.id !== id),
      selectedIds: (() => {
        const next = new Set(state.selectedIds)
        next.delete(id)
        return next
      })()
    }))
  },

  updateSnippetInStore: (snippet) => {
    set((state) => ({
      snippets: state.snippets.map((s) => (s.id === snippet.id ? snippet : s))
    }))
  },

  toggleSelect: (id) => {
    set((state) => {
      const next = new Set(state.selectedIds)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return { selectedIds: next }
    })
  },

  clearSelection: () => set({ selectedIds: new Set() }),

  selectAll: () => {
    const allIds = get().snippets.map((s) => s.id)
    set({ selectedIds: new Set(allIds) })
  }
}))
