import Link from "next/link"

import { LinkButton } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { SITE } from "@/lib/site"

import { FooterNinja } from "./footer-ninja"
import { InstagramLogo, TikTokLogo, XLogo, YouTubeLogo } from "./social-icons"

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/docs", label: "Docs" },
      { href: "/docs#install", label: "Install" },
    ],
  },
  {
    title: "Developers",
    links: [
      { href: "/docs/reference/api", label: "API" },
      { href: "/llms.txt", label: "llms.txt" },
      { href: "/contributors", label: "Contributors" },
    ],
  },
]

const SOCIALS = [
  { name: "X", href: SITE.xUrl, Logo: XLogo },
  { name: "TikTok", href: SITE.tiktokUrl, Logo: TikTokLogo },
  { name: "YouTube", href: SITE.youtubeUrl, Logo: YouTubeLogo },
  { name: "Instagram", href: SITE.instagramUrl, Logo: InstagramLogo },
]

const LINK_CLASS =
  "rounded-sm outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"

// The lesson player's footer row (`LessonFooter` in packages/player), which the bottom strip matches.
const SMALL_LINK_CLASS =
  "shrink-0 rounded-md outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"

/**
 * The bottom of every page, on the page background: the ninja on his own row, the name, tagline,
 * and social links level with the link columns under him, and the legal row last. `className`
 * sets its width to match the page (`max-w-*`).
 */
export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        "mx-auto flex w-full max-w-7xl flex-col gap-16 px-4 pt-20 pb-12 sm:gap-20 sm:px-6 sm:pt-28",
        className
      )}
    >
      <div className="flex flex-col gap-6">
        <FooterNinja />
        <div className="flex flex-col gap-10 sm:flex-row sm:justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
              <Link
                href="/"
                className={cn(
                  LINK_CLASS,
                  "text-base font-semibold tracking-tight"
                )}
              >
                {SITE.name}
              </Link>
              <span className="text-muted-foreground">by</span>
              {SITE.makers.map((m) => (
                <LinkButton
                  key={m.handle}
                  variant="secondary"
                  size="sm"
                  className="px-1.5"
                  href={m.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <bdi dir="ltr">{m.handle}</bdi>
                </LinkButton>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">{SITE.tagline}</p>
            {/* The negative margin lines the first icon up with the text above. */}
            <div className="-ms-1.5 flex items-center pt-2">
              {SOCIALS.map(({ name, href, Logo }) => (
                <LinkButton
                  key={name}
                  variant="ghost"
                  size="icon-sm"
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${SITE.name} on ${name}`}
                >
                  <Logo />
                </LinkButton>
              ))}
            </div>
          </div>
          {/* The padding centers the column titles on the name's row. */}
          <nav className="flex gap-16 sm:pt-1.5">
            {COLUMNS.map((column) => (
              <div key={column.title} className="flex flex-col gap-3">
                <p className="text-xs font-medium text-muted-foreground">
                  {column.title}
                </p>
                <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
                  {column.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className={LINK_CLASS}>
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
      </div>

      <p className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Link href="/" className={SMALL_LINK_CLASS}>
          © {new Date().getFullYear()} {SITE.name}
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/privacy" className={SMALL_LINK_CLASS}>
          Privacy
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/terms" className={SMALL_LINK_CLASS}>
          Terms
        </Link>
      </p>
    </footer>
  )
}
