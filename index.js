// ===================================================================
//                                SETUP
// ===================================================================
const express = require('express');
const path = require('path');
const cors = require('cors');
const axios = require('axios');
const { createCanvas } = require('canvas');
const db = require('./db.js');
const http = require('http');
const { Server } = require("socket.io");
const basicAuth = require('express-basic-auth');

const app = express();
const PORT = 3000;

// ===================================================================
//                             MIDDLEWARE
// ===================================================================
app.use(cors());
app.use(express.json());

// ===================================================================
//                      PUBLIC & ADMIN ROUTES
// ===================================================================
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.get('/games_admin', (req, res) => res.sendFile(path.join(__dirname, 'games_admin.html')));
app.get('/results_admin', (req, res) => res.sendFile(path.join(__dirname, 'results_admin.html')));
app.get('/insights_admin', (req, res) => res.sendFile(path.join(__dirname, 'insights_admin.html')));
app.get('/my-result', (req, res) => res.sendFile(path.join(__dirname, 'my_result.html')));
app.get('/results/:gameId', (req, res) => res.sendFile(path.join(__dirname, 'client_dashboard.html')));
// הגדר את שם המשתמש והסיסמה הרצויים
const logUsers = { 'admin': 'CHANGE-THIS-PASSWORD' }; // 🚨 חובה להחליף לסיסמה חזקה!
app.get('/master_admin', basicAuth({
    users: logUsers,
    challenge: true,
    unauthorizedResponse: 'Unauthorized access'
}), (req, res) => {
    res.sendFile(path.join(__dirname, 'master_admin.html'));
});
app.get('/', basicAuth({
    users: logUsers,
    challenge: true,
    unauthorizedResponse: 'Unauthorized access'
}), (req, res) => {
    res.redirect('/master_admin');
});
app.get('/logs', basicAuth({
    users: logUsers,
    challenge: true, // יקפיץ חלון לדרוש שם משתמש וסיסמה
    unauthorizedResponse: 'Unauthorized access'
}), (req, res) => {
    res.sendFile(path.join(__dirname, 'logs.html'));
});

// ===================================================================
//                  API ROUTES
// ===================================================================

