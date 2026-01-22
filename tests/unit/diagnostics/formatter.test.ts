import { describe, it, expect } from 'vitest';
import {
  DiagnosticFormatter,
  DiagnosticSeverity,
  ERROR_CODES,
  createTypeMismatchDiagnostic,
  createUndefinedVariableDiagnostic,
  createUnusedVariableDiagnostic,
  createInvalidSwizzleDiagnostic,
  findSimilarNames,
  levenshteinDistance,
} from '../../packages/core/src/diagnostics';
import type { Diagnostic, SourceLocation } from '../../packages/core/src/types';

describe('DiagnosticFormatter', () => {
  describe('constructor', () => {
    it('creates formatter with default options', () => {
      const formatter = new DiagnosticFormatter();
      expect(formatter).toBeDefined();
    });

    it('creates formatter with custom options', () => {
      const formatter = new DiagnosticFormatter({
        color: false,
        contextLines: 5,
      });
      expect(formatter).toBeDefined();
    });
  });

  describe('formatDiagnostic', () => {
    const sampleDiagnostic: Diagnostic = {
      severity: DiagnosticSeverity.Error,
      message: 'Type mismatch',
      code: 'E0001',
      location: {
        file: 'shader.wgsl',
        line: 10,
        column: 5,
        offset: 100,
        length: 8,
      },
    };

    it('formats error diagnostic', () => {
      const formatter = new DiagnosticFormatter({ color: false });
      const result = formatter.formatDiagnostic(sampleDiagnostic);

      expect(result).toContain('error');
      expect(result).toContain('E0001');
      expect(result).toContain('Type mismatch');
      expect(result).toContain('shader.wgsl');
      expect(result).toContain('10');
    });

    it('formats warning diagnostic', () => {
      const formatter = new DiagnosticFormatter({ color: false });
      const warning: Diagnostic = {
        severity: DiagnosticSeverity.Warning,
        message: 'Unused variable',
        code: 'W0001',
        location: {
          file: 'test.wgsl',
          line: 5,
          column: 1,
          offset: 50,
          length: 5,
        },
      };

      const result = formatter.formatDiagnostic(warning);
      expect(result).toContain('warning');
      expect(result).toContain('W0001');
    });

    it('formats info diagnostic', () => {
      const formatter = new DiagnosticFormatter({ color: false });
      const info: Diagnostic = {
        severity: DiagnosticSeverity.Info,
        message: 'Consider using vec3f instead',
        code: 'I0001',
        location: {
          file: 'test.wgsl',
          line: 1,
          column: 1,
          offset: 0,
          length: 1,
        },
      };

      const result = formatter.formatDiagnostic(info);
      expect(result).toContain('info');
    });

    it('formats hint diagnostic', () => {
      const formatter = new DiagnosticFormatter({ color: false });
      const hint: Diagnostic = {
        severity: DiagnosticSeverity.Hint,
        message: 'Consider using const',
        code: 'H0001',
        location: {
          file: 'test.wgsl',
          line: 1,
          column: 1,
          offset: 0,
          length: 1,
        },
      };

      const result = formatter.formatDiagnostic(hint);
      expect(result).toContain('hint');
    });
  });

  describe('formatWithContext', () => {
    it('shows source context around error', () => {
      const formatter = new DiagnosticFormatter({ color: false, contextLines: 2 });
      const source = `fn main() {
  let x: f32 = 1.0;
  let y: vec3f = x;
  return;
}`;

      const diagnostic: Diagnostic = {
        severity: DiagnosticSeverity.Error,
        message: 'Expected vec3f but found f32',
        code: 'E0001',
        location: {
          file: 'test.wgsl',
          line: 3,
          column: 18,
          offset: 35,
          length: 1,
        },
      };

      const result = formatter.formatWithContext(diagnostic, source);
      expect(result).toContain('let y: vec3f = x');
      expect(result).toContain('^');
    });

    it('shows line numbers', () => {
      const formatter = new DiagnosticFormatter({ color: false });
      const source = 'line 1\nline 2\nline 3\nline 4\nline 5';

      const diagnostic: Diagnostic = {
        severity: DiagnosticSeverity.Error,
        message: 'Error on line 3',
        code: 'E0001',
        location: {
          file: 'test.wgsl',
          line: 3,
          column: 1,
          offset: 14,
          length: 4,
        },
      };

      const result = formatter.formatWithContext(diagnostic, source);
      expect(result).toContain('3');
    });

    it('underlines the error span', () => {
      const formatter = new DiagnosticFormatter({ color: false });
      const source = 'let x: invalidType = 1;';

      const diagnostic: Diagnostic = {
        severity: DiagnosticSeverity.Error,
        message: 'Unknown type',
        code: 'E0002',
        location: {
          file: 'test.wgsl',
          line: 1,
          column: 8,
          offset: 7,
          length: 11,
        },
      };

      const result = formatter.formatWithContext(diagnostic, source);
      expect(result).toContain('^');
    });
  });

  describe('formatToAnsi', () => {
    it('includes ANSI color codes', () => {
      const formatter = new DiagnosticFormatter({ color: true });
      const diagnostic: Diagnostic = {
        severity: DiagnosticSeverity.Error,
        message: 'Test error',
        code: 'E0001',
        location: {
          file: 'test.wgsl',
          line: 1,
          column: 1,
          offset: 0,
          length: 1,
        },
      };

      const result = formatter.formatToAnsi(diagnostic);
      expect(result).toContain('\x1b['); // ANSI escape
    });
  });

  describe('formatToHtml', () => {
    it('outputs HTML format', () => {
      const formatter = new DiagnosticFormatter();
      const diagnostic: Diagnostic = {
        severity: DiagnosticSeverity.Error,
        message: 'Test error',
        code: 'E0001',
        location: {
          file: 'test.wgsl',
          line: 1,
          column: 1,
          offset: 0,
          length: 1,
        },
      };

      const result = formatter.formatToHtml(diagnostic);
      expect(result).toContain('<');
      expect(result).toContain('class=');
    });

    it('escapes HTML entities', () => {
      const formatter = new DiagnosticFormatter();
      const diagnostic: Diagnostic = {
        severity: DiagnosticSeverity.Error,
        message: 'Expected <vec3f> but found &something',
        code: 'E0001',
        location: {
          file: 'test.wgsl',
          line: 1,
          column: 1,
          offset: 0,
          length: 1,
        },
      };

      const result = formatter.formatToHtml(diagnostic);
      expect(result).toContain('&lt;');
      expect(result).toContain('&gt;');
      expect(result).toContain('&amp;');
    });
  });

  describe('formatSuggestion', () => {
    it('formats quick fix suggestions', () => {
      const formatter = new DiagnosticFormatter({ color: false });
      const suggestion = {
        message: 'Did you mean `position`?',
        replacement: 'position',
      };

      const result = formatter.formatSuggestion(suggestion);
      expect(result).toContain('position');
      expect(result).toContain('Did you mean');
    });
  });
});

