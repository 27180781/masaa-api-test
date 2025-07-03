// ===================================================================
//                                SETUP
// ===================================================================
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = 3000;

const DATA_DIR = '/app/data'; 
const GAMES_DB_FILE = path.join(DATA_DIR, 'games.json');
const QUESTIONS_DB_FILE = path.join(DATA_DIR, 'questions.json');
const INSIGHTS_DB_FILE = path.join(DATA_DIR, 'insights.json');
const RESULTS_DIR = path.join(DATA_DIR, 'results');

// ===================================================================
//                             MIDDLEWARE
// ===================================================================
app.use(cors());
app.use(express.json());

const ensurePathExists = async (filePath, isDirectory = false, defaultContent = '[]') => {
  try {
    await fs.access(filePath);
  } catch (error) {
    if (isDirectory) await fs.mkdir(filePath, { recursive: true });
    else await fs.writeFile(filePath, defaultContent);
  }
};

// ===================================================================
//                      PUBLIC & ADMIN ROUTES
// ===================================================================
app.get('/', (req, res) => res.send('API is running.'));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.get('/games_admin', (req, res) => res.sendFile(path.join(__dirname, 'games_admin.html')));
app.get('/results_admin', (req, res) => res.sendFile(path.join(__dirname, 'results_admin.html')));
app.get('/insights_admin', (req, res) => res.sendFile(path.join(__dirname, 'insights_admin.html')));
app.get('/my-result', (req, res) => res.sendFile(path.join(__dirname, 'my_result.html')));
app.get('/results/:gameId', (req, res) => res.sendFile(path.join(__dirname, 'client_dashboard.html')));

// ===================================================================
//                  API ROUTES
// ===================================================================

// --- ניהול שאלות ---
app.get('/api/questions', async (req, res) => {
    try {
        const data = await fs.readFile(QUESTIONS_DB_FILE, 'utf-8');
        res.json(JSON.parse(data));
    } catch (e) { if (e.code === 'ENOENT') return res.json([]); res.status(500).json({e}); }
});
app.post('/api/questions', async (req, res) => {
    try {
        const data = await fs.readFile(QUESTIONS_DB_FILE, 'utf-8');
        const questions = JSON.parse(data);
        questions.push(req.body);
        await fs.writeFile(QUESTIONS_DB_FILE, JSON.stringify(questions, null, 2));
        res.status(201).json({ message: 'Question added' });
    } catch (e) { res.status(500).json({e}); }
});
app.delete('/api/questions/:questionId', async (req, res) => {
    try {
        const { questionId } = req.params;
        const data = await fs.readFile(QUESTIONS_DB_FILE, 'utf-8');
        let questions = JSON.parse(data);
        const newQuestions = questions.filter(q => q.question_id !== questionId);
        await fs.writeFile(QUESTIONS_DB_FILE, JSON.stringify(newQuestions, null, 2));
        res.json({ message: 'Question deleted' });
    } catch (e) { res.status(500).json({e}); }
});

// --- ניהול משחקים ---
app.get('/api/games', async (req, res) => {
    try {
        const data = await fs.readFile(GAMES_DB_FILE, 'utf-8');
        res.json(JSON.parse(data));
    } catch (e) { if (e.code === 'ENOENT') return res.json([]); res.status(500).json({e}); }
});
app.post('/api/games', async (req, res) => {
    try {
        const data = await fs.readFile(GAMES_DB_FILE, 'utf-8');
        const games = JSON.parse(data);
        games.push(req.body);
        await fs.writeFile(GAMES_DB_FILE, JSON.stringify(games, null, 2));
        res.status(201).json({ message: 'Game saved' });
    } catch (e) { res.status(500).json({e}); }
});
app.delete('/api/games/:gameId', async (req, res) => {
    try {
        const { gameId } = req.params;
        const data = await fs.readFile(GAMES_DB_FILE, 'utf-8');
        let games = JSON.parse(data);
        const newGames = games.filter(g => g.game_id !== gameId);
        await fs.writeFile(GAMES_DB_FILE, JSON.stringify(newGames, null, 2));
        res.json({ message: 'Game deleted' });
    } catch (e) { res.status(500).json({e}); }
});

// --- ניהול תובנות ---
app.get('/api/insights', async (req, res) => {
    try {
        const data = await fs.readFile(INSIGHTS_DB_FILE, 'utf-8');
        res.json(JSON.parse(data));
    } catch (e) { if (e.code === 'ENOENT') return res.json({}); res.status(500).json({e}); }
});
app.post('/api/insights', async (req, res) => {
    try {
        await fs.writeFile(INSIGHTS_DB_FILE, JSON.stringify(req.body, null, 2));
        res.json({ message: 'Insights saved' });
    } catch (e) { res.status(500).json({e}); }
});

// --- צפייה בתוצאות (אדמין) ---
app.get('/api/results', async (req, res) => {
    try {
        const files = await fs.readdir(RESULTS_DIR);
        const summaries = await Promise.all(files.map(async file => {
            const content = await fs.readFile(path.join(RESULTS_DIR, file), 'utf-8');
            const data = JSON.parse(content);
            return { game_id: data.game_id, client_email: data.client_email, processed_at: data.processed_at };
        }));
        res.json(summaries.sort((a,b) => new Date(b.processed_at) - new Date(a.processed_at)));
    } catch (e) { if (e.code === 'ENOENT') return res.json([]); res.status(500).json({e}); }
});
app.get('/api/results/:gameId', async (req, res) => {
    try {
        const { gameId } = req.params;
        const content = await fs.readFile(path.join(RESULTS_DIR, `results_${gameId}.json`), 'utf-8');
        res.json(JSON.parse(content));
    } catch (e) { if (e.code === 'ENOENT') return res.status(404).json({ message: 'Not found' }); res.status(500).json({e}); }
});

