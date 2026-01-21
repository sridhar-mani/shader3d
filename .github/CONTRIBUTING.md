# Contributing to Shader3D

Thank you for your interest in contributing to Shader3D! This document provides guidelines for contributing.

## Code of Conduct

Please be respectful and constructive in all interactions. We're building something cool together!

## License Agreement

By contributing to this project, you agree that:

1. Your contributions will be licensed under the same non-commercial license as the project
2. You grant the maintainers the right to include your contributions in commercially licensed versions
3. You have the right to submit your contributions

## Getting Started

### Prerequisites

- Node.js 18.x or later
- npm 9.x or later
- A modern browser with WebGPU support (Chrome 113+, Edge 113+)

### Setup

```bash
# Clone the repository
git clone https://github.com/shader3d/shader3d.git
cd shader3d

# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm test
```

## Development Workflow

### Branch Naming

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation
- `refactor/` - Code refactoring
- `test/` - Test additions/changes

### Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `style` - Code style changes
- `refactor` - Code refactoring
- `test` - Test changes
- `chore` - Build/tooling changes

Examples:
```
feat(core): add support for compute shaders
fix(runtime): resolve WebGPU context loss handling
docs(readme): update installation instructions
```

## Pull Request Process

1. **Fork** the repository
2. **Create** a feature branch from `main`
3. **Make** your changes with clear commits
4. **Test** your changes thoroughly
5. **Push** to your fork
6. **Open** a Pull Request

### PR Requirements

- [ ] All tests pass
- [ ] Code follows the project style
- [ ] New features include tests
- [ ] Documentation is updated if needed
- [ ] Commit messages follow conventions

## Project Structure

```
shader3d/
├── packages/
│   ├── core/          # Parser, transpiler, code generators
│   ├── runtime/       # WebGPU runtime
│   ├── vite-plugin/   # Vite integration
│   └── ladder/        # Learning system & CLI
├── examples/          # Example projects
├── example/           # React demo app
└── docs/              # Documentation
```

## Development Tips

### Building a Specific Package

```bash
cd packages/core
npm run build
```

### Running the Example App

```bash
cd example
npm run dev
```

### Type Checking

```bash
npm run typecheck
```

### Linting

```bash
npm run lint
```

## Areas to Contribute

### Good First Issues

Look for issues labeled `good first issue` - these are great starting points.

### Documentation

- Improve README and guides
- Add JSDoc comments
- Create tutorials

### Features

- New shader transformations
- Additional WebGPU primitives
- Better error messages
- Performance optimizations

### Testing

- Add unit tests
- Add integration tests
- Improve test coverage

## Questions?

- Open an issue for questions
- Check existing issues first
- Be specific and provide context
