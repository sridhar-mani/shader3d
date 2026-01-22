import type { Diagnostic, SourceLocation } from '../types';

export interface RichDiagnostic extends Diagnostic {
  code: string;
  category: DiagnosticCategory;
  source?: string;
  relatedInformation?: RelatedInformation[];
  fixes?: QuickFix[];
  documentationUrl?: string;
}

export interface RelatedInformation {
  location: SourceLocation;
  message: string;
}

export interface QuickFix {
  description: string;
  changes: TextChange[];
  isPreferred?: boolean;
}

export interface TextChange {
  range: SourceLocation;
  newText: string;
}

export type DiagnosticCategory = 'syntax' | 'type' | 'scope' | 'semantic' | 'performance' | 'style';

export interface FormattedDiagnostic {
  ansi: string;
  plain: string;
  html: string;
}

const ERROR_CODES: Record<string, { message: string; category: DiagnosticCategory; docs: string }> =
  {
    E0001: { message: 'Unexpected token', category: 'syntax', docs: 'errors/E0001' },
    E0002: { message: 'Expected expression', category: 'syntax', docs: 'errors/E0002' },
    E0003: { message: 'Unterminated string', category: 'syntax', docs: 'errors/E0003' },
    E0004: { message: 'Invalid number literal', category: 'syntax', docs: 'errors/E0004' },

    E0100: { message: 'Type mismatch', category: 'type', docs: 'errors/E0100' },
    E0101: { message: 'Cannot find type', category: 'type', docs: 'errors/E0101' },
    E0102: { message: 'Invalid swizzle', category: 'type', docs: 'errors/E0102' },
    E0103: { message: 'Matrix dimension mismatch', category: 'type', docs: 'errors/E0103' },
    E0104: { message: 'Cannot apply operator', category: 'type', docs: 'errors/E0104' },
    E0105: { message: 'Incompatible types in assignment', category: 'type', docs: 'errors/E0105' },
    E0106: { message: 'Invalid return type', category: 'type', docs: 'errors/E0106' },
    E0107: { message: 'Wrong number of arguments', category: 'type', docs: 'errors/E0107' },
    E0108: { message: 'Argument type mismatch', category: 'type', docs: 'errors/E0108' },

    E0200: { message: 'Undefined variable', category: 'scope', docs: 'errors/E0200' },
    E0201: { message: 'Undefined function', category: 'scope', docs: 'errors/E0201' },
    E0202: { message: 'Duplicate declaration', category: 'scope', docs: 'errors/E0202' },
    E0203: { message: 'Variable used before declaration', category: 'scope', docs: 'errors/E0203' },
    E0204: { message: 'Undefined struct field', category: 'scope', docs: 'errors/E0204' },

    E0300: { message: 'Missing return statement', category: 'semantic', docs: 'errors/E0300' },
    E0301: { message: 'Not all paths return a value', category: 'semantic', docs: 'errors/E0301' },
    E0302: { message: 'Invalid entry point signature', category: 'semantic', docs: 'errors/E0302' },
    E0303: { message: 'Workgroup size required', category: 'semantic', docs: 'errors/E0303' },

    W0001: { message: 'Large loop detected', category: 'performance', docs: 'perf/W0001' },
    W0002: { message: 'Expensive operation in loop', category: 'performance', docs: 'perf/W0002' },
    W0003: { message: 'Dependent texture read', category: 'performance', docs: 'perf/W0003' },
    W0004: { message: 'Unused variable', category: 'performance', docs: 'perf/W0004' },
  };

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
};

export class DiagnosticFormatter {
  private sourceLines: string[];
  private filename: string;
  private baseUrl: string;

  constructor(
    source: string,
    filename: string = 'shader.shader3d.ts',
    baseUrl: string = 'https://shader3d.dev/docs/'
  ) {
    this.sourceLines = source.split('\n');
    this.filename = filename;
    this.baseUrl = baseUrl;
  }

  format(diagnostic: Diagnostic | RichDiagnostic): FormattedDiagnostic {
    const rich = this.enrichDiagnostic(diagnostic);
    return {
      ansi: this.formatAnsi(rich),
      plain: this.formatPlain(rich),
      html: this.formatHtml(rich),
    };
  }

  formatAll(diagnostics: Diagnostic[]): string {
    return diagnostics.map((d) => this.format(d).ansi).join('\n\n');
  }