// --- שליפת תוצאה למשתמש קצה ---
app.get('/api/my-result/by-code/:accessCode', async (req, res) => {
    try {
        const { accessCode } = req.params;
        const files = await fs.readdir(RESULTS_DIR);
        for (const file of files) {
            const content = await fs.readFile(path.join(RESULTS_DIR, file), 'utf-8');
            const data = JSON.parse(content);
            const user = data.individual_results.find(u => u.access_code === accessCode);
            if (user) return res.json(user);
        }
        res.status(404).json({ message: 'Result not found' });
    } catch (e) { res.status(500).json({e}); }
});
app.get('/api/my-result/by-phone/:phone', async (req, res) => {
    try {
        const { phone } = req.params;
        const files = await fs.readdir(RESULTS_DIR);
        for (const file of files) {
            const content = await fs.readFile(path.join(RESULTS_DIR, file), 'utf-8');
            const data = JSON.parse(content);
            const user = data.individual_results.find(u => u.id === phone);
            if (user) return res.json(user);
        }
        res.status(404).json({ message: 'Result not found' });
    } catch (e) { res.status(500).json({e}); }
});

// --- עיבוד תוצאות ---
app.post('/api/submit-results', async (req, res) => {
    try {
        console.log('--- RAW DATA RECEIVED ---:', JSON.stringify(req.body, null, 2));
        const { gameId: game_id, users } = req.body; 
        if (!game_id || !users) return res.status(400).json({ message: 'Invalid data structure' });
        
        const participantsArray = Object.values(users);
        const gamesData = await fs.readFile(GAMES_DB_FILE, 'utf-8');
        const games = JSON.parse(gamesData);
        const currentGame = games.find(game => game.game_id === game_id);
        const client_email = currentGame ? currentGame.client_email : null;
        
        const questionsData = await fs.readFile(QUESTIONS_DB_FILE, 'utf-8');
        const questions = JSON.parse(questionsData);
        const questionMap = questions.reduce((map, q) => { map[q.question_id] = q; return map; }, {});

        const individual_results = [];
        const group_element_totals = {};

        for (const [userId, participantData] of Object.entries(users)) {
            const elementCounts = { fire: 0, water: 0, air: 0, earth: 0 };
            const totalAnswers = participantData.answers ? Object.keys(participantData.answers).length : 0;
            if (participantData.answers) {
                for (const [questionId, answerChoice] of Object.entries(participantData.answers)) {
                    const question = questionMap[questionId];
                    if (question && question.answers_mapping) {
                        const element = question.answers_mapping[String(answerChoice)];
                        if (element) elementCounts[element]++;
                    }
                }
            }
            const profile = Object.keys(elementCounts).reduce((prof, key) => {
                prof[key] = totalAnswers > 0 ? (elementCounts[key] / totalAnswers) * 100 : 0;
                return prof;
            }, {});
            const access_code = Math.random().toString(36).substring(2, 8).toUpperCase();
            individual_results.push({ id: userId, name: participantData.name, group_name: participantData.group_name, profile, access_code });
            if(participantData.group_name) {
                if (!group_element_totals[participantData.group_name]) {
                    group_element_totals[participantData.group_name] = { counts: { fire: 0, water: 0, air: 0, earth: 0 }, participant_count: 0 };
                }
                Object.keys(profile).forEach(elem => group_element_totals[participantData.group_name].counts[elem] += profile[elem]);
                group_element_totals[participantData.group_name].participant_count++;
            }
        }
        
        const group_results = {};
        for(const [groupName, data] of Object.entries(group_element_totals)) {
            group_results[groupName] = {
                profile: Object.keys(data.counts).reduce((prof, key) => {
                    prof[key] = data.counts[key] / data.participant_count;
                    return prof;
                }, {}),
                participant_count: data.participant_count
            };
        }
        const finalResult = { game_id, client_email, processed_at: new Date().toISOString(), individual_results, group_results };
        const resultFilePath = path.join(RESULTS_DIR, `results_${game_id}.json`);
        await fs.writeFile(resultFilePath, JSON.stringify(finalResult, null, 2));
        console.log(`✅ תוצאות עבור משחק ${game_id} עובדו ונשמרו.`);

        const webhookUrl = process.env.WEBHOOK_URL;
        if (webhookUrl) {
            try {
                const payload = {
                    ...finalResult,
                    client_dashboard_url: `https://masaa.clicker.co.il/results/${game_id}`
                };
                await axios.post(webhookUrl, payload);
                console.log(`📢 Webhook נשלח בהצלחה.`);
            } catch (webhookError) {
                console.error(`❌ Error sending webhook: ${webhookError.message}`);
            }
        } else {
            console.warn('⚠️ WEBHOOK_URL not defined. Skipping webhook.');
        }

        res.json({ status: 'success', message: 'Game results processed successfully' });
    } catch (error) {
        console.error('❌ Error processing results:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// ===================================================================
//                          SERVER STARTUP
// ===================================================================
app.listen(PORT, '0.0.0.0', async () => {
  await ensurePathExists(DATA_DIR, true);
  await ensurePathExists(GAMES_DB_FILE, false);
  await ensurePathExists(QUESTIONS_DB_FILE, false);
  await ensurePathExists(RESULTS_DIR, true);
  await ensurePathExists(INSIGHTS_DB_FILE, false, JSON.stringify({ dominant_insights: {}, general_insights: {} }));
  
  console.log(`✅ Server is running on port ${PORT}`);
  console.log(`🗄️ Persistent data directory is at: ${DATA_DIR}`);
});