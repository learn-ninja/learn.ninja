// The lesson spec v0.8: the single definition of a valid lesson.
export * from "./schema"
export {
  everyVisual,
  fractionStep,
  LEVELS,
  LIMITS,
  type Level,
} from "./basics"
export { redundantTag, type Issue, type IssueKind } from "./rules"
export {
  formatIssues,
  validateLesson,
  type Note,
  type ValidationResult,
} from "./validate"
export { lessonJsonSchema } from "./json-schema"
export { pieceOn, readFen, type FenPiece, type Placement } from "./chess"
export { COUNTRIES, NOT_ON_MAP, type Country } from "./countries"
export { DRAWN_SIZES } from "./map-sizes"
export {
  boxesOverlap,
  inBox,
  MAP_MIN_TAP,
  MAP_REGION_NAMES,
  MAP_REGIONS,
  MAP_WIDTH,
  type Box,
  type MapRegion,
} from "./map"
export { listItem, textBlocks, type TextBlock } from "./text"
export { canUpgrade, subjectForTopic, upgradeLesson } from "./upgrade"
export {
  isSubject,
  SUBJECT_INFO,
  SUBJECTS,
  type Subject,
  type SubjectInfo,
} from "./subjects"
export {
  isTagLabel,
  labelForTag,
  normalizeLabel,
  normalizeTag,
  TAG_LABEL_PATTERN,
  TAG_LABELS,
  TAG_LIMITS,
  TAG_PATTERN,
  TAG_SYNONYMS,
} from "./tags"
