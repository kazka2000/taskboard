import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AIProvider } from './context/AIContext';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AIProvider>
      <App />
    </AIProvider>
  </StrictMode>,
)
