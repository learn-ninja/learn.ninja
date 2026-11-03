// The words on /mission: the mission line, the nine areas where help
// goes furthest (grouped), and the four steps for someone new. CONTRIBUTING.md's "Where we want
// help" table lists the same areas; mission.test.ts keeps the two in step.

import { SITE } from "./site"

export const MISSION = "The best interactive learning in the world. Free for everyone."

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
  /** Spans both columns. */
  wide?: boolean
}

export type AreaGroup = { title: string; lead: string; areas: Area[] }

export const AREA_GROUPS: AreaGroup[] = [
  {
    title: "Content",
    lead: "What the agent learns from, and what the player says in your language.",
    areas: [
      {
        title: "Subjects",
        icon: "subjects",
        level: "Beginner",
        who: "If you know a subject",
        ask: "Example lessons for subjects we don't cover, and reports of bad published lessons.",
        label: "area: subjects",
      },
      {
        title: "Languages",
        icon: "languages",
        level: "Beginner",
        who: "If you speak a language",
        ask: "Check one of the player's translations as a native speaker, and fix right-to-left issues.",
        label: "translation",
      },
    ],
  },
  {
    title: "The lesson",
    lead: "What happens on each screen: the question, the feedback, the visual, the help.",
    areas: [
      {
        title: "Katas",
        icon: "katas",
        level: "Intermediate",
        who: "If you care how a question lands",
        ask: "Sharper feedback, hints, and visuals in the nine kata types, and question-first teaching in the guide.",
        label: "area: katas",
      },
      {
        title: "Rich lessons",
        icon: "rich",
        level: "Advanced",
        who: "If you build things",
        ask: "Interactive visuals the player renders itself, like chess and maps today, plus sounds, motion, and haptics.",
        label: "area: rich-lessons",
      },
      {
        title: "Tutor",
        icon: "tutor",
        level: "Project",
        proposal: true,
        who: 'If you\'ve wanted to ask a lesson "why?"',
        ask: "Explain-my-answer and Socratic hints inside a lesson, from the agent that wrote it or from a server. The cost question comes before the code.",
        wide: true,
      },
    ],
  },
  {
    title: "The journey",
    lead: "What happens between lessons: remembering, sequencing, and coming back tomorrow.",
    areas: [
      {
        title: "Memory",
        icon: "memory",
        level: "Advanced",
        proposal: true,
        who: "If you know how learning sticks",
        ask: "Review and spaced repetition across lessons, and a Mistakes mode. Needs accounts.",
      },
      {
        title: "Paths",
        icon: "paths",
        level: "Advanced",
        proposal: true,
        who: "If you've designed a curriculum",
        ask: "Courses as sequences of lessons, placement, and adaptive difficulty. Needs accounts.",
      },
      {
        title: "Motivation",
        icon: "motivation",
        level: "Intermediate",
        who: "If you've felt a streak pull you back",
        ask: "XP, quests, milestones, share cards, leagues, reminders and widgets. Rewarding usage, never punishing mistakes.",
        label: "area: motivation",
        wide: true,
      },
    ],
  },
  {
    title: "Across all three",
    lead: "The agent writes every part above. Teach it well and everything gets better at once.",
    areas: [
      {
        title: "Agents",
        icon: "agents",
        level: "Project",
        who: "If you use an agent",
        ask: "The teaching guide, the checker, and round trips from every agent, so every part above gets written well the first time.",
        label: "area: agents",
        wide: true,
      },
    ],
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
