import { useState, useEffect } from 'react'
import Globe from './components/Globe'
import Sidebar from './components/Sidebar'
import MarketClock from './components/MarketClock'
import LeftSidebar from './components/LeftSidebar'
import RightPanel from './components/RightPanel'
import './index.css'

function App() {
  const [selectedExchange, setSelectedExchange] = useState(null);
  const [theme, setTheme] = useState('dark');
  const [mapMode, setMapMode] = useState('3d');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      {/* 3-D / 2-D Globe fills entire background */}
      <Globe onExchangeSelect={setSelectedExchange} mapMode={mapMode} />

      {/* Top nav bar */}
      <MarketClock />

      {/* Theme toggle */}
      <button
        className="theme-toggle"
        onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
        aria-label="Toggle theme"
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>

      {/* Map mode toggle */}
      <button
        className="map-mode-toggle"
        onClick={() => setMapMode(m => m === '3d' ? '2d' : '3d')}
        aria-label="Toggle map mode"
        title={mapMode === '3d' ? 'Switch to 2D map' : 'Switch to 3D globe'}
      >
        {mapMode === '3d' ? '🗺️' : '🌐'}
        <span className="map-mode-toggle__label">{mapMode === '3d' ? '2D' : '3D'}</span>
      </button>

      {/* Smart left sidebar — collapsible */}
      <LeftSidebar />

      {/* Right markets grid — always visible */}
      <RightPanel />

      {/* Right details panel — appears on exchange click (overlays RightPanel) */}
      <Sidebar exchange={selectedExchange} onClose={() => setSelectedExchange(null)} />
    </div>
  )
}

export default App
