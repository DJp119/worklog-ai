import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import zlib from 'zlib'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load env variables
dotenv.config()
// Fallback to server/.env if run from the root directory during local development
if (!process.env.SUPABASE_URL) {
    dotenv.config({ path: path.resolve(__dirname, '../server/.env') })
}

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('CRITICAL: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment.')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    }
})

// Restore order matters due to Foreign Key constraints!
const RESTORE_ORDER = [
    'users',
    'user_profiles',
    'work_log_entries',
    'appraisal_criteria',
    'generated_appraisals',
    'reminder_logs',
    'monthly_summaries',
    'chat_sessions',
    'chat_messages',
    'feedback',
    'ai_articles',
    'ai_impact_cards',
    'user_bookmarks',
    'translation_cache'
]

async function runRestore() {
    const args = process.argv.slice(2);
    if (args.length < 1) {
        console.log('Usage: node scripts/restore.js <path-to-backup-file>');
        console.log('Example: node scripts/restore.js ./worklog_ai_backup_2026-06-07.json.gz');
        process.exit(1);
    }

    const filePath = path.resolve(args[0]);
    if (!fs.existsSync(filePath)) {
        console.error(`Error: File does not exist at ${filePath}`);
        process.exit(1);
    }

    console.log(`Reading backup file from ${filePath}...`);
    let fileBuffer = fs.readFileSync(filePath);
    
    // Decompress if gzip
    if (filePath.endsWith('.gz')) {
        console.log('Decompressing gzip archive...');
        fileBuffer = zlib.gunzipSync(fileBuffer);
    }

    console.log('Parsing JSON data...');
    const backupData = JSON.parse(fileBuffer.toString());
    
    console.log(`Backup generated at: ${backupData.backup_time}`);
    console.log('Starting table restore processes (upsert mode)...');

    for (const table of RESTORE_ORDER) {
        const rows = backupData.tables[table];
        if (!rows || rows.length === 0) {
            console.log(`Table ${table}: No records found in backup, skipping.`);
            continue;
        }

        console.log(`Restoring table: ${table} (${rows.length} records)...`);
        
        // Chunk inserts to prevent payload limits
        const chunkSize = 100;
        for (let i = 0; i < rows.length; i += chunkSize) {
            const chunk = rows.slice(i, i + chunkSize);
            
            // Perform upsert (insert or update on primary key match)
            const { error } = await supabase
                .from(table)
                .upsert(chunk);
                
            if (error) {
                console.error(`  Error restoring chunk in table ${table}:`, error.message);
                console.error('  Chunk sample:', JSON.stringify(chunk[0], null, 2));
                process.exit(1);
            }
        }
        console.log(`  Table ${table} restored successfully.`);
    }

    console.log('\nDatabase restore completed successfully!');
}

runRestore().catch(err => {
    console.error('Restore failed:', err);
    process.exit(1);
});
