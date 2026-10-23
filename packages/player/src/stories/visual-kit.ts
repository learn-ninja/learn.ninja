// The built-in UI kit for HTML lesson visuals: Basecoat markup checked to render inside the sandbox
// (no scripts, frame sized to its content). The teaching guide's "built-in UI kit" table documents the
// same markup for the skill; keep the two in step when adding a component.

export interface KitSample {
  name: string
  html: string
}

export const visualKit: KitSample[] = [
  {
    name: "Buttons",
    html: `<div class="flex flex-wrap gap-2"><button class="btn">Save</button><button class="btn" data-variant="secondary">Secondary</button><button class="btn" data-variant="outline">Outline</button><button class="btn" data-variant="ghost">Ghost</button><button class="btn" data-variant="link">Link</button><button class="btn" data-variant="destructive">Delete</button></div>`,
  },
  {
    name: "Icons",
    html: `<div class="grid gap-3 text-sm"><div class="flex flex-wrap items-center gap-4"><span class="inline-flex items-center gap-1.5"><span class="icon-[octicon--repo-16]"></span> repo</span><span class="inline-flex items-center gap-1.5"><span class="icon-[octicon--git-branch-16]"></span> branch</span><span class="inline-flex items-center gap-1.5"><span class="icon-[octicon--git-commit-16]"></span> commit</span><span class="inline-flex items-center gap-1.5"><span class="icon-[octicon--git-pull-request-16] text-chart-2"></span> pull request</span><span class="inline-flex items-center gap-1.5"><span class="icon-[octicon--issue-opened-16] text-destructive"></span> issue</span></div><div class="flex flex-wrap items-center gap-4 text-muted-foreground"><span class="icon-[lucide--database] size-8 text-primary"></span><span class="icon-[lucide--git-merge] size-8"></span><span class="icon-[logos--github-icon] size-8"></span><span class="icon-[vscode-icons--file-type-python] size-8"></span><span class="icon-[simple-icons--react] size-8 text-chart-1"></span></div></div>`,
  },
  {
    name: "Badges and keys",
    html: `<div class="flex flex-wrap items-center gap-2"><span class="badge">New</span><span class="badge" data-variant="secondary">Draft</span><span class="badge" data-variant="outline">Beta</span><span class="badge" data-variant="destructive">Failed</span><kbd class="kbd">⌘K</kbd></div>`,
  },
  {
    name: "Text field",
    html: `<div class="field w-64"><label class="label" for="email">Email</label><input class="input" id="email" placeholder="you@example.com"></div>`,
  },
  {
    name: "Field with an error",
    html: `<div class="field w-64" data-invalid="true"><label class="label" for="email-2">Email</label><input class="input" id="email-2" aria-invalid="true" value="colin@"><p role="alert">Enter a full email address.</p></div>`,
  },
  {
    name: "Textarea",
    html: `<div class="field w-64"><label class="label" for="bio">Bio</label><textarea class="textarea" id="bio" placeholder="A few words about you"></textarea></div>`,
  },
  {
    name: "Checkbox, switch, radio",
    html: `<div class="grid gap-3"><label class="label"><input type="checkbox" class="input" checked> Remember me</label><label class="label"><input type="checkbox" role="switch" class="input" checked> Wi-Fi</label><div role="radiogroup" class="grid gap-2"><label class="label"><input type="radio" name="plan" class="input" checked> Monthly</label><label class="label"><input type="radio" name="plan" class="input"> Yearly</label></div></div>`,
  },
  {
    name: "Select (closed)",
    html: `<select class="select w-48"><option>United States</option><option>Canada</option></select>`,
  },
  {
    name: "Select (open)",
    html: `<div class="select"><button type="button" class="btn" data-variant="outline" aria-expanded="true"><span>Apple</span></button><div data-popover aria-hidden="false"><div role="listbox"><div role="option" data-value="apple" aria-selected="true">Apple</div><div role="option" data-value="banana">Banana</div><div role="option" data-value="cherry">Cherry</div></div></div></div>`,
  },
  {
    name: "Slider and progress",
    html: `<div class="grid w-64 gap-4"><input type="range" class="input" value="40"><div class="progress"><span class="w-3/5"></span></div></div>`,
  },
  {
    name: "Tabs",
    html: `<div class="tabs w-72"><nav role="tablist"><button role="tab" aria-selected="true">Account</button><button role="tab">Password</button></nav><div role="tabpanel"><div class="card"><section>Your name and email.</section></div></div></div>`,
  },
  {
    name: "Accordion",
    html: `<section class="accordion w-72"><details open><summary>Is it free?</summary><section><p>Yes, always.</p></section></details><details><summary>Do I need an account?</summary><section><p>No.</p></section></details></section>`,
  },
  {
    name: "Card",
    html: `<div class="card w-72"><header><h2>Pro plan</h2><p>For growing teams.</p></header><section>Unlimited projects and priority support.</section><footer><button class="btn w-full">Upgrade</button></footer></div>`,
  },
  {
    name: "Alerts",
    html: `<div class="grid w-80 gap-3"><div class="alert"><h2>Heads up</h2><section>Your trial ends in 3 days.</section></div><div class="alert" data-variant="destructive"><h2>Payment failed</h2><section>Update your card to keep your plan.</section></div></div>`,
  },
  {
    name: "Table",
    html: `<table class="table w-80"><thead><tr><th>Plan</th><th>Price</th></tr></thead><tbody><tr><td>Free</td><td>$0</td></tr><tr><td>Pro</td><td>$12</td></tr></tbody></table>`,
  },
  {
    name: "Avatar and skeleton",
    html: `<div class="flex items-center gap-3"><span class="avatar"><span>CP</span></span><div class="grid gap-2"><div class="skeleton h-4 w-40"></div><div class="skeleton h-4 w-24"></div></div></div>`,
  },
  {
    name: "Empty state",
    html: `<div class="empty"><header><h3>No projects yet</h3><p>Create one to get started.</p></header><section><button class="btn">New project</button></section></div>`,
  },
  {
    name: "Dialog",
    html: `<dialog class="dialog" open><div><header><h2>Rename project</h2><p>Pick a name your team will recognize.</p></header><section><input class="input" value="Website redesign"></section><footer><button class="btn" data-variant="outline">Cancel</button><button class="btn">Save</button></footer></div></dialog>`,
  },
  {
    name: "Alert dialog",
    html: `<dialog class="alert-dialog" open><div><header><h2>Delete project?</h2><p>This can't be undone.</p></header><footer><button class="btn" data-variant="outline">Cancel</button><button class="btn" data-variant="destructive">Delete</button></footer></div></dialog>`,
  },
  {
    name: "Toast",
    html: `<div class="toaster"><div class="toast" role="status"><div class="toast-content"><section><h2>Project archived</h2><p>You can restore it for 30 days.</p></section><footer><button class="btn" data-size="sm" data-toast-action>Undo</button></footer></div></div></div>`,
  },
  {
    name: "Dropdown menu (open)",
    html: `<div class="dropdown-menu"><button type="button" class="btn" data-variant="outline" aria-expanded="true">Options</button><div data-popover aria-hidden="false"><div role="menu"><div role="menuitem">Edit</div><div role="menuitem">Duplicate</div><hr role="separator"><div role="menuitem">Delete</div></div></div></div>`,
  },
  {
    name: "Popover",
    html: `<div class="popover"><button class="btn" data-variant="outline">Share</button><div data-popover aria-hidden="false"><p>Anyone with the link can view.</p></div></div>`,
  },
  {
    name: "Tooltip",
    html: `<button class="btn" data-variant="outline" data-tooltip="Copy link">Share</button>`,
  },
]

