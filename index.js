// ===================================================================
//                                SETUP
// ===================================================================
require('dotenv').config();
const express = require('express');
const { registerFont } = require('canvas');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const axios = require('axios');
const db = require('./db.js');
const http = require('http');
const { Server } = require("socket.io");
const basicAuth = require('express-basic-auth');
const celery = require('celery-node');
const imageGenerator = require('./image-generator/generator.js');
const archetypes = require('./archetypes.js');
const { YemotRouter } = require('yemot-router2');

const router = YemotRouter({ defaults: { removeInvalidChars: true } });

// --- Register Fonts ---
const regularFontPath = './assets/FbKanuba-Regular.ttf';
const boldFontPath = './assets/FbKanuba-Bold.ttf';
if (fs.existsSync(regularFontPath) && fs.existsSync(boldFontPath)) {
  registerFont(regularFontPath, { family: 'FbKanuba', weight: 'normal' });
  registerFont(boldFontPath, { family: 'FbKanuba', weight: 'bold' });
  console.log('✅ Fonts "FbKanuba" registered successfully.');
} else {
  console.error('❌ Error: Font files not found. Please check the /assets directory.');
}

const celeryClient = celery.createClient(process.env.REDIS_URL, process.env.REDIS_URL);
const QUEUE_NAME = process.env.QUEUE_NAME || 'celery';
const TASK_NAME = 'process_game_result_task';

const app = express();
const PORT = 3000;
const logHistory = [];
const MAX_LOG_HISTORY = 50;

// ===================================================================
//                             MIDDLEWARE
// ===================================================================
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// =================================================================
//                      PUBLIC & ADMIN ROUTES
// ===================================================================
const adminUsers = { [process.env.ADMIN_USER || 'admin']: process.env.ADMIN_PASSWORD };
const adminOnly = basicAuth({
    users: adminUsers,
    challenge: true,
    unauthorizedResponse: 'Unauthorized access'
});

app.get('/', adminOnly, (req, res) => res.redirect('/unified_dashboard'));
app.get('/unified_dashboard', adminOnly, (req, res) => res.sendFile(path.join(__dirname, 'unified_dashboard.html')));
app.get('/my-result', (req, res) => res.sendFile(path.join(__dirname, 'my_result.html')));
app.get('/results/:gameId', (req, res) => res.sendFile(path.join(__dirname, 'client_dashboard.html')));

// ===================================================================
//                      API ROUTES
// ===================================================================

// --- Settings, Questions, Insights APIs (ללא שינוי) ---
app.get('/api/settings', (req, res) => {
    try {
        const row = db.prepare('SELECT settings_data FROM settings WHERE id = 1').get();
        res.json(row ? JSON.parse(row.settings_data) : {});
    } catch (e) { res.status(500).json({ message: 'Internal Server Error' }); }
});
app.patch('/api/settings', (req, res) => {
    try {
        const updatedFields = req.body;
        const row = db.prepare('SELECT settings_data FROM settings WHERE id = 1').get();
        let currentSettings = row ? JSON.parse(row.settings_data) : {};
        const decodedFields = {};
        for (const [key, value] of Object.entries(updatedFields)) {
            if (key.includes('webhook_url') && value) {
                try { decodedFields[key] = Buffer.from(value, 'base64').toString('utf8'); } catch { decodedFields[key] = value; }
            } else { decodedFields[key] = value; }
        }
        const newSettings = { ...currentSettings, ...decodedFields };
        db.prepare('INSERT OR REPLACE INTO settings (id, settings_data) VALUES (1, ?)').run(JSON.stringify(newSettings));
        res.json({ message: 'Settings updated successfully' });
    } catch (e) { res.status(500).json({ message: 'Internal Server Error' }); }
});
app.get('/api/questions', (req, res) => {
    try {
        const rows = db.prepare('SELECT question_id, question_text, answers_mapping FROM questions').all();
        const questions = rows.map(r => ({ ...r, answers_mapping: JSON.parse(r.answers_mapping) }));
        res.json(questions);
    } catch (e) { res.status(500).json({ message: 'Internal Server Error' }); }
});
app.post('/api/questions', (req, res) => {
    try {
        const { question_id, question_text, answers_mapping } = req.body;
        db.prepare('INSERT OR REPLACE INTO questions (question_id, question_text, answers_mapping) VALUES (?, ?, ?)').run(question_id, question_text, JSON.stringify(answers_mapping));
        res.status(201).json({ message: 'Question added/updated' });
    } catch (e) { res.status(500).json({ message: 'Internal Server Error' }); }
});
app.delete('/api/questions/:questionId', (req, res) => {
    try {
        const { questionId } = req.params;
        db.prepare('DELETE FROM questions WHERE question_id = ?').run(questionId);
        res.json({ message: `Question ${questionId} deleted` });
    } catch (e) { res.status(500).json({ message: 'Internal Server Error' }); }
});
app.get('/api/insights', (req, res) => {
    try {
        const row = db.prepare('SELECT insights_data FROM insights WHERE id = 1').get();
        res.json(row ? JSON.parse(row.insights_data) : {});
    } catch (e) { res.status(500).json({ message: 'Internal Server Error' }); }
});
app.post('/api/insights', (req, res) => {
    try {
        db.prepare('INSERT OR REPLACE INTO insights (id, insights_data) VALUES (1, ?)').run(JSON.stringify(req.body));
        res.json({ message: 'Insights saved' });
    } catch (e) { res.status(500).json({ message: 'Internal Server Error' }); }
});

