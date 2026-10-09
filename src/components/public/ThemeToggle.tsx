"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"
import { Toggle } from "@/components/animate-ui/components/radix/toggle"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  // Tema hanya diketahui di client; server & hydration render placeholder berukuran sama
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )

  if (!mounted) {
    return <span aria-hidden="true" className="inline-block size-9" />
  }

  // resolvedTheme (bukan theme) agar mode "system" tetap dibaca dengan benar
  const isDark = resolvedTheme === "dark"

  return (
    <Toggle
      pressed={isDark}
      onPressedChange={(pressed) => setTheme(pressed ? "dark" : "light")}
      className="text-muted-foreground hover:text-foreground"
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
      {/* Nama aksesibel untuk tombol; aria-label tidak diteruskan ke <button> oleh wrapper animate-ui */}
      <span className="sr-only">{isDark ? "Beralih ke mode terang" : "Beralih ke mode gelap"}</span>
    </Toggle>
  )
}
