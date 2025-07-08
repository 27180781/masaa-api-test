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
    client_email TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS results (
    game_id TEXT PRIMARY KEY,
    result_data TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    settings_data TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS questions (
      question_id TEXT PRIMARY KEY,
      question_text TEXT NOT NULL,
      answers_mapping TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS insights (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      insights_data TEXT NOT NULL
  );
`);
console.log('✅ Database tables initialized.');

// --- הגירת נתונים אוטומטית (תרוץ פעם אחת אם צריך) ---
function migrateData() {
    console.log('Checking for data migration...');
    const migrate = (tableName, jsonFileName, migrationLogic) => {
        try {
            const count = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get().count;
            const jsonPath = path.join(dataDir, jsonFileName);
            if (count === 0 && fs.existsSync(jsonPath)) {
                console.log(`Migrating ${jsonFileName}...`);
                const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
                migrationLogic(data);
            }
        } catch(e) { console.error(`Could not migrate ${jsonFileName}:`, e.message); }
    };

    migrate('games', 'games.json', (data) => {
        const stmt = db.prepare('INSERT INTO games (game_id, client_email, created_at) VALUES (?, ?, ?)');
        db.transaction(() => {
            for (const game of data) stmt.run(game.game_id, game.client_email, game.createdAt || new Date().toISOString());
        })();
        console.log(`Migrated ${data.length} games.`);
    });

    migrate('questions', 'questions.json', (data) => {
        const stmt = db.prepare('INSERT INTO questions (question_id, question_text, answers_mapping) VALUES (?, ?, ?)');
        db.transaction(() => {
            for (const q of data) stmt.run(q.question_id, q.question_text, JSON.stringify(q.answers_mapping));
        })();
        console.log(`Migrated ${data.length} questions.`);
    });
    
    migrate('insights', 'insights.json', (data) => {
        db.prepare('INSERT OR REPLACE INTO insights (id, insights_data) VALUES (1, ?)').run(JSON.stringify(data));
        console.log('Migrated insights.');
    });

    try {
        const count = db.prepare('SELECT COUNT(*) as count FROM results').get().count;
        const resultsDir = path.join(dataDir, 'results');
        if (count === 0 && fs.existsSync(resultsDir)) {
             console.log('Migrating results...');
             const resultFiles = fs.readdirSync(resultsDir).filter(f => f.endsWith('.json'));
             const stmt = db.prepare('INSERT INTO results (game_id, result_data) VALUES (?, ?)');
             db.transaction(() => {
                 for (const file of resultFiles) {
                     const gameId = file.replace('results_', '').replace('.json', '');
                     const data = fs.readFileSync(path.join(resultsDir, file), 'utf-8');
                     stmt.run(gameId, data);
                 }
             })();
             console.log(`Migrated ${resultFiles.length} result files.`);
        }
    } catch(e) { console.error('Could not migrate results:', e.message); }
}

migrateData();

module.exports = db;