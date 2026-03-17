'use client'

import { useState, useEffect } from 'react'

export function useTheme() {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'))
  }, [])

  const setTheme = (dark: boolean) => {
    const html = document.documentElement
    if (dark) {
      html.classList.add('dark')
      localStorage.setItem('lifecycle-theme', 'dark')
    } else {
      html.classList.remove('dark')
      localStorage.setItem('lifecycle-theme', 'light')
    }
    setIsDark(dark)
  }

  const toggleTheme = () => setTheme(!isDark)

  return { isDark, setTheme, toggleTheme }
}
