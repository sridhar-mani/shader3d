import * as ts from 'typescript'

/**
 * Magic comment directive types
 */
export interface MagicCommentDirective {
  type: 'compute' | 'vertex' | 'fragment'
  name?: string
  workgroupSize?: number
  target: string
  location: { line: number; column: number }
  options: Record<string, string>
}

/**
 * Magic comment patterns
 */
const MAGIC_PATTERNS = {
  // /* @3d-shader compute */
  block: /\/\*\s*@3d-shader\s+(compute|vertex|fragment)(?:\s*=\s*"([^"]+)")?(?:\s+([^*]+))?\s*\*\//,
  // // @3d-shader compute
  line: /\/\/\s*@3d-shader\s+(compute|vertex|fragment)(?:\s*=\s*"([^"]+)")?(?:\s+(.+))?$/,
  // Options like workgroup=64, binding=0
  options: /(\w+)\s*=\s*(\S+)/g
}

/**
 * Parse magic comments from source code
 */
export class MagicCommentParser {
  private sourceFile: ts.SourceFile
  private sourceText: string

  constructor(source: string, filename: string) {
    this.sourceText = source
    this.sourceFile = ts.createSourceFile(
      filename,
      source,
      ts.ScriptTarget.Latest,
      true
    )
  }

  /**
   * Extract all magic comment directives
   */
  parse(): MagicCommentDirective[] {
    const directives: MagicCommentDirective[] = []

    const visit = (node: ts.Node) => {
      if (ts.isFunctionDeclaration(node) || 
          ts.isFunctionExpression(node) ||
          ts.isArrowFunction(node)) {
        const directive = this.extractDirective(node)
        if (directive) {
          directives.push(directive)
        }
      }

      ts.forEachChild(node, visit)
    }

    visit(this.sourceFile)
    return directives
  }

  /**
   * Check if source has any magic comments
   */
  hasMagicComments(): boolean {
    return MAGIC_PATTERNS.block.test(this.sourceText) || 
           MAGIC_PATTERNS.line.test(this.sourceText)
  }

  /**
   * Extract directive from a function node
   */
  private extractDirective(
    node: ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction
  ): MagicCommentDirective | null {
    const fullText = node.getFullText(this.sourceFile)
    
    // Try block comment pattern
    let match = fullText.match(MAGIC_PATTERNS.block)
    if (!match) {
      // Try line comment pattern
      match = fullText.match(MAGIC_PATTERNS.line)
    }
    
    if (!match) {
      return null
    }

    const [, type, name, optionsStr] = match
    const functionName = this.getFunctionName(node)
    
    // Parse options
    const options: Record<string, string> = {}
    if (optionsStr) {
      let optMatch
      while ((optMatch = MAGIC_PATTERNS.options.exec(optionsStr)) !== null) {
        options[optMatch[1]] = optMatch[2]
      }
    }

    const { line, character } = this.sourceFile.getLineAndCharacterOfPosition(node.getStart())

    return {
      type: type as 'compute' | 'vertex' | 'fragment',
      name: name || functionName,
      workgroupSize: options.workgroup ? parseInt(options.workgroup) : undefined,
      target: functionName,
      location: { line: line + 1, column: character + 1 },
      options
    }
  }

  /**
   * Get function name from node
   */
  private getFunctionName(
    node: ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction
  ): string {
    if (ts.isFunctionDeclaration(node) && node.name) {
      return node.name.text
    }
    
    if (ts.isFunctionExpression(node) && node.name) {
      return node.name.text
    }

    // Try to get name from parent variable declaration
    const parent = node.parent
    if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
      return parent.name.text
    }

    return 'anonymous'
  }
}

/**
 * Convert JavaScript function to WGSL
 */
export class JSToWGSLConverter {
  /**
   * Convert a JavaScript function to WGSL
   */
  convert(func: ts.FunctionDeclaration, directive: MagicCommentDirective): string {
    const lines: string[] = []
    
    // Add stage decorator
    lines.push(`@${directive.type}`)
    
    if (directive.type === 'compute') {
      lines.push(`@workgroup_size(${directive.workgroupSize || 64})`)
    }

    // Generate function signature
    const params = this.generateParameters(func, directive)
    const returnType = this.generateReturnType(func, directive)
    
    lines.push(`fn ${directive.name || directive.target}(${params})${returnType} {`)
    
    // Convert body
    if (func.body) {
      const body = this.convertBody(func.body, directive)
      lines.push(body)
    }
    
    lines.push('}')

    return lines.join('\n')
  }

