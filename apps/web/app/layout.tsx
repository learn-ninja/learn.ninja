import type { Metadata } from "next"
import { Geist_Mono, Inter } from "next/font/google"

import "katex/dist/katex.min.css"
import "@workspace/ui/globals.css"
import "./site.css"
import { AgentationToolbar } from "@/components/agentation-toolbar"
import { ClientRouter } from "@/components/site/client-router"
import { ThemeProvider } from "@/components/theme-provider"
import { SITE } from "@/lib/site"
import { cn } from "@workspace/ui/lib/utils"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} · ${SITE.tagline}`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  // Lesson pages extend this through shareMetadata(), with their URL and language.
  openGraph: { siteName: SITE.name, type: "website", locale: "en_US" },
  // Published lessons set their own, without the maker's handle.
  twitter: { card: "summary_large_image", creator: SITE.maker },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        inter.variable,
        geistMono.variable,
        "font-sans antialiased"
      )}
    >
      <body>
        <ThemeProvider>
          <ClientRouter>{children}</ClientRouter>
        </ThemeProvider>
        {/* Visual feedback for Claude Code; renders nothing outside development. */}
        <AgentationToolbar />
      </body>
    </html>
  )
}
