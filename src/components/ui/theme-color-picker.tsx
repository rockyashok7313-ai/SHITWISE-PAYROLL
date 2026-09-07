"use client"

import * as React from "react"
import { Palette, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useThemeColor, THEME_COLORS, THEME_COLOR_SWATCHES, type ThemeColorName } from "@/components/providers/theme-color-provider"

const LABELS: Record<ThemeColorName, string> = {
  purple: "Purple",
  blue: "Blue",
  green: "Green",
  teal: "Teal",
  orange: "Orange",
  red: "Red",
}

export function ThemeColorPicker({ className }: { className?: string }) {
  const { themeColor, setThemeColor } = useThemeColor()
  const [mounted, setMounted] = React.useState(false)

  // Same reasoning as ThemeToggle: the real value is only known client-side
  // (it comes from localStorage), so the swatch shown before mount is a
  // fixed placeholder rather than something that could mismatch the server
  // render.
  React.useEffect(() => setMounted(true), [])
  const activeColor = mounted ? themeColor : "purple"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className={cn("w-9 h-9", className)} aria-label="Change theme color">
          <span
            className="w-4 h-4 rounded-full border border-border/50"
            style={{ backgroundColor: THEME_COLOR_SWATCHES[activeColor] }}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Palette className="w-3.5 h-3.5" /> Theme Color
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {THEME_COLORS.map((color) => (
          <DropdownMenuItem
            key={color}
            onClick={() => setThemeColor(color)}
            className="cursor-pointer gap-2"
          >
            <span
              className="w-4 h-4 rounded-full border border-border/50 shrink-0"
              style={{ backgroundColor: THEME_COLOR_SWATCHES[color] }}
            />
            <span className="flex-1">{LABELS[color]}</span>
            {mounted && themeColor === color && <Check className="w-3.5 h-3.5 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
