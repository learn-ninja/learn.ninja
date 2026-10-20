# Subjects and tags: how lessons get categorized

Plan written on 2026-10-20. Nothing here is built yet. It replaces the free-text `topic` label with a fixed list of **subjects** that the agent must pick from and the checker enforces, plus a few free **tags** per lesson that stay out of the way until there are enough lessons to need them.

## The problem

Today a lesson has one optional field for its category, `topic`, defined as "a short label, e.g. UI design" (`packages/spec/src/schema.ts:335`, `skills/learn/reference/lesson-format.md:17`). The agent invents it per lesson, so three lessons by one person in one afternoon landed as "Startups", "Git & Claude Code", and "Claude Code". The label is shown on Explore rows and the title screen and feeds the aura colour (`hueFor` in `packages/player/src/ninja.tsx`), but it can't be filtered, counted, translated, or linked, because no two lessons agree on it.

The word is also wrong. "Topic" means the lesson's subject matter to the guides ("a bare topic like how vaccines work") and a category to the schema. The plan retires it.

What a category system has to do here, in order:

1. Let a reader of Explore narrow to what they care about ("show me the code lessons", "show me the history ones"), and let us build subject pages (`/explore/history`) that search engines can index.
2. Give every lesson a label that is correct, consistent, and the same across languages: a Spanish lesson about cooking and an English one should sit in the same bucket, with the bucket named in the reader's language.
3. Cost the agent nothing. The agent already writes 30 fields; one more pick from a short list is fine, a judgment call against a thousand-node tree is not.
4. Scale from thirty lessons to a hundred thousand without re-tagging the first thirty.

## What other systems do

| System | Top level | Below it | How labels are assigned | Lesson for us |
|---|---|---|---|---|
| Coursera | 11 subjects (Arts and Humanities, Business, Computer Science, Data Science, Health, Information Technology, Language Learning, Math and Logic, Personal Development, Physical Science and Engineering, Social Sciences), as its browse page shows today | Skills (Python, SQL, Project Management…) as a separate flat list | Partner picks; Coursera clusters | A short top level survives years; the detail lives in a separate flat list, not in deeper tree levels |
| Udemy | 13 categories (Development, Business, Finance & Accounting, IT & Software, Office Productivity, Personal Development, Design, Marketing, Lifestyle, Photography & Video, Health & Fitness, Music, Teaching & Academics) | ~130 subcategories, then "topics" | Instructor picks category and subcategory; Udemy moves things around in periodic taxonomy updates (E-commerce moved from Development to Business; "Design Thinking" removed; "Nutrition & Diet" merged) | Even a curated two-level tree needs editing a few times a year; the data must survive a term moving or merging |
| Khan Academy | Math, Science, Computing, Arts & humanities, Economics, Reading & language arts, Life skills, Test prep | Courses | Editorial | School subjects are what people expect for academic content |
| YouTube | 15 categories (Education, Science & Technology, Howto & Style, Gaming, Music…) | None; everything else is search | Uploader picks one | One required pick from ~15 is a solved interaction |
| Stack Overflow | None | ~65,000 free tags | Asker types tags; new tags need 1,500 reputation; synonyms map variants ("js" → "javascript") to one canonical tag; single-use tags older than six months are culled | Free tags drift into variants within weeks. They need synonyms, a creation threshold, and culling from day one, or they become noise |
| GitHub Topics | None | Free topics; "featured" topics are the ones with the most repositories, "curated" ones have a description and logo added by hand | Repository owner types topics | Let free tags exist, but only promote the ones that earn it |

Three patterns recur across all of them:

- **A short, fixed top level that rarely changes**, owned by the product. Nobody lets users invent top-level categories.
- **Detail as a flat list, not a deep tree.** Deep trees need a taxonomist; flat lists need a synonym table.
- **Free tagging is a liability unless it's governed**: normalized spelling, synonyms, a limit per item, and a rule for what gets shown.

The one thing we have that none of them do: the thing picking the label is a capable language model that has read the whole lesson and the whole guide, and a deterministic checker that can refuse anything outside the list. That makes a closed list cheap to enforce, so we should enforce it.

