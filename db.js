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
  game_id TEXT PRIMARY KEY,
  client_email TEXT, -- יהיה ריק בהתחלה
  status TEXT DEFAULT 'available', -- available, assigned, completed
  created_at TEXT DEFAULT CURRENT_TIMESTAMP, -- [שדרוג] שומר על תאריך ההוספה המקורי
  assigned_at TEXT,
  completed_at TEXT
);
  CREATE TABLE IF NOT EXISTS questions (
      question_id TEXT PRIMARY KEY,
      question_text TEXT NOT NULL,
      answers_mapping TEXT NOT NULL 
  );
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    settings_data TEXT NOT NULL
  );
   CREATE TABLE IF NOT EXISTS insights (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      insights_data TEXT NOT NULL
  );

  /* --- [שינוי]: 3 טבלאות תוצאות חדשות במקום אחת --- */
  CREATE TABLE IF NOT EXISTS game_summaries (
    game_id TEXT PRIMARY KEY,
    client_email TEXT,
    processed_at TEXT NOT NULL,
    game_average_profile TEXT NOT NULL, /* JSON */
    FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS individual_results (
    id TEXT NOT NULL, /* מזהה המשתתף (טלפון) */
    game_id TEXT NOT NULL,
    access_code TEXT NOT NULL UNIQUE,
    user_name TEXT,
    group_name TEXT,
    profile_data TEXT NOT NULL, /* JSON */
    PRIMARY KEY (id, game_id),
    FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS group_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT NOT NULL,
    group_name TEXT NOT NULL,
    participant_count INTEGER,
    profile_data TEXT NOT NULL, /* JSON */
    FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE,
    UNIQUE(game_id, group_name)
  );
`);

console.log('✅ Database tables initialized.');

// --- הגירת נתונים מורכבת (תרוץ פעם אחת אם צריך) ---
function migrateOldResults() {
    try {
        const count = db.prepare('SELECT COUNT(*) as count FROM game_summaries').get().count;
        if (count > 0) return; // ההגירה כבר בוצעה

        const oldResultsTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='results'").get();
        if (!oldResultsTableExists) return;

        console.log('Migrating old `results` table to new normalized tables...');
        const oldResults = db.prepare('SELECT game_id, result_data FROM results').all();

        const insertSummary = db.prepare('INSERT INTO game_summaries (game_id, client_email, processed_at, game_average_profile) VALUES (?, ?, ?, ?)');
        const insertIndividual = db.prepare('INSERT INTO individual_results (id, game_id, access_code, user_name, group_name, profile_data) VALUES (?, ?, ?, ?, ?, ?)');
        const insertGroup = db.prepare('INSERT INTO group_results (game_id, group_name, participant_count, profile_data) VALUES (?, ?, ?, ?)');

        db.transaction(() => {
            for(const oldRes of oldResults) {
                const data = JSON.parse(oldRes.result_data);

                // 1. הגירת סיכום כללי
                if (data.game_average_profile) {
                    insertSummary.run(data.game_id, data.client_email, data.processed_at, JSON.stringify(data.game_average_profile));
                }

                // 2. הגירת תוצאות אישיות
                if (data.individual_results) {
                    for (const p of data.individual_results) {
                       insertIndividual.run(p.id, data.game_id, p.access_code, p.name, p.group_name, JSON.stringify(p.profile));
                    }
                }

                // 3. הגירת תוצאות קבוצתיות
                if (data.group_results) {
                    for (const groupName in data.group_results) {
                        const groupData = data.group_results[groupName];
                        insertGroup.run(data.game_id, groupName, groupData.participant_count, JSON.stringify(groupData.profile));
                    }
                }
            }
        })();

        // מחיקת הטבלה הישנה לאחר הצלחה
        db.exec('DROP TABLE results');
        console.log(`✅ Migrated ${oldResults.length} old results and dropped old table.`);

    } catch(e) { console.error('Could not migrate old results table:', e.message); }
}

// קריאה להגירה הישנה. אם לא קיימת טבלת results, היא פשוט לא תעשה כלום
migrateOldResults();

module.exports = db;