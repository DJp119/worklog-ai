```markdown
# worklog-ai Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill introduces the development patterns and conventions used in the `worklog-ai` TypeScript codebase. It covers file naming, import/export styles, commit practices, and testing patterns. While no specific frameworks or automated workflows are detected, this guide provides best practices and helpful commands to streamline your development process.

## Coding Conventions

### File Naming
- Use **camelCase** for file names.
  - Example: `worklogEntry.ts`, `userManager.ts`

### Import Style
- Use **relative imports** for modules within the project.
  - Example:
    ```typescript
    import { getUser } from './userManager';
    ```

### Export Style
- Use **named exports** rather than default exports.
  - Example:
    ```typescript
    // userManager.ts
    export function getUser(id: string) { ... }
    export function setUser(user: User) { ... }
    ```

### Commit Patterns
- Commit messages are freeform, with no strict prefixes.
- Keep messages concise (average length: 19 characters).
  - Example:
    ```
    Add user login logic
    Fix typo in worklog
    ```

## Workflows

_No automated workflows detected in this repository._

## Testing Patterns

- Test files use the pattern `*.test.*` (e.g., `worklogEntry.test.ts`).
- The specific testing framework is **unknown**, but tests are likely written in TypeScript.
- Example test file structure:
  ```typescript
  // worklogEntry.test.ts
  import { createEntry } from './worklogEntry';

  describe('createEntry', () => {
    it('should create a new worklog entry', () => {
      const entry = createEntry('Task', 'Completed');
      expect(entry.title).toBe('Task');
      expect(entry.status).toBe('Completed');
    });
  });
  ```

## Commands
| Command | Purpose |
|---------|---------|
| /test   | Run all test files matching `*.test.*` |
| /lint   | Lint the codebase for style and errors |
| /commit | Start a new commit with recommended conventions |

```