/** A diagram with the kit's icons, the way a GitHub lesson would draw one, for the kit story. */
export const visualKitDiagram = `direction: right
repo: Repo {icon: octicon/repo-16}
branch: Branch {shape: image; icon: lucide/git-branch}
pr: Pull request {icon: octicon/git-pull-request-16}
repo -> branch: branch
branch -> pr: open`

/** A diagram sample for the Diagrams stories: one per kind of D2 drawing a lesson may use. */
export interface DiagramSample {
  name: string
  alt: string
  d2: string
}

/**
 * The kinds of D2 drawing the teaching guide documents (its "Diagrams in D2" section), each in
 * the shape a lesson would use it. prepare-examples.ts draws them for the stories.
 */
export const diagramSamples: DiagramSample[] = [
  {
    name: "Flow with icons",
    alt: "A repo, a branch, and a pull request, each with its icon.",
    d2: visualKitDiagram,
  },
  {
    name: "Sequence diagram",
    alt: "The browser asks the server for lessons, the server queries the database and answers with the page.",
    d2: `shape: sequence_diagram
browser: Browser
server: Server
db: Database
browser -> server: GET /lessons
server -> db: query
db -> server: rows
server -> browser: 200 OK
browser.note: Renders the page`,
  },
  {
    name: "Grid",
    alt: "Three stages of the Bronze Age collapse in a row: trade thrives, the Sea Peoples attack, the palaces fall.",
    d2: `timeline: 1200 to 1150 BC {
  grid-rows: 1
  grid-gap: 0
  a: "1200 BC\\nTrade thrives"
  b: "1180 BC\\nSea Peoples attack"
  c: "1150 BC\\nPalaces fall"
}`,
  },
  {
    name: "Table",
    alt: "A users table whose team_id column points at the teams table's id.",
    d2: `users: {
  shape: sql_table
  id: int {constraint: primary_key}
  email: text {constraint: unique}
  team_id: int {constraint: foreign_key}
}
teams: {
  shape: sql_table
  id: int {constraint: primary_key}
  name: text
}
users.team_id -> teams.id`,
  },
]
