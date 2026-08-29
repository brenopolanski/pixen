import './index.css'

import React from 'react'
import ReactDOM from 'react-dom/client'

import { Splash } from '@/components/Splash'
import { isSplashWindow } from '@/lib/desktop'

import App from './App'

const splash = isSplashWindow()

if (splash) {
  document.documentElement.classList.add('splash')
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>{splash ? <Splash /> : <App />}</React.StrictMode>,
)
