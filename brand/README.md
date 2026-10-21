# Brand files

Share images for the places that take an upload instead of a link. All three are the site's link
preview card (`apps/web/lib/og.tsx`) at another size. Regenerate them after changing the card:

```bash
npm run share -w web
```

| File | Size | Where it goes |
| --- | --- | --- |
| `github-social-preview.png` | 1280×640 | GitHub → repo Settings → Social preview |
| `x-banner.png` | 1500×500 | The X profile header |
| `square.png` | 1080×1080 | Posts on LinkedIn, WhatsApp, launch sites |
| `icon-512.png`, `icon-1024.png` | 512×512, 1024×1024 | The connector icon for Claude's directory and other stores: `apps/web/app/icon.svg` rendered on its white disc (`npm run favicon -w web` builds the favicon from the same file; render these with sharp at `density: 1200`) |

Link previews themselves are served live: `/opengraph-image` for the site and `/lessons/{slug}/opengraph-image` or `/l/{slug}-{id}/opengraph-image` for a lesson.
