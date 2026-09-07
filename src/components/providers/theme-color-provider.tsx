"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

/**
 * Independent from light/dark (that's next-themes, via ThemeProvider). This
 * picks WHICH Material 3 color scheme is active -- purple (default), blue,
 * green, teal, orange, or red -- each a real M3 "harmony" preset pulled from
 * Figma's Material 3 Design Kit (see globals.css's [data-theme-color] blocks),
 * not a hand-picked recolor. Applied via a data-theme-color attribute on
 * <html>, same mechanism next-themes uses for the .dark class, so both can
 * combine freely ([data-theme-color="blue"].dark selects blue-dark).
 */

export const THEME_COLORS = ["purple", "blue", "green", "teal", "orange", "red"] as const
export type ThemeColorName = typeof THEME_COLORS[number]

/** Swatch hex per theme, for the picker UI -- the light-mode primary token,
 *  same values baked into globals.css. */
export const THEME_COLOR_SWATCHES: Record<ThemeColorName, string> = {
  purple: "#6750A4",
  blue: "#485E92",
  green: "#376A3E",
  teal: "#006B60",
  orange: "#8D4F28",
  red: "#914B43",
}

const STORAGE_KEY = "theme-color"
const DEFAULT_COLOR: ThemeColorName = "purple"

interface ThemeColorContextValue {
  themeColor: ThemeColorName
  setThemeColor: (color: ThemeColorName) => void
}

const ThemeColorContext = createContext<ThemeColorContextValue | null>(null)

function applyThemeColor(color: ThemeColorName) {
  // Purple is the default :root/.dark values in globals.css directly, so it
  // doesn't need (and has no) a [data-theme-color="purple"] block -- clearing
  // the attribute falls back to those defaults, same visual result as having
  // one.
  if (color === DEFAULT_COLOR) {
    document.documentElement.removeAttribute("data-theme-color")
  } else {
    document.documentElement.setAttribute("data-theme-color", color)
  }
}

export function ThemeColorProvider({ children }: { children: ReactNode }) {
  const [themeColor, setThemeColorState] = useState<ThemeColorName>(DEFAULT_COLOR)

  // Runs once after mount to pick up whatever the inline script in the root
  // layout already applied synchronously (avoids a flash), and to sync React
  // state to match it.
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    const initial = (THEME_COLORS as readonly string[]).includes(stored ?? "")
      ? (stored as ThemeColorName)
      : DEFAULT_COLOR
    setThemeColorState(initial)
  }, [])

  const setThemeColor = (color: ThemeColorName) => {
    setThemeColorState(color)
    try {
      window.localStorage.setItem(STORAGE_KEY, color)
    } catch {
      // Private browsing / storage disabled -- theme still applies for this
      // page load, just won't persist. Not worth surfacing to the user.
    }
    applyThemeColor(color)
  }

  return (
    <ThemeColorContext.Provider value={{ themeColor, setThemeColor }}>
      {children}
    </ThemeColorContext.Provider>
  )
}

export function useThemeColor() {
  const ctx = useContext(ThemeColorContext)
  if (!ctx) throw new Error("useThemeColor must be used within ThemeColorProvider")
  return ctx
}
