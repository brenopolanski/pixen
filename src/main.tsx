import './styles/globals.css'

import React from 'react'
import ReactDOM from 'react-dom/client'

import { App } from './App'
import { About } from './components/About'
import { Splash } from './components/Splash'
import { isAboutWindow, isSplashWindow } from './lib/desktop'
import { applyDocumentTheme, readSettings } from './lib/settings'

const splash = isSplashWindow()
const about = isAboutWindow()

applyDocumentTheme(readSettings().theme)

if (splash) {
  document.documentElement.classList.add('splash')
}

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