// --- Games API (מתוקן ומסודר) ---
app.get('/api/games', (req, res) => {
    try {
        const games = db.prepare('SELECT * FROM games ORDER BY created_at DESC').all();
        res.json(games);
    } catch (e) { console.error('❌ Error reading games:', e); res.status(500).json({ message: 'Internal Server Error' }); }
});

app.post('/api/games', (req, res) => {
    try {
        const { game_id, name, client_email } = req.body;
        if (!game_id || !name || !client_email) {
            return res.status(400).json({ message: 'game_id, name, and client_email are required' });
        }
        const upper_game_id = game_id.trim().toUpperCase();
        const stmt = db.prepare(`INSERT OR REPLACE INTO games (game_id, name, client_email, status, assigned_at) VALUES (?, ?, ?, 'assigned', datetime('now'))`);
        stmt.run(upper_game_id, name, client_email);
        res.status(201).json({ message: `Game ${upper_game_id} assigned successfully` });
    } catch (e) { console.error('❌ Error creating/assigning game:', e); res.status(500).json({ message: 'Internal Server Error' }); }
});

app.delete('/api/games/:gameId', (req, res) => {
    try {
        const upper_gameId = req.params.gameId.toUpperCase();
        db.prepare('DELETE FROM games WHERE game_id = ?').run(upper_gameId);
        res.json({ message: `Game ${upper_gameId} deleted` });
    } catch (e) { console.error('❌ Error deleting game:', e); res.status(500).json({ message: 'Internal Server Error' }); }
});

app.get('/api/games/summary', (req, res) => {
    try {
        const rows = db.prepare(`SELECT participant_count, status, COUNT(*) as count FROM games WHERE participant_count IS NOT NULL GROUP BY participant_count, status ORDER BY participant_count`).all();
        const summary = rows.reduce((acc, row) => {
            const { participant_count, status, count } = row;
            if (!acc[participant_count]) acc[participant_count] = { available: 0, assigned: 0, completed: 0, total: 0 };
            acc[participant_count][status] = count;
            acc[participant_count].total += count;
            return acc;
        }, {});
        res.json(summary);
    } catch (e) { console.error('❌ Error fetching games summary:', e); res.status(500).json({ message: 'Internal Server Error' }); }
});

// --- Results API (Admin) - גרסה מתוקנת ---
app.get('/api/results', (req, res) => {
    try {
        const summaries = db.prepare('SELECT game_id, client_email, processed_at FROM game_summaries ORDER BY processed_at DESC').all();
        const summariesWithScores = summaries.map(summary => {
            const scoreResult = db.prepare('SELECT AVG(archetype_score) as avg_score FROM individual_results WHERE game_id = ?').get(summary.game_id);
            return { ...summary, average_archetype_score: scoreResult ? scoreResult.avg_score : null };
        });
        res.json(summariesWithScores);
    } catch (e) { console.error('❌ Error listing results:', e); res.status(500).json({ message: 'Internal Server Error' }); }
});

