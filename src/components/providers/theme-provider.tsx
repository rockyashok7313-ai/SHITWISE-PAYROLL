"use client"

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Wraps next-themes. Toggles the `.dark` class on <html> (Tailwind is
 * configured with darkMode: 'class'), persists the choice, and supports a
 * "system" option that follows the OS setting.
 */
export function ThemeProvider({ children, ...props }: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
