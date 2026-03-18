import { useAppStore, type View } from '../stores/useAppStore'

const navItems: { id: View; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Studio Manager', icon: '🎛' },
  { id: 'vault', label: 'The Vault', icon: '📦' },
  { id: 'projects', label: 'Projects', icon: '🎵' }
]

export function Sidebar(): React.JSX.Element {
  const { currentView, setView } = useAppStore()

  return (
    <aside className="sidebar">
      <div className="sidebar__title">Maestro OS</div>
      <nav className="sidebar__nav">
        {navItems.map((item) => (
          <div
            key={item.id}
            className={`sidebar__item ${currentView === item.id ? 'sidebar__item--active' : ''}`}
            onClick={() => setView(item.id)}
          >
            <span className="sidebar__icon">{item.icon}</span>
            <span className="sidebar__label">{item.label}</span>
          </div>
        ))}
      </nav>
    </aside>
  )
}
