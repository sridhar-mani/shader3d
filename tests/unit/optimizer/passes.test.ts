import { describe, it, expect } from 'vitest';
import {
  Optimizer,
  optimize,
  ConstantFoldingPass,
  AlgebraicSimplificationPass,
  DeadCodeEliminationPass,
  CommonSubexpressionPass,
  StrengthReductionPass,
  PeepholeOptimizationPass,
  FunctionInliningPass,
  LoopInvariantMotionPass,
  LoopUnrollingPass,
} from '../../packages/core/src/optimizer';
import type { ShaderProgram, Expression, Statement } from '../../packages/core/src/types';

describe('Optimizer', () => {
  describe('constructor', () => {
    it('creates optimizer with default options', () => {
      const optimizer = new Optimizer();
      expect(optimizer).toBeDefined();
    });

    it('creates optimizer with custom options', () => {
      const optimizer = new Optimizer({ level: 3, maxIterations: 10 });
      expect(optimizer).toBeDefined();
    });
  });

  describe('optimize', () => {
    it('returns program unchanged at level 0', () => {
      const program: ShaderProgram = {
        type: 'ShaderProgram',
        body: [],
        metadata: { version: '1.0' },
      };

      const result = optimize(program, { level: 0 });
      expect(result.program).toEqual(program);
    });

    it('returns optimization stats', () => {
      const program: ShaderProgram = {
        type: 'ShaderProgram',
        body: [],
        metadata: { version: '1.0' },
      };

      const result = optimize(program, { level: 2 });
      expect(result.stats).toBeDefined();
      expect(typeof result.stats.passesRun).toBe('number');
      expect(typeof result.stats.totalTransformations).toBe('number');
    });
  });
});

