import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { isExtension } from './utils/platform'

if (isExtension) {
  document.documentElement.classList.add('is-extension');
  document.body.classList.add('is-extension');
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

