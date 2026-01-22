import { describe, it, expect } from 'vitest';
import { TypeChecker } from '../../packages/core/src/type-system/type-checking';
import type { FunctionDeclaration, ShaderProgram } from '../../packages/core/src/types';

describe('TypeChecker', () => {
  describe('constructor', () => {
    it('creates a type checker instance', () => {
      const checker = new TypeChecker();
      expect(checker).toBeDefined();
    });
  });

  describe('checkProgram', () => {
    it('checks a minimal valid program', () => {
      const checker = new TypeChecker();
      const program: ShaderProgram = {
        type: 'ShaderProgram',
        body: [],
        metadata: { version: '1.0' },
      };

      const result = checker.checkProgram(program);
      expect(result.errors).toHaveLength(0);
    });

    it('detects missing vertex entry point', () => {
      const checker = new TypeChecker();
      const program: ShaderProgram = {
        type: 'ShaderProgram',
        body: [
          {
            type: 'FunctionDeclaration',
            name: 'helper',
            params: [],
            returnType: { kind: 'primitive', name: 'f32' },
            body: { type: 'BlockStatement', statements: [] },
          },
        ],
        metadata: { version: '1.0', requiresVertex: true },
      };

      const result = checker.checkProgram(program);
      expect(result.errors.some((e) => e.message.includes('vertex'))).toBe(true);
    });

    it('detects missing fragment entry point', () => {
      const checker = new TypeChecker();
      const program: ShaderProgram = {
        type: 'ShaderProgram',
        body: [],
        metadata: { version: '1.0', requiresFragment: true },
      };

      const result = checker.checkProgram(program);
      expect(result.errors.some((e) => e.message.toLowerCase().includes('fragment'))).toBe(true);
    });
  });

  describe('checkFunction', () => {
    it('validates return type matches', () => {
      const checker = new TypeChecker();
      const func: FunctionDeclaration = {
        type: 'FunctionDeclaration',
        name: 'getValue',
        params: [],
        returnType: { kind: 'primitive', name: 'f32' },
        body: {
          type: 'BlockStatement',
          statements: [
            {
              type: 'ReturnStatement',
              argument: { type: 'Literal', value: 1.0, raw: '1.0' },
            },
          ],
        },
      };

      const errors = checker.checkFunction(func);
      expect(errors).toHaveLength(0);
    });

    it('detects return type mismatch', () => {
      const checker = new TypeChecker();
      const func: FunctionDeclaration = {
        type: 'FunctionDeclaration',
        name: 'getValue',
        params: [],
        returnType: { kind: 'vector', size: 3, elementType: 'f32' },
        body: {
          type: 'BlockStatement',
          statements: [
            {
              type: 'ReturnStatement',
              argument: { type: 'Literal', value: 1.0, raw: '1.0' },
            },
          ],
        },
      };

      const errors = checker.checkFunction(func);
      expect(errors.some((e) => e.message.includes('type'))).toBe(true);
    });

    it('validates parameter types', () => {
      const checker = new TypeChecker();
      const func: FunctionDeclaration = {
        type: 'FunctionDeclaration',
        name: 'add',
        params: [
          { name: 'a', type: { kind: 'primitive', name: 'f32' } },
          { name: 'b', type: { kind: 'primitive', name: 'f32' } },
        ],
        returnType: { kind: 'primitive', name: 'f32' },
        body: {
          type: 'BlockStatement',
          statements: [
            {
              type: 'ReturnStatement',
              argument: {
                type: 'BinaryExpression',
                operator: '+',
                left: { type: 'Identifier', name: 'a' },
                right: { type: 'Identifier', name: 'b' },
              },
            },
          ],
        },
      };

      const errors = checker.checkFunction(func);
      expect(errors).toHaveLength(0);
    });
  });

  describe('checkExpression', () => {
    it('validates binary expression operand types', () => {
      const checker = new TypeChecker();

      const validExpr = {
        type: 'BinaryExpression' as const,
        operator: '+',
        left: { type: 'Literal' as const, value: 1.0, raw: '1.0' },
        right: { type: 'Literal' as const, value: 2.0, raw: '2.0' },
      };

      expect(checker.checkExpression(validExpr)).toHaveLength(0);
    });

    it('validates function call arguments', () => {
      const checker = new TypeChecker();

      const validCall = {
        type: 'CallExpression' as const,
        callee: { type: 'Identifier' as const, name: 'sin' },
        arguments: [{ type: 'Literal' as const, value: 1.0, raw: '1.0' }],
      };

      expect(checker.checkExpression(validCall)).toHaveLength(0);
    });

    it('detects invalid function call argument count', () => {
      const checker = new TypeChecker();

      const invalidCall = {
        type: 'CallExpression' as const,
        callee: { type: 'Identifier' as const, name: 'sin' },
        arguments: [], // sin requires 1 argument
      };

      const errors = checker.checkExpression(invalidCall);
      expect(errors.some((e) => e.message.includes('argument'))).toBe(true);
    });
  });

  describe('checkStatement', () => {
    it('validates variable declaration', () => {
      const checker = new TypeChecker();

      const decl = {
        type: 'VariableDeclaration' as const,
        declarations: [
          {
            id: { type: 'Identifier' as const, name: 'x' },
            typeAnnotation: { kind: 'primitive' as const, name: 'f32' },
            init: { type: 'Literal' as const, value: 1.0, raw: '1.0' },
          },
        ],
      };

      expect(checker.checkStatement(decl)).toHaveLength(0);
    });

    it('detects type mismatch in variable initialization', () => {
      const checker = new TypeChecker();

      const decl = {
        type: 'VariableDeclaration' as const,
        declarations: [
          {
            id: { type: 'Identifier' as const, name: 'x' },
            typeAnnotation: { kind: 'vector' as const, size: 3, elementType: 'f32' },
            init: { type: 'Literal' as const, value: 1.0, raw: '1.0' },
          },
        ],
      };

      const errors = checker.checkStatement(decl);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('validates if statement condition', () => {
      const checker = new TypeChecker();

      const ifStmt = {
        type: 'IfStatement' as const,
        test: { type: 'Literal' as const, value: true, raw: 'true' },
        consequent: { type: 'BlockStatement' as const, statements: [] },
        alternate: null,
      };

      expect(checker.checkStatement(ifStmt)).toHaveLength(0);
    });

    it('detects non-boolean if condition', () => {
      const checker = new TypeChecker();

      const ifStmt = {
        type: 'IfStatement' as const,
        test: { type: 'Literal' as const, value: 1.0, raw: '1.0' },
        consequent: { type: 'BlockStatement' as const, statements: [] },
        alternate: null,
      };

      const errors = checker.checkStatement(ifStmt);
      expect(errors.some((e) => e.message.includes('bool'))).toBe(true);
    });

    it('validates for loop', () => {
      const checker = new TypeChecker();

      const forStmt = {
        type: 'ForStatement' as const,
        init: {
          type: 'VariableDeclaration' as const,
          declarations: [
            {
              id: { type: 'Identifier' as const, name: 'i' },
              typeAnnotation: { kind: 'primitive' as const, name: 'i32' },
              init: { type: 'Literal' as const, value: 0, raw: '0' },
            },
          ],
        },
        test: {
          type: 'BinaryExpression' as const,
          operator: '<',
          left: { type: 'Identifier' as const, name: 'i' },
          right: { type: 'Literal' as const, value: 10, raw: '10' },
        },
        update: {
          type: 'AssignmentExpression' as const,
          operator: '+=',
          left: { type: 'Identifier' as const, name: 'i' },
          right: { type: 'Literal' as const, value: 1, raw: '1' },
        },
        body: { type: 'BlockStatement' as const, statements: [] },
      };

      expect(checker.checkStatement(forStmt)).toHaveLength(0);
    });
  });

  describe('vertex entry point validation', () => {
    it('validates vertex output has position', () => {
      const checker = new TypeChecker();
      const func: FunctionDeclaration = {
        type: 'FunctionDeclaration',
        name: 'vs_main',
        params: [],
        returnType: {
          kind: 'struct',
          name: 'VertexOutput',
          fields: [
            {
              name: 'position',
              type: { kind: 'vector', size: 4, elementType: 'f32' },
              builtin: 'position',
            },
          ],
        },
        body: { type: 'BlockStatement', statements: [] },
        attributes: [{ name: 'vertex' }],
      };

      const errors = checker.checkVertexEntryPoint(func);
      expect(errors).toHaveLength(0);
    });

    it('detects missing position in vertex output', () => {
      const checker = new TypeChecker();
      const func: FunctionDeclaration = {
        type: 'FunctionDeclaration',
        name: 'vs_main',
        params: [],
        returnType: {
          kind: 'struct',
          name: 'VertexOutput',
          fields: [
            {
              name: 'color',
              type: { kind: 'vector', size: 4, elementType: 'f32' },
            },
          ],
        },
        body: { type: 'BlockStatement', statements: [] },
        attributes: [{ name: 'vertex' }],
      };

      const errors = checker.checkVertexEntryPoint(func);
      expect(errors.some((e) => e.message.includes('position'))).toBe(true);
    });
  });

  describe('fragment entry point validation', () => {
    it('validates fragment output type', () => {
      const checker = new TypeChecker();
      const func: FunctionDeclaration = {
        type: 'FunctionDeclaration',
        name: 'fs_main',
        params: [],
        returnType: { kind: 'vector', size: 4, elementType: 'f32' },
        body: { type: 'BlockStatement', statements: [] },
        attributes: [{ name: 'fragment' }],
      };

      const errors = checker.checkFragmentEntryPoint(func);
      expect(errors).toHaveLength(0);
    });

    it('accepts struct with color output', () => {
      const checker = new TypeChecker();
      const func: FunctionDeclaration = {
        type: 'FunctionDeclaration',
        name: 'fs_main',
        params: [],
        returnType: {
          kind: 'struct',
          name: 'FragmentOutput',
          fields: [
            {
              name: 'color',
              type: { kind: 'vector', size: 4, elementType: 'f32' },
              location: 0,
            },
          ],
        },
        body: { type: 'BlockStatement', statements: [] },
        attributes: [{ name: 'fragment' }],
      };

      const errors = checker.checkFragmentEntryPoint(func);
      expect(errors).toHaveLength(0);
    });
  });

  describe('struct validation', () => {
    it('validates struct field types', () => {
      const checker = new TypeChecker();
      const structDecl = {
        type: 'StructDeclaration' as const,
        name: 'Vertex',
        fields: [
          { name: 'position', type: { kind: 'vector' as const, size: 3, elementType: 'f32' } },
          { name: 'normal', type: { kind: 'vector' as const, size: 3, elementType: 'f32' } },
          { name: 'uv', type: { kind: 'vector' as const, size: 2, elementType: 'f32' } },
        ],
      };

      const errors = checker.checkStruct(structDecl);
      expect(errors).toHaveLength(0);
    });

    it('detects duplicate field names', () => {
      const checker = new TypeChecker();
      const structDecl = {
        type: 'StructDeclaration' as const,
        name: 'BadStruct',
        fields: [
          { name: 'x', type: { kind: 'primitive' as const, name: 'f32' } },
          { name: 'x', type: { kind: 'primitive' as const, name: 'f32' } },
        ],
      };

      const errors = checker.checkStruct(structDecl);
      expect(errors.some((e) => e.message.includes('duplicate'))).toBe(true);
    });
  });

  describe('binding validation', () => {
    it('validates uniform bindings', () => {
      const checker = new TypeChecker();
      const binding = {
        type: 'BindingDeclaration' as const,
        name: 'uniforms',
        group: 0,
        binding: 0,
        bindingType: 'uniform' as const,
        type_: {
          kind: 'struct' as const,
          name: 'Uniforms',
          fields: [{ name: 'mvp', type: { kind: 'matrix', rows: 4, cols: 4, elementType: 'f32' } }],
        },
      };

      const errors = checker.checkBinding(binding);
      expect(errors).toHaveLength(0);
    });

    it('validates texture bindings', () => {
      const checker = new TypeChecker();
      const binding = {
        type: 'BindingDeclaration' as const,
        name: 'myTexture',
        group: 0,
        binding: 1,
        bindingType: 'texture' as const,
        type_: { kind: 'texture' as const, dimension: '2d', sampleType: 'float' },
      };

      const errors = checker.checkBinding(binding);
      expect(errors).toHaveLength(0);
    });

    it('validates sampler bindings', () => {
      const checker = new TypeChecker();
      const binding = {
        type: 'BindingDeclaration' as const,
        name: 'mySampler',
        group: 0,
        binding: 2,
        bindingType: 'sampler' as const,
        type_: { kind: 'sampler' as const },
      };

      const errors = checker.checkBinding(binding);
      expect(errors).toHaveLength(0);
    });

    it('detects duplicate binding indices', () => {
      const checker = new TypeChecker();
      const bindings = [
        {
          type: 'BindingDeclaration' as const,
          name: 'a',
          group: 0,
          binding: 0,
          bindingType: 'uniform' as const,
          type_: { kind: 'primitive' as const, name: 'f32' },
        },
        {
          type: 'BindingDeclaration' as const,
          name: 'b',
          group: 0,
          binding: 0, // duplicate!
          bindingType: 'uniform' as const,
          type_: { kind: 'primitive' as const, name: 'f32' },
        },
      ];

      const errors = checker.checkBindings(bindings);
      expect(errors.some((e) => e.message.includes('duplicate'))).toBe(true);
    });
  });

  describe('built-in validation', () => {
    it('validates position built-in type', () => {
      const checker = new TypeChecker();
      const field = {
        name: 'position',
        type: { kind: 'vector' as const, size: 4, elementType: 'f32' },
        builtin: 'position',
      };

      const errors = checker.checkBuiltin(field);
      expect(errors).toHaveLength(0);
    });

    it('detects wrong type for position built-in', () => {
      const checker = new TypeChecker();
      const field = {
        name: 'position',
        type: { kind: 'vector' as const, size: 3, elementType: 'f32' }, // should be vec4
        builtin: 'position',
      };

      const errors = checker.checkBuiltin(field);
      expect(errors.some((e) => e.message.includes('vec4'))).toBe(true);
    });

    it('validates vertex_index built-in', () => {
      const checker = new TypeChecker();
      const field = {
        name: 'vid',
        type: { kind: 'primitive' as const, name: 'u32' },
        builtin: 'vertex_index',
      };

      const errors = checker.checkBuiltin(field);
      expect(errors).toHaveLength(0);
    });

    it('validates instance_index built-in', () => {
      const checker = new TypeChecker();
      const field = {
        name: 'iid',
        type: { kind: 'primitive' as const, name: 'u32' },
        builtin: 'instance_index',
      };

      const errors = checker.checkBuiltin(field);
      expect(errors).toHaveLength(0);
    });

    it('validates front_facing built-in', () => {
      const checker = new TypeChecker();
      const field = {
        name: 'isFront',
        type: { kind: 'primitive' as const, name: 'bool' },
        builtin: 'front_facing',
      };

      const errors = checker.checkBuiltin(field);
      expect(errors).toHaveLength(0);
    });
  });
});
