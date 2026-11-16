import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

const DEV_SW_CLEARED_KEY = 'cuboards_dev_sw_cleared'

async function boot() {
  if (import.meta.env.DEV && 'serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations()
    const hadWorker = registrations.length > 0 || Boolean(navigator.serviceWorker.controller)
    await Promise.all(registrations.map((registration) => registration.unregister()))
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
    }
    if (hadWorker && sessionStorage.getItem(DEV_SW_CLEARED_KEY) !== '1') {
      sessionStorage.setItem(DEV_SW_CLEARED_KEY, '1')
      window.location.reload()
      return
    }
  } else if (!import.meta.env.DEV) {
    registerSW({ immediate: true })
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void boot()