app.get('/api/results/:gameId', (req, res) => {
    try {
        const upper_gameId = req.params.gameId.toUpperCase();
        const summary = db.prepare('SELECT * FROM game_summaries WHERE game_id = ?').get(upper_gameId);
        if (!summary) return res.status(404).json({ message: 'Result not found' });
        
        const individuals = db.prepare('SELECT * FROM individual_results WHERE game_id = ?').all(upper_gameId);
        const groups = db.prepare('SELECT * FROM group_results WHERE game_id = ?').all(upper_gameId);

        const fullResult = {
            game_id: summary.game_id,
            client_email: summary.client_email,
            processed_at: summary.processed_at,
            game_average_profile: JSON.parse(summary.game_average_profile),
            individual_results: individuals.map(p => ({
                id: p.id, name: p.user_name, group_name: p.group_name, access_code: p.access_code,
                profile: JSON.parse(p.profile_data), archetype_id: p.archetype_id, archetype_score: p.archetype_score
            })),
            group_results: groups.reduce((acc, g) => {
                acc[g.group_name] = { participant_count: g.participant_count, profile: JSON.parse(g.profile_data) };
                return acc;
            }, {})
        };
        res.json(fullResult);
    } catch (e) { console.error('❌ Error reading result:', e); res.status(500).json({ message: 'Internal Server Error' }); }
});

// --- Helper & End User Result API - גרסה מתוקנת ---
function findUserResult(searchKey, searchValue) {
    const dbKey = searchKey === 'access_code' ? 'ir.access_code' : 'ir.id';
    const query = `
        SELECT ir.* FROM individual_results ir
        JOIN game_summaries gs ON ir.game_id = gs.game_id
        WHERE ${dbKey} = ?
        ORDER BY gs.processed_at DESC
        LIMIT 1
    `;
    const user = db.prepare(query).get(searchValue);
    if (!user) return null;
    return { 
        id: user.id, name: user.user_name, group_name: user.group_name, access_code: user.access_code,
        profile: JSON.parse(user.profile_data), game_id: user.game_id, archetype_id: user.archetype_id, archetype_score: user.archetype_score
    };
}

app.get('/api/my-result/by-code/:accessCode', (req, res) => {
    try {
        const userProfile = findUserResult('access_code', req.params.accessCode);
        if (!userProfile) return res.status(404).json({ message: 'Result not found' });
        res.json(userProfile);
    } catch (e) { res.status(500).json({ message: 'Internal Server Error' }); }
});
app.get('/api/my-result/by-phone/:phone', (req, res) => {
    try {
        const userProfile = findUserResult('id', req.params.phone);
        if (!userProfile) return res.status(404).json({ message: 'Result not found' });
        res.json(userProfile);
    } catch (e) { res.status(500).json({ message: 'Internal Server Error' }); }
});

