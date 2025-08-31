const Database = require('better-sqlite3');
const path = require('path');
const dbFilePath = path.join(__dirname, 'main.db'); // It will look for main.db in the same directory
const db = new Database(dbFilePath, { verbose: console.log });

const dbSchema = `
PRAGMA foreign_keys = ON;

/* ======== THIS IS THE MISSING PART THAT WAS ADDED ======== */
CREATE TABLE IF NOT EXISTS games_old (
  game_id TEXT PRIMARY KEY,
  name TEXT,
  participant_count INTEGER,
  client_email TEXT,
  status TEXT DEFAULT 'available', -- available, assigned, completed
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  assigned_at TEXT,
  completed_at TEXT
);
/* ========================================================= */

CREATE TABLE IF NOT EXISTS games (
  game_id TEXT PRIMARY KEY,
  name TEXT,
  participant_count INTEGER,
  client_email TEXT,
  status TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  assigned_at TEXT,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS individual_results (
    id TEXT NOT NULL, /* A unique identifier for the user (e.g., phone number) */
    game_id TEXT NOT NULL,
    access_code TEXT NOT NULL UNIQUE,
    user_name TEXT,
    group_name TEXT,
    profile_data TEXT NOT NULL, /* JSON */
    archetype_id INTEGER, /* The ID of the new primary archetype */
    archetype_score REAL, /* The score of the new primary archetype */
    PRIMARY KEY (id, game_id),
    FOREIGN KEY (game_id) REFERENCES "games_old"(game_id) ON DELETE CASCADE
  );

CREATE TABLE IF NOT EXISTS group_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT NOT NULL,
    group_name TEXT NOT NULL,
    participant_count INTEGER,
    profile_data TEXT NOT NULL, /* JSON */
    FOREIGN KEY (game_id) REFERENCES "games_old"(game_id) ON DELETE CASCADE,
    UNIQUE(game_id, group_name)
  );

  CREATE TABLE IF NOT EXISTS game_summaries (
    game_id TEXT PRIMARY KEY,
    client_email TEXT,
    processed_at TEXT NOT NULL,
    game_average_profile TEXT NOT NULL, /* JSON */
    FOREIGN KEY (game_id) REFERENCES "games_old"(game_id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    settings_data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS insights (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    insights_data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS questions (
    question_id TEXT PRIMARY KEY,
    question_text TEXT NOT NULL,
    answers_mapping TEXT NOT NULL
);

`;

db.exec(dbSchema);


module.exports = db;