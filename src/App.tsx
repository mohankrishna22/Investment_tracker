import { HashRouter, Link, Navigate, NavLink, Route, Routes } from 'react-router-dom'
import { StoreProvider, useStore } from './lib/store'
import { useTheme } from './lib/theme'
import Dashboard from './pages/Dashboard'
import VentureDetail from './pages/VentureDetail'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import { currencySymbol } from './lib/format'

function Shell() {
  const { data, updateSettings } = useStore()
  const dark = useTheme(data.settings.theme)

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          <span className="brand-mark">{currencySymbol(data.settings)}</span>
          Investment Tracker
        </Link>
        <nav className="nav">
          <NavLink to="/" end>
            Home
          </NavLink>
          <NavLink to="/reports">Reports</NavLink>
          <NavLink to="/settings">Settings</NavLink>
        </nav>
        <div className="topbar-spacer" />
        <button
          className="btn-ghost btn-sm"
          title="Toggle light and dark"
          onClick={() => updateSettings({ theme: dark ? 'light' : 'dark' })}
        >
          {dark ? '☀️' : '🌙'}
        </button>
      </header>
      <Routes>
        <Route path="/" element={<Dashboard dark={dark} />} />
        <Route path="/venture/:id" element={<VentureDetail dark={dark} />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      {/* Hash routing keeps deep links working on static hosts like GitHub Pages. */}
      <HashRouter>
        <Shell />
      </HashRouter>
    </StoreProvider>
  )
}
