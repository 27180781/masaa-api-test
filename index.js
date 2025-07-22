// ===================================================================
//                                SETUP
// ===================================================================
require('dotenv').config(); // [תיקון אבטחה] טוען משתני סביבה מהקובץ .env
const express = require('express');
const path = require('path');
const cors = require('cors');
const axios = require('axios');
const { createCanvas } = require('canvas');
const db = require('./db.js');
const http = require('http');
const { Server } = require("socket.io");
const basicAuth = require('express-basic-auth');
const celery = require('celery-node');

const celeryClient = celery.createClient(
  process.env.REDIS_URL, // משתמש במשתנה הסביבה לכתובת הרדיס
  process.env.REDIS_URL  // משמש גם עבור ה-backend של Celery
);

const QUEUE_NAME = process.env.QUEUE_NAME || 'celery'; // שם התור, ברירת מחדל 'celery'
const TASK_NAME = 'process_game_result_task'; // שם המשימה כפי שמוגדר ב-worker.py

const app = express();
const PORT = 3000;
const logHistory = [];
const MAX_LOG_HISTORY = 50;

// ===================================================================
//                             MIDDLEWARE
// ===================================================================
app.use(cors());
app.use(express.json());

// =================================================================
//                      PUBLIC & ADMIN ROUTES
// ===================================================================
// [תיקון אבטחה] הגדרת המשתמשים מאוחזרת ממשתני הסביבה
const adminUsers = { [process.env.ADMIN_USER || 'admin']: process.env.ADMIN_PASSWORD };

const adminOnly = basicAuth({
    users: adminUsers,
    challenge: true,
    unauthorizedResponse: 'Unauthorized access'
});

// --- נתיבים מאובטחים ---
app.get('/', adminOnly, (req, res) => res.redirect('/master_admin'));
app.get('/master_admin', adminOnly, (req, res) => res.sendFile(path.join(__dirname, 'master_admin.html')));
app.get('/logs', adminOnly, (req, res) => {
    // [תוקן] שימוש ב-__dirname במקום __name
    res.sendFile(path.join(__dirname, 'logs.html'));
});