describe('ERROR_CODES', () => {
  it('defines type error codes', () => {
    expect(ERROR_CODES.E0001).toBeDefined();
    expect(ERROR_CODES.E0001.message).toContain('type');
  });

  it('defines undefined variable error', () => {
    expect(ERROR_CODES.E0002).toBeDefined();
    expect(ERROR_CODES.E0002.message).toContain('undefined');
  });

  it('defines invalid swizzle error', () => {
    expect(ERROR_CODES.E0003).toBeDefined();
    expect(ERROR_CODES.E0003.message).toContain('swizzle');
  });

  it('defines all error codes with documentation links', () => {
    for (const [code, info] of Object.entries(ERROR_CODES)) {
      expect(info.message).toBeDefined();
      expect(info.documentationUrl).toContain(code);
    }
  });
});

describe('Diagnostic creation helpers', () => {
  describe('createTypeMismatchDiagnostic', () => {
    it('creates type mismatch diagnostic', () => {
      const location: SourceLocation = {
        file: 'test.wgsl',
        line: 5,
        column: 10,
        offset: 50,
        length: 8,
      };

      const diagnostic = createTypeMismatchDiagnostic('vec3f', 'f32', location);

      expect(diagnostic.severity).toBe(DiagnosticSeverity.Error);
      expect(diagnostic.code).toBe('E0001');
      expect(diagnostic.message).toContain('vec3f');
      expect(diagnostic.message).toContain('f32');
    });
  });

  describe('createUndefinedVariableDiagnostic', () => {
    it('creates undefined variable diagnostic', () => {
      const location: SourceLocation = {
        file: 'test.wgsl',
        line: 3,
        column: 5,
        offset: 30,
        length: 4,
      };

      const diagnostic = createUndefinedVariableDiagnostic('myVar', location);

      expect(diagnostic.severity).toBe(DiagnosticSeverity.Error);
      expect(diagnostic.code).toBe('E0002');
      expect(diagnostic.message).toContain('myVar');
    });

    it('includes suggestions for similar names', () => {
      const location: SourceLocation = {
        file: 'test.wgsl',
        line: 1,
        column: 1,
        offset: 0,
        length: 5,
      };

      const diagnostic = createUndefinedVariableDiagnostic('positon', location, [
        'position',
        'rotation',
        'direction',
      ]);

      expect(diagnostic.suggestions).toBeDefined();
      expect(diagnostic.suggestions?.[0].replacement).toBe('position');
    });
  });

  describe('createUnusedVariableDiagnostic', () => {
    it('creates unused variable warning', () => {
      const location: SourceLocation = {
        file: 'test.wgsl',
        line: 2,
        column: 5,
        offset: 20,
        length: 6,
      };

      const diagnostic = createUnusedVariableDiagnostic('unused', location);

      expect(diagnostic.severity).toBe(DiagnosticSeverity.Warning);
      expect(diagnostic.code).toBe('W0001');
      expect(diagnostic.message).toContain('unused');
    });

    it('suggests prefixing with underscore', () => {
      const location: SourceLocation = {
        file: 'test.wgsl',
        line: 1,
        column: 1,
        offset: 0,
        length: 3,
      };

      const diagnostic = createUnusedVariableDiagnostic('foo', location);

      expect(diagnostic.suggestions?.[0].replacement).toBe('_foo');
    });
  });

  describe('createInvalidSwizzleDiagnostic', () => {
    it('creates invalid swizzle diagnostic', () => {
      const location: SourceLocation = {
        file: 'test.wgsl',
        line: 4,
        column: 12,
        offset: 45,
        length: 3,
      };

      const diagnostic = createInvalidSwizzleDiagnostic('xyz', 'vec2f', location);

      expect(diagnostic.severity).toBe(DiagnosticSeverity.Error);
      expect(diagnostic.code).toBe('E0003');
      expect(diagnostic.message).toContain('xyz');
      expect(diagnostic.message).toContain('vec2f');
    });

    it('suggests valid alternatives', () => {
      const location: SourceLocation = {
        file: 'test.wgsl',
        line: 1,
        column: 1,
        offset: 0,
        length: 1,
      };

      const diagnostic = createInvalidSwizzleDiagnostic('z', 'vec2f', location);

      expect(diagnostic.suggestions).toBeDefined();
      expect(
        diagnostic.suggestions?.some((s) => s.replacement === 'x' || s.replacement === 'y')
      ).toBe(true);
    });
  });
});