// --- Main Game Results Submission (מתוקן עם טיפול באותיות גדולות) ---
app.post('/api/submit-results', async (req, res) => {
    try {
        const logEntry = { timestamp: new Date().toISOString(), type: 'SUBMIT_RESULTS', data: req.body };
        logHistory.push(logEntry);
        if (logHistory.length > MAX_LOG_HISTORY) logHistory.shift();
        io.emit('new_log', logEntry);

        let { game_id, participants } = req.body;
        if (!game_id || !participants) return res.status(400).json({ message: 'Invalid data structure' });
        
        game_id = game_id.trim().toUpperCase(); // <-- תיקון קריטי
        
        const gameRow = db.prepare('SELECT client_email FROM games WHERE game_id = ?').get(game_id);
        const client_email = gameRow ? gameRow.client_email : null;
        
        // ... (שאר הלוגיקה של עיבוד התוצאות נשארת זהה) ...
        const questionRows = db.prepare('SELECT question_id, answers_mapping FROM questions').all();
        const questionMap = questionRows.reduce((map, q) => { map[q.question_id] = { answers_mapping: JSON.parse(q.answers_mapping) }; return map; }, {});
        const individual_results = [];
        const group_results_obj = {};
        const game_grand_totals = { fire: 0, water: 0, air: 0, earth: 0 };
        for (const [userId, participantData] of Object.entries(participants)) {
            const name = participantData.details ? participantData.details.name : userId;
            const group_name = participantData.details && participantData.details.category_1 ? `קבוצה ${participantData.details.category_1.groupId}` : null;
            const answers = {};
            for (const key in participantData) {
                if (key.startsWith('queId_') && !key.includes('_success')) {
                    answers[`q${key.replace('queId_', '')}`] = String(participantData[key]);
                }
            }
            const elementCounts = { fire: 0, water: 0, air: 0, earth: 0 };
            let validAnswersCount = 0;
            for (const [questionId, answerChoice] of Object.entries(answers)) {
                const question = questionMap[questionId];
                if (question && question.answers_mapping && question.answers_mapping[answerChoice]) {
                    elementCounts[question.answers_mapping[answerChoice]]++;
                    validAnswersCount++;
                }
            }
            const profile = Object.keys(elementCounts).reduce((prof, key) => { prof[key] = validAnswersCount > 0 ? (elementCounts[key] / validAnswersCount) * 100 : 0; return prof; }, {});
            Object.keys(profile).forEach(elem => { game_grand_totals[elem] += profile[elem]; });
            const access_code = Math.random().toString(36).substring(2, 8).toUpperCase();
            const matchResult = findClosestArchetype(profile);
            const archetype_id = matchResult && matchResult.archetype ? matchResult.archetype.type_id : null;
            const archetype_score = matchResult && matchResult.score !== Infinity ? matchResult.score : null;
            individual_results.push({ id: userId, name, group_name, profile, access_code, archetype_id, archetype_score });
            if (group_name) {
                if (!group_results_obj[group_name]) { group_results_obj[group_name] = { counts: { fire: 0, water: 0, air: 0, earth: 0 }, participant_count: 0 }; }
                Object.keys(profile).forEach(elem => group_results_obj[group_name].counts[elem] += profile[elem]);
                group_results_obj[group_name].participant_count++;
            }
        }
        const group_results = {};
        for (const [groupName, data] of Object.entries(group_results_obj)) {
            group_results[groupName] = { profile: Object.keys(data.counts).reduce((prof, key) => { prof[key] = data.counts[key] / data.participant_count; return prof; }, {}), participant_count: data.participant_count };
        }
        const totalParticipants = individual_results.length;
        const game_average_profile = Object.keys(game_grand_totals).reduce((prof, key) => { prof[key] = totalParticipants > 0 ? game_grand_totals[key] / totalParticipants : 0; return prof; }, {});
        
        const insertSummary = db.prepare('INSERT OR REPLACE INTO game_summaries (game_id, client_email, processed_at, game_average_profile) VALUES (?, ?, ?, ?)');
        const insertIndividual = db.prepare('INSERT OR REPLACE INTO individual_results (id, game_id, access_code, user_name, group_name, profile_data, archetype_id, archetype_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        const insertGroup = db.prepare('INSERT OR REPLACE INTO group_results (game_id, group_name, participant_count, profile_data) VALUES (?, ?, ?, ?)');
        
        db.transaction(() => {
            insertSummary.run(game_id, client_email, new Date().toISOString(), JSON.stringify(game_average_profile));
            for (const res of individual_results) {
                insertIndividual.run(res.id, game_id, res.access_code, res.name, res.group_name, JSON.stringify(res.profile), res.archetype_id, res.archetype_score);
            }
            for (const groupName in group_results) {
                insertGroup.run(game_id, groupName, group_results[groupName].participant_count, JSON.stringify(group_results[groupName].profile));
            }
        })();

        db.prepare("UPDATE games SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE game_id = ?").run(game_id);

        res.json({ status: 'success', message: 'Game results processed successfully' });
    } catch (error) {
        console.error('❌ Error processing results:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});


// [הוספה] נתיב דיבאג מיוחד לבדיקת מצב בסיס הנתונים
app.get('/api/debug/db-check', adminOnly, (req, res) => {
    try {
        const gamesCount = db.prepare('SELECT COUNT(*) as count FROM games').get().count;
        const summariesCount = db.prepare('SELECT COUNT(*) as count FROM game_summaries').get().count;
        const individualsCount = db.prepare('SELECT COUNT(*) as count FROM individual_results').get().count;
        
        const sampleSummaries = db.prepare('SELECT game_id, processed_at FROM game_summaries ORDER BY processed_at DESC LIMIT 10').all();

        res.json({
            message: "Database Status Check",
            counts: {
                games: gamesCount,
                game_summaries: summariesCount,
                individual_results: individualsCount
            },
            sample_summaries: sampleSummaries
        });
    } catch(e) {
        res.status(500).json({ error: "Failed to check database", details: e.message });
    }
});

        console.log(`📢 מתחיל שליחת ${individual_results.length} משימות ל-Celery...`);
        for (const participantResult of individual_results) {
            try {
                const job_data = { phone: participantResult.id, name: participantResult.name, profile: participantResult.profile };
                const task = celeryClient.createTask(TASK_NAME, { queue: QUEUE_NAME });
                task.applyAsync([job_data]);
                console.log(`✅ משימה נשלחה ל-Celery עבור: ${participantResult.name} (${participantResult.id})`);
            } catch (e) {
                console.error(`❌ Error sending Celery task for participant ${participantResult.name}: ${e.message}`);
            }
        }
        res.json({ status: 'success', message: 'Game results processed successfully' });
    } catch (error) {
        console.error('❌ Error processing results:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// נתיב הבדיקה המעודכן
app.get('/images/test/game-summary', async (req, res) => {
    try {
        console.log('🧪 Generating a test image...');
        const mockProfile = { fire: 35.5, water: 20.1, air: 14.9, earth: 29.5 };
        const imageBuffer = await imageGenerator.createGameSummaryImage(mockProfile); // הסרת gameId
        res.setHeader('Content-Type', 'image/png');
        res.send(imageBuffer);
    } catch (error) { 
        console.error('❌ Error generating test image:', error);
        res.status(500).send('Error generating test image');
    }
});

// הנתיב האמיתי המעודכן
app.get('/images/game-summary/:gameId.png', async (req, res) => {
    try {
        const { gameId } = req.params;
        const row = db.prepare('SELECT game_average_profile FROM game_summaries WHERE game_id = ?').get(gameId);
        if (!row) return res.status(404).send('Results not found');
        const profile = JSON.parse(row.game_average_profile);
        if (!profile) return res.status(404).send('No average profile found');
        const imageBuffer = await imageGenerator.createGameSummaryImage(profile); // הסרת gameId
        res.setHeader('Content-Type', 'image/png');
        res.send(imageBuffer);
    } catch (error) { 
        console.error('❌ Error generating image:', error);
        res.status(500).send('Error generating image');
    }
});
app.get('/images/license-status/:gameId.png', async (req, res) => {
    try {
        const { gameId } = req.params;
        const game = db.prepare('SELECT status FROM games WHERE game_id = ?').get(gameId);

        if (!game) {
            return res.status(404).send('Game not found');
        }

        // קביעת הסטטוס להעברה לפונקציית יצירת התמונה
        const licenseStatus = (game.status === 'completed') ? 'expired' : 'valid';

        const imageBuffer = await imageGenerator.createLicenseStatusImage(licenseStatus);
        
        res.setHeader('Content-Type', 'image/png');
        res.send(imageBuffer);

    } catch (error) { 
        console.error('❌ Error generating license status image:', error);
        res.status(500).send('Error generating image');
    }
});
app.get('/images/group-breakdown/:gameId.png', async (req, res) => {
    try {
        const { gameId } = req.params;
        const groupsData = db.prepare('SELECT group_name, profile_data FROM group_results WHERE game_id = ?').all(gameId);
        
        const groups = groupsData.map(g => ({
            group_name: g.group_name,
            profile: JSON.parse(g.profile_data)
        }));

        const imageBuffer = await imageGenerator.createGroupBreakdownImage(groups);
        
        res.setHeader('Content-Type', 'image/png');
        res.send(imageBuffer);

    } catch (error) { 
        console.error('❌ Error generating group breakdown image:', error);
        res.status(500).send('Error generating image');
    }
});
app.get('/images/participant-list/:gameId.png', async (req, res) => {
    try {
        const { gameId } = req.params;
        const participantsData = db.prepare('SELECT user_name, profile_data FROM individual_results WHERE game_id = ?').all(gameId);
        
        const participants = participantsData.map(p => ({
            name: p.user_name,
            profile: JSON.parse(p.profile_data)
        }));

        const imageBuffer = await imageGenerator.createParticipantListImage(participants);
        
        res.setHeader('Content-Type', 'image/png');
        res.send(imageBuffer);

    } catch (error) { 
        console.error('❌ Error generating participant list image:', error);
        res.status(500).send('Error generating image');
    }
});

// ===================================================================
//                          🧪 TEST ROUTES FOR GALLERY
// ===================================================================
// נתונים פיקטיביים לשימוש בנתיבי הבדיקה
const mockData = {
    summaryProfile: { fire: 35.5, water: 20.1, air: 14.9, earth: 29.5 },
    participants: [
        { name: 'ישראל ישראלי', profile: { fire: 50, water: 25, air: 15, earth: 10 } },
        { name: 'משה כהן', profile: { fire: 10, water: 40, air: 30, earth: 20 } },
        { name: 'דנה לוי', profile: { fire: 20, water: 10, air: 60, earth: 10 } },
        { name: 'אביגיל שרון', profile: { fire: 15, water: 15, air: 15, earth: 55 } },
        { name: 'יונתן אדלר', profile: { fire: 25, water: 25, air: 25, earth: 25 } },
        { name: 'תמר גולדשטיין', profile: { fire: 80, water: 5, air: 5, earth: 10 } },
        { name: 'דוד ביטון', profile: { fire: 5, water: 70, air: 15, earth: 10 } }
    ],
    groups: [
        { group_name: 'קבוצה 1', profile: { fire: 40, water: 30, air: 20, earth: 10 } },
        { group_name: 'קבוצה 2', profile: { fire: 10, water: 20, air: 30, earth: 40 } },
        { group_name: 'קבוצת הנשרים', profile: { fire: 60, water: 10, air: 20, earth: 10 } }
    ]
};

// נתיב קיים - נוודא שהוא משתמש בנתונים החדשים
app.get('/images/test/game-summary', async (req, res) => {
    try {
        const imageBuffer = await imageGenerator.createGameSummaryImage(mockData.summaryProfile);
        res.setHeader('Content-Type', 'image/png').send(imageBuffer);
    } catch (e) { res.status(500).send('Error generating test image'); }
});

// נתיב חדש - רשימת משתתפים
app.get('/images/test/participant-list', async (req, res) => {
    try {
        const imageBuffer = await imageGenerator.createParticipantListImage(mockData.participants);
        res.setHeader('Content-Type', 'image/png').send(imageBuffer);
    } catch (e) { res.status(500).send('Error generating test image'); }
});

// נתיב חדש - פילוח קבוצות
app.get('/images/test/group-breakdown', async (req, res) => {
    try {
        const imageBuffer = await imageGenerator.createGroupBreakdownImage(mockData.groups);
        res.setHeader('Content-Type', 'image/png').send(imageBuffer);
    } catch (e) { res.status(500).send('Error generating test image'); }
});

// נתיב חדש - סטטוס תקין
app.get('/images/test/license-status-valid', async (req, res) => {
    try {
        const imageBuffer = await imageGenerator.createLicenseStatusImage('valid');
        res.setHeader('Content-Type', 'image/png').send(imageBuffer);
    } catch (e) { res.status(500).send('Error generating test image'); }
});

// נתיב חדש - סטטוס פג תוקף
app.get('/images/test/license-status-expired', async (req, res) => {
    try {
        const imageBuffer = await imageGenerator.createLicenseStatusImage('expired');
        res.setHeader('Content-Type', 'image/png').send(imageBuffer);
    } catch (e) { res.status(500).send('Error generating test image'); }
});

// ===================================================================
//                          SERVER STARTUP
// ===================================================================
app.use('/', router.asExpressRouter); // ⭐️ שינוי: הוספת asExpressRouter

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});
io.on('connection', (socket) => {
    console.log('✨ A user connected to the logs dashboard');
    socket.emit('log_history', logHistory);
});
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server is running on port ${PORT}`);
  console.log(`🚀 MASTER ADMIN is available at http://localhost:${PORT}/master_admin`);
});