// --- ניהול הגדרות ---
app.get('/api/settings', (req, res) => {
    try {
        const row = db.prepare('SELECT settings_data FROM settings WHERE id = 1').get();
        res.json(row ? JSON.parse(row.settings_data) : {});
    } catch (e) {
        console.error('❌ Error reading settings:', e);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

app.patch('/api/settings', (req, res) => {
    try {
        const updatedFields = req.body;
        const row = db.prepare('SELECT settings_data FROM settings WHERE id = 1').get();
        let currentSettings = row ? JSON.parse(row.settings_data) : {};

        const decodedFields = {};
        for (const [key, value] of Object.entries(updatedFields)) {
            if (key.includes('webhook_url') && value) {
                try {
                    decodedFields[key] = Buffer.from(value, 'base64').toString('utf8');
                } catch { decodedFields[key] = value; }
            } else {
                decodedFields[key] = value;
            }
        }

        const newSettings = { ...currentSettings, ...decodedFields };
        db.prepare('INSERT OR REPLACE INTO settings (id, settings_data) VALUES (1, ?)').run(JSON.stringify(newSettings));
        res.json({ message: 'Settings updated successfully' });
    } catch (e) {
        console.error('❌ Error updating settings:', e);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// --- ניהול שאלות ---
app.get('/api/questions', (req, res) => {
    try {
        const rows = db.prepare('SELECT question_id, question_text, answers_mapping FROM questions').all();
        const questions = rows.map(r => ({ ...r, answers_mapping: JSON.parse(r.answers_mapping) }));
        res.json(questions);
    } catch (e) {
        console.error('❌ Error reading questions:', e);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

app.post('/api/questions', (req, res) => {
    try {
        const { question_id, question_text, answers_mapping } = req.body;
        if (!question_id || !question_text || !answers_mapping) {
            return res.status(400).json({ message: 'Invalid question format' });
        }
        db.prepare('INSERT OR REPLACE INTO questions (question_id, question_text, answers_mapping) VALUES (?, ?, ?)')
          .run(question_id, question_text, JSON.stringify(answers_mapping));
        res.status(201).json({ message: 'Question added/updated' });
    } catch (e) {
        console.error('❌ Error saving question:', e);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

app.delete('/api/questions/:questionId', (req, res) => {
    try {
        const { questionId } = req.params;
        const info = db.prepare('DELETE FROM questions WHERE question_id = ?').run(questionId);
        if (info.changes > 0) {
            res.json({ message: `Question ${questionId} deleted` });
        } else {
            res.status(404).json({ message: 'Question not found' });
        }
    } catch (e) {
        console.error('❌ Error deleting question:', e);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// --- ניהול משחקים ---
app.get('/api/games', (req, res) => {
    try {
        const games = db.prepare('SELECT game_id, client_email, created_at FROM games ORDER BY created_at DESC').all();
        res.json(games);
    } catch (e) {
        console.error('❌ Error reading games:', e);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

app.post('/api/games', (req, res) => {
    try {
        let { game_id, client_email } = req.body;
        if (!game_id || !client_email) return res.status(400).json({ message: 'game_id and client_email are required' });
        game_id = game_id.trim();
        db.prepare('INSERT INTO games (game_id, client_email) VALUES (?, ?)')
          .run(game_id, client_email);
        res.status(201).json({ message: 'Game saved' });
    } catch (e) {
        // Handle unique constraint violation for game_id
        if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(409).json({ message: `Game with ID '${e.value}' already exists.` });
        }
        console.error('❌ Error saving game:', e);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

app.delete('/api/games/:gameId', (req, res) => {
    try {
        const { gameId } = req.params;
        const info = db.prepare('DELETE FROM games WHERE game_id = ?').run(gameId);
        if (info.changes > 0) {
            res.json({ message: `Game ${gameId} deleted` });
        } else {
            res.status(404).json({ message: 'Game not found' });
        }
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
    } catch (e) {
        console.error('❌ Error reading insights:', e);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
app.post('/api/insights', (req, res) => {
    try {
        db.prepare('INSERT OR REPLACE INTO insights (id, insights_data) VALUES (1, ?)')
          .run(JSON.stringify(req.body));
        res.json({ message: 'Insights saved' });
    } catch (e) {
        console.error('❌ Error saving insights:', e);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// --- צפייה בתוצאות (אדמין) ---
app.get('/api/results', (req, res) => {
    try {
        const rows = db.prepare('SELECT result_data FROM results').all();
        const summaries = rows.map(row => {
            const data = JSON.parse(row.result_data);
            return { game_id: data.game_id, client_email: data.client_email, processed_at: data.processed_at };
        }).sort((a, b) => new Date(b.processed_at) - new Date(a.processed_at));
        res.json(summaries);
    } catch (e) {
        console.error('❌ Error listing results:', e);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
app.get('/api/results/:gameId', (req, res) => {
    try {
        const { gameId } = req.params;
        const row = db.prepare('SELECT result_data FROM results WHERE game_id = ?').get(gameId);
        if (row) {
            res.json(JSON.parse(row.result_data));
        } else {
            res.status(404).json({ message: 'Result not found' });
        }
    } catch (e) {
        console.error('❌ Error reading result:', e);
        res.status(500).json({ message: 'Internal Server Error' });
    }
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
            if (applicableRule) {
                general_insights_text.push(`${element}: ${applicableRule.text}`);
            }
        }
    }
    return {
        dominant_insight,
        general_insights: general_insights_text,
        full_text: `התכונה הדומיננטית שלך היא: ${dominant_insight}. פירוט נוסף: ${general_insights_text.join('. ')}.`
    };
}

function findUserResult(searchKey, searchValue) {
    const allResults = db.prepare('SELECT result_data FROM results').all();
    for (const result of allResults) {
        const data = JSON.parse(result.result_data);
        if (data.individual_results) {
            const user = data.individual_results.find(u => u[searchKey] === searchValue);
            if (user) return user;
        }
    }
    return null;
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
    } catch (e) {
        console.error('❌ Error searching by code:', e);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
app.get('/api/my-result/by-phone/:phone', (req, res) => {
    try {
        const userProfile = findUserResult('id', req.params.phone);
        if (!userProfile) return res.status(404).json({ message: 'Result not found' });

        const insightsRow = db.prepare('SELECT insights_data FROM insights WHERE id = 1').get();
        const insights = insightsRow ? JSON.parse(insightsRow.insights_data) : {};

        const processedInsights = processInsightsForProfile(userProfile.profile, insights);
        res.json({ ...userProfile, insights: processedInsights });
    } catch (e) {
        console.error('❌ Error searching by phone:', e);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// --- עיבוד תוצאות ---
app.post('/api/submit-results', async (req, res) => {
    try {
        const logEntry = {
            timestamp: new Date().toISOString(),
            type: 'SUBMIT_RESULTS',
            data: req.body // שולחים את המידע הגולמי שהתקבל
        };
        io.emit('new_log', logEntry); // שדר את הלוג לכל הלקוחות המחוברים
        let { gameId: game_id, users } = req.body;
        if (!game_id || !users) return res.status(400).json({ message: 'Invalid data structure' });
        game_id = game_id.trim();

        const gameRow = db.prepare('SELECT client_email FROM games WHERE game_id = ?').get(game_id);
        const client_email = gameRow ? gameRow.client_email : null;
        
        const questionRows = db.prepare('SELECT question_id, answers_mapping FROM questions').all();
        const questionMap = questionRows.reduce((map, q) => {
            map[q.question_id] = { answers_mapping: JSON.parse(q.answers_mapping) };
            return map;
        }, {});

        const individual_results = [];
        const group_element_totals = {};
        const game_grand_totals = { fire: 0, water: 0, air: 0, earth: 0 };

        for (const [userId, participantData] of Object.entries(users)) {
            const elementCounts = { fire: 0, water: 0, air: 0, earth: 0 };
            let validAnswersCount = 0;
            if (participantData.answers) {
                for (const [questionId, answerChoice] of Object.entries(participantData.answers)) {
                    const question = questionMap[questionId];
                    if (question && question.answers_mapping) {
                        const element = question.answers_mapping[String(answerChoice)];
                        if (element) {
                            elementCounts[element]++;
                            validAnswersCount++;
                        }
                    }
                }
            }
            const profile = Object.keys(elementCounts).reduce((prof, key) => {
                prof[key] = validAnswersCount > 0 ? (elementCounts[key] / validAnswersCount) * 100 : 0;
                return prof;
            }, {});
            Object.keys(profile).forEach(elem => { game_grand_totals[elem] += profile[elem]; });
            const access_code = Math.random().toString(36).substring(2, 8).toUpperCase();
            individual_results.push({ id: userId, name: participantData.name, group_name: participantData.group_name, profile, access_code });

            if (participantData.group_name) {
                if (!group_element_totals[participantData.group_name]) {
                    group_element_totals[participantData.group_name] = { counts: { fire: 0, water: 0, air: 0, earth: 0 }, participant_count: 0 };
                }
                Object.keys(profile).forEach(elem => group_element_totals[participantData.group_name].counts[elem] += profile[elem]);
                group_element_totals[participantData.group_name].participant_count++;
            }
        }
        
        const group_results = {};
        for (const [groupName, data] of Object.entries(group_element_totals)) {
            group_results[groupName] = { profile: Object.keys(data.counts).reduce((prof, key) => { prof[key] = data.counts[key] / data.participant_count; return prof; }, {}), participant_count: data.participant_count };
        }
        
        const totalParticipants = individual_results.length;
        const game_average_profile = Object.keys(game_grand_totals).reduce((prof, key) => {
            prof[key] = totalParticipants > 0 ? game_grand_totals[key] / totalParticipants : 0;
            return prof;
        }, {});
        
        const finalResult = { game_id, client_email, processed_at: new Date().toISOString(), game_average_profile, individual_results, group_results };

        db.prepare('INSERT OR REPLACE INTO results (game_id, result_data) VALUES (?, ?)')
          .run(game_id, JSON.stringify(finalResult));
        console.log(`✅ Game results for ${game_id} processed and saved to DB.`);

        const settingsRow = db.prepare('SELECT settings_data FROM settings WHERE id = 1').get();
        const settings = settingsRow ? JSON.parse(settingsRow.settings_data) : {};

        if (settings.summary_webhook_url && client_email) {
            try {
                const dashboardLink = `https://masaa.clicker.co.il/results/${game_id}`;
                const encodedEmail = encodeURIComponent(client_email);
                const encodedLink = encodeURIComponent(dashboardLink);
                const finalWebhookUrl = `${settings.summary_webhook_url}&Email=${encodedEmail}&Text27=${encodedLink}`;
                console.log(`📢 Sending GET webhook to: ${finalWebhookUrl}`);
                await axios.get(finalWebhookUrl);
                console.log(`📢 Webhook סיכום נשלח בהצלחה.`);
            } catch (webhookError) { console.error(`❌ Error sending summary GET webhook: ${webhookError.message}`); }
        }
        if (settings.participant_webhook_url) {
            for (const participantResult of individual_results) {
                try {
                    const payload = { ...participantResult, game_id, client_email };
                    await axios.post(settings.participant_webhook_url, payload);
                    console.log(`📢 Webhook נשלח עבור משתתף: ${participantResult.name}`);
                } catch (e) { console.error(`❌ Error sending webhook for participant ${participantResult.name}: ${e.message}`); }
            }
        }
        res.json({ status: 'success', message: 'Game results processed successfully' });
    } catch (error) {
        console.error('❌ Error processing results:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// ===================================================================
//                  API ליצירת תמונות
// ===================================================================
app.get('/images/game-summary/:gameId.png', (req, res) => {
    try {
        const { gameId } = req.params;
        const row = db.prepare('SELECT result_data FROM results WHERE game_id = ?').get(gameId);
        if (!row) return res.status(404).send('Results not found for this game ID');

        const resultData = JSON.parse(row.result_data);
        const profile = resultData.game_average_profile;
        if (!profile) return res.status(404).send('No average profile found for this game');

        const width = 800;
        const height = 400;
        const canvas = createCanvas(width, height);
        const context = canvas.getContext('2d');
        context.fillStyle = '#f7f8fb';
        context.fillRect(0, 0, width, height);
        context.fillStyle = '#1d5b85';
        context.font = 'bold 30px Arial';
        context.textAlign = 'center';
        context.fillText(`סיכום תוצאות למשחק: ${gameId}`, width / 2, 50);
        const elements = Object.keys(profile);
        const barWidth = 100;
        const barMargin = 50;
        const chartHeight = 250;
        const startX = (width - (elements.length * (barWidth + barMargin) - barMargin)) / 2;

        elements.forEach((element, index) => {
            const barHeight = (profile[element] / 100) * chartHeight;
            const x = startX + index * (barWidth + barMargin);
            const y = height - 70 - barHeight;
            const color = {fire: '#e74c3c', water: '#3498db', air: '#f1c40f', earth: '#2ecc71'}[element] || '#ccc';
            context.fillStyle = color;
            context.fillRect(x, y, barWidth, barHeight);
            context.fillStyle = '#333';
            context.font = 'bold 18px Arial';
            context.fillText(`${profile[element].toFixed(1)}%`, x + barWidth / 2, y - 10);
            context.font = '20px Arial';
            context.fillText(element, x + barWidth / 2, height - 30);
        });

        res.setHeader('Content-Type', 'image/png');
        canvas.createPNGStream().pipe(res);
    } catch (error) {
        console.error('❌ Error generating image:', error);
        res.status(500).send('Error generating image');
    }
});

// ===================================================================
//                          SERVER STARTUP
// ===================================================================
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server is running on port ${PORT}`);
  console.log(`🚀 MASTER ADMIN is available at http://localhost:${PORT}/master_admin`);
});