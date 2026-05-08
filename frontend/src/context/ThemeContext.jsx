import { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext()

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('chat-theme')
    return saved ? saved === 'dark' : true  // default: dark
  })

  useEffect(() => {
    localStorage.setItem('chat-theme', isDark ? 'dark' : 'light')
  }, [isDark])

  const toggle = () => setIsDark(v => !v)

  // ── Color tokens ──────────────────────────────────────────
  const t = isDark ? {
    // Dark (WhatsApp dark — current)
    bg:            '#0b141a',
    bgPanel:       '#111b21',
    bgHeader:      '#202c33',
    bgInput:       '#2a3942',
    bgBubbleOut:   '#005c4b',
    bgBubbleIn:    '#202c33',
    bgContextMenu: '#233138',
    bgHover:       '#2a3942',
    bgBanner:      '#182229',
    bgDateBadge:   '#182229',
    border:        '#2a3942',
    borderSub:     '#1d282e',
    borderBadge:   '#2a3942',
    text:          '#e9edef',
    textSub:       '#8696a0',
    textTime:      'rgba(233,237,239,0.55)',
    textEdited:    'rgba(233,237,239,0.5)',
    textTick:      'rgba(233,237,239,0.6)',
    accent:        '#00a884',
    accentHover:   '#008f73',
    accentDisabled:'#3c4a54',
    onlineDot:     '#00a884',
    emojiTheme:    'dark',
  } : {
    // Light (WhatsApp light)
    bg:            '#efeae2',
    bgPanel:       '#f0f2f5',
    bgHeader:      '#f0f2f5',
    bgInput:       '#ffffff',
    bgBubbleOut:   '#d9fdd3',
    bgBubbleIn:    '#ffffff',
    bgContextMenu: '#ffffff',
    bgHover:       '#f5f6f6',
    bgBanner:      '#f0f2f5',
    bgDateBadge:   '#ffffff',
    border:        '#e9edef',
    borderSub:     '#e9edef',
    borderBadge:   '#e9edef',
    text:          '#111b21',
    textSub:       '#667781',
    textTime:      'rgba(17,27,33,0.55)',
    textEdited:    'rgba(17,27,33,0.5)',
    textTick:      'rgba(17,27,33,0.45)',
    accent:        '#00a884',
    accentHover:   '#008f73',
    accentDisabled:'#c5c5c5',
    onlineDot:     '#00a884',
    emojiTheme:    'light',
  }

  return (
    <ThemeContext.Provider value={{ isDark, toggle, t }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