describe('ConstantFoldingPass', () => {
  const pass = new ConstantFoldingPass();

  describe('arithmetic folding', () => {
    it('folds 1 + 2', () => {
      const expr: Expression = {
        type: 'BinaryExpression',
        operator: '+',
        left: { type: 'Literal', value: 1, raw: '1' },
        right: { type: 'Literal', value: 2, raw: '2' },
      };

      const result = pass.foldExpression(expr);
      expect(result.type).toBe('Literal');
      expect((result as any).value).toBe(3);
    });

    it('folds 5 - 3', () => {
      const expr: Expression = {
        type: 'BinaryExpression',
        operator: '-',
        left: { type: 'Literal', value: 5, raw: '5' },
        right: { type: 'Literal', value: 3, raw: '3' },
      };

      const result = pass.foldExpression(expr);
      expect((result as any).value).toBe(2);
    });

    it('folds 4 * 3', () => {
      const expr: Expression = {
        type: 'BinaryExpression',
        operator: '*',
        left: { type: 'Literal', value: 4, raw: '4' },
        right: { type: 'Literal', value: 3, raw: '3' },
      };

      const result = pass.foldExpression(expr);
      expect((result as any).value).toBe(12);
    });

    it('folds 10 / 2', () => {
      const expr: Expression = {
        type: 'BinaryExpression',
        operator: '/',
        left: { type: 'Literal', value: 10, raw: '10' },
        right: { type: 'Literal', value: 2, raw: '2' },
      };

      const result = pass.foldExpression(expr);
      expect((result as any).value).toBe(5);
    });

    it('folds nested expressions', () => {
      const expr: Expression = {
        type: 'BinaryExpression',
        operator: '+',
        left: {
          type: 'BinaryExpression',
          operator: '*',
          left: { type: 'Literal', value: 2, raw: '2' },
          right: { type: 'Literal', value: 3, raw: '3' },
        },
        right: { type: 'Literal', value: 4, raw: '4' },
      };

      const result = pass.foldExpression(expr);
      expect((result as any).value).toBe(10);
    });
  });

  describe('comparison folding', () => {
    it('folds 1 < 2', () => {
      const expr: Expression = {
        type: 'BinaryExpression',
        operator: '<',
        left: { type: 'Literal', value: 1, raw: '1' },
        right: { type: 'Literal', value: 2, raw: '2' },
      };

      const result = pass.foldExpression(expr);
      expect((result as any).value).toBe(true);
    });

    it('folds 3 > 2', () => {
      const expr: Expression = {
        type: 'BinaryExpression',
        operator: '>',
        left: { type: 'Literal', value: 3, raw: '3' },
        right: { type: 'Literal', value: 2, raw: '2' },
      };

      const result = pass.foldExpression(expr);
      expect((result as any).value).toBe(true);
    });

    it('folds 2 == 2', () => {
      const expr: Expression = {
        type: 'BinaryExpression',
        operator: '==',
        left: { type: 'Literal', value: 2, raw: '2' },
        right: { type: 'Literal', value: 2, raw: '2' },
      };

      const result = pass.foldExpression(expr);
      expect((result as any).value).toBe(true);
    });
  });

  describe('function call folding', () => {
    it('folds sin(0)', () => {
      const expr: Expression = {
        type: 'CallExpression',
        callee: { type: 'Identifier', name: 'sin' },
        arguments: [{ type: 'Literal', value: 0, raw: '0' }],
      };

      const result = pass.foldExpression(expr);
      expect(result.type).toBe('Literal');
      expect((result as any).value).toBe(0);
    });

    it('folds cos(0)', () => {
      const expr: Expression = {
        type: 'CallExpression',
        callee: { type: 'Identifier', name: 'cos' },
        arguments: [{ type: 'Literal', value: 0, raw: '0' }],
      };

      const result = pass.foldExpression(expr);
      expect((result as any).value).toBe(1);
    });

    it('folds abs(-5)', () => {
      const expr: Expression = {
        type: 'CallExpression',
        callee: { type: 'Identifier', name: 'abs' },
        arguments: [{ type: 'Literal', value: -5, raw: '-5' }],
      };

      const result = pass.foldExpression(expr);
      expect((result as any).value).toBe(5);
    });

    it('folds sqrt(16)', () => {
      const expr: Expression = {
        type: 'CallExpression',
        callee: { type: 'Identifier', name: 'sqrt' },
        arguments: [{ type: 'Literal', value: 16, raw: '16' }],
      };

      const result = pass.foldExpression(expr);
      expect((result as any).value).toBe(4);
    });

    it('folds min(3, 7)', () => {
      const expr: Expression = {
        type: 'CallExpression',
        callee: { type: 'Identifier', name: 'min' },
        arguments: [
          { type: 'Literal', value: 3, raw: '3' },
          { type: 'Literal', value: 7, raw: '7' },
        ],
      };

      const result = pass.foldExpression(expr);
      expect((result as any).value).toBe(3);
    });

    it('folds max(3, 7)', () => {
      const expr: Expression = {
        type: 'CallExpression',
        callee: { type: 'Identifier', name: 'max' },
        arguments: [
          { type: 'Literal', value: 3, raw: '3' },
          { type: 'Literal', value: 7, raw: '7' },
        ],
      };

      const result = pass.foldExpression(expr);
      expect((result as any).value).toBe(7);
    });
  });
});

