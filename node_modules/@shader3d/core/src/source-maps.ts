import type { SourceLocation } from './ast'

/**
 * Source map position
 */
export interface SourcePosition {
  line: number
  column: number
}

/**
 * Source mapping entry
 */
export interface SourceMapping {
  generated: SourcePosition
  original: SourcePosition
  source: string
  name?: string
}

/**
 * Source map V3 format
 */
export interface SourceMapV3 {
  version: 3
  file: string
  sourceRoot?: string
  sources: string[]
  sourcesContent?: (string | null)[]
  names: string[]
  mappings: string
}

/**
 * VLQ encoding table
 */
const VLQ_BASE_SHIFT = 5
const VLQ_BASE = 1 << VLQ_BASE_SHIFT
const VLQ_BASE_MASK = VLQ_BASE - 1
const VLQ_CONTINUATION_BIT = VLQ_BASE

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/**
 * Encode a number as VLQ
 */
function encodeVLQ(value: number): string {
  let encoded = ''
  let vlq = value < 0 ? ((-value) << 1) + 1 : value << 1

  do {
    let digit = vlq & VLQ_BASE_MASK
    vlq >>>= VLQ_BASE_SHIFT
    if (vlq > 0) {
      digit |= VLQ_CONTINUATION_BIT
    }
    encoded += BASE64_CHARS[digit]
  } while (vlq > 0)

  return encoded
}

/**
 * Source Map Generator
 */
export class SourceMapGenerator {
  private mappings: SourceMapping[] = []
  private sources: string[] = []
  private sourcesContent: Map<string, string> = new Map()
  private names: string[] = []
  private file: string

  constructor(file: string) {
    this.file = file
  }

  /**
   * Add a source file
   */
  addSource(source: string, content?: string): number {
    let index = this.sources.indexOf(source)
    if (index === -1) {
      index = this.sources.length
      this.sources.push(source)
      if (content) {
        this.sourcesContent.set(source, content)
      }
    }
    return index
  }

  /**
   * Add a name
   */
  addName(name: string): number {
    let index = this.names.indexOf(name)
    if (index === -1) {
      index = this.names.length
      this.names.push(name)
    }
    return index
  }

  /**
   * Add a mapping
   */
  addMapping(mapping: SourceMapping): void {
    this.mappings.push(mapping)
    this.addSource(mapping.source)
    if (mapping.name) {
      this.addName(mapping.name)
    }
  }

  /**
   * Add a mapping from source location
   */
  addLocationMapping(
    generatedLine: number,
    generatedColumn: number,
    originalLocation: SourceLocation,
    name?: string
  ): void {
    this.addMapping({
      generated: { line: generatedLine, column: generatedColumn },
      original: { line: originalLocation.line, column: originalLocation.column },
      source: originalLocation.file,
      name
    })
  }

  /**
   * Generate source map JSON
   */
  generate(): SourceMapV3 {
    // Sort mappings by generated position
    this.mappings.sort((a, b) => {
      if (a.generated.line !== b.generated.line) {
        return a.generated.line - b.generated.line
      }
      return a.generated.column - b.generated.column
    })

    // Encode mappings
    const encodedMappings = this.encodeMappings()

    // Build sources content array
    const sourcesContent = this.sources.map(s => this.sourcesContent.get(s) || null)

    return {
      version: 3,
      file: this.file,
      sources: this.sources,
      sourcesContent,
      names: this.names,
      mappings: encodedMappings
    }
  }

  /**
   * Generate source map as JSON string
   */
  toString(): string {
    return JSON.stringify(this.generate())
  }

  /**
   * Generate source map as data URL
   */
  toDataURL(): string {
    const json = this.toString()
    const base64 = typeof btoa === 'function' 
      ? btoa(json)
      : (globalThis as any).Buffer?.from(json).toString('base64') || btoa(json)
    return `data:application/json;base64,${base64}`
  }

  /**
   * Generate source map comment for appending to output
   */
  toComment(): string {
    return `//# sourceMappingURL=${this.toDataURL()}`
  }

  private encodeMappings(): string {
    const lines: string[] = []
    let prevGeneratedLine = 1
    let prevGeneratedColumn = 0
    let prevOriginalLine = 0
    let prevOriginalColumn = 0
    let prevSourceIndex = 0
    let prevNameIndex = 0

    let currentLine: string[] = []

    for (const mapping of this.mappings) {
      // Handle line changes
      while (prevGeneratedLine < mapping.generated.line) {
        lines.push(currentLine.join(','))
        currentLine = []
        prevGeneratedLine++
        prevGeneratedColumn = 0
      }

      // Encode segment
      let segment = ''

      // Generated column (relative to previous)
      segment += encodeVLQ(mapping.generated.column - prevGeneratedColumn)
      prevGeneratedColumn = mapping.generated.column

      // Source index
      const sourceIndex = this.sources.indexOf(mapping.source)
      segment += encodeVLQ(sourceIndex - prevSourceIndex)
      prevSourceIndex = sourceIndex

      // Original line (relative, 0-based in source map)
      segment += encodeVLQ((mapping.original.line - 1) - prevOriginalLine)
      prevOriginalLine = mapping.original.line - 1

      // Original column (relative)
      segment += encodeVLQ(mapping.original.column - prevOriginalColumn)
      prevOriginalColumn = mapping.original.column

      // Name index (if present)
      if (mapping.name) {
        const nameIndex = this.names.indexOf(mapping.name)
        segment += encodeVLQ(nameIndex - prevNameIndex)
        prevNameIndex = nameIndex
      }

      currentLine.push(segment)
    }

    // Don't forget the last line
    if (currentLine.length > 0) {
      lines.push(currentLine.join(','))
    }

    return lines.join(';')
  }
}

/**
 * Create source map generator for a transpilation
 */
export function createSourceMapGenerator(outputFile: string): SourceMapGenerator {
  return new SourceMapGenerator(outputFile)
}

/**
 * Merge multiple source maps (for chained transformations)
 */
export function mergeSourceMaps(maps: SourceMapV3[]): SourceMapV3 {
  if (maps.length === 0) {
    throw new Error('No source maps to merge')
  }
  if (maps.length === 1) {
    return maps[0]
  }

  // For now, simple concatenation - proper merging would trace through chains
  const merged = new SourceMapGenerator(maps[maps.length - 1].file)
  
  // Add all sources
  const allSources = new Set<string>()
  maps.forEach(map => map.sources.forEach(s => allSources.add(s)))
  
  allSources.forEach(source => merged.addSource(source))

  // The proper implementation would decode and re-encode following the chain
  // This is a simplified version
  return merged.generate()
}

/**
 * Add source map to generated code
 */
export function appendSourceMap(code: string, sourceMap: SourceMapV3): string {
  const base64 = typeof btoa === 'function'
    ? btoa(JSON.stringify(sourceMap))
    : (globalThis as any).Buffer?.from(JSON.stringify(sourceMap)).toString('base64') || btoa(JSON.stringify(sourceMap))
  
  return `${code}\n//# sourceMappingURL=data:application/json;base64,${base64}`
}
