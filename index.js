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
const RESULTS_DIR = path.join(DATA_DIR, 'results');
const INSIGHTS_DB_FILE = path.join(DATA_DIR, 'insights.json');

// ===================================================================
//                             MIDDLEWARE
// ===================================================================
app.use(cors());
app.use(express.json());

// פונקציית עזר שמוודאת שקובץ או תיקייה קיימים
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
app.get('/', (req, res) => res.send('API is running. Go to /admin, /games_admin, or /results_admin.'));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.get('/games_admin', (req, res) => res.sendFile(path.join(__dirname, 'games_admin.html')));
app.get('/results_admin', (req, res) => res.sendFile(path.join(__dirname, 'results_admin.html')));
app.get('/results/:gameId', (req, res) => res.sendFile(path.join(__dirname, 'client_dashboard.html')));
app.get('/insights_admin', (req, res) => res.sendFile(path.join(__dirname, 'insights_admin.html')));

// ===================================================================
//                  API ROUTES - ניהול שאלות
// ===================================================================
app.get('/api/questions', async (req, res) => {
    try {
        const questionsData = await fs.readFile(QUESTIONS_DB_FILE, 'utf-8');
        res.json(JSON.parse(questionsData));
    } catch (error) {
        res.status(500).json({ message: 'Error reading questions file' });
    }
});
app.post('/api/questions', async (req, res) => {
    try {
        const newQuestion = req.body;
        if (!newQuestion.question_id || !newQuestion.question_text || !newQuestion.answers_mapping) {
            return res.status(400).json({ message: 'Invalid question format' });
        }
        const questionsData = await fs.readFile(QUESTIONS_DB_FILE, 'utf-8');
        const questions = JSON.parse(questionsData);
        questions.push(newQuestion);
        await fs.writeFile(QUESTIONS_DB_FILE, JSON.stringify(questions, null, 2));
        res.status(201).json({ message: 'Question added successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error saving question' });
    }
});
app.delete('/api/questions/:questionId', async (req, res) => {
    try {
        const { questionId } = req.params;
        const questionsData = await fs.readFile(QUESTIONS_DB_FILE, 'utf-8');
        let questions = JSON.parse(questionsData);
        const updatedQuestions = questions.filter(q => q.question_id !== questionId);
        if (questions.length === updatedQuestions.length) {
            return res.status(404).json({ message: 'Question not found' });
        }
        await fs.writeFile(QUESTIONS_DB_FILE, JSON.stringify(updatedQuestions, null, 2));
        res.json({ message: `Question ${questionId} deleted` });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting question' });
    }
});

// ===================================================================
//                  API ROUTES - ניהול משחקים
// ===================================================================
app.get('/api/games', async (req, res) => {
    try {
        const gamesData = await fs.readFile(GAMES_DB_FILE, 'utf-8');
        res.json(JSON.parse(gamesData));
    } catch (error) {
        res.status(500).json({ message: 'Error reading games file' });
    }
});
app.post('/api/games', async (req, res) => {
    try {
        const { game_id, client_email } = req.body;
        if (!game_id || !client_email) return res.status(400).json({ message: 'game_id and client_email are required' });
        const gamesData = await fs.readFile(GAMES_DB_FILE, 'utf-8');
        const games = JSON.parse(gamesData);
        games.push({ game_id, client_email, createdAt: new Date() });
        await fs.writeFile(GAMES_DB_FILE, JSON.stringify(games, null, 2));
        res.status(201).json({ message: 'המשחק נשמר בהצלחה' });
    } catch (error) {
        res.status(500).json({ message: 'Error saving game' });
    }
});
app.delete('/api/games/:gameId', async (req, res) => {
    try {
        const { gameId } = req.params;
        const gamesData = await fs.readFile(GAMES_DB_FILE, 'utf-8');
        let games = JSON.parse(gamesData);
        const updatedGames = games.filter(g => g.game_id !== gameId);
        if (games.length === updatedGames.length) return res.status(404).json({ message: 'Game not found' });
        await fs.writeFile(GAMES_DB_FILE, JSON.stringify(updatedGames, null, 2));
        res.json({ message: `Game ${gameId} deleted` });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting game' });
    }
});