describe('AlgebraicSimplificationPass', () => {
  const pass = new AlgebraicSimplificationPass();

  describe('identity simplifications', () => {
    it('simplifies x + 0 to x', () => {
      const expr: Expression = {
        type: 'BinaryExpression',
        operator: '+',
        left: { type: 'Identifier', name: 'x' },
        right: { type: 'Literal', value: 0, raw: '0' },
      };

      const result = pass.simplify(expr);
      expect(result.type).toBe('Identifier');
      expect((result as any).name).toBe('x');
    });

    it('simplifies 0 + x to x', () => {
      const expr: Expression = {
        type: 'BinaryExpression',
        operator: '+',
        left: { type: 'Literal', value: 0, raw: '0' },
        right: { type: 'Identifier', name: 'x' },
      };

      const result = pass.simplify(expr);
      expect((result as any).name).toBe('x');
    });

    it('simplifies x - 0 to x', () => {
      const expr: Expression = {
        type: 'BinaryExpression',
        operator: '-',
        left: { type: 'Identifier', name: 'x' },
        right: { type: 'Literal', value: 0, raw: '0' },
      };

      const result = pass.simplify(expr);
      expect((result as any).name).toBe('x');
    });

    it('simplifies x * 1 to x', () => {
      const expr: Expression = {
        type: 'BinaryExpression',
        operator: '*',
        left: { type: 'Identifier', name: 'x' },
        right: { type: 'Literal', value: 1, raw: '1' },
      };

      const result = pass.simplify(expr);
      expect((result as any).name).toBe('x');
    });

    it('simplifies 1 * x to x', () => {
      const expr: Expression = {
        type: 'BinaryExpression',
        operator: '*',
        left: { type: 'Literal', value: 1, raw: '1' },
        right: { type: 'Identifier', name: 'x' },
      };

      const result = pass.simplify(expr);
      expect((result as any).name).toBe('x');
    });

    it('simplifies x / 1 to x', () => {
      const expr: Expression = {
        type: 'BinaryExpression',
        operator: '/',
        left: { type: 'Identifier', name: 'x' },
        right: { type: 'Literal', value: 1, raw: '1' },
      };

      const result = pass.simplify(expr);
      expect((result as any).name).toBe('x');
    });
  });

  describe('zero simplifications', () => {
    it('simplifies x * 0 to 0', () => {
      const expr: Expression = {
        type: 'BinaryExpression',
        operator: '*',
        left: { type: 'Identifier', name: 'x' },
        right: { type: 'Literal', value: 0, raw: '0' },
      };

      const result = pass.simplify(expr);
      expect(result.type).toBe('Literal');
      expect((result as any).value).toBe(0);
    });

    it('simplifies 0 * x to 0', () => {
      const expr: Expression = {
        type: 'BinaryExpression',
        operator: '*',
        left: { type: 'Literal', value: 0, raw: '0' },
        right: { type: 'Identifier', name: 'x' },
      };

      const result = pass.simplify(expr);
      expect((result as any).value).toBe(0);
    });

    it('simplifies 0 / x to 0', () => {
      const expr: Expression = {
        type: 'BinaryExpression',
        operator: '/',
        left: { type: 'Literal', value: 0, raw: '0' },
        right: { type: 'Identifier', name: 'x' },
      };

      const result = pass.simplify(expr);
      expect((result as any).value).toBe(0);
    });
  });

  describe('self simplifications', () => {
    it('simplifies x - x to 0', () => {
      const expr: Expression = {
        type: 'BinaryExpression',
        operator: '-',
        left: { type: 'Identifier', name: 'x' },
        right: { type: 'Identifier', name: 'x' },
      };

      const result = pass.simplify(expr);
      expect((result as any).value).toBe(0);
    });

    it('simplifies x / x to 1', () => {
      const expr: Expression = {
        type: 'BinaryExpression',
        operator: '/',
        left: { type: 'Identifier', name: 'x' },
        right: { type: 'Identifier', name: 'x' },
      };

      const result = pass.simplify(expr);
      expect((result as any).value).toBe(1);
    });
  });

  describe('double negation', () => {
    it('simplifies -(-x) to x', () => {
      const expr: Expression = {
        type: 'UnaryExpression',
        operator: '-',
        argument: {
          type: 'UnaryExpression',
          operator: '-',
          argument: { type: 'Identifier', name: 'x' },
        },
      };

      const result = pass.simplify(expr);
      expect((result as any).name).toBe('x');
    });
  });
});

