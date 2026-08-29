import './index.css'

import React from 'react'
import ReactDOM from 'react-dom/client'

import { About } from '@/components/About'
import { Splash } from '@/components/Splash'
import { isAboutWindow, isSplashWindow } from '@/lib/desktop'

import App from './App'

const splash = isSplashWindow()
const about = isAboutWindow()

if (splash) {
  document.documentElement.classList.add('splash')
}

const view = about ? <About /> : splash ? <Splash /> : <App />

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>{view}</React.StrictMode>,
)
