export {
  MagicCommentParser,
  JSToWGSLConverter,
  hasMagicComments,
  parseMagicComments,
  convertMagicToWGSL
} from './magic-comments'
export type { MagicCommentDirective } from './magic-comments'

export {
  SkillLevelDetector,
  SKILL_LEVELS,
  detectSkillLevel,
  getSkillLevelInfo,
  canUpgrade
} from './detector'
export type { SkillLevel, DetectionResult, SkillLevelInfo } from './detector'

export {
  ProjectScaffolder,
  createScaffolder,
  scaffoldProject
} from './scaffolder'
export type { ScaffoldOptions, ProjectTemplate } from './scaffolder'

export {
  main as runCLI,
  initCommand,
  upgradeCommand,
  buildCommand,
  watchCommand
} from './cli'
