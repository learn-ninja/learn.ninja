// The lesson spec v0.5: the single definition of a valid lesson.
export * from "./schema"
export { everyVisual, LIMITS, type Issue, type IssueKind } from "./rules"
export { formatIssues, validateLesson, type ValidationResult } from "./validate"
export { lessonJsonSchema } from "./json-schema"
export { canUpgrade, upgradeLesson } from "./upgrade"
