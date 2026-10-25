// The brand's name and mark. A module of its own, with no client code, so server components (the
// site's header and footer, avatars) can draw the logo without pulling in the player.

export const BRAND = {
  name: "learn.ninja",
  maker: "@cmicpace",
  makerUrl: "https://x.com/cmicpace",
}

/** The working Learn logo: an outlined face with a cap, a smile, and tall oval eyes. */
export function LearnLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <g stroke="currentColor" strokeWidth="5" strokeLinejoin="round">
        <path d="M7.01 24.83A26 26 0 0 1 56.99 24.83Q32 15.17 7.01 24.83Z" />
        <path d="M56.99 39.17Q32 48.83 7.01 39.17A26 26 0 0 0 56.99 39.17Z" />
      </g>
      <g fill="currentColor">
        <ellipse cx="25" cy="32" rx="2.9" ry="4.6" />
        <ellipse cx="39" cy="32" rx="2.9" ry="4.6" />
      </g>
    </svg>
  )
}
