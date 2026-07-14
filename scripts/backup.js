import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import zlib from 'zlib'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

// Handle ES modules pathing
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
const brevoApiKey = process.env.BREVO_API_KEY
const brevoFromEmail = process.env.BREVO_FROM_EMAIL || 'xtate62@gmail.com'
const brevoFromName = process.env.BREVO_FROM_NAME || 'Worklog AI Backup'
const recipientEmail = process.env.BACKUP_RECIPIENT_EMAIL || 'djpcodehelp@gmail.com'

// Verify env vars
if (!supabaseUrl || !supabaseServiceKey) {
    console.error('CRITICAL: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment.')
    process.exit(1)
}

if (!brevoApiKey) {
    console.error('CRITICAL: Missing BREVO_API_KEY in environment. Cannot send email.')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    }
})

// Tables in correct schema order (dependencies first if needed, though for backup order doesn't matter)
const TABLES = [
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

async function fetchAllRows(tableName) {
    const pageSize = 1000;
    let allData = [];
    let from = 0;
    let to = pageSize - 1;
    let hasMore = true;

    while (hasMore) {
        let query = supabase.from(tableName).select('*').range(from, to);
        
        // Sorting helps guarantee consistent pagination
        if (tableName === 'translation_cache') {
            query = query.order('language_code', { ascending: true });
        } else {
            query = query.order('id', { ascending: true });
        }

        const { data, error } = await query;
        
        if (error) {
            // Fallback: try fetching without ordering if ordering fails
            const { data: dataNoOrder, error: errNoOrder } = await supabase
                .from(tableName)
                .select('*')
                .range(from, to);
                
            if (errNoOrder) {
                throw new Error(`Failed to fetch table ${tableName}: ${errNoOrder.message}`);
            }
            
            allData = allData.concat(dataNoOrder);
            if (dataNoOrder.length < pageSize) {
                hasMore = false;
            }
        } else {
            allData = allData.concat(data);
            if (data.length < pageSize) {
                hasMore = false;
            }
        }
        
        from += pageSize;
        to += pageSize;
    }
    return allData;
}

async function sendBackupEmail(zipBuffer, filename) {
    const base64Content = zipBuffer.toString('base64');
    
    console.log(`Sending email to ${recipientEmail} via Brevo...`);
    
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'api-key': brevoApiKey,
        },
        body: JSON.stringify({
            sender: {
                email: brevoFromEmail,
                name: brevoFromName,
            },
            to: [{ email: recipientEmail }],
            subject: `Worklog AI - Database Backup - ${new Date().toISOString().split('T')[0]}`,
            htmlContent: `
                <h3>Worklog AI Automatic Database Backup</h3>
                <p>Please find attached the database backup for <strong>${new Date().toLocaleString()}</strong>.</p>
                <p>This backup is a compressed JSON file containing all database tables. Keep this email safe.</p>
                <br/>
                <p><em>To restore this backup, use the restore script in the codebase.</em></p>
            `,
            attachment: [
                {
                    content: base64Content,
                    name: filename
                }
            ]
        }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Brevo API Error (${response.status}): ${JSON.stringify(errorData)}`);
    }
    
    console.log('Backup email sent successfully.');
}

async function runBackup() {
    console.log('Starting automated database backup...');
    const backupData = {
        backup_time: new Date().toISOString(),
        tables: {}
    };

    for (const table of TABLES) {
        try {
            console.log(`Fetching data for table: ${table}...`);
            const rows = await fetchAllRows(table);
            backupData.tables[table] = rows;
            console.log(`  Fetched ${rows.length} rows.`);
        } catch (err) {
            console.error(`  Error backing up table ${table}:`, err.message);
            // We continue backup even if one table fails to maximize data recovery
        }
    }

    const jsonString = JSON.stringify(backupData, null, 2);
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `worklog_ai_backup_${dateStr}.txt`;

    console.log('Preparing backup data buffer...');
    const buffer = Buffer.from(jsonString);
    console.log(`Backup file size: ${(buffer.length / 1024).toFixed(2)} KB`);

    await sendBackupEmail(buffer, filename);
    console.log('Backup job finished successfully!');
}

runBackup().catch(err => {
    console.error('Backup job failed:', err);
    process.exit(1);
});
