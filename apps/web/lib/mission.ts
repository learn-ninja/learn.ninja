// The words on /mission: the mission line and the nine areas where help goes furthest.
// CONTRIBUTING.md's "Where we want help" table lists the same areas; mission.test.ts keeps
// the two in step.

import { SITE } from "./site"

export const MISSION =
  "The best interactive learning in the world. Free for everyone."

export const MISSION_SUMMARY =
  "Duolingo and Brilliant proved short, hands-on lessons work. Together, we're bringing them to every subject, in every language."

export type AreaIcon =
  | "subjects"
  | "languages"
  | "katas"
  | "rich"
  | "tutor"
  | "memory"
  | "paths"
  | "motivation"
  | "agents"

export type Area = {
  title: string
  icon: AreaIcon
  level: "Beginner" | "Intermediate" | "Advanced" | "Project"
  /** Starts as an Idea issue rather than a pull request: it reaches every lesson or needs accounts. */
  proposal?: boolean
  /** The "If you…" opener, without its full stop. */
  who: string
  ask: string
  /** The GitHub label its issues carry; a proposal links to the Idea form instead. */
  label?: string
}

export const AREAS: Area[] = [
  {
    title: "Subjects",
    icon: "subjects",
    level: "Beginner",
    who: "If you know a subject",
    ask: "Example lessons for subjects we don't cover yet.",
    label: "area: subjects",
  },
  {
    title: "Languages",
    icon: "languages",
    level: "Beginner",
    who: "If you speak a language",
    ask: "Check a translation as a native speaker.",
    label: "translation",
  },
  {
    title: "Katas",
    icon: "katas",
    level: "Intermediate",
    who: "If you care how a question lands",
    ask: "A kata is one lesson screen. Sharper feedback, hints, and visuals.",
    label: "area: katas",
  },
  {
    title: "Rich lessons",
    icon: "rich",
    level: "Advanced",
    who: "If you build things",
    ask: "Visuals the player draws itself, like chess and maps, plus sound and motion.",
    label: "area: rich-lessons",
  },
  {
    title: "Tutor",
    icon: "tutor",
    level: "Project",
    proposal: true,
    who: 'If you\'ve wanted to ask a lesson "why?"',
    ask: "Explain-my-answer and Socratic hints inside a lesson.",
  },
  {
    title: "Memory",
    icon: "memory",
    level: "Advanced",
    proposal: true,
    who: "If you know how learning sticks",
    ask: "Spaced review and a Mistakes mode. Needs accounts.",
  },
  {
    title: "Paths",
    icon: "paths",
    level: "Advanced",
    proposal: true,
    who: "If you've designed a curriculum",
    ask: "Courses, placement, and adaptive difficulty. Needs accounts.",
  },
  {
    title: "Motivation",
    icon: "motivation",
    level: "Intermediate",
    who: "If you've felt a streak pull you back",
    ask: "XP, quests, leagues, and reminders that reward, never punish.",
    label: "area: motivation",
  },
  {
    title: "Agents",
    icon: "agents",
    level: "Project",
    who: "If you use an agent",
    ask: "The teaching guide and checker, so every lesson is written well the first time.",
    label: "area: agents",
  },
]

export const IDEA_URL = `${SITE.repo}/issues/new?template=idea.yml`
export const GOOD_FIRST_ISSUES_URL = `${SITE.repo}/labels/good%20first%20issue`
export const CONTRIBUTING_URL = `${SITE.repo}/blob/main/CONTRIBUTING.md`

/** Where an area's card leads: its open issues, or the Idea form for a proposal. */
export function areaHref(area: Area): string {
  if (area.proposal || !area.label) return IDEA_URL
  const query = `is:open label:"${area.label}"`
  return `${SITE.repo}/issues?q=${encodeURIComponent(query)}`
}