## The design

### Two layers

**Subject** (required, exactly one, from a fixed list of 16). This is the category. It drives Explore filters, subject pages, the aura colour, and the label on rows and the title screen. It is a short slug in the lesson file (`"subject": "programming"`) and is translated by the player's locale files, so the row reads "Programación" to a Spanish reader whatever language the lesson is in.

**Tags** (optional, up to five, free text). These are the specifics: `git`, `claude-code`, `compound-interest`, `bronze-age`. They are stored and indexed from day one but shown nowhere at first. They exist so that, once there are a few thousand lessons, we can see which tags recur, promote the recurring ones to filters within a subject, and build pages like `/explore/programming/git` without re-tagging anything. Until then they cost nothing and clutter nothing.

Why not primary and secondary subjects? Because a lesson that is "really" two subjects is rare enough to handle with a tag, and a second subject doubles every count, filter, and page's ambiguity for the sake of the edge case. One subject keeps "where does this lesson live" a question with one answer. The agent can mention the other in a tag, and tags are where cross-cutting lives.

Why not one bigger list? The screenshot's three lessons show the failure: "Claude Code", "Git & Claude Code", and "Startups" are all reasonable labels, and all useless as categories. A list short enough to be stable is too coarse to be specific; a list specific enough is too long to be stable. Two layers let each be the right size.

### The subjects

Sixteen, chosen so that any lesson has an obvious home, no two overlap on common cases, and the list reads like a sensible browse menu rather than a library catalogue. Where a lesson could go two ways, the scope note decides, and the checker's docs carry the note. The agent reads this table from the format reference; the slugs are the schema's enum.

| Slug | English name | Covers | Not this (goes to) |
|---|---|---|---|
| `programming` | Programming | Languages, frameworks, algorithms, software design, databases, testing, version control | Using a developer tool as a user without code (→ `tools`); AI as a subject (→ `ai`) |
| `ai` | AI | How models work, prompting, agents, machine learning concepts, working with AI tools | Writing code that calls an API, where the lesson is about the code (→ `programming`) |
| `tools` | Tools & productivity | How to use a specific app, product, or workflow: Git as a tool, spreadsheets, note apps, keyboard habits, personal productivity systems | Programming in that tool's language (→ `programming`); a tool used for design (→ `design`) |
| `design` | Design | UI, UX, visual and graphic design, typography, product design, design systems | Art appreciation and art history (→ `arts`) |
| `business` | Business & startups | Strategy, startups, management, operations, entrepreneurship, product management, economics as it applies to firms | Personal money (→ `money`); the macroeconomics of nations (→ `society`) |
| `marketing` | Marketing & writing | Marketing, sales, copywriting, content, social media, public speaking, professional writing | Creative writing (→ `arts`); grammar of a language being learned (→ `languages`) |
| `money` | Money & finance | Personal finance, investing, accounting, economics for individuals | Running a company's finances (→ `business`) |
| `science` | Science | Physics, chemistry, biology, earth and space science, scientific method | Human health (→ `health`); maths on its own (→ `math`) |
| `math` | Math & data | Arithmetic through calculus, statistics, probability, data literacy, data analysis | Programming a data pipeline (→ `programming`); machine learning (→ `ai`) |
| `health` | Health & fitness | Medicine for lay readers, nutrition, exercise, sleep, mental health, first aid | Biology for its own sake (→ `science`) |
| `history` | History | Any period, place, or theme in history; archaeology | Current politics and institutions (→ `society`) |
| `society` | Society & ideas | Politics, law, philosophy, religion, psychology, sociology, geography, current affairs, civics | Historical events (→ `history`); personal habits (→ `life`) |
| `languages` | Languages | Learning a language: vocabulary, grammar, phrases, pronunciation. Set `targetLanguage` | Writing well in your own language (→ `marketing`) |
| `arts` | Arts & culture | Music, film, literature, visual art, creative writing, photography, games as culture, pop culture | Making a UI (→ `design`); the history of an art movement when the lesson is history first (→ `history`) |
| `life` | Everyday life | Cooking, gardening, home, parenting, travel, pets, hobbies, crafts, DIY, relationships, study skills | Health and fitness (→ `health`); personal finance (→ `money`) |
| `careers` | Careers & learning | Job search, interviews, workplace skills, leadership as a skill, teaching, how to learn, exam prep | Running a business (→ `business`); a specific tool (→ `tools`) |