describe('findSimilarNames', () => {
  it('finds similar names by edit distance', () => {
    const candidates = ['position', 'rotation', 'direction', 'color'];
    const similar = findSimilarNames('positon', candidates);

    expect(similar[0]).toBe('position');
  });

  it('returns empty array for no matches', () => {
    const candidates = ['foo', 'bar', 'baz'];
    const similar = findSimilarNames('xyz', candidates, 1);

    expect(similar).toHaveLength(0);
  });

  it('limits results by maxDistance', () => {
    const candidates = ['position', 'rotation', 'direction'];
    const similar = findSimilarNames('posit', candidates, 2);

    // Only position should be within distance 2
    expect(similar.includes('position')).toBe(true);
  });

  it('returns results sorted by distance', () => {
    const candidates = ['position', 'posit', 'pos'];
    const similar = findSimilarNames('positi', candidates);

    // posit should come first (distance 1)
    expect(similar[0]).toBe('posit');
  });
});

describe('levenshteinDistance', () => {
  it('calculates distance of 0 for identical strings', () => {
    expect(levenshteinDistance('hello', 'hello')).toBe(0);
  });

  it('calculates distance for single insertion', () => {
    expect(levenshteinDistance('hell', 'hello')).toBe(1);
  });

  it('calculates distance for single deletion', () => {
    expect(levenshteinDistance('hello', 'hell')).toBe(1);
  });

  it('calculates distance for single substitution', () => {
    expect(levenshteinDistance('hello', 'hallo')).toBe(1);
  });

  it('calculates distance for multiple edits', () => {
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
  });

  it('handles empty strings', () => {
    expect(levenshteinDistance('', 'hello')).toBe(5);
    expect(levenshteinDistance('hello', '')).toBe(5);
    expect(levenshteinDistance('', '')).toBe(0);
  });

  it('is case-sensitive', () => {
    expect(levenshteinDistance('Hello', 'hello')).toBe(1);
  });
});