  /**
   * Generate WGSL parameters
   */
  private generateParameters(
    func: ts.FunctionDeclaration,
    directive: MagicCommentDirective
  ): string {
    const params: string[] = []

    if (directive.type === 'compute') {
      // Add builtin invocation ID
      params.push('@builtin(global_invocation_id) id: vec3<u32>')
    } else if (directive.type === 'vertex') {
      params.push('@builtin(vertex_index) vertex_index: u32')
    }

    // Convert function parameters
    func.parameters.forEach((param, index) => {
      const name = param.name.getText()
      const binding = directive.options[`${name}_binding`] || String(index)
      const group = directive.options[`${name}_group`] || '0'
      
      // Infer type from parameter name or type annotation
      const typeStr = this.inferWGSLType(param, name)
      
      if (typeStr.includes('array') || typeStr.includes('ptr')) {
        params.push(`@group(${group}) @binding(${binding}) ${name}: ${typeStr}`)
      } else if (param.type) {
        params.push(`${name}: ${typeStr}`)
      }
    })

    return params.join(',\n  ')
  }

  /**
   * Generate return type
   */
  private generateReturnType(
    func: ts.FunctionDeclaration,
    directive: MagicCommentDirective
  ): string {
    if (directive.type === 'vertex') {
      return ' -> @builtin(position) vec4<f32>'
    }
    
    if (directive.type === 'fragment') {
      return ' -> @location(0) vec4<f32>'
    }

    return ''
  }

  /**
   * Infer WGSL type from JS parameter
   */
  private inferWGSLType(param: ts.ParameterDeclaration, name: string): string {
    // Common naming patterns
    if (name.includes('particles') || name.endsWith('Array') || name.endsWith('Buffer')) {
      return 'ptr<storage, array<f32>, read_write>'
    }
    
    if (name === 'dt' || name === 'deltaTime' || name === 'time') {
      return 'f32'
    }

    if (name.includes('count') || name.includes('index')) {
      return 'u32'
    }

    // Check type annotation
    if (param.type) {
      const typeText = param.type.getText()
      if (typeText.includes('Float32Array')) return 'ptr<storage, array<f32>, read_write>'
      if (typeText.includes('number[]')) return 'ptr<storage, array<f32>, read_write>'
      if (typeText === 'number') return 'f32'
      if (typeText === 'boolean') return 'bool'
    }

    return 'f32'
  }

  /**
   * Convert JavaScript function body to WGSL
   */
  private convertBody(body: ts.Block, directive: MagicCommentDirective): string {
    let wgsl = body.getText()
    
    // Remove outer braces
    wgsl = wgsl.slice(1, -1).trim()

    // Apply transformations
    wgsl = wgsl
      // Variable declarations
      .replace(/\b(let|const)\s+/g, 'var ')
      
      // for...of loops -> index-based iteration
      .replace(
        /for\s*\(\s*(?:let|const|var)\s+(\w+)\s+of\s+(\w+)\s*\)/g,
        'for (var __i: u32 = 0u; __i < arrayLength(&$2); __i++)'
      )
      
      // Array length
      .replace(/(\w+)\.length/g, 'arrayLength(&$1)')
      
      // Math functions
      .replace(/Math\.(sin|cos|tan|atan|atan2|sqrt|pow|abs|floor|ceil|round|min|max|exp|log|sign|clamp)/g, '$1')
      .replace(/Math\.PI/g, '3.14159265359')
      .replace(/Math\.random\(\)/g, '/* random() not supported */')
      
      // Type casts
      .replace(/Number\((\w+)\)/g, 'f32($1)')
      .replace(/parseInt\(([^)]+)\)/g, 'i32($1)')
      
      // Boolean literals
      .replace(/\btrue\b/g, 'true')
      .replace(/\bfalse\b/g, 'false')
      
      // Ternary (basic support)
      .replace(/(\w+)\s*\?\s*([^:]+)\s*:\s*([^;,)]+)/g, 'select($3, $2, $1)')

    // Indent
    return wgsl
      .split('\n')
      .map(line => '  ' + line.trim())
      .filter(line => line.trim())
      .join('\n')
  }
}

/**
 * Quick check for magic comments in source
 */
export function hasMagicComments(source: string): boolean {
  return MAGIC_PATTERNS.block.test(source) || MAGIC_PATTERNS.line.test(source)
}

/**
 * Parse magic comments from source
 */
export function parseMagicComments(source: string, filename: string): MagicCommentDirective[] {
  const parser = new MagicCommentParser(source, filename)
  return parser.parse()
}

/**
 * Convert magic-commented JS to WGSL
 */
export function convertMagicToWGSL(source: string, filename: string): string {
  const parser = new MagicCommentParser(source, filename)
  const directives = parser.parse()
  
  if (directives.length === 0) {
    return ''
  }

  // Parse source file
  const sourceFile = ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    true
  )

  const converter = new JSToWGSLConverter()
  const wgslParts: string[] = []

  // Find functions and convert
  const findFunction = (name: string): ts.FunctionDeclaration | undefined => {
    let found: ts.FunctionDeclaration | undefined
    
    const visit = (node: ts.Node) => {
      if (ts.isFunctionDeclaration(node) && node.name?.text === name) {
        found = node
        return
      }
      ts.forEachChild(node, visit)
    }
    
    visit(sourceFile)
    return found
  }

  directives.forEach(directive => {
    const func = findFunction(directive.target)
    if (func) {
      wgslParts.push(converter.convert(func, directive))
    }
  })

  return wgslParts.join('\n\n')
}