Rules the list follows, so later edits keep it sound:

- **One home per common case.** The "Not this" column is the tiebreaker, and it is written so the agent can apply it without judgment: ask what the learner does afterwards, not what nouns appear in the title. A Git lesson for people who will type Git commands is `tools`; a lesson on how Git stores objects is `programming`.
- **No "Other".** Every system that ships "Other" ends up with a quarter of its content there. `life` and `society` are wide on purpose, so nothing is left over. If a kind of lesson keeps landing awkwardly, that is a reason to edit the list, not to add a bucket for the awkward.
- **Names are for a browse menu.** Two words at most, ampersands allowed, no slashes. Slugs are one lowercase word and never change once shipped; names can be reworded in any locale without touching data.
- **The three screenshot lessons** land as `business` (tags `startups`, `building-in-public`), `tools` (tags `git`, `claude-code`), and `tools` (tags `claude-code`, `remote-work`). The seven bundled examples land as `history`, `design`, `money`, `math`, `programming`, `languages`, `business`.

### Tags

- Up to five per lesson, each 2–30 characters, lowercase, letters, digits, and single hyphens between words (`claude-code`, not `Claude Code` or `claude_code`), matched by the schema with a regex. Unicode letters are allowed so lessons in other languages tag in their own words; the player never shows a tag it can't read.
- The guide asks for them in this order: the specific thing taught (`git`, `compound-interest`), then the product or field if there is one (`claude-code`, `javascript`), then at most one angle (`beginners`, `history-of`). Nouns, singular, no level or language words (those are fields already), no repeating the subject (`programming` as a tag on a `programming` lesson is rejected by a rule).
- The checker normalizes before it validates: trims, lowercases, folds spaces and underscores to hyphens, strips a leading `#`. It reports what it changed as a note, not an error, so the agent doesn't have to retry over a capital letter.
- A synonym table (`packages/spec/src/tags.ts`, a plain object, a few dozen rows at first) maps variants to one canonical tag at publish time: `js` → `javascript`, `claudecode` → `claude-code`, `ux` → `user-experience`. It grows by hand from what the tag report (below) shows; this is Stack Overflow's lesson, applied before the mess instead of after.
- Tags are stored twice: in the lesson JSON as the agent wrote them (after normalization), and in a `lesson_tag` table (`lesson_id`, `tag`) for counting and filtering. The table is rebuilt from the JSON on every publish and update, so the JSON stays the source of truth and the table is an index.

### What the player and the site show

- **Rows and the title screen**: the subject's translated name where the topic sits now, so nothing moves. The subject replaces `topic` in `MetaLine` (`packages/player/src/lesson-player.tsx`) and `LessonRow` (`apps/web/components/explore/lesson-row.tsx`). Tags are not shown.
- **Aura**: `hueFor(subject)` becomes a lookup in a 16-entry table so every subject has a deliberate hue (history warm, science cool, and so on) instead of a hash. A lesson's light then says something.
- **Explore**: a row of subject chips above the list, horizontally scrollable on phones, "All" first, then subjects in a fixed order, each only shown once it has at least one listed lesson. Picking one filters the list and sets the URL to `/explore/{subject}`. The empty state for a subject says what it is and invites a lesson.
- **Subject pages** `/explore/{subject}`: the same feed filtered, with a title and description from the subject table, a canonical URL, and an entry in `sitemap.ts`. These are the pages that can rank for "interactive history lessons".
- **Profiles**: no filter at first; a person rarely has enough lessons to need one.
- **Link previews** (`apps/web/lib/og.tsx`): the subject name instead of the topic string.
- **Agent-facing text** (`/llms.txt`, docs): the subject list with scope notes, so an agent that reads the site instead of installing the skill still picks correctly.

### How a lesson gets its subject and tags

