import { supabase } from './src/lib/database.ts'

async function test() {
    try {
        // Try to fetch work logs for your user
        const userId = 'c5a0fdc6-3304-40da-9e66-4ecf0be88892'

        const { data, error } = await supabase
            .from('work_log_entries')
            .insert({
                user_id: userId,
                week_start_date: '2026-05-03',
                accomplishments: 'Test from script',
                challenges: 'None',
                learnings: 'Debugging',
                goals_next_week: 'Deploy',
                hours_logged: 40
            })
            .select()
            .single()

        if (error) {
            console.error('Error:', error)
        } else {
            console.log('Success:', data)
        }
    } catch (err) {
        console.error('Exception:', err)
    }
}

test()