describe('DeadCodeEliminationPass', () => {
  const pass = new DeadCodeEliminationPass();

  describe('unreachable code', () => {
    it('removes code after return', () => {
      const statements: Statement[] = [
        {
          type: 'ReturnStatement',
          argument: { type: 'Literal', value: 1, raw: '1' },
        },
        {
          type: 'ExpressionStatement',
          expression: { type: 'Identifier', name: 'unreachable' },
        },
      ];

      const result = pass.eliminateDeadCode(statements);
      expect(result).toHaveLength(1);
    });

    it('removes code after break', () => {
      const statements: Statement[] = [
        { type: 'BreakStatement' },
        {
          type: 'ExpressionStatement',
          expression: { type: 'Identifier', name: 'unreachable' },
        },
      ];

      const result = pass.eliminateDeadCode(statements);
      expect(result).toHaveLength(1);
    });

    it('removes code after continue', () => {
      const statements: Statement[] = [
        { type: 'ContinueStatement' },
        {
          type: 'ExpressionStatement',
          expression: { type: 'Identifier', name: 'unreachable' },
        },
      ];

      const result = pass.eliminateDeadCode(statements);
      expect(result).toHaveLength(1);
    });
  });

  describe('unused variables', () => {
    it('removes unused variable declarations', () => {
      const statements: Statement[] = [
        {
          type: 'VariableDeclaration',
          declarations: [
            {
              id: { type: 'Identifier', name: 'unused' },
              init: { type: 'Literal', value: 0, raw: '0' },
            },
          ],
        },
        {
          type: 'ReturnStatement',
          argument: { type: 'Literal', value: 1, raw: '1' },
        },
      ];

      const result = pass.eliminateUnusedVariables(statements);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('ReturnStatement');
    });

    it('keeps used variable declarations', () => {
      const statements: Statement[] = [
        {
          type: 'VariableDeclaration',
          declarations: [
            {
              id: { type: 'Identifier', name: 'used' },
              init: { type: 'Literal', value: 0, raw: '0' },
            },
          ],
        },
        {
          type: 'ReturnStatement',
          argument: { type: 'Identifier', name: 'used' },
        },
      ];

      const result = pass.eliminateUnusedVariables(statements);
      expect(result).toHaveLength(2);
    });
  });

  describe('constant conditions', () => {
    it('eliminates if (false) branch', () => {
      const stmt: Statement = {
        type: 'IfStatement',
        test: { type: 'Literal', value: false, raw: 'false' },
        consequent: {
          type: 'BlockStatement',
          statements: [
            { type: 'ReturnStatement', argument: { type: 'Literal', value: 1, raw: '1' } },
          ],
        },
        alternate: null,
      };

      const result = pass.eliminateConstantCondition(stmt);
      expect(result).toBeNull();
    });

    it('keeps if (true) consequent', () => {
      const stmt: Statement = {
        type: 'IfStatement',
        test: { type: 'Literal', value: true, raw: 'true' },
        consequent: {
          type: 'BlockStatement',
          statements: [
            { type: 'ReturnStatement', argument: { type: 'Literal', value: 1, raw: '1' } },
          ],
        },
        alternate: null,
      };

      const result = pass.eliminateConstantCondition(stmt);
      expect(result?.type).toBe('BlockStatement');
    });
  });
});

describe('StrengthReductionPass', () => {
  const pass = new StrengthReductionPass();

  describe('power reduction', () => {
    it('reduces x * 2 to x + x', () => {
      const expr: Expression = {
        type: 'BinaryExpression',
        operator: '*',
        left: { type: 'Identifier', name: 'x' },
        right: { type: 'Literal', value: 2, raw: '2' },
      };

      const result = pass.reduce(expr);
      expect(result.type).toBe('BinaryExpression');
      expect((result as any).operator).toBe('+');
    });

    it('reduces pow(x, 2) to x * x', () => {
      const expr: Expression = {
        type: 'CallExpression',
        callee: { type: 'Identifier', name: 'pow' },
        arguments: [
          { type: 'Identifier', name: 'x' },
          { type: 'Literal', value: 2, raw: '2' },
        ],
      };

      const result = pass.reduce(expr);
      expect(result.type).toBe('BinaryExpression');
      expect((result as any).operator).toBe('*');
    });

    it('reduces pow(x, 0.5) to sqrt(x)', () => {
      const expr: Expression = {
        type: 'CallExpression',
        callee: { type: 'Identifier', name: 'pow' },
        arguments: [
          { type: 'Identifier', name: 'x' },
          { type: 'Literal', value: 0.5, raw: '0.5' },
        ],
      };

      const result = pass.reduce(expr);
      expect(result.type).toBe('CallExpression');
      expect((result as any).callee.name).toBe('sqrt');
    });
  });

  describe('division to multiplication', () => {
    it('reduces x / 2 to x * 0.5', () => {
      const expr: Expression = {
        type: 'BinaryExpression',
        operator: '/',
        left: { type: 'Identifier', name: 'x' },
        right: { type: 'Literal', value: 2, raw: '2' },
      };

      const result = pass.reduce(expr);
      expect(result.type).toBe('BinaryExpression');
      expect((result as any).operator).toBe('*');
      expect((result as any).right.value).toBe(0.5);
    });

    it('reduces x / 4 to x * 0.25', () => {
      const expr: Expression = {
        type: 'BinaryExpression',
        operator: '/',
        left: { type: 'Identifier', name: 'x' },
        right: { type: 'Literal', value: 4, raw: '4' },
      };

      const result = pass.reduce(expr);
      expect((result as any).right.value).toBe(0.25);
    });
  });
});