  private enrichDiagnostic(diagnostic: Diagnostic): RichDiagnostic {
    if ('category' in diagnostic && 'code' in diagnostic) {
      return diagnostic as RichDiagnostic;
    }

    const code = diagnostic.code || this.inferErrorCode(diagnostic.message);
    const codeInfo = ERROR_CODES[code];

    return {
      ...diagnostic,
      code,
      category: codeInfo?.category || 'semantic',
      documentationUrl: codeInfo ? `${this.baseUrl}${codeInfo.docs}` : undefined,
    };
  }

  private inferErrorCode(message: string): string {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('type mismatch') || lowerMessage.includes('cannot assign'))
      return 'E0100';
    if (lowerMessage.includes('swizzle')) return 'E0102';
    if (lowerMessage.includes('matrix')) return 'E0103';
    if (lowerMessage.includes('undefined') && lowerMessage.includes('variable')) return 'E0200';
    if (lowerMessage.includes('undefined') && lowerMessage.includes('function')) return 'E0201';
    if (lowerMessage.includes('duplicate')) return 'E0202';
    if (lowerMessage.includes('missing return')) return 'E0300';
    if (lowerMessage.includes('not all paths')) return 'E0301';

    return 'E0000';
  }

  private formatAnsi(diagnostic: RichDiagnostic): string {
    const lines: string[] = [];
    const severity = diagnostic.severity;
    const severityColor =
      severity === 'error' ? COLORS.red : severity === 'warning' ? COLORS.yellow : COLORS.blue;
    const severityIcon = severity === 'error' ? '❌' : severity === 'warning' ? '⚠️ ' : 'ℹ️ ';

    lines.push(
      `${severityIcon} ${severityColor}${COLORS.bold}${this.capitalizeFirst(severity)}${COLORS.reset}: ${diagnostic.message}`
    );
    lines.push('');

    if (diagnostic.loc) {
      const { start, end } = diagnostic.loc;
      const lineNum = start.line;
      const col = start.column;

      lines.push(`  ${COLORS.cyan}╭─[${this.filename}:${lineNum}:${col}]${COLORS.reset}`);
      lines.push(`  ${COLORS.cyan}│${COLORS.reset}`);

      const contextStart = Math.max(0, lineNum - 2);
      const contextEnd = Math.min(this.sourceLines.length, lineNum + 1);

      for (let i = contextStart; i < contextEnd; i++) {
        const line = this.sourceLines[i] || '';
        const lineNumStr = String(i + 1).padStart(3, ' ');
        const isErrorLine = i === lineNum - 1;

        if (isErrorLine) {
          lines.push(`${COLORS.cyan}${lineNumStr}│${COLORS.reset} ${line}`);

          const underlineStart = col - 1;
          const underlineLength =
            end && end.line === start.line
              ? end.column - start.column
              : Math.max(1, line.length - underlineStart);

          const padding = ' '.repeat(underlineStart + 4);
          const underline = `${COLORS.red}${'─'.repeat(Math.max(1, underlineLength))}${COLORS.reset}`;
          lines.push(`${padding}${underline}`);
        } else {
          lines.push(
            `${COLORS.dim}${lineNumStr}│${COLORS.reset} ${COLORS.dim}${line}${COLORS.reset}`
          );
        }
      }

      lines.push(`  ${COLORS.cyan}│${COLORS.reset}`);
      lines.push(`  ${COLORS.cyan}╰────${COLORS.reset}`);
    }

    if (diagnostic.suggestions && diagnostic.suggestions.length > 0) {
      lines.push('');
      lines.push(`${COLORS.cyan}💡 Suggestions:${COLORS.reset}`);
      for (let i = 0; i < diagnostic.suggestions.length; i++) {
        lines.push(`   ${i + 1}. ${diagnostic.suggestions[i]}`);
      }
    }

    if (diagnostic.fixes && diagnostic.fixes.length > 0) {
      lines.push('');
      lines.push(`${COLORS.cyan}🔧 Quick fixes:${COLORS.reset}`);
      for (const fix of diagnostic.fixes) {
        const preferred = fix.isPreferred ? ' (recommended)' : '';
        lines.push(`   • ${fix.description}${preferred}`);
      }
    }

    if (diagnostic.documentationUrl) {
      lines.push('');
      lines.push(`${COLORS.blue}📖 Learn more: ${diagnostic.documentationUrl}${COLORS.reset}`);
    }

    return lines.join('\n');
  }

  private formatPlain(diagnostic: RichDiagnostic): string {
    const lines: string[] = [];
    const severity = diagnostic.severity;
    const severityIcon =
      severity === 'error' ? 'Error' : severity === 'warning' ? 'Warning' : 'Info';

    lines.push(`${severityIcon}: ${diagnostic.message}`);

    if (diagnostic.loc) {
      const { start } = diagnostic.loc;
      lines.push(`  at ${this.filename}:${start.line}:${start.column}`);

      const line = this.sourceLines[start.line - 1] || '';
      lines.push(`  ${start.line} | ${line}`);
    }

    if (diagnostic.suggestions && diagnostic.suggestions.length > 0) {
      lines.push('');
      lines.push('Suggestions:');
      for (const suggestion of diagnostic.suggestions) {
        lines.push(`  - ${suggestion}`);
      }
    }

    if (diagnostic.documentationUrl) {
      lines.push('');
      lines.push(`Learn more: ${diagnostic.documentationUrl}`);
    }

    return lines.join('\n');
  }

  private formatHtml(diagnostic: RichDiagnostic): string {
    const severity = diagnostic.severity;
    const severityClass = `diagnostic-${severity}`;

    let html = `<div class="diagnostic ${severityClass}">`;
    html += `<div class="diagnostic-header">`;
    html += `<span class="diagnostic-severity">${this.capitalizeFirst(severity)}</span>`;
    html += `<span class="diagnostic-message">${this.escapeHtml(diagnostic.message)}</span>`;
    html += `</div>`;

    if (diagnostic.loc) {
      const { start } = diagnostic.loc;
      html += `<div class="diagnostic-location">${this.escapeHtml(this.filename)}:${start.line}:${start.column}</div>`;

      const line = this.sourceLines[start.line - 1] || '';
      html += `<pre class="diagnostic-code"><code>${this.escapeHtml(line)}</code></pre>`;
    }

    if (diagnostic.suggestions && diagnostic.suggestions.length > 0) {
      html += `<ul class="diagnostic-suggestions">`;
      for (const suggestion of diagnostic.suggestions) {
        html += `<li>${this.escapeHtml(suggestion)}</li>`;
      }
      html += `</ul>`;
    }

    if (diagnostic.documentationUrl) {
      html += `<a class="diagnostic-docs" href="${diagnostic.documentationUrl}" target="_blank">Learn more</a>`;
    }

    html += `</div>`;
    return html;
  }

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

