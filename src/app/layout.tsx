import type {Metadata} from 'next';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/700.css';
import './globals.css';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { ThemeColorProvider } from '@/components/providers/theme-color-provider';

export const metadata: Metadata = {
  title: 'ShiftWise Payroll',
  description: 'Precision payroll for 9-hour and 12-hour shifts',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // suppressHydrationWarning: next-themes sets the class on <html> before React
  // hydrates, so the server/client class attribute differs by design.
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..700&family=Inter:wght@100..900&display=swap" rel="stylesheet" />
        {/* Mirrors next-themes' own no-flash approach, for the independent
            theme-color pick (see ThemeColorProvider): apply it to <html>
            synchronously, before first paint, instead of waiting for React
            to hydrate and read localStorage itself. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var c=localStorage.getItem('theme-color');if(c&&c!=='purple'&&['blue','green','teal','orange','red'].indexOf(c)!==-1){document.documentElement.setAttribute('data-theme-color',c);}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="font-body antialiased bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <ThemeColorProvider>
            {children}
          </ThemeColorProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
