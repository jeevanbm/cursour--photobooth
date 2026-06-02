import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { CapturePage } from './pages/CapturePage'
import { PrintStationPage } from './pages/PrintStationPage'
import './styles/booth.css'

function Home() {
  return (
    <AppShell
      title="Professional event photobooth"
      subtitle="Capture on any device. Print and archive strips from your laptop."
    >
      <div className="home-grid">
        <Link to="/capture" className="feature-card feature-card-primary">
          <span className="feature-icon" aria-hidden>
            ◉
          </span>
          <h2>Capture booth</h2>
          <p>iPad, iPhone, or Android — tap a frame and shoot four photos.</p>
          <span className="feature-cta">Open capture →</span>
        </Link>
        <Link to="/station" className="feature-card">
          <span className="feature-icon" aria-hidden>
            ⎙
          </span>
          <h2>Print station</h2>
          <p>Laptop connected to your DNP printer. Gallery, queue, and re-print.</p>
          <span className="feature-cta">Open station →</span>
        </Link>
      </div>
      <ul className="home-steps">
        <li>
          <strong>1</strong> Guest picks a frame and takes photos
        </li>
        <li>
          <strong>2</strong> Strip saves to the cloud automatically
        </li>
        <li>
          <strong>3</strong> Laptop prints 2×6 and keeps every strip in history
        </li>
      </ul>
    </AppShell>
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