describe('CommonSubexpressionPass', () => {
  const pass = new CommonSubexpressionPass();

  it('identifies common subexpressions', () => {
    const statements: Statement[] = [
      {
        type: 'VariableDeclaration',
        declarations: [
          {
            id: { type: 'Identifier', name: 'a' },
            init: {
              type: 'BinaryExpression',
              operator: '+',
              left: { type: 'Identifier', name: 'x' },
              right: { type: 'Identifier', name: 'y' },
            },
          },
        ],
      },
      {
        type: 'VariableDeclaration',
        declarations: [
          {
            id: { type: 'Identifier', name: 'b' },
            init: {
              type: 'BinaryExpression',
              operator: '+',
              left: { type: 'Identifier', name: 'x' },
              right: { type: 'Identifier', name: 'y' },
            },
          },
        ],
      },
    ];

    const result = pass.eliminateCSE(statements);
    expect(result.transformations).toBeGreaterThan(0);
  });

  it('hashes expressions consistently', () => {
    const expr1: Expression = {
      type: 'BinaryExpression',
      operator: '+',
      left: { type: 'Identifier', name: 'a' },
      right: { type: 'Identifier', name: 'b' },
    };

    const expr2: Expression = {
      type: 'BinaryExpression',
      operator: '+',
      left: { type: 'Identifier', name: 'a' },
      right: { type: 'Identifier', name: 'b' },
    };

    expect(pass.hashExpression(expr1)).toBe(pass.hashExpression(expr2));
  });

  it('hashes different expressions differently', () => {
    const expr1: Expression = {
      type: 'BinaryExpression',
      operator: '+',
      left: { type: 'Identifier', name: 'a' },
      right: { type: 'Identifier', name: 'b' },
    };

    const expr2: Expression = {
      type: 'BinaryExpression',
      operator: '*',
      left: { type: 'Identifier', name: 'a' },
      right: { type: 'Identifier', name: 'b' },
    };

    expect(pass.hashExpression(expr1)).not.toBe(pass.hashExpression(expr2));
  });
});

describe('PeepholeOptimizationPass', () => {
  const pass = new PeepholeOptimizationPass();

  it('optimizes consecutive assignments', () => {
    const statements: Statement[] = [
      {
        type: 'ExpressionStatement',
        expression: {
          type: 'AssignmentExpression',
          operator: '=',
          left: { type: 'Identifier', name: 'x' },
          right: { type: 'Literal', value: 1, raw: '1' },
        },
      },
      {
        type: 'ExpressionStatement',
        expression: {
          type: 'AssignmentExpression',
          operator: '=',
          left: { type: 'Identifier', name: 'x' },
          right: { type: 'Literal', value: 2, raw: '2' },
        },
      },
    ];

    const result = pass.optimize(statements);
    expect(result).toHaveLength(1);
    expect((result[0] as any).expression.right.value).toBe(2);
  });

  it('optimizes load after store', () => {
    const statements: Statement[] = [
      {
        type: 'ExpressionStatement',
        expression: {
          type: 'AssignmentExpression',
          operator: '=',
          left: { type: 'Identifier', name: 'x' },
          right: { type: 'Literal', value: 42, raw: '42' },
        },
      },
      {
        type: 'VariableDeclaration',
        declarations: [
          {
            id: { type: 'Identifier', name: 'y' },
            init: { type: 'Identifier', name: 'x' },
          },
        ],
      },
    ];

    const result = pass.optimize(statements);
    // y should be initialized with 42 directly
    expect((result[1] as any).declarations[0].init.value).toBe(42);
  });
});