The agent picks, at write time, from the format reference. The server never guesses; it refuses. This fits how everything else works here: the agent is the model, the server is the checker, and the server has no model of its own and shouldn't need one for this.

1. **Guide**: `reference/lesson-format.md` gains the subject table above (slug, name, covers, not this) and the tag rules, in place of the `topic` row. `steps.md` step 3 gets one line: "Pick the `subject` from the table by what the learner will do afterwards; write 2–5 `tags`". The teaching guide is unchanged.
2. **Schema** (`packages/spec/src/schema.ts`): `subject: z.enum(SUBJECTS)` required, `tags: z.array(tagSchema).max(5).optional()`, `topic` removed. `SUBJECTS` and the subject table (names, scope notes, hue) export from `packages/spec` so the player, the site, the docs, and the CLI read one list. Spec version becomes 0.6.
3. **Checker rules** (`packages/spec/src/rules.ts`): no tag equal to the subject or to a level or language word; no duplicate tags after synonym mapping; a `note` (not an error) when normalization changed a tag.
4. **Upgrade** (`packages/spec/src/upgrade.ts`): 0.5 → 0.6 maps `topic` to a subject through a small lookup of the labels seen so far (`JavaScript` → `programming`, `UI design` → `design`, `Startups` → `business`, `History` → `history`…) and otherwise to `life`, keeping the old label as a tag so nothing is lost. The lookup is a best effort for lessons already in the database; the examples are edited by hand.
5. **Publish and update** (`apps/web/lib/publish/handlers.ts`): after validation, write the `lesson_tag` rows, and revalidate the subject's cache tag as well as the general one.
6. **Over MCP**: nothing changes in the tools. `get_guide` already returns the format reference; `publish_lesson` already returns the checker's issues, so a wrong subject comes back as a normal issue with a patch path.
7. **The CLI** (`learn validate`): the offline fallback bundles the subject list with the schema, as it does today for everything else, so offline checks refuse an unknown subject too.

The pick is one closed choice with a tiebreaker column; an agent that has just written a whole lesson gets it right almost every time, and the checker catches the rest. We don't build a classifier, a review queue, or an admin UI for this. What we do build is a weekly **tag report**: a script (`npm run tags -w web`) that prints subjects by lesson count, the top 50 tags per subject, and tags that appear once, so a person can add synonyms, spot a subject that is swallowing everything, and decide when a tag has earned a filter. This is the whole moderation process until the numbers say otherwise.

### When the list changes

It will; Udemy edits theirs a few times a year. Rules so a change is a pull request, not a migration project:

- **Adding a subject**: add the slug, name, scope note, hue, and translations; bump the spec; write an upgrade step that moves lessons whose tags match (`tags` is why this is possible). Older skills keep publishing under the old list until they sync, because the server upgrades their files.
- **Splitting a subject** (say `programming` into `programming` and `web`): the same, with the old slug kept as an accepted alias in the upgrade for a year.
- **Merging or renaming**: the slug stays or becomes an alias; only the name changes. Slugs are forever.
- **Promoting a tag to a filter** inside a subject needs no schema change: it's a list in the site (`apps/web/lib/explore/subjects.ts`) of which tags to show as chips under a subject, read from the tag report.

### Translations

Sixteen names in the 23 locales the player already ships (`packages/player/src/locales/`). Each locale file gains a `subjects` record typed against `SUBJECTS`, so a missing one fails the type check. The names are short enough that a first pass by a model and a check by a speaker is fine; the English names are the reference.

## Data model

```ts
// packages/spec/src/subjects.ts
export const SUBJECTS = ["programming", "ai", "tools", "design", "business", "marketing",
  "money", "science", "math", "health", "history", "society", "languages", "arts",
  "life", "careers"] as const
export type Subject = (typeof SUBJECTS)[number]
export const SUBJECT_INFO: Record<Subject, { hue: number; covers: string; notThis: string }>

// packages/spec/src/schema.ts
subject: z.enum(SUBJECTS),
tags: z.array(z.string().regex(TAG_PATTERN).min(2).max(30)).max(5).optional(),
```

