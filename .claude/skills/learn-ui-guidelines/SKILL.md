---
name: learn-ui-guidelines
description: UI rules for the Learn app and lesson player. Use before building or changing any screen, component, or style in apps/web, packages/player, or packages/ui (layout, colors, dark mode, cards, buttons, typography, states, accessibility, right-to-left), and when reviewing a design or a Figma frame against the build.
---

# Learn UI guidelines

The look comes from **shadcn's Nova style** (`aria-nova` in both `components.json` files), with one tweak: the `sm` button keeps 14px text (Nova's own is 12.8px), the size Colin likes best at 28px tall. Colin's Figma frames are wireframes: follow their layout and content, but take component looks and sizes from shadcn, not from Figma. When Figma and Vega disagree on a component's look, Vega wins; when they disagree on layout, Figma wins.

## Components first

- Use the components in `packages/ui/src/components` (button, badge, card, alert, progress, dialog, dropdown-menu, direction, selectable). If one is missing, add it with `npx shadcn@latest add <name>` from `apps/web`. Don't copy shadcn classes into new markup.
- Player code imports UI only from `@workspace/ui/components/*`, never from `react-aria-components`.
- Answer options, chips, and gaps use `Selectable` (a React Aria toggle) styled with the control recipe below.

## Surfaces and elevation

Every screen has visible layers in both themes. Windows are outlined, not filled, so their content stays clean; cards and controls inside them are filled, so in dark mode nothing interactive sits flat on pure black.

| Layer | Use | Classes |
| --- | --- | --- |
| Page | App background, header, footer | `bg-background` |
| Window | The player's lesson card and Theory panel, the docs preview window | `rounded-2xl border` on the page background, no fill or shadow (like shadcn's component previews). A window that overlays content (the Theory panel on phones) adds `bg-background` |
| Card | Content cards on the site and inside a brick | `bg-card rounded-xl shadow-xs ring-1 ring-foreground/10` (or the `Card` component) |
| Control on a card | Options, chips, sort and order items, filled gaps | `rounded-md border bg-background shadow-xs dark:bg-input/30`, hover `bg-muted` / `dark:bg-input/50` |
| Floating | Menus, dialogs | `bg-popover` (the components handle it) |
| Tooltip | Short hints on hover, focus, or tap | The `Tooltip` component: no arrow, white in light mode and black in dark (`bg-popover dark:bg-black`), not shadcn's inverted default |

- Never paint a card with `bg-background`; that merges it into the page in dark mode.
- Lesson visuals are the exception: an HTML visual's frame is `rounded-xl border bg-background` (no fill, no dot grid), and an option card's visual sits on a `bg-background` panel (at least 160px tall, `min-h-40`, or 112px on phones, with the visual centered) above a muted caption footer (`bg-muted dark:bg-input/30`). The border keeps them apart from the page. Option cards mark selection and answers with the border color only, never a tint over the visual or caption.
- Selected controls use `border-primary` plus `bg-muted`, with `dark:data-selected:bg-muted` so the dark tint doesn't hide the selection.
- Shadows stay at `shadow-xs`. Use rings and borders for separation, not heavier shadows.

## Shapes and sizes