describe('Diagnostic relatedInformation', () => {
  it('includes related locations', () => {
    const location: SourceLocation = {
      file: 'test.wgsl',
      line: 10,
      column: 5,
      offset: 100,
      length: 8,
    };

    const relatedLocation: SourceLocation = {
      file: 'test.wgsl',
      line: 5,
      column: 1,
      offset: 50,
      length: 20,
    };

    const diagnostic: Diagnostic = {
      severity: DiagnosticSeverity.Error,
      message: 'Type mismatch',
      code: 'E0001',
      location,
      relatedInformation: [
        {
          location: relatedLocation,
          message: 'Variable declared here',
        },
      ],
    };

    expect(diagnostic.relatedInformation).toHaveLength(1);
    expect(diagnostic.relatedInformation?.[0].message).toContain('declared');
  });
});

describe('Diagnostic formatting edge cases', () => {
  it('handles multi-line errors', () => {
    const formatter = new DiagnosticFormatter({ color: false });
    const diagnostic: Diagnostic = {
      severity: DiagnosticSeverity.Error,
      message: 'Mismatched brackets',
      code: 'E0100',
      location: {
        file: 'test.wgsl',
        line: 1,
        column: 1,
        offset: 0,
        length: 50,
      },
    };

    const source = `fn main() {
  if (true) {
    // missing closing brace
  
}`;

    const result = formatter.formatWithContext(diagnostic, source);
    expect(result).toBeDefined();
  });

  it('handles errors at end of file', () => {
    const formatter = new DiagnosticFormatter({ color: false });
    const source = 'let x = 1';

    const diagnostic: Diagnostic = {
      severity: DiagnosticSeverity.Error,
      message: 'Expected semicolon',
      code: 'E0101',
      location: {
        file: 'test.wgsl',
        line: 1,
        column: 10,
        offset: 9,
        length: 0,
      },
    };

    const result = formatter.formatWithContext(diagnostic, source);
    expect(result).toContain('let x = 1');
  });

  it('handles errors at beginning of file', () => {
    const formatter = new DiagnosticFormatter({ color: false });
    const source = 'invalid code here';

    const diagnostic: Diagnostic = {
      severity: DiagnosticSeverity.Error,
      message: 'Unexpected token',
      code: 'E0102',
      location: {
        file: 'test.wgsl',
        line: 1,
        column: 1,
        offset: 0,
        length: 7,
      },
    };

    const result = formatter.formatWithContext(diagnostic, source);
    expect(result).toContain('invalid');
  });

  it('handles very long lines', () => {
    const formatter = new DiagnosticFormatter({ color: false, maxLineLength: 80 });
    const longLine = 'let x = ' + 'a + '.repeat(50) + '1;';

    const diagnostic: Diagnostic = {
      severity: DiagnosticSeverity.Error,
      message: 'Error in expression',
      code: 'E0001',
      location: {
        file: 'test.wgsl',
        line: 1,
        column: 100,
        offset: 99,
        length: 1,
      },
    };

    const result = formatter.formatWithContext(diagnostic, longLine);
    // Should truncate or handle gracefully
    expect(result).toBeDefined();
  });
});

