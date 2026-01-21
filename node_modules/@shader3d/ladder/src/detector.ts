// Skill levels: 0=JS Magic, 1=Template, 2=Full DSL, 3=Expert WGSL
export type SkillLevel = 0 | 1 | 2 | 3

export interface SkillLevelInfo {
  level: SkillLevel
  name: string
  description: string
  features: string[]
}

export const SKILL_LEVELS: Record<SkillLevel, SkillLevelInfo> = {
  0: {
    level: 0,
    name: 'JS Magic',
    description: 'Normal JavaScript with magic comments',
    features: [
      'Write regular JavaScript functions',
      'Mark GPU functions with /* @3d-shader compute */',
      'Auto-conversion to WGSL',
      'Limited control but easy to start'
    ]
  },
  1: {
    level: 1,
    name: 'Template DSL',
    description: 'Simplified shader syntax',
    features: [
      'Use shader3d.fragment() and shader3d.compute()',
      'Shadertoy-compatible uniforms',
      'ShaderPark-style SDF primitives',
      'Type inference for common patterns'
    ]
  },
  2: {
    level: 2,
    name: 'Full DSL',
    description: 'Complete Shader3D TypeScript syntax',
    features: [
      'Full TypeScript type safety',
      'Explicit struct definitions',
      'Custom bind groups and layouts',
      'Performance optimizations'
    ]
  },
  3: {
    level: 3,
    name: 'Expert',
    description: 'Raw WGSL with Shader3D helpers',
    features: [
      'Write raw WGSL directly',
      'Use Shader3D for build integration only',
      'Full control over all aspects',
      'Escape hatch for complex shaders'
    ]
  }
}

/**
 * Detection result
 */
export interface DetectionResult {
  level: SkillLevel
  confidence: number
  indicators: string[]
  suggestions: string[]
}

/**
 * Patterns that indicate skill level
 */