// ===================================================================
//                  API ROUTES - צפייה בתוצאות (לאדמין)
// ===================================================================
app.get('/api/results', async (req, res) => {
    try {
        await ensurePathExists(RESULTS_DIR, true);
        const resultFiles = await fs.readdir(RESULTS_DIR);
        const summaries = [];
        for (const file of resultFiles) {
            if (file.startsWith('results_') && file.endsWith('.json')) {
                const fileContent = await fs.readFile(path.join(RESULTS_DIR, file), 'utf-8');
                const resultData = JSON.parse(fileContent);
                summaries.push({
                    game_id: resultData.game_id,
                    client_email: resultData.client_email,
                    processed_at: resultData.processed_at
                });
            }
        }
        res.json(summaries.sort((a, b) => new Date(b.processed_at) - new Date(a.processed_at)));
    } catch (error) {
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
app.get('/api/results/:gameId', async (req, res) => {
    try {
        const { gameId } = req.params;
        const filePath = path.join(RESULTS_DIR, `results_${gameId}.json`);
        const fileContent = await fs.readFile(filePath, 'utf-8');
        res.json(JSON.parse(fileContent));
    } catch (error) {
        if (error.code === 'ENOENT') return res.status(404).json({ message: 'Result not found' });
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// ====[ API ROUTES - ניהול תובנות ]====
app.get('/api/insights', async (req, res) => {
    try {
        const insightsData = await fs.readFile(INSIGHTS_DB_FILE, 'utf-8');
        res.json(JSON.parse(insightsData));
    } catch (error) {
        res.status(500).json({ message: 'Error reading insights file' });
    }
});

app.post('/api/insights', async (req, res) => {
    try {
        const newInsights = req.body;
        // כאן אפשר להוסיף ולידציה למבנה התובנות
        await fs.writeFile(INSIGHTS_DB_FILE, JSON.stringify(newInsights, null, 2));
        res.json({ message: 'Insights saved successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error saving insights' });
    }
});

// ===================================================================
//                  API ROUTE - עיבוד תוצאות
// ===================================================================
app.post('/api/submit-results', async (req, res) => {
    try {
        console.log('--- RAW DATA RECEIVED ---:', JSON.stringify(req.body, null, 2));
        const { gameId: game_id, users } = req.body; 
        if (!game_id || !users) {
            return res.status(400).json({ message: 'Invalid data structure: Missing gameId or users' });
        }
        const participantsArray = Object.values(users);
        const gamesData = await fs.readFile(GAMES_DB_FILE, 'utf-8');
        const games = JSON.parse(gamesData);
        const currentGame = games.find(game => game.game_id === game_id);
        const client_email = currentGame ? currentGame.client_email : null;
        if (!client_email) console.warn(`⚠️ Warning: No email found for game_id: ${game_id}`);
        const questionsData = await fs.readFile(QUESTIONS_DB_FILE, 'utf-8');
        const questions = JSON.parse(questionsData);
        const questionMap = questions.reduce((map, q) => { map[q.question_id] = q; return map; }, {});
        const individual_results = [];
        const group_element_totals = {};
        for (const participant of participantsArray) {
            const elementCounts = { fire: 0, water: 0, air: 0, earth: 0 };
            const totalAnswers = participant.answers ? Object.keys(participant.answers).length : 0;
            if (participant.answers) {
                for (const [questionId, answerChoice] of Object.entries(participant.answers)) {
                    const question = questionMap[questionId];
                    if (question && question.answers_mapping) {
                        const element = question.answers_mapping[answerChoice];
                        if (element) elementCounts[element]++;
                    }
                }
            }
            const profile = Object.keys(elementCounts).reduce((prof, key) => {
                prof[key] = totalAnswers > 0 ? (elementCounts[key] / totalAnswers) * 100 : 0;
                return prof;
            }, {});
            const access_code = Math.floor(1000 + Math.random() * 9000).toString();
            individual_results.push({ name: participant.name, group_name: participant.group_name, profile, access_code });
            if(participant.group_name) {
                if (!group_element_totals[participant.group_name]) {
                    group_element_totals[participant.group_name] = { counts: { fire: 0, water: 0, air: 0, earth: 0 }, participant_count: 0 };
                }
                Object.keys(profile).forEach(elem => group_element_totals[participant.group_name].counts[elem] += profile[elem]);
                group_element_totals[participant.group_name].participant_count++;
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
        console.log(`✅ תוצאות עבור משחק ${game_id} עובדו ונשמרו (עם מייל: ${client_email}).`);

        const webhookUrl = process.env.WEBHOOK_URL;
        if (webhookUrl) {
            try {
                const payload = {
                    ...finalResult,
                    client_dashboard_url: `https://masaa.clicker.co.il/results/${game_id}`
                };
                await axios.post(webhookUrl, payload);
                console.log(`📢 Webhook נשלח בהצלחה אל: ${webhookUrl}`);
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
  console.log(`🚀 Admin interfaces are available`);
});