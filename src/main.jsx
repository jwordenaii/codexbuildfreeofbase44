import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/ws.css'
import PinGate from './PinGate.jsx'
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PinGate>
      <App />
    </PinGate>
  </React.StrictMode>
)