const LEVEL_PATTERNS = {
  level0: [
    /\/\*\s*@3d-shader/,
    /\/\/\s*@3d-shader/,
    /function\s+\w+\s*\([^)]*\)\s*{/,
    /Math\.(sin|cos|pow)/
  ],
  level1: [
    /shader3d\.(fragment|vertex|compute)\s*\(/,
    /\$\.(sphere|box|torus)/,
    /\.(time|resolution|mouse)\b/,
    /mainImage\s*\(/
  ],
  level2: [
    /@(compute|vertex|fragment)\s*$/m,
    /interface\s+\w+\s*{[^}]*vec[234]/,
    /@group\s*\(\s*\d+\s*\)/,
    /@binding\s*\(\s*\d+\s*\)/,
    /\bstruct\s+\w+/
  ],
  level3: [
    /fn\s+\w+\s*\([^)]*\)\s*->/,
    /var<(storage|uniform|private)>/,
    /\bworkgroupBarrier\s*\(/,
    /textureLoad\s*\(/,
    /atomicAdd\s*\(/
  ]
}

/**
 * Detect skill level from source code
 */
export class SkillLevelDetector {
  /**
   * Analyze source code and detect skill level
   */
  detect(source: string, filename: string): DetectionResult {
    const scores: Record<SkillLevel, number> = { 0: 0, 1: 0, 2: 0, 3: 0 }
    const indicators: string[] = []

    // Check Level 0 patterns
    LEVEL_PATTERNS.level0.forEach(pattern => {
      if (pattern.test(source)) {
        scores[0]++
        indicators.push(`Found Level 0 pattern: ${pattern.source.slice(0, 30)}...`)
      }
    })

    // Check Level 1 patterns
    LEVEL_PATTERNS.level1.forEach(pattern => {
      if (pattern.test(source)) {
        scores[1]++
        indicators.push(`Found Level 1 pattern: ${pattern.source.slice(0, 30)}...`)
      }
    })

    // Check Level 2 patterns
    LEVEL_PATTERNS.level2.forEach(pattern => {
      if (pattern.test(source)) {
        scores[2]++
        indicators.push(`Found Level 2 pattern: ${pattern.source.slice(0, 30)}...`)
      }
    })

    // Check Level 3 patterns
    LEVEL_PATTERNS.level3.forEach(pattern => {
      if (pattern.test(source)) {
        scores[3]++
        indicators.push(`Found Level 3 pattern: ${pattern.source.slice(0, 30)}...`)
      }
    })

    // Check file extension
    if (filename.endsWith('.wgsl')) {
      scores[3] += 3
      indicators.push('File extension is .wgsl')
    } else if (filename.endsWith('.shader3d') || filename.endsWith('.3d')) {
      scores[2] += 2
      indicators.push('File extension is .shader3d or .3d')
    } else if (filename.endsWith('.js') || filename.endsWith('.ts')) {
      if (scores[0] > 0) {
        scores[0] += 1
      }
    }

    // Determine level with highest score
    let maxScore = 0
    let detectedLevel: SkillLevel = 0 as SkillLevel
    
    (Object.entries(scores) as [string, number][]).forEach(([level, score]: [string, number]) => {
      if (score > maxScore) {
        maxScore = score
        detectedLevel = parseInt(level) as SkillLevel
      }
    })

    // Calculate confidence
    const totalPatterns = Object.values(LEVEL_PATTERNS).flat().length
    const confidence = maxScore > 0 ? Math.min(maxScore / 4, 1) : 0

    // Generate suggestions
    const suggestions = this.generateSuggestions(detectedLevel, source)

    return {
      level: detectedLevel,
      confidence,
      indicators,
      suggestions
    }
  }

  /**
   * Generate suggestions for upgrading
   */
  private generateSuggestions(level: SkillLevel, source: string): string[] {
    const suggestions: string[] = []

    if (level === 0) {
      suggestions.push('Consider upgrading to Level 1 for better type safety')
      suggestions.push("Run 'npx shader3d upgrade' to auto-convert magic comments")
      
      if (source.includes('for') && source.includes('of')) {
        suggestions.push('Replace for...of loops with explicit index iteration for better GPU performance')
      }
    }

    if (level === 1) {
      suggestions.push('Add explicit type annotations for struct fields')
      suggestions.push('Consider using @group/@binding for resource management')
    }

    if (level === 2) {
      if (!source.includes('@workgroup_size')) {
        suggestions.push('Add explicit @workgroup_size for compute shaders')
      }
      
      if (source.includes('storage') && !source.includes('read_write')) {
        suggestions.push('Consider explicit access modes (read, write, read_write) for storage buffers')
      }
    }

    if (level === 3) {
      suggestions.push('You are using raw WGSL - maximum control!')
      suggestions.push('Consider Shader3D DSL for better error messages and type checking')
    }

    return suggestions
  }

  /**
   * Get recommended next level
   */
  getNextLevel(currentLevel: SkillLevel): SkillLevel | null {
    if (currentLevel >= 3) return null
    return (currentLevel + 1) as SkillLevel
  }

  /**
   * Get learning path from current to target level
   */
  getLearningPath(from: SkillLevel, to: SkillLevel): SkillLevelInfo[] {
    if (from >= to) return []
    
    const path: SkillLevelInfo[] = []
    for (let level = from + 1; level <= to; level++) {
      path.push(SKILL_LEVELS[level as SkillLevel])
    }
    return path
  }
}

/**
 * Detect skill level from source
 */
export function detectSkillLevel(source: string, filename: string): DetectionResult {
  const detector = new SkillLevelDetector()
  return detector.detect(source, filename)
}

/**
 * Get skill level info
 */
export function getSkillLevelInfo(level: SkillLevel): SkillLevelInfo {
  return SKILL_LEVELS[level]
}

/**
 * Check if source can be upgraded
 */
export function canUpgrade(source: string, filename: string): boolean {
  const result = detectSkillLevel(source, filename)
  return result.level < 3
}
