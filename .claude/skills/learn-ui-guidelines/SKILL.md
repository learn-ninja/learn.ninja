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
| Card | Content cards on the site and inside a kata | `bg-card rounded-xl shadow-xs ring-1 ring-foreground/10` (or the `Card` component) |
| Control on a card | Options, chips, sort and order items, filled gaps | `rounded-md border bg-background shadow-xs dark:bg-input/30`, hover `bg-muted` / `dark:bg-input/50` |
| Floating | Menus, dialogs | `bg-popover` (the components handle it) |
| Tooltip | Short hints on hover, focus, or tap | The `Tooltip` component: no arrow, white in light mode and black in dark (`bg-popover dark:bg-black`), not shadcn's inverted default |

- Never paint a card with `bg-background`; that merges it into the page in dark mode.
- Lesson visuals are the exception: an HTML visual's frame is `rounded-xl border bg-background` (no fill, no dot grid), and every visual's own window is at least 288px tall (`visualWindow` in `packages/player/src/controls.ts`, one number for every kind) with shorter content centered, so a two-line chat or a small formula isn't a thin strip; and an option card's visual sits on a `bg-background` panel (at least 160px tall, `min-h-40`, or 112px on phones, with the visual centered) above a muted caption footer (`bg-muted dark:bg-input/30`). The border keeps them apart from the page. Option cards mark selection and answers with the border color only, never a tint over the visual or caption.
- Selected controls use `border-primary` plus `bg-muted`, with `dark:data-selected:bg-muted` so the dark tint doesn't hide the selection.
- Shadows stay at `shadow-xs`. Use rings and borders for separation, not heavier shadows.

## Shapes and sizes

