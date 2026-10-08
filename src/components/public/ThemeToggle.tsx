"use client"

import * as React from "react"
import { useTheme } from "next-themes"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  // useEffect digunakan untuk mencegah hydration error
  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null // Return null atau skeleton saat server-side rendering
  }

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="absolute top-6 right-4 px-4 py-2 rounded-full transition ease-in bg-foreground text-primary-foreground dark:bg-primary-dark"
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  )
}