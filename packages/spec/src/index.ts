// The lesson spec v0.6: the single definition of a valid lesson.
export * from "./schema"
export {
  everyVisual,
  LIMITS,
  redundantTag,
  type Issue,
  type IssueKind,
} from "./rules"
export {
  formatIssues,
  validateLesson,
  type Note,
  type ValidationResult,
} from "./validate"
export { lessonJsonSchema } from "./json-schema"
export { canUpgrade, subjectForTopic, upgradeLesson } from "./upgrade"
export {
  isSubject,
  SUBJECT_INFO,
  SUBJECTS,
  type Subject,
  type SubjectInfo,
} from "./subjects"
export { normalizeTag, TAG_LIMITS, TAG_PATTERN, TAG_SYNONYMS } from "./tags"