app.get('/admin', adminOnly, (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.get('/games_admin', adminOnly, (req, res) => res.sendFile(path.join(__dirname, 'games_admin.html')));
app.get('/results_admin', adminOnly, (req, res) => res.sendFile(path.join(__dirname, 'results_admin.html')));
app.get('/insights_admin', adminOnly, (req, res) => res.sendFile(path.join(__dirname, 'insights_admin.html')));
app.get('/my-result', (req, res) => res.sendFile(path.join(__dirname, 'my_result.html')));
app.get('/results/:gameId', (req, res) => res.sendFile(path.join(__dirname, 'client_dashboard.html')));

// ===================================================================
//                      API ROUTES
// ===================================================================

// --- ניהול הגדרות ---
app.get('/api/settings', (req, res) => {
    try {
        const row = db.prepare('SELECT settings_data FROM settings WHERE id = 1').get();
        res.json(row ? JSON.parse(row.settings_data) : {});
    } catch (e) { console.error('❌ Error reading settings:', e); res.status(500).json({ message: 'Internal Server Error' }); }
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
    } catch (e) { console.error('❌ Error updating settings:', e); res.status(500).json({ message: 'Internal Server Error' }); }
});

// --- ניהול שאלות ---
app.get('/api/questions', (req, res) => {
    try {
        const rows = db.prepare('SELECT question_id, question_text, answers_mapping FROM questions').all();
        const questions = rows.map(r => ({ ...r, answers_mapping: JSON.parse(r.answers_mapping) }));
        res.json(questions);
    } catch (e) { console.error('❌ Error reading questions:', e); res.status(500).json({ message: 'Internal Server Error' }); }
});

app.post('/api/questions', (req, res) => {
    try {
        const { question_id, question_text, answers_mapping } = req.body;
        if (!question_id || !question_text || !answers_mapping) return res.status(400).json({ message: 'Invalid question format' });
        db.prepare('INSERT OR REPLACE INTO questions (question_id, question_text, answers_mapping) VALUES (?, ?, ?)').run(question_id, question_text, JSON.stringify(answers_mapping));
        res.status(201).json({ message: 'Question added/updated' });
    } catch (e) { console.error('❌ Error saving question:', e); res.status(500).json({ message: 'Internal Server Error' }); }
});

app.delete('/api/questions/:questionId', (req, res) => {
    try {
        const { questionId } = req.params;
        const info = db.prepare('DELETE FROM questions WHERE question_id = ?').run(questionId);
        if (info.changes > 0) res.json({ message: `Question ${questionId} deleted` });
        else res.status(404).json({ message: 'Question not found' });
    } catch (e) { console.error('❌ Error deleting question:', e); res.status(500).json({ message: 'Internal Server Error' }); }
});

// --- ניהול משחקים (משודרג למודל Pool) ---
app.get('/api/games', (req, res) => {
    try {
        const games = db.prepare('SELECT * FROM games ORDER BY created_at DESC').all();
        res.json(games);
    } catch (e) {
        console.error('❌ Error reading games:', e);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

app.post('/api/games/bulk', (req, res) => {
    try {
        const { game_ids } = req.body;
        if (!game_ids || !Array.isArray(game_ids)) {
            return res.status(400).json({ message: 'Expecting an array of game_ids' });
        }

        const insert = db.prepare("INSERT OR IGNORE INTO games (game_id, created_at) VALUES (?, datetime('now'))");
        const bulkInsert = db.transaction((ids) => {
            for (const id of ids) {
                const trimmedId = id.trim();
                if(trimmedId) insert.run(trimmedId);
            }
        });

        bulkInsert(game_ids);
        res.status(201).json({ message: `${game_ids.length} games added or ignored.` });
    } catch (e) {
        console.error('❌ Error bulk adding games:', e);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

app.post('/api/games/assign', (req, res) => {
    try {
        const { client_email } = req.body;
        if (!client_email) return res.status(400).json({ message: 'client_email is required' });

        const availableGame = db.prepare("SELECT game_id FROM games WHERE status = 'available' ORDER BY created_at LIMIT 1").get();

        if (!availableGame) {
            return res.status(404).json({ message: 'No available game IDs in the pool.' });
        }

        const game_id = availableGame.game_id;
        db.prepare("UPDATE games SET client_email = ?, status = 'assigned', assigned_at = CURRENT_TIMESTAMP WHERE game_id = ?")
          .run(client_email, game_id);

        console.log(`✅ Game ID ${game_id} assigned to ${client_email}`);
        res.json({ status: 'success', assigned_game_id: game_id });
    } catch (e) {
        console.error('❌ Error assigning game:', e);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

app.delete('/api/games/:gameId', (req, res) => {
    try {
        const { gameId } = req.params;
        const info = db.prepare('DELETE FROM games WHERE game_id = ?').run(gameId);
        if (info.changes > 0) res.json({ message: `Game ${gameId} deleted` });
        else res.status(404).json({ message: 'Game not found' });
    } catch (e) {
        console.error('❌ Error deleting game:', e);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// --- ניהול תובנות ---
app.get('/api/insights', (req, res) => {
    try {
        const row = db.prepare('SELECT insights_data FROM insights WHERE id = 1').get();
        res.json(row ? JSON.parse(row.insights_data) : {});
    } catch (e) { console.error('❌ Error reading insights:', e); res.status(500).json({ message: 'Internal Server Error' }); }
});

app.post('/api/insights', (req, res) => {
    try {
        db.prepare('INSERT OR REPLACE INTO insights (id, insights_data) VALUES (1, ?)').run(JSON.stringify(req.body));
        res.json({ message: 'Insights saved' });
    } catch (e) { console.error('❌ Error saving insights:', e); res.status(500).json({ message: 'Internal Server Error' }); }
});

// --- צפייה בתוצאות (אדמין) ---
app.get('/api/results', (req, res) => {
    try {
        const summaries = db.prepare('SELECT game_id, client_email, processed_at FROM game_summaries ORDER BY processed_at DESC').all();
        res.json(summaries);
    } catch (e) { console.error('❌ Error listing results:', e); res.status(500).json({ message: 'Internal Server Error' }); }
});

app.get('/api/results/:gameId', (req, res) => {
    try {
        const { gameId } = req.params;
        const summary = db.prepare('SELECT * FROM game_summaries WHERE game_id = ?').get(gameId);
        if (!summary) return res.status(404).json({ message: 'Result not found' });
        const individuals = db.prepare('SELECT * FROM individual_results WHERE game_id = ?').all(gameId);
        const groups = db.prepare('SELECT * FROM group_results WHERE game_id = ?').all(gameId);

        const fullResult = {
            game_id: summary.game_id, client_email: summary.client_email, processed_at: summary.processed_at,
            game_average_profile: JSON.parse(summary.game_average_profile),
            individual_results: individuals.map(p => ({ id: p.id, name: p.user_name, group_name: p.group_name, access_code: p.access_code, profile: JSON.parse(p.profile_data) })),
            group_results: groups.reduce((acc, g) => { acc[g.group_name] = { participant_count: g.participant_count, profile: JSON.parse(g.profile_data) }; return acc; }, {})
        };
        res.json(fullResult);
    } catch (e) { console.error('❌ Error reading result:', e); res.status(500).json({ message: 'Internal Server Error' }); }
});

// --- פונקציות עזר לשליפת תוצאה ---
function processInsightsForProfile(profile, insights) {
    if (!insights || !profile) return null;
    const getDominantElement = (p) => Object.keys(p).reduce((a, b) => p[a] > p[b] ? a : b);
    const dominantElement = getDominantElement(profile);
    const dominant_insight = (insights.dominant_insights && insights.dominant_insights[dominantElement]) ? insights.dominant_insights[dominantElement] : "לא נמצאה תובנה דומיננטית.";
    const general_insights_text = [];
    for (const [element, value] of Object.entries(profile)) {
        if (insights.general_insights && insights.general_insights[element]) {
            const sortedRules = insights.general_insights[element].sort((a, b) => b.min_percent - a.min_percent);
            const applicableRule = sortedRules.find(rule => value >= rule.min_percent);
            if (applicableRule) general_insights_text.push(`${element}: ${applicableRule.text}`);
        }
    }
    return { dominant_insight, general_insights: general_insights_text, full_text: `התכונה הדומיננטית שלך היא: ${dominant_insight}. פירוט נוסף: ${general_insights_text.join('. ')}.` };
}

function findUserResult(searchKey, searchValue) {
    const dbKey = searchKey === 'access_code' ? 'access_code' : 'id';
    const user = db.prepare(`SELECT * FROM individual_results WHERE ${dbKey} = ?`).get(searchValue);
    if (!user) return null;
    return { id: user.id, name: user.user_name, group_name: user.group_name, access_code: user.access_code, profile: JSON.parse(user.profile_data), game_id: user.game_id };
}

// --- שליפת תוצאה למשתמש קצה ---
app.get('/api/my-result/by-code/:accessCode', (req, res) => {
    try {
        const userProfile = findUserResult('access_code', req.params.accessCode);
        if (!userProfile) return res.status(404).json({ message: 'Result not found' });
        const insightsRow = db.prepare('SELECT insights_data FROM insights WHERE id = 1').get();
        const insights = insightsRow ? JSON.parse(insightsRow.insights_data) : {};
        const processedInsights = processInsightsForProfile(userProfile.profile, insights);
        res.json({ ...userProfile, insights: processedInsights });
    } catch (e) { console.error('❌ Error searching by code:', e); res.status(500).json({ message: 'Internal Server Error' }); }
});

app.get('/api/my-result/by-phone/:phone', (req, res) => {
    try {
        const userProfile = findUserResult('id', req.params.phone);
        if (!userProfile) return res.status(404).json({ message: 'Result not found' });
        const insightsRow = db.prepare('SELECT insights_data FROM insights WHERE id = 1').get();
        const insights = insightsRow ? JSON.parse(insightsRow.insights_data) : {};
        const processedInsights = processInsightsForProfile(userProfile.profile, insights);
        res.json({ ...userProfile, insights: processedInsights });
    } catch (e) { console.error('❌ Error searching by phone:', e); res.status(500).json({ message: 'Internal Server Error' }); }
});

// --- [שדרוג] עיבוד תוצאות עם הפורמט החדש ---
app.post('/api/submit-results', async (req, res) => {
    try {
        const logEntry = { timestamp: new Date().toISOString(), type: 'SUBMIT_RESULTS', data: req.body };
        logHistory.push(logEntry);
        if (logHistory.length > MAX_LOG_HISTORY) { logHistory.shift(); }
        io.emit('new_log', logEntry);

        // שימוש בשם המשתנה החדש מהפורמט 'participants'
        let { game_id, participants } = req.body;
        if (!game_id || !participants) return res.status(400).json({ message: 'Invalid data structure' });
        
        game_id = game_id.trim();
        const gameRow = db.prepare('SELECT client_email FROM games WHERE game_id = ?').get(game_id);
        const client_email = gameRow ? gameRow.client_email : null;
        
        const questionRows = db.prepare('SELECT question_id, answers_mapping FROM questions').all();
        const questionMap = questionRows.reduce((map, q) => { map[q.question_id] = { answers_mapping: JSON.parse(q.answers_mapping) }; return map; }, {});

        const individual_results = [];
        const group_results_obj = {};
        const game_grand_totals = { fire: 0, water: 0, air: 0, earth: 0 };

        for (const [userId, participantData] of Object.entries(participants)) {
            // [תיקון] חילוץ הנתונים מהמבנה החדש והמורכב
            const name = participantData.details ? participantData.details.name : userId;
            const group_name = participantData.details && participantData.details.category_1 ? `קבוצה ${participantData.details.category_1.groupId}` : null;
            
            const answers = {};
            // [תיקון] לולאה שחולטת רק את התשובות מהאובייקט
            for (const key in participantData) {
                if (key.startsWith('queId_') && !key.includes('_success')) {
                    const questionNum = key.replace('queId_', '');
                    answers[`q${questionNum}`] = String(participantData[key]);
                }
            }

            const elementCounts = { fire: 0, water: 0, air: 0, earth: 0 };
            let validAnswersCount = 0;
            if (answers) {
                for (const [questionId, answerChoice] of Object.entries(answers)) {
                    const question = questionMap[questionId];
                    if (question && question.answers_mapping) {
                        const element = question.answers_mapping[answerChoice];
                        if (element) { elementCounts[element]++; validAnswersCount++; }
                    }
                }
            }
            
            const profile = Object.keys(elementCounts).reduce((prof, key) => { prof[key] = validAnswersCount > 0 ? (elementCounts[key] / validAnswersCount) * 100 : 0; return prof; }, {});
            Object.keys(profile).forEach(elem => { game_grand_totals[elem] += profile[elem]; });
            const access_code = Math.random().toString(36).substring(2, 8).toUpperCase();
            
            individual_results.push({ id: userId, name, group_name, profile, access_code });
            
            if (group_name) {
                if (!group_results_obj[group_name]) { group_results_obj[group_name] = { counts: { fire: 0, water: 0, air: 0, earth: 0 }, participant_count: 0 }; }
                Object.keys(profile).forEach(elem => group_results_obj[group_name].counts[elem] += profile[elem]);
                group_results_obj[group_name].participant_count++;
            }
        }
        
        // --- המשך הלוגיקה הקיימת ---
        const group_results = {};
        for (const [groupName, data] of Object.entries(group_results_obj)) {
            group_results[groupName] = { profile: Object.keys(data.counts).reduce((prof, key) => { prof[key] = data.counts[key] / data.participant_count; return prof; }, {}), participant_count: data.participant_count };
        }
        const totalParticipants = individual_results.length;
        const game_average_profile = Object.keys(game_grand_totals).reduce((prof, key) => { prof[key] = totalParticipants > 0 ? game_grand_totals[key] / totalParticipants : 0; return prof; }, {});
        
        const insertSummary = db.prepare('INSERT OR REPLACE INTO game_summaries (game_id, client_email, processed_at, game_average_profile) VALUES (?, ?, ?, ?)');
        const insertIndividual = db.prepare('INSERT OR REPLACE INTO individual_results (id, game_id, access_code, user_name, group_name, profile_data) VALUES (?, ?, ?, ?, ?, ?)');
        const insertGroup = db.prepare('INSERT OR REPLACE INTO group_results (game_id, group_name, participant_count, profile_data) VALUES (?, ?, ?, ?)');
        
        const saveAllResults = db.transaction(() => {
            insertSummary.run(game_id, client_email, new Date().toISOString(), JSON.stringify(game_average_profile));
            for (const res of individual_results) { insertIndividual.run(res.id, game_id, res.access_code, res.name, res.group_name, JSON.stringify(res.profile)); }
            for (const groupName in group_results) { const groupData = group_results[groupName]; insertGroup.run(game_id, groupName, groupData.participant_count, JSON.stringify(groupData.profile)); }
        });
        saveAllResults();
        console.log(`✅ Game results for ${game_id} saved to DB (Normalized).`);
// [שינוי] עדכון סטטוס המשחק ל-'completed'
db.prepare("UPDATE games SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE game_id = ?")
  .run(game_id);

console.log(`✅ Game ${game_id} marked as completed.`);

        const settingsRow = db.prepare('SELECT settings_data FROM settings WHERE id = 1').get();
        const settings = settingsRow ? JSON.parse(settingsRow.settings_data) : {};
        if (settings.summary_webhook_url && client_email) {
            try {
                const dashboardLink = `https://masaa.clicker.co.il/results/${game_id}`;
                const encodedEmail = encodeURIComponent(client_email);
                const encodedLink = encodeURIComponent(dashboardLink);
                const finalWebhookUrl = `${settings.summary_webhook_url}&Email=${encodedEmail}&Text27=${encodedLink}`;
                await axios.get(finalWebhookUrl);
                console.log(`📢 Webhook סיכום נשלח בהצלחה.`);
            } catch (webhookError) { console.error(`❌ Error sending summary GET webhook: ${webhookError.message}`); }
        }
// <<< יש להוסיף את כל הקטע הזה במקום הקוד שנמחק >>>
console.log(`📢 מתחיל שליחת ${individual_results.length} משימות ל-Celery...`);
for (const participantResult of individual_results) {
    try {
        // 1. הכנת מבנה הנתונים כפי שה-Worker מצפה לקבל
        const job_data = {
            phone: participantResult.id, // 'id' הוא מספר הטלפון
            name: participantResult.name,
            profile: participantResult.profile
        };

        // 2. שליחת המשימה לתור שמוגדר במשתני הסביבה
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
// --- API ליצירת תמונות ---
app.get('/images/game-summary/:gameId.png', (req, res) => {
    try {
        const { gameId } = req.params;
        const row = db.prepare('SELECT game_average_profile FROM game_summaries WHERE game_id = ?').get(gameId);
        if (!row) return res.status(404).send('Results not found for this game ID');
        const profile = JSON.parse(row.game_average_profile);
        if (!profile) return res.status(404).send('No average profile found for this game');
        const width = 800; const height = 400;
        const canvas = createCanvas(width, height);
        const context = canvas.getContext('2d');
        context.fillStyle = '#f7f8fb'; context.fillRect(0, 0, width, height);
        context.fillStyle = '#1d5b85'; context.font = 'bold 30px Arial';
        context.textAlign = 'center'; context.fillText(`סיכום תוצאות למשחק: ${gameId}`, width / 2, 50);
        const elements = Object.keys(profile);
        const barWidth = 100; const barMargin = 50;
        const chartHeight = 250; const startX = (width - (elements.length * (barWidth + barMargin) - barMargin)) / 2;
        elements.forEach((element, index) => {
            const barHeight = (profile[element] / 100) * chartHeight;
            const x = startX + index * (barWidth + barMargin);
            const y = height - 70 - barHeight;
            const color = {fire: '#e74c3c', water: '#3498db', air: '#f1c40f', earth: '#2ecc71'}[element] || '#ccc';
            context.fillStyle = color; context.fillRect(x, y, barWidth, barHeight);
            context.fillStyle = '#333'; context.font = 'bold 18px Arial';
            context.fillText(`${profile[element].toFixed(1)}%`, x + barWidth / 2, y - 10);
            context.font = '20px Arial'; context.fillText(element, x + barWidth / 2, height - 30);
        });
        res.setHeader('Content-Type', 'image/png');
        canvas.createPNGStream().pipe(res);
    } catch (error) { console.error('❌ Error generating image:', error); res.status(500).send('Error generating image'); }
});

// ===================================================================
//                          SERVER STARTUP
// ===================================================================
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