describe('LoopUnrollingPass', () => {
  const pass = new LoopUnrollingPass({ maxUnrollIterations: 8 });

  it('unrolls small constant loops', () => {
    const forLoop: Statement = {
      type: 'ForStatement',
      init: {
        type: 'VariableDeclaration',
        declarations: [
          {
            id: { type: 'Identifier', name: 'i' },
            init: { type: 'Literal', value: 0, raw: '0' },
          },
        ],
      },
      test: {
        type: 'BinaryExpression',
        operator: '<',
        left: { type: 'Identifier', name: 'i' },
        right: { type: 'Literal', value: 4, raw: '4' },
      },
      update: {
        type: 'UpdateExpression',
        operator: '++',
        argument: { type: 'Identifier', name: 'i' },
        prefix: false,
      },
      body: {
        type: 'BlockStatement',
        statements: [
          {
            type: 'ExpressionStatement',
            expression: { type: 'Identifier', name: 'doSomething' },
          },
        ],
      },
    };

    const result = pass.unroll(forLoop);
    expect(result.type).toBe('BlockStatement');
    expect((result as any).statements.length).toBe(4);
  });

  it('does not unroll large loops', () => {
    const forLoop: Statement = {
      type: 'ForStatement',
      init: {
        type: 'VariableDeclaration',
        declarations: [
          {
            id: { type: 'Identifier', name: 'i' },
            init: { type: 'Literal', value: 0, raw: '0' },
          },
        ],
      },
      test: {
        type: 'BinaryExpression',
        operator: '<',
        left: { type: 'Identifier', name: 'i' },
        right: { type: 'Literal', value: 100, raw: '100' },
      },
      update: null,
      body: { type: 'BlockStatement', statements: [] },
    };

    const result = pass.unroll(forLoop);
    expect(result.type).toBe('ForStatement');
  });

  it('does not unroll dynamic bounds', () => {
    const forLoop: Statement = {
      type: 'ForStatement',
      init: null,
      test: {
        type: 'BinaryExpression',
        operator: '<',
        left: { type: 'Identifier', name: 'i' },
        right: { type: 'Identifier', name: 'n' }, // dynamic bound
      },
      update: null,
      body: { type: 'BlockStatement', statements: [] },
    };

    const result = pass.unroll(forLoop);
    expect(result.type).toBe('ForStatement');
  });
});