export function createTypeMismatchDiagnostic(
  expected: string,
  got: string,
  location: SourceLocation
): RichDiagnostic {
  return {
    severity: 'error',
    message: `Type mismatch: expected '${expected}', got '${got}'`,
    code: 'E0100',
    category: 'type',
    loc: location,
    suggestions: [`Change the type to '${got}'`, `Convert the value to '${expected}'`],
    documentationUrl: 'https://shader3d.dev/docs/errors/E0100',
  };
}

export function createUndefinedVariableDiagnostic(
  name: string,
  location: SourceLocation,
  suggestions: string[] = []
): RichDiagnostic {
  const didYouMean = suggestions.length > 0 ? `. Did you mean '${suggestions[0]}'?` : '';

  return {
    severity: 'error',
    message: `Cannot find name '${name}'${didYouMean}`,
    code: 'E0200',
    category: 'scope',
    loc: location,
    suggestions: suggestions.map((s) => `Did you mean '${s}'?`),
    documentationUrl: 'https://shader3d.dev/docs/errors/E0200',
  };
}

export function createInvalidSwizzleDiagnostic(
  swizzle: string,
  vectorSize: number,
  location: SourceLocation
): RichDiagnostic {
  const validComponents = ['x', 'y', 'z', 'w'].slice(0, vectorSize);

  return {
    severity: 'error',
    message: `Invalid swizzle '${swizzle}' for vec${vectorSize}`,
    code: 'E0102',
    category: 'type',
    loc: location,
    suggestions: [
      `Valid components for vec${vectorSize}: ${validComponents.join(', ')}`,
      `Use .${validComponents.join('')} for full vector access`,
    ],
    documentationUrl: 'https://shader3d.dev/docs/errors/E0102',
  };
}

export function createPerformanceWarning(
  message: string,
  location: SourceLocation,
  impact: string,
  suggestions: string[]
): RichDiagnostic {
  return {
    severity: 'warning',
    message,
    code: 'W0001',
    category: 'performance',
    loc: location,
    suggestions: [...suggestions, `Impact: ${impact}`],
    documentationUrl: 'https://shader3d.dev/docs/perf/loops',
  };
}

export function findSimilarNames(
  name: string,
  available: string[],
  maxDistance: number = 2
): string[] {
  return available
    .map((n) => ({ name: n, distance: levenshteinDistance(name.toLowerCase(), n.toLowerCase()) }))
    .filter(({ distance }) => distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance)
    .map(({ name }) => name);
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}
