# AI Pulse Database Deployment Checklist

## Problem
The error `PGRST205: Could not find the table 'public.ai_articles'` means the AI Pulse database tables haven't been created in Supabase.

## Solution: Run SQL Migration in Supabase

### Step 1: Open Supabase SQL Editor

1. Go to [supabase.com](https://supabase.com)
2. Select your project (`worklog-ai`)
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**

### Step 2: Copy and Run the Migration SQL

Copy the **entire contents** of this file:

```
D:\Vibe Coded\worklog-ai\supabase-migration-ai-pulse.sql
```

Paste it into the SQL Editor and click **Run** (or press `Ctrl+Enter`).

This single script will:
- Create 3 tables: `ai_articles`, `ai_impact_cards`, `user_bookmarks`
- Create indexes for performance
- Enable Row Level Security (RLS) with public read policies
- Add triggers for auto-updating timestamps
- Insert 5 sample articles and 4 sample impact cards

### Step 3: Verify Tables Were Created

Run this verification query in the SQL Editor:

```sql
SELECT
  tablename,
  tableowner
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('ai_articles', 'ai_impact_cards', 'user_bookmarks')
ORDER BY tablename;
```

**Expected output:**
```
| tablename       | tableowner |
|-----------------|------------|
| ai_articles     | postgres   |
| ai_impact_cards | postgres   |
| user_bookmarks  | postgres   |
```

If you see all 3 tables, the migration succeeded.

### Step 4: Verify Seed Data

Run this to confirm sample data exists:

```sql
SELECT 'ai_articles' as table_name, COUNT(*) as count FROM ai_articles
UNION ALL
SELECT 'ai_impact_cards', COUNT(*) FROM ai_impact_cards;
```

**Expected output:**
```
| table_name      | count |
|-----------------|-------|
| ai_articles     | 5     |
| ai_impact_cards | 4     |
```

### Step 5: Verify API Connection

After deployment, Restart your Render deployment, and test the API endpoint:

```
GET https://your-render-url.onrender.com/api/ai-pulse/articles
```

You should receive:
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "title": "OpenAI Releases GPT-4.5 with Enhanced Reasoning",
      ...
    },
    ...
  ]
}
```

## Alternative: Run Seed File Separately

If you want to add more seed data later, run this file:

```
D:\Vibe Coded\worklog-ai\supabase-schema-ai-pulse-seed.sql
```

This contains additional sample articles and impact cards.

## Environment Variables Checklist

Ensure these are set in **Render** dashboard for your backend service:

- `SUPABASE_URL` - Your Supabase project URL (e.g., `https://xyzabc.supabase.co`)
- `SUPABASE_SERVICE_KEY` - Your Supabase service role key (found in Supabase dashboard > Settings > API)

## Troubleshooting

### Error: "relation already exists"
The tables were already created. You can skip the migration.

### Error: "permission denied"
Ensure you're running the SQL as the `postgres` user in Supabase (default).

### API still fails after migration
1. Check Render logs for environment variable issues
2. Verify the Supabase service key is correct
3. Check RLS policies in Supabase > Database > Tables

## Files Reference

| File | Purpose |
|------|---------|
| `supabase-migration-ai-pulse.sql` | **Run this first** - Creates tables, policies, indexes, seed data |
| `supabase-schema-ai-pulse-seed.sql` | Additional seed data (optional) |
| `server/src/routes/aiPulse.ts` | API routes querying the tables |

---

**After completing these steps, the `PGRST205` error should be resolved.**