import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom'
import { CapturePage } from './pages/CapturePage'
import { PrintStationPage } from './pages/PrintStationPage'
import './styles/booth.css'

function Home() {
  return (
    <div className="page home-page">
      <h1>Event Photo Booth</h1>
      <p className="muted">Two-device setup: capture on tablet/phone, print on laptop.</p>
      <nav className="home-nav">
        <Link to="/capture" className="home-card">
          <strong>Capture</strong>
          <span>iPad · iPhone · Android</span>
        </Link>
        <Link to="/station" className="home-card">
          <strong>Print station</strong>
          <span>Laptop + DNP printer</span>
        </Link>
      </nav>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/capture" element={<CapturePage />} />
        <Route path="/station" element={<PrintStationPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
