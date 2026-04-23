```markdown
# worklog-ai Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill provides a comprehensive guide to contributing to the `worklog-ai` TypeScript codebase. It covers the project's coding conventions, common deployment and integration workflows, and testing patterns. Whether you're updating deployment configs, authentication logic, or writing new features, this guide will help you follow established patterns and best practices.

## Coding Conventions

- **Language:** TypeScript
- **Framework:** None detected
- **File Naming:** Use camelCase for file and directory names.
  - Example: `userProfile.ts`, `supabaseClient.ts`
- **Import Style:** Use relative imports.
  - Example:
    ```typescript
    import supabase from '../lib/supabase';
    ```
- **Export Style:** Use default exports.
  - Example:
    ```typescript
    // server/src/lib/supabase.ts
    const supabase = createClient(...);
    export default supabase;
    ```
- **Commit Messages:** Freeform, typically short (average 33 characters), no enforced prefix.

## Workflows

### Update Vercel Deployment Config
**Trigger:** When you need to adjust Vercel deployment settings or fix deployment issues (e.g., environment schema, SPA routing, output directory).
**Command:** `/update-vercel-config`

1. Edit `vercel.json` (or `client/vercel.json`) to update configuration or environment schema.
2. Optionally update or create `scripts/vercel-prepare-output.mjs` or `client/public/scripts/vercel-prepare-output.mjs` to prepare the output directory.
3. If SPA routing is involved, edit `client/src/App.tsx` or `client/main.tsx`.
4. Commit changes to `vercel.json` and any related scripts.

**Example:**
```json
// vercel.json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "env": { "SUPABASE_URL": "@supabase-url" }
}
```

### Update Server Auth or Supabase Integration
**Trigger:** When you want to improve authentication, add logging, or update Supabase usage on the server.
**Command:** `/update-auth-supabase`

1. Edit `server/src/middleware/auth.ts` to update authentication logic.
2. Edit `server/src/lib/supabase.ts` to change Supabase integration or logging.
3. Optionally update `server/src/index.ts` or related route files if needed.
4. Commit changes to auth and supabase files.

**Example:**
```typescript
// server/src/middleware/auth.ts
import supabase from '../lib/supabase';

export default async function auth(req, res, next) {
  const token = req.headers['authorization'];
  const { user, error } = await supabase.auth.getUser(token);
  if (error) return res.status(401).send('Unauthorized');
  req.user = user;
  next();
}
```

### Update Render Deployment Config
**Trigger:** When you need to fix or update deployment settings for Render (e.g., build/start commands, Procfile).
**Command:** `/update-render-config`

1. Edit `render.yaml` to update build or start commands.
2. Optionally edit `server/Procfile` if process commands change.
3. Commit changes to `render.yaml` and/or `Procfile`.

**Example:**
```yaml
# render.yaml
services:
  - type: web
    name: worklog-ai-server
    env: node
    buildCommand: npm run build
    startCommand: npm start
```
```Procfile
web: node dist/index.js
```

## Testing Patterns

- **Test Framework:** Unknown (not detected).
- **Test File Pattern:** Files named with `.test.` (e.g., `userAuth.test.ts`).
- **Location:** Tests are typically placed alongside the code they test.
- **Example:**
  ```typescript
  // server/src/middleware/auth.test.ts
  import auth from './auth';

  test('rejects invalid token', async () => {
    // ...test logic...
  });
  ```

## Commands

| Command                | Purpose                                                      |
|------------------------|--------------------------------------------------------------|
| /update-vercel-config  | Update or fix Vercel deployment configuration                |
| /update-auth-supabase  | Change authentication logic or update Supabase integration   |
| /update-render-config  | Update Render deployment configuration                       |
```
