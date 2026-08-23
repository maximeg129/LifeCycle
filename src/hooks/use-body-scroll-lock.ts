"use client"

import { useEffect } from 'react'

/**
 * Locks <body> scroll while `locked` is true, using position:fixed rather
 * than relying on overflow:hidden.
 *
 * Radix Dialog already locks body scroll via react-remove-scroll, but that
 * mechanism works by intercepting `touchmove` in JS and calling
 * preventDefault() — on iOS Chrome (and other non-Safari WKWebView
 * browsers), that interception isn't always honored, so the touch falls
 * through and scrolls the page behind the modal instead of the modal's own
 * scrollable content. position:fixed removes <body> from the scrollable
 * flow entirely, so there's nothing left for a stray touch to grab — no
 * matter how the browser handles the JS-level prevention.
 *
 * Uses setProperty(..., 'important') because Radix's own lock injects a
 * `body[data-scroll-locked] { position: relative !important }` rule, which
 * would otherwise win over a plain inline style.
 */
export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return

    const scrollY = window.scrollY
    const { style } = document.body

    style.setProperty('position', 'fixed', 'important')
    style.setProperty('top', `-${scrollY}px`, 'important')
    style.setProperty('left', '0', 'important')
    style.setProperty('right', '0', 'important')

    return () => {
      style.removeProperty('position')
      style.removeProperty('top')
      style.removeProperty('left')
      style.removeProperty('right')
      window.scrollTo(0, scrollY)
    }
  }, [locked])
}
