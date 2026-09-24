import './styles/globals.css'

import React from 'react'
import ReactDOM from 'react-dom/client'

import { About } from '@/components/windows/About'
import { Splash } from '@/components/windows/Splash'
import { isAboutWindow, isSplashWindow } from '@/lib/desktop'
import { applyDocumentTheme, readSettings } from '@/lib/settings'

import { App } from './App'

const splash = isSplashWindow()
const about = isAboutWindow()

applyDocumentTheme(readSettings().theme)

const renderView = () => {
  if (about) {
    return <About />
  }

  if (splash) {
    return <Splash />
  }

  return <App />
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>{renderView()}</React.StrictMode>,
)