describe('Batch diagnostic formatting', () => {
  it('formats multiple diagnostics', () => {
    const formatter = new DiagnosticFormatter({ color: false });
    const diagnostics: Diagnostic[] = [
      {
        severity: DiagnosticSeverity.Error,
        message: 'Error 1',
        code: 'E0001',
        location: { file: 'test.wgsl', line: 1, column: 1, offset: 0, length: 1 },
      },
      {
        severity: DiagnosticSeverity.Warning,
        message: 'Warning 1',
        code: 'W0001',
        location: { file: 'test.wgsl', line: 2, column: 1, offset: 10, length: 1 },
      },
      {
        severity: DiagnosticSeverity.Error,
        message: 'Error 2',
        code: 'E0002',
        location: { file: 'test.wgsl', line: 3, column: 1, offset: 20, length: 1 },
      },
    ];

    const result = formatter.formatDiagnostics(diagnostics);
    expect(result).toContain('Error 1');
    expect(result).toContain('Warning 1');
    expect(result).toContain('Error 2');
  });

  it('sorts diagnostics by severity', () => {
    const formatter = new DiagnosticFormatter({ color: false, sortBySeverity: true });
    const diagnostics: Diagnostic[] = [
      {
        severity: DiagnosticSeverity.Warning,
        message: 'Warning',
        code: 'W0001',
        location: { file: 'test.wgsl', line: 1, column: 1, offset: 0, length: 1 },
      },
      {
        severity: DiagnosticSeverity.Error,
        message: 'Error',
        code: 'E0001',
        location: { file: 'test.wgsl', line: 2, column: 1, offset: 10, length: 1 },
      },
    ];

    const result = formatter.formatDiagnostics(diagnostics);
    const errorPos = result.indexOf('Error');
    const warningPos = result.indexOf('Warning');

    expect(errorPos).toBeLessThan(warningPos);
  });

  it('groups diagnostics by file', () => {
    const formatter = new DiagnosticFormatter({ color: false, groupByFile: true });
    const diagnostics: Diagnostic[] = [
      {
        severity: DiagnosticSeverity.Error,
        message: 'Error in a.wgsl',
        code: 'E0001',
        location: { file: 'a.wgsl', line: 1, column: 1, offset: 0, length: 1 },
      },
      {
        severity: DiagnosticSeverity.Error,
        message: 'Error in b.wgsl',
        code: 'E0001',
        location: { file: 'b.wgsl', line: 1, column: 1, offset: 0, length: 1 },
      },
      {
        severity: DiagnosticSeverity.Error,
        message: 'Another error in a.wgsl',
        code: 'E0002',
        location: { file: 'a.wgsl', line: 2, column: 1, offset: 10, length: 1 },
      },
    ];

    const result = formatter.formatDiagnostics(diagnostics);
    // a.wgsl errors should be grouped together
    const firstA = result.indexOf('a.wgsl');
    const secondA = result.lastIndexOf('a.wgsl');
    const bPos = result.indexOf('b.wgsl');

    // Both a.wgsl references should appear before or after b.wgsl
    expect(Math.abs(firstA - secondA)).toBeLessThan(Math.abs(firstA - bPos));
  });
});