- Radius: `rounded-lg` for buttons, inputs, menus, alerts and inner panels (Nova's control shape), `rounded-md` for other controls (options, chips), `rounded-xl` for cards, `rounded-4xl` for the player's window, `rounded-full` only for pills, badges, progress, and avatars. No arbitrary radii.
- Borders are 1px. No `border-[1.5px]` or 3D bottom shadows.
- Button sizes: `sm` (28px, 14px text; `icon-sm` for icon-only) everywhere in the app frame, header and footer alike (on phones the header's menu button is `icon`, 32px); `lg` (36px) only in the tray under the lesson (48px and full width on phones, below), where every button (the screen's actions and the player settings) is also a pill: `TRAY_BUTTON` from `packages/player/src/shell.tsx` adds `rounded-full px-4`. The screen's main action lives in that tray; Enter runs it, listed in the footer's shortcuts dialog rather than as a `Kbd` on the button.
- One primary (filled) button per area. Everything else is `outline` or `ghost`.

### Control sizes

The control recipe lives in one place, `packages/player/src/controls.ts`; bricks import it instead of copying classes. `controlStyles` is the control on a card with its hover and selected states (`controlSurface` without them, for a picture of a control), `controlPadding` (`px-3 py-2.5 text-sm font-medium`) sizes a one-line control, `slotStyles` is the dashed empty place (an open order slot, an empty sort lane, a used word), and `markStyles` colors a checked answer.

- A one-line control is its padding plus one line of `text-sm` (42px at the default text size, 47px at Large; on phones 45px and 51px), never a fixed `min-h-*`, so it grows with the learner's text size. An empty slot gets the same padding and an aria-hidden zero-width space for its line, so it's exactly as tall as a filled one.
- Anything beside the text in a control (match's pair badge) must not make it taller than one line.
- Two deliberate exceptions: choice rows are roomier for their key hint (`min-h-12 px-4 py-3`, `rounded-lg`), and blank's word chips are the sentence's size, since they sit in its text.

## Typography

- Screens are a centered column: `max-w-sm` for the intro, `max-w-lg` for questions and concepts, `max-w-2xl` when there's a visual or a side-by-side brick. Headings are `text-2xl font-semibold`; options and body copy in tight spaces are `text-sm font-medium`.
- Use Tailwind's text scale only (`text-xs` to `text-4xl`). No pixel or arbitrary sizes.
- Lesson content scales with the learner's text size setting: wrap it in an element with `data-text-size={textSize}`. The app frame (header, footer, buttons) never scales.
- Phones (below `sm`) take a bigger step for each setting (`globals.css`), so `text-sm` answers and body text are 16, 18, and 20px at Small, Medium, and Large instead of 14, 15.75, and 17.5px. Code blocks step back down to `text-xs` there (about 14px at Small), since their lines need the width.
- Two weights do most of the work: `font-medium` for labels and `font-semibold`/`font-bold` for headings. Supporting text is `text-muted-foreground`, never reduced opacity.
- Sentence case everywhere.

## Color

- Use semantic tokens only (`bg-card`, `text-muted-foreground`, `border-border`, `bg-primary`...). No raw hex or palette colors in UI chrome.
- Answer feedback colors: green for correct, yellow for a miss (the `warning` button variant, yellow marks). Revealing the answer isn't an error: its toast is neutral and the last pick stays yellow beside the green answer. Marked rows, the explanation panel, and the feedback toast share one recipe: a 10% tint with a matching border (`border-green-600 bg-green-600/10`, `border-yellow-500 bg-yellow-500/10`) and regular foreground text. The toast floats over content, so it mixes the same tint into `--background` (in sRGB) to stay opaque. Check both themes.
- Feedback after checking is a small toast in the lesson card's bottom start corner: one short semibold line at the answers' size (`text-sm font-semibold`, so it scales with the text size setting), plus at most one short sentence. Options show their result in the number key's place (a green check or a yellow X), and the marked row takes the same color as a tint with a matching border. The hook gets the same colors (a green or yellow toast and Continue), though a miss there still moves on. A correct answer gets a short praise line, a `success` Continue button, and a **Why?** button that opens the explanation under the right answer's row (`Explanation` in `bricks.tsx`; below the brick when there's no single row to attach to), one line per worked step. Explanations are never shown unasked except once an answer is revealed.

## Layout and direction

- Use logical utilities only (`ms-*`, `pe-*`, `start-*`, `end-*`, `text-start`). Directional icons get `rtl:-scale-x-100` or `rtl:rotate-180`.
- Content columns max out around `max-w-2xl`. Phones (375px) get edge-to-edge cards, icon-only secondary buttons, and no horizontal scroll. Grids that hold long content use `grid-cols-[minmax(0,1fr)]`.
- Visuals on phones: a picture, diagram, or chart (not a hotspot, code, or a card's visual) gets an expand button that opens it full screen at a desktop column's width (`w-160`) to pan and pinch; code wraps under each line's start instead of scrolling; hotspot corners stay on (no hover to hint with); and three or more picture options sit in two columns (a pair keeps one).

### The player on phones (below `sm`)

Phones get a focused player, not the desktop frame squeezed down. Everything is `max-sm:`, so tablets and desktops keep the layout above.

- **Header:** the logo, the progress bar across the rest, and one menu (`PhoneMenu` in `shell.tsx`). The title shows only on the intro. The menu holds what the chevron menu, the gear, Share, the tray's settings (`PlayerSettingsItems`), and the footer's links hold on wider screens, with roomier rows. Frame buttons keep their look and grow their tap target to 44px with `PHONE_HIT`.
- **No footer** while playing; its links are in the menu.
- **Action bar:** the tray is the card's color (no grey, no notch, never closed), and its buttons share its width at 48px (`PHONE_BAR` in `lesson-player.tsx`), so the main action is always in the same place under the thumb. The tray clears the home indicator with `env(safe-area-inset-bottom)`.
- **Feedback** is a card in the tray above the buttons (the toast's recipe, no shadow), not a bubble over the answers. Why? sits inside that card so Continue keeps the full width. After checking, the last marked answer scrolls back into view if the taller tray covered it.
- **Lesson screens start at the top** (concepts and questions), so nothing moves when the tray grows; the intro and wrap-up stay centered.
- **The ninja** shows only in a screen's slot (the intro, a scenario's brief, the wrap-up): there's no room for him in the corner beside a brick, so his corner spot is hidden.
- Wrap user handles and code in `<bdi dir="ltr">` so they stay readable in Arabic.

## States and interaction

- Every interactive element has hover, `focus-visible` (the 3px ring from the components), pressed, and selected or disabled states as needed. Prefer explaining why something can't happen over a disabled button.
- Keyboard first: Enter runs the main action (start, check, continue) and number keys pick answer options (shown with a `Kbd` on each option). The footer's shortcuts dialog (`?`) lists them. Avoid pointer-only interactions.
- Motion goes behind `motion-safe:` and stays short (fades and small slides, about 150 to 300ms).

## Accessibility

- Icon-only buttons need an `aria-label`. Progress and status changes are announced (`aria-live`, `valueLabel`).
- Touch targets: the frame's buttons are 28px tall but at least 32px wide; main actions in the tray are 36px.
- Text and tinted backgrounds meet WCAG AA contrast in both themes.

## Copy

- All player text lives in `packages/player/src/strings.ts` with English and Arabic. Never hard-code UI strings in components.
- Keep it short and plain: "Check", "Try again", "Link copied". No exclamation marks in system text, except for celebrating a correct answer.

## Before calling a UI change done

1. Run `npm run check`.
2. Look at it in Storybook or the dev server in light and dark, in English and Arabic (`?ui=ar`), at 375px and at desktop width, and with text size set to Large.
3. Add or update a story for any new screen or state.