- Radius: `rounded-lg` for buttons, inputs, menus, alerts and inner panels (Nova's control shape), `rounded-md` for other controls (options, chips), `rounded-xl` for cards, `rounded-4xl` for the player's window, `rounded-full` only for pills, badges, progress, and avatars. No arbitrary radii.
- Borders are 1px. No `border-[1.5px]` or 3D bottom shadows.
- Button sizes: `sm` (28px, 14px text; `icon-sm` for icon-only) everywhere in the app frame, header and footer alike (on phones the header's menu button is `icon`, 32px); `lg` (36px) only in the tray under the lesson (48px and full width on phones, below), where every button (the screen's actions and the player settings) is also a pill: `TRAY_BUTTON` from `packages/player/src/shell.tsx` adds `rounded-full px-4`. The screen's main action lives in that tray; Enter runs it, listed in the footer's shortcuts dialog rather than as a `Kbd` on the button.
- One primary (filled) button per area. Everything else is `outline` or `ghost`.

### Control sizes

The control recipe lives in one place, `packages/player/src/controls.ts`; katas import it instead of copying classes. `controlStyles` is the control on a card with its hover and selected states (`controlSurface` without them, for a picture of a control), `controlPadding` (`px-3 py-2.5 text-sm font-medium`) sizes a one-line control, `slotStyles` is the dashed empty place (an open order slot, an empty sort lane, a used word), and `markStyles` colors a checked answer.

- A one-line control is its padding plus one line of `text-sm` (42px at the default text size, 47px at Large), never a fixed `min-h-*`, so it grows with the learner's text size. An empty slot gets the same padding and an aria-hidden zero-width space for its line, so it's exactly as tall as a filled one.
- Anything beside the text in a control must not make it taller than one line.
- Two deliberate exceptions: choice rows are roomier for their key hint (`min-h-12 px-4 py-3`, `rounded-lg`), and blank's word chips are the sentence's size, since they sit in its text.

## Typography

- Screens are a centered column: `max-w-sm` for the intro, `max-w-lg` for questions and concepts, `max-w-2xl` when there's a visual or a side-by-side kata. Headings are `text-2xl font-semibold`, except a kata's own: a concept's title and a question's prompt share `text-lg font-semibold`, so the first line keeps one size from screen to screen. Options and body copy in tight spaces are `text-sm font-medium`.
- Use Tailwind's text scale only (`text-xs` to `text-4xl`). No pixel or arbitrary sizes.
- Lesson content scales with the learner's text size setting: wrap it in an element with `data-text-size={textSize}`. The app frame (header, footer, buttons) never scales.
- Phones use the same text sizes as desktop for now: `text-sm` answers and body text are 14, 15.75, and 17.5px at Small, Medium, and Large on every screen.
- Two weights do most of the work: `font-medium` for labels and `font-semibold`/`font-bold` for headings. Supporting text is `text-muted-foreground`, never reduced opacity.
- Sentence case everywhere.

## Color

- Use semantic tokens only (`bg-card`, `text-muted-foreground`, `border-border`, `bg-primary`...). No raw hex or palette colors in UI chrome.
- Answer feedback colors: green for correct, yellow for a miss (the `warning` button variant, yellow marks). Revealing the answer isn't an error: its toast is neutral and the last pick stays yellow beside the green answer. Marked rows, the explanation panel, and the note under the answers share one recipe: a 10% tint with a matching border (`border-green-600 bg-green-600/10`, `border-yellow-500 bg-yellow-500/10`) and regular foreground text. The ninja's speech bubble is quieter: a chat bubble (`rounded-[18px]`, no border or shadow) in a light tint of the tone (green 18%, yellow 22%, `bg-muted` when neutral) mixed into `--background` (in sRGB) so it stays opaque over content. Check both themes.
- Feedback after checking comes in two parts. The ninja says only his line in a speech bubble above him in the lesson card's bottom start corner (`text-sm font-medium`, so it scales with the text size setting). Everything longer (a miss's hint, where a scenario pick led, the explanation) is a note under the answers (`Note` in `katas.tsx`): amber with a filled "!" for a hint or a miss, green with a filled white check for the explanation or a right pick's outcome. Nothing opens inside an answer row in the player except Every path. Options show their result in the number key's place (a green check or a yellow X), and the marked row takes the same color as a tint with a matching border. The hook gets the same colors (a green or yellow bubble and Continue), though a miss there still moves on. A correct answer gets a short praise line, a `success` Continue button, and a **Why?** button that adds the explanation note, one line per worked step. While answering a kata that has a hint (not the hook), a **Hint** toggle (`Toggle`, outline, `TRAY_BUTTON`) sits beside Check: it shows the hint as a quiet note under the answers on every screen size (`Note` in neutral: `border-border bg-muted` with a lightbulb, no tint) and stays pressed while it's open, so another press hides it; the ninja says nothing. A miss opens the same note for the retry. A lone demo shows the hint as a lightbulb alert instead. Hints are free: no score change. H is its key, listed in the shortcuts dialog next to W. Explanations are never shown unasked except once an answer is revealed. A lone kata demo (the docs) has no ninja, so it keeps the explanation under the right answer's row (`Explanation`; below the kata when there's no single row).

## Layout and direction

- Use logical utilities only (`ms-*`, `pe-*`, `start-*`, `end-*`, `text-start`). Directional icons get `rtl:-scale-x-100` or `rtl:rotate-180`.
- Content columns max out around `max-w-2xl`. Phones (375px) get edge-to-edge cards, icon-only secondary buttons, and no horizontal scroll. Grids that hold long content use `grid-cols-[minmax(0,1fr)]`.
- Visuals on phones: a picture, diagram, or chart (not a hotspot, code, or a card's visual) gets an expand button that opens it full screen at a desktop column's width (`w-160`) to pan and pinch; code wraps under each line's start instead of scrolling; and three or more picture options sit in two columns (a pair keeps one).

### The player on phones (below `sm`)

Phones get a focused player, not the desktop frame squeezed down. Everything is `max-sm:`, so tablets and desktops keep the layout above.

- **Header:** the logo, the progress bar across the rest, the app's account control (the lantern, or Sign up for a visitor), and one menu (`PhoneMenu` in `shell.tsx`). The title shows only on the intro. The menu holds what the chevron menu, the gear, Share, the profile picture's menu, the tray's settings (`PlayerSettingsItems`), and the footer's links hold on wider screens, with roomier rows. Frame buttons keep their look and grow their tap target to 44px with `PHONE_HIT`.
- **No footer** while playing; its links are in the menu.
- **Action bar:** the tray is the card's color (no grey, no notch, never closed), and its buttons share its width at 48px (`PHONE_BAR` in `lesson-player.tsx`), so the main action is always in the same place under the thumb. The tray clears the home indicator with `env(safe-area-inset-bottom)`.
- **Feedback** sits in the tray above the buttons, not in a bubble over the answers, and the whole tray takes its tone (the toast's recipe spread across it, with a line of the tone's color on top). Why? sits in it so Continue keeps the full width. After checking, the last marked answer scrolls back into view if the taller tray covered it.
- **Lesson screens start at the top** (concepts and questions), so nothing moves when the tray grows; the intro and wrap-up stay centered.
- **The ninja** shows only in a screen's slot (the intro, the wrap-up): there's no room for him in the corner beside a kata, so his corner spot is hidden.
- **Katas on phones:** sort deals the items as a deck: the next item is a card (the card's look, not a control's, so it doesn't read as an answer option) with a count above it ("2 of 5") and the next card's edge under it, and each group is a bin below (side by side for two groups, stacked for more). The whole bin takes the tap, its dashed open space stays first so repeated taps keep landing, and the card flies in as a chip; tap a chip to put it back on top of the deck. Until everything is sorted the Check button says how many are left ("2 left to sort"). Desktop keeps the lanes. Order keeps every item's place in the pool (a placed item leaves a dashed space, so nothing reflows), and its open slots for visual items are shorter.

### Kata behavior

- **Match judges each pair as it's made**, on every screen: a right pair flashes green and settles as a dashed, muted tile out of play; a wrong one shakes yellow, comes apart, and costs the kata its first-try score (the `slip` action). The last pair checks the kata, so there's no Check to press.
- Sort and order slide items with a view transition, which lets taps through (`::view-transition { pointer-events: none }`), so quick taps in a row all land.
- **An HTML hotspot stays clean at rest.** The part under the pointer or picked gets a grey tile and the rest dims; a checked part takes the answer's color with a solid edge. No frames or corners. All of it is drawn inside the visual's frame (`packages/player/src/spots.ts`), and the buttons over it take the taps. Phones have no hover, so every part shows its tile when the kata arrives and while a finger holds the stage.
- Wrap user handles and code in `<bdi dir="ltr">` so they stay readable in Arabic.

## States and interaction

- Every interactive element has hover, `focus-visible` (the 3px ring from the components), pressed, and selected or disabled states as needed. Prefer explaining why something can't happen over a disabled button.
- Keyboard first: Enter runs the main action (start, check, continue) and number keys pick answer options (shown with a `Kbd` on each option). A `Kbd` is an outlined keycap with no fill everywhere (options, chips, the footer, the shortcuts dialog), so it keeps its shape on a hovered or selected surface; don't give one a background. The footer's shortcuts dialog (`?`) lists them. Avoid pointer-only interactions.
- Motion goes behind `motion-safe:` and stays short (fades and small slides, about 150 to 300ms).

## Accessibility

- Icon-only buttons need an `aria-label`. Progress and status changes are announced (`aria-live`, `valueLabel`).
- Touch targets: the frame's buttons are 28px tall but at least 32px wide; main actions in the tray are 36px.
- Text and tinted backgrounds meet WCAG AA contrast in both themes.

## Copy

- All player text lives in `packages/player-core/src/strings.ts` with English and Arabic. Never hard-code UI strings in components.
- Keep it short and plain: "Check", "Try again", "Link copied". No exclamation marks in system text, except for celebrating a correct answer.

## Before calling a UI change done

1. Run `npm run check`.
2. Look at it in Storybook or the dev server in light and dark, in English and Arabic (`?ui=ar`), at 375px and at desktop width, and with text size set to Large.
3. Add or update a story for any new screen or state.
