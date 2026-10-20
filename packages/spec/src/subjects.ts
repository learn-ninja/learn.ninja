// The subjects a lesson can belong to: one required pick from a fixed list, chosen by the agent at
// write time and refused by the checker otherwise. The list is short and wide on purpose (no
// "Other"), slugs never change once shipped, and the player translates the names. The scope notes
// are what the format reference shows the agent; the hue is the lesson's aura on the title screen.
// plans/subjects-and-tags.md says why.

export const SUBJECTS = [
  "programming",
  "ai",
  "tools",
  "design",
  "business",
  "marketing",
  "money",
  "science",
  "math",
  "health",
  "history",
  "society",
  "languages",
  "arts",
  "life",
  "careers",
] as const

export type Subject = (typeof SUBJECTS)[number]

export interface SubjectInfo {
  /** The English name, as a browse menu shows it: two words at most. Other languages live in the player's locales. */
  name: string
  /** The aura's hue on the title screen (0–359), picked so related subjects sit near each other on the wheel. */
  hue: number
  /** What belongs here. */
  covers: string
  /** The tiebreaker: what looks like it belongs here but goes elsewhere, and where. */
  notThis: string
}

export const SUBJECT_INFO: Record<Subject, SubjectInfo> = {
  programming: {
    name: "Programming",
    hue: 220,
    covers:
      "Languages, frameworks, algorithms, software design, databases, testing, version control",
    notThis:
      "Using a developer tool as a user without code (→ `tools`); AI as a subject (→ `ai`)",
  },
  ai: {
    name: "AI",
    hue: 280,
    covers:
      "How models work, prompting, agents, machine learning concepts, working with AI tools",
    notThis:
      "Writing code that calls an API, where the lesson is about the code (→ `programming`)",
  },
  tools: {
    name: "Tools & productivity",
    hue: 200,
    covers:
      "How to use a specific app, product, or workflow: Git as a tool, spreadsheets, note apps, keyboard habits, personal productivity systems",
    notThis:
      "Programming in that tool's language (→ `programming`); a tool used for design (→ `design`)",
  },
  design: {
    name: "Design",
    hue: 320,
    covers:
      "UI, UX, visual and graphic design, typography, product design, design systems",
    notThis: "Art appreciation and art history (→ `arts`)",
  },
  business: {
    name: "Business & startups",
    hue: 240,
    covers:
      "Strategy, startups, management, operations, entrepreneurship, product management, economics as it applies to firms",
    notThis:
      "Personal money (→ `money`); the macroeconomics of nations (→ `society`)",
  },
  marketing: {
    name: "Marketing & writing",
    hue: 5,
    covers:
      "Marketing, sales, copywriting, content, social media, public speaking, professional writing",
    notThis:
      "Creative writing (→ `arts`); grammar of a language being learned (→ `languages`)",
  },
  money: {
    name: "Money & finance",
    hue: 120,
    covers:
      "Personal finance, investing, accounting, economics for individuals",
    notThis: "Running a company's finances (→ `business`)",
  },
  science: {
    name: "Science",
    hue: 185,
    covers:
      "Physics, chemistry, biology, earth and space science, scientific method",
    notThis: "Human health (→ `health`); maths on its own (→ `math`)",
  },
  math: {
    name: "Math & data",
    hue: 260,
    covers:
      "Arithmetic through calculus, statistics, probability, data literacy, data analysis",
    notThis:
      "Programming a data pipeline (→ `programming`); machine learning (→ `ai`)",
  },
  health: {
    name: "Health & fitness",
    hue: 155,
    covers:
      "Medicine for lay readers, nutrition, exercise, sleep, mental health, first aid",
    notThis: "Biology for its own sake (→ `science`)",
  },
  history: {
    name: "History",
    hue: 40,
    covers: "Any period, place, or theme in history; archaeology",
    notThis: "Current politics and institutions (→ `society`)",
  },
  society: {
    name: "Society & ideas",
    hue: 340,
    covers:
      "Politics, law, philosophy, religion, psychology, sociology, geography, current affairs, civics",
    notThis: "Historical events (→ `history`); personal habits (→ `life`)",
  },
  languages: {
    name: "Languages",
    hue: 55,
    covers:
      "Learning a language: vocabulary, grammar, phrases, pronunciation. Set `targetLanguage`",
    notThis: "Writing well in your own language (→ `marketing`)",
  },
  arts: {
    name: "Arts & culture",
    hue: 300,
    covers:
      "Music, film, literature, visual art, creative writing, photography, games as culture, pop culture",
    notThis:
      "Making a UI (→ `design`); the history of an art movement when the lesson is history first (→ `history`)",
  },
  life: {
    name: "Everyday life",
    hue: 80,
    covers:
      "Cooking, gardening, home, parenting, travel, pets, hobbies, crafts, DIY, relationships, study skills",
    notThis: "Health and fitness (→ `health`); personal finance (→ `money`)",
  },
  careers: {
    name: "Careers & learning",
    hue: 25,
    covers:
      "Job search, interviews, workplace skills, leadership as a skill, teaching, how to learn, exam prep",
    notThis: "Running a business (→ `business`); a specific tool (→ `tools`)",
  },
}

export function isSubject(value: unknown): value is Subject {
  return (
    typeof value === "string" && (SUBJECTS as readonly string[]).includes(value)
  )
}