```ts
// packages/db/src/schema.ts
export const lessonTag = pgTable("lesson_tag", {
  lessonId: text("lesson_id").notNull().references(() => lesson.id, { onDelete: "cascade" }),
  tag: text("tag").notNull(),
}, (t) => [
  primaryKey({ columns: [t.lessonId, t.tag] }),
  index("lesson_tag_tag_idx").on(t.tag),
])
```

The subject is read from the JSON like the title is today (`lesson->>'subject'`), with an expression index on it joined with the listing index: `index("lesson_subject_idx").on(sql\`(lesson->>'subject')\`, t.visibility, t.hidden, t.createdAt)`. No new column, so publishing stays one row write, and the JSON stays the one truth. If the feed ever needs more than that index gives, a generated column is a one-line migration later.

Explore queries gain an optional `subject` and an optional `tag` (`listLessons(db, sort, limit, { subject, tag })`); the cache key and tag include them (`["explore", sort, subject ?? "all", …]`, tags `explore` and `explore:{subject}`).

## Phases

Each phase ships on its own and leaves the product whole.

**Phase 1: the field.** Spec 0.6 with `subject` and `tags`, `topic` gone; the subject list, scope notes, and hues in `packages/spec`; the upgrade; the checker rules and normalization; the synonym table with its first rows; the examples re-labelled; the format reference, `steps.md`, docs, and `/llms.txt` updated; `npm run schema` and `npm run skill:build`; the player and rows show the translated subject name; `hueFor` reads the table; 23 locale files gain the names. No Explore change yet. Done when `npm run check` passes, a lesson with `topic` still publishes and comes back with a subject, and a lesson with `"subject": "coding"` is refused with a message that lists the 16.

**Phase 2: the index and the report.** The `lesson_tag` table and migration; writes on publish and update; the subject index; `listLessons` filters; the tag report script. Done when the report prints for the production database.

**Phase 3: Explore by subject.** Subject chips, `/explore/{subject}` pages with metadata and sitemap entries, per-subject cache tags, the empty state. Storybook story for the chip row. Done when a subject page renders in under the current Explore budget and a publish refreshes only its subject's list.

**Phase 4, when the numbers ask for it:** tag chips inside a subject from the promoted list; `/explore/{subject}/{tag}`; maybe a second-level list if one subject holds more than a third of all lessons for a month. Not planned in detail on purpose.

## Decisions

| Question | Decision |
|---|---|
| One field or two | Two: one required `subject` from a fixed list, 0–5 free `tags` |
| How many subjects | 16; wide on purpose, no "Other" |
| Primary and secondary subjects | No; a second subject becomes a tag |
| Who assigns | The agent, from the format reference, at write time; the checker refuses anything else; no server-side classifier |
| Are tags shown | Not until a tag earns a filter in a subject; stored and indexed from day one |
| Tag governance | Normalization and a hand-kept synonym table in the spec; a weekly tag report; single-use tags are fine, they just aren't shown |
| Where the subject lives in the database | In the lesson JSON with an expression index; tags also in a `lesson_tag` table for counting |
| What happens to `topic` | Removed from the spec; the upgrade maps old labels to a subject and keeps the label as a tag |
| Spec version | 0.6, upgraded on read like 0.2–0.5; no skill version bump (SKILL.md and the CLI don't change) |
| Translations | Subject names in every player locale, typed so none can be missing |
| URLs | `/explore/{subject}` now, `/explore/{subject}/{tag}` when phase 4 comes |

## Open questions

- **`ai` as its own subject.** It's the fastest-growing kind of lesson and overlaps `programming` and `tools`. The scope note separates them, but if the report shows most `ai` lessons are really "how to use product X", fold it into `tools` before phase 3 rather than after.
- **Child-reader lessons.** Reading age is a property of the writing, not the subject, so it stays out of the taxonomy. If parents turn out to browse for "lessons for kids", that's a filter on a new field, not a subject.
- **Language of tags.** Allowing Unicode tags keeps non-English lessons honest but splits the counts (`historia` and `history`). The synonym table can map common ones; a tag's language could also be inferred from the lesson's. Decide when the report shows the split matters.