describe('FunctionInliningPass', () => {
  const pass = new FunctionInliningPass({ maxInlineSize: 10 });

  it('inlines small functions', () => {
    const program: ShaderProgram = {
      type: 'ShaderProgram',
      body: [
        {
          type: 'FunctionDeclaration',
          name: 'square',
          params: [{ name: 'x', type: { kind: 'primitive', name: 'f32' } }],
          returnType: { kind: 'primitive', name: 'f32' },
          body: {
            type: 'BlockStatement',
            statements: [
              {
                type: 'ReturnStatement',
                argument: {
                  type: 'BinaryExpression',
                  operator: '*',
                  left: { type: 'Identifier', name: 'x' },
                  right: { type: 'Identifier', name: 'x' },
                },
              },
            ],
          },
        },
      ],
      metadata: { version: '1.0' },
    };

    const callExpr: Expression = {
      type: 'CallExpression',
      callee: { type: 'Identifier', name: 'square' },
      arguments: [{ type: 'Identifier', name: 'y' }],
    };

    const result = pass.inlineCall(callExpr, program);
    expect(result?.type).toBe('BinaryExpression');
  });

  it('does not inline large functions', () => {
    const pass = new FunctionInliningPass({ maxInlineSize: 1 });
    const program: ShaderProgram = {
      type: 'ShaderProgram',
      body: [
        {
          type: 'FunctionDeclaration',
          name: 'complex',
          params: [],
          returnType: { kind: 'primitive', name: 'f32' },
          body: {
            type: 'BlockStatement',
            statements: [
              { type: 'ExpressionStatement', expression: { type: 'Literal', value: 1, raw: '1' } },
              { type: 'ExpressionStatement', expression: { type: 'Literal', value: 2, raw: '2' } },
              { type: 'ExpressionStatement', expression: { type: 'Literal', value: 3, raw: '3' } },
              { type: 'ReturnStatement', argument: { type: 'Literal', value: 0, raw: '0' } },
            ],
          },
        },
      ],
      metadata: { version: '1.0' },
    };

    const callExpr: Expression = {
      type: 'CallExpression',
      callee: { type: 'Identifier', name: 'complex' },
      arguments: [],
    };

    const result = pass.inlineCall(callExpr, program);
    expect(result).toBeNull(); // too large to inline
  });

  it('does not inline recursive functions', () => {
    const program: ShaderProgram = {
      type: 'ShaderProgram',
      body: [
        {
          type: 'FunctionDeclaration',
          name: 'factorial',
          params: [{ name: 'n', type: { kind: 'primitive', name: 'i32' } }],
          returnType: { kind: 'primitive', name: 'i32' },
          body: {
            type: 'BlockStatement',
            statements: [
              {
                type: 'ReturnStatement',
                argument: {
                  type: 'CallExpression',
                  callee: { type: 'Identifier', name: 'factorial' },
                  arguments: [{ type: 'Identifier', name: 'n' }],
                },
              },
            ],
          },
        },
      ],
      metadata: { version: '1.0' },
    };

    const callExpr: Expression = {
      type: 'CallExpression',
      callee: { type: 'Identifier', name: 'factorial' },
      arguments: [{ type: 'Literal', value: 5, raw: '5' }],
    };

    const result = pass.inlineCall(callExpr, program);
    expect(result).toBeNull();
  });
});

describe('LoopInvariantMotionPass', () => {
  const pass = new LoopInvariantMotionPass();

  it('hoists invariant expressions', () => {
    const forLoop: Statement = {
      type: 'ForStatement',
      init: {
        type: 'VariableDeclaration',
        declarations: [
          {
            id: { type: 'Identifier', name: 'i' },
            init: { type: 'Literal', value: 0, raw: '0' },
          },
        ],
      },
      test: {
        type: 'BinaryExpression',
        operator: '<',
        left: { type: 'Identifier', name: 'i' },
        right: { type: 'Literal', value: 10, raw: '10' },
      },
      update: null,
      body: {
        type: 'BlockStatement',
        statements: [
          {
            type: 'VariableDeclaration',
            declarations: [
              {
                id: { type: 'Identifier', name: 'invariant' },
                init: {
                  type: 'BinaryExpression',
                  operator: '+',
                  left: { type: 'Identifier', name: 'a' },
                  right: { type: 'Identifier', name: 'b' },
                },
              },
            ],
          },
        ],
      },
    };

    const result = pass.hoistInvariants(forLoop);
    expect(result.hoisted).toHaveLength(1);
    expect(result.modified.type).toBe('ForStatement');
  });

  it('does not hoist loop-dependent expressions', () => {
    const forLoop: Statement = {
      type: 'ForStatement',
      init: {
        type: 'VariableDeclaration',
        declarations: [
          {
            id: { type: 'Identifier', name: 'i' },
            init: { type: 'Literal', value: 0, raw: '0' },
          },
        ],
      },
      test: null,
      update: null,
      body: {
        type: 'BlockStatement',
        statements: [
          {
            type: 'VariableDeclaration',
            declarations: [
              {
                id: { type: 'Identifier', name: 'dependent' },
                init: {
                  type: 'BinaryExpression',
                  operator: '+',
                  left: { type: 'Identifier', name: 'i' }, // depends on loop var
                  right: { type: 'Literal', value: 1, raw: '1' },
                },
              },
            ],
          },
        ],
      },
    };

    const result = pass.hoistInvariants(forLoop);
    expect(result.hoisted).toHaveLength(0);
  });
});
