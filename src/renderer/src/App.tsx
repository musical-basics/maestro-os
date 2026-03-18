import { useAppStore } from './stores/useAppStore'
import { Sidebar } from './components/Sidebar'
import { DashboardView } from './views/DashboardView'
import { VaultView } from './views/VaultView'
import { ProjectsView } from './views/ProjectsView'

const viewMap = {
  dashboard: DashboardView,
  vault: VaultView,
  projects: ProjectsView
} as const

function App(): React.JSX.Element {
  const currentView = useAppStore((s) => s.currentView)
  const ViewComponent = viewMap[currentView]

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="app-main">
        <ViewComponent />
      </main>
    </div>
  )
}

export default App
