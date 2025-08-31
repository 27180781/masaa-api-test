// db.js
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dataDir = '/app/data';
const dbPath = path.join(dataDir, 'main.db');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);
console.log(`✅ Connected to SQLite database at ${dbPath}`);

// יצירת טבלאות
db.exec(`
CREATE TABLE IF NOT EXISTS games (
  game_id TEXT PRIMARY KEY, name TEXT, participant_count INTEGER, client_email TEXT,
  status TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, assigned_at TEXT, completed_at TEXT
);
CREATE TABLE IF NOT EXISTS questions (
  question_id TEXT PRIMARY KEY, question_text TEXT NOT NULL, answers_mapping TEXT NOT NULL 
);
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1), settings_data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS insights (
  id INTEGER PRIMARY KEY CHECK (id = 1), insights_data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS game_summaries (
  game_id TEXT PRIMARY KEY, client_email TEXT, processed_at TEXT NOT NULL, game_average_profile TEXT NOT NULL,
  FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS individual_results (
  id TEXT NOT NULL, game_id TEXT NOT NULL, access_code TEXT NOT NULL UNIQUE, user_name TEXT,
  group_name TEXT, profile_data TEXT NOT NULL, archetype_id INTEGER, archetype_score REAL,
  PRIMARY KEY (id, game_id), FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS group_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT, game_id TEXT NOT NULL, group_name TEXT NOT NULL,
  participant_count INTEGER, profile_data TEXT NOT NULL,
  FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE, UNIQUE(game_id, group_name)
);
`);

console.log('✅ Database tables initialized.');

function runGamesMigration() {
    try {
        const version = db.prepare('PRAGMA user_version').get().user_version;
        if (version < 1) {
            console.log('🚀 Running migration for `games` table (v1)...');
            const migration = db.transaction(() => {
                db.exec('ALTER TABLE games RENAME TO games_old');
                db.exec(`CREATE TABLE games (
                    game_id TEXT PRIMARY KEY, name TEXT, participant_count INTEGER, client_email TEXT, status TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP, assigned_at TEXT, completed_at TEXT
                )`);
                db.exec('INSERT INTO games (game_id, name, participant_count, client_email, status, created_at, assigned_at, completed_at) SELECT game_id, name, participant_count, client_email, status, created_at, assigned_at, completed_at FROM games_old');
                db.exec('DROP TABLE games_old');
                db.prepare('PRAGMA user_version = 1').run();
                console.log('✅ Migration completed successfully.');
            });
            migration();
        } else {
            console.log('✔️ `games` table is already up to date.');
        }
    } catch (e) {
        console.error('❌ Migration failed:', e.message);
        try {
            db.exec('DROP TABLE games');
            db.exec('ALTER TABLE games_old RENAME TO games');
            console.log('⏪ Database restored to previous state.');
        } catch (restoreError) { console.error('❌ Could not restore database:', restoreError.message); }
    }
}

runGamesMigration();

// [תיקון] פונקציית מיגרציה משודרגת ועמידה יותר
function migrateOldResults() {
    try {
        const oldResultsTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='results'").get();
        if (!oldResultsTableExists) {
            console.log('✔️ Old `results` table not found, no migration needed.');
            return; // אם הטבלה הישנה לא קיימת, אין מה לעשות
        }
        
        console.log('🚀 Checking if migration from `results` table is needed...');
        // מנקים את הטבלאות החדשות כדי להבטיח שהמיגרציה תהיה נקייה במקרה של הרצה חוזרת
        db.exec('DELETE FROM game_summaries;');
        db.exec('DELETE FROM individual_results;');
        db.exec('DELETE FROM group_results;');

        const oldResults = db.prepare('SELECT game_id, result_data FROM results').all();
        if (oldResults.length === 0) {
            console.log('✔️ Old `results` table is empty. Dropping it.');
            db.exec('DROP TABLE results');
            return;
        }

        console.log(`🚀 Migrating ${oldResults.length} records from old \`results\` table...`);

        const insertSummary = db.prepare('INSERT OR IGNORE INTO game_summaries (game_id, client_email, processed_at, game_average_profile) VALUES (?, ?, ?, ?)');
        const insertIndividual = db.prepare('INSERT OR IGNORE INTO individual_results (id, game_id, access_code, user_name, group_name, profile_data) VALUES (?, ?, ?, ?, ?, ?)');
        const insertGroup = db.prepare('INSERT OR IGNORE INTO group_results (game_id, group_name, participant_count, profile_data) VALUES (?, ?, ?, ?)');
        
        let successCount = 0;
        db.transaction(() => {
            for (const oldRes of oldResults) {
                try {
                    const data = JSON.parse(oldRes.result_data);
                    if (data.game_average_profile) {
                        insertSummary.run(data.game_id, data.client_email, data.processed_at, JSON.stringify(data.game_average_profile));
                    }
                    if (data.individual_results) {
                        for (const p of data.individual_results) {
                           insertIndividual.run(p.id, data.game_id, p.access_code, p.name, p.group_name, JSON.stringify(p.profile));
                        }
                    }
                    if (data.group_results) {
                        for (const groupName in data.group_results) {
                            const groupData = data.group_results[groupName];
                            insertGroup.run(data.game_id, groupName, groupData.participant_count, JSON.stringify(groupData.profile));
                        }
                    }
                    successCount++;
                } catch (parseError) {
                    console.error(`❌ Skipping record for game_id ${oldRes.game_id} due to invalid JSON:`, parseError.message);
                }
            }
        })();

        console.log(`✅ Migration finished. Successfully migrated ${successCount} out of ${oldResults.length} records.`);

        // מחיקת הטבלה הישנה רק לאחר שהתהליך הסתיים בהצלחה
        db.exec('DROP TABLE results');
        console.log('✅ Dropped old `results` table.');

    } catch(e) { console.error('❌ A critical error occurred during the results migration:', e.message); }
}

migrateOldResults();

module.exports = db;