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
const SETTINGS_DB_FILE = path.join(DATA_DIR, 'settings.json'); 

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
app.get('/', (req, res) => res.redirect('/master_admin')); 
app.get('/master_admin', (req, res) => res.sendFile(path.join(__dirname, 'master_admin.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html'))); 
app.get('/games_admin', (req, res) => res.sendFile(path.join(__dirname, 'games_admin.html')));
app.get('/results_admin', (req, res) => res.sendFile(path.join(__dirname, 'results_admin.html')));
app.get('/insights_admin', (req, res) => res.sendFile(path.join(__dirname, 'insights_admin.html')));
app.get('/my-result', (req, res) => res.sendFile(path.join(__dirname, 'my_result.html')));
app.get('/results/:gameId', (req, res) => res.sendFile(path.join(__dirname, 'client_dashboard.html')));

// ===================================================================
//                  API ROUTES
// ===================================================================
// --- [חדש] ניהול הגדרות ---
app.get('/api/settings', async (req, res) => {
    try {
        const settingsData = await fs.readFile(SETTINGS_DB_FILE, 'utf-8');
        res.json(JSON.parse(settingsData));
    } catch (e) {
        if (e.code === 'ENOENT') {
            // אם הקובץ לא קיים, החזר הגדרות ברירת מחדל
            return res.json({ summary_webhook_url: '', participant_webhook_url: '' });
        }
        res.status(500).json({ message: 'Error reading settings' });
    }
});
app.post('/api/settings', async (req, res) => {
    try {
        await fs.writeFile(SETTINGS_DB_FILE, JSON.stringify(req.body, null, 2));
        res.json({ message: 'Settings saved successfully' });
    } catch (e) { res.status(500).json({ message: 'Error saving settings' }); }
});
// --- ניהול שאלות ---
app.get('/api/questions', async (req, res) => {
    try {
        const data = await fs.readFile(QUESTIONS_DB_FILE, 'utf-8');
        res.json(JSON.parse(data));
    } catch (e) {
        if (e.code === 'ENOENT') return res.json([]);
        console.error('❌ Error reading questions file:', e);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
app.post('/api/questions', async (req, res) => {
    try {
        const data = await fs.readFile(QUESTIONS_DB_FILE, 'utf-8');
        const questions = JSON.parse(data);
        questions.push(req.body);
        await fs.writeFile(QUESTIONS_DB_FILE, JSON.stringify(questions, null, 2));
        res.status(201).json({ message: 'Question added' });
    } catch (e) {
        console.error('❌ Error saving question:', e);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
app.delete('/api/questions/:questionId', async (req, res) => {
    try {
        const { questionId } = req.params;
        const data = await fs.readFile(QUESTIONS_DB_FILE, 'utf-8');
        let questions = JSON.parse(data);
        const newQuestions = questions.filter(q => q.question_id !== questionId);
        await fs.writeFile(QUESTIONS_DB_FILE, JSON.stringify(newQuestions, null, 2));
        res.json({ message: 'Question deleted' });
    } catch (e) {
        console.error('❌ Error deleting question:', e);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// --- ניהול משחקים ---
app.get('/api/games', async (req, res) => {
    try {
        const data = await fs.readFile(GAMES_DB_FILE, 'utf-8');
        res.json(JSON.parse(data));
    } catch (e) {
        if (e.code === 'ENOENT') return res.json([]);
        console.error('❌ Error reading games file:', e);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
app.post('/api/games', async (req, res) => {
    try {
        const { game_id, client_email } = req.body;
        if (!game_id || !client_email) return res.status(400).json({ message: 'game_id and client_email are required' });
game_id = game_id.trim();
        const data = await fs.readFile(GAMES_DB_FILE, 'utf-8');
        const games = JSON.parse(data);
        games.push({ game_id, client_email, createdAt: new Date() });
        await fs.writeFile(GAMES_DB_FILE, JSON.stringify(games, null, 2));
        res.status(201).json({ message: 'Game saved' });
    } catch (e) {
        console.error('❌ Error saving game:', e);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
app.delete('/api/games/:gameId', async (req, res) => {
    try {
        const { gameId } = req.params;
        const data = await fs.readFile(GAMES_DB_FILE, 'utf-8');
        let games = JSON.parse(data);
        const newGames = games.filter(g => g.game_id !== gameId);
        await fs.writeFile(GAMES_DB_FILE, JSON.stringify(newGames, null, 2));
        res.json({ message: 'Game deleted' });
    } catch (e) {
        console.error('❌ Error deleting game:', e);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
// ===================================================================
//                  [חדש וזמני] API לצורכי דיבאגינג
// ===================================================================
app.get('/api/debug/view-file/games', async (req, res) => {
    try {
        const fileContent = await fs.readFile(GAMES_DB_FILE, 'utf-8');
        // הגדרת כותרת כדי להבטיח שהעברית תוצג כראוי בדפדפן
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.send(fileContent);
    } catch (error) {
        res.status(500).json({ error: "Could not read games.json file", details: error.message });
    }
});

// --- ניהול תובנות ---
app.get('/api/insights', async (req, res) => {
    try {
        const data = await fs.readFile(INSIGHTS_DB_FILE, 'utf-8');
        res.json(JSON.parse(data));
    } catch (e) {
        if (e.code === 'ENOENT') return res.json({});
        console.error('❌ Error reading insights file:', e);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
app.post('/api/insights', async (req, res) => {
    try {
        await fs.writeFile(INSIGHTS_DB_FILE, JSON.stringify(req.body, null, 2));
        res.json({ message: 'Insights saved' });
    } catch (e) {
        console.error('❌ Error saving insights:', e);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// --- צפייה בתוצאות (אדמין) ---
app.get('/api/results', async (req, res) => {
    try {
        await ensurePathExists(RESULTS_DIR, true);
        const files = await fs.readdir(RESULTS_DIR);
        const summaries = await Promise.all(files.map(async file => {
            if (file.startsWith('results_') && file.endsWith('.json')) {
                const content = await fs.readFile(path.join(RESULTS_DIR, file), 'utf-8');
                const data = JSON.parse(content);
                return { game_id: data.game_id, client_email: data.client_email, processed_at: data.processed_at };
            }
            return null;
        }));
        res.json(summaries.filter(Boolean).sort((a, b) => new Date(b.processed_at) - new Date(a.processed_at)));
    } catch (e) {
        if (e.code === 'ENOENT') return res.json([]);
        console.error('❌ Error listing results:', e);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
app.get('/api/results/:gameId', async (req, res) => {
    try {
        const { gameId } = req.params;
        const content = await fs.readFile(path.join(RESULTS_DIR, `results_${gameId}.json`), 'utf-8');
        res.json(JSON.parse(content));
    } catch (e) {
        if (e.code === 'ENOENT') return res.status(404).json({ message: 'Not found' });
        console.error('❌ Error reading result file:', e);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
// ===================================================================
//                  [חדש] פונקציית עזר לעיבוד תובנות
// ===================================================================
function processInsightsForProfile(profile, insights) {
    if (!insights || !profile) return null;

    const getDominantElement = (p) => Object.keys(p).reduce((a, b) => p[a] > p[b] ? a : b);
    const dominantElement = getDominantElement(profile);

    const dominant_insight = (insights.dominant_insights && insights.dominant_insights[dominantElement]) 
        ? insights.dominant_insights[dominantElement] 
        : "לא נמצאה תובנה דומיננטית.";

    const general_insights_text = [];
    for (const [element, value] of Object.entries(profile)) {
        if (insights.general_insights && insights.general_insights[element]) {
            const sortedRules = insights.general_insights[element].sort((a,b) => b.min_percent - a.min_percent);
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
// ===================================================================
//          [שדרוג] API ROUTES - שליפת תוצאה למשתמש קצה
// ===================================================================

async function findUserResult(searchKey, searchValue) {
    const files = await fs.readdir(RESULTS_DIR);
    for (const file of files) {
        if (file.startsWith('results_') && file.endsWith('.json')) {
            const content = await fs.readFile(path.join(RESULTS_DIR, file), 'utf-8');
            const data = JSON.parse(content);
            const user = data.individual_results.find(u => u[searchKey] === searchValue);
            if (user) return user;
        }
    }
    return null;
}

app.get('/api/my-result/by-code/:accessCode', async (req, res) => {
    try {
        const userProfile = await findUserResult('access_code', req.params.accessCode);
        if (!userProfile) return res.status(404).json({ message: 'Result not found' });

        const insightsData = await fs.readFile(INSIGHTS_DB_FILE, 'utf-8');
        const insights = JSON.parse(insightsData);
        
        const processedInsights = processInsightsForProfile(userProfile.profile, insights);
        
        res.json({ ...userProfile, insights: processedInsights });

    } catch (e) {
        console.error('❌ Error searching by code:', e);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

app.get('/api/my-result/by-phone/:phone', async (req, res) => {
    try {
        const userProfile = await findUserResult('id', req.params.phone);
        if (!userProfile) return res.status(404).json({ message: 'Result not found' });
        
        const insightsData = await fs.readFile(INSIGHTS_DB_FILE, 'utf-8');
        const insights = JSON.parse(insightsData);
        
        const processedInsights = processInsightsForProfile(userProfile.profile, insights);

        res.json({ ...userProfile, insights: processedInsights });

    } catch (e) {
        console.error('❌ Error searching by phone:', e);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
// --- [שדרוג] עיבוד תוצאות ---
app.post('/api/submit-results', async (req, res) => {
    try {
        console.log('--- RAW DATA RECEIVED ---:', JSON.stringify(req.body, null, 2));
        let { gameId: game_id, users } = req.body;
        if (!game_id || !users) return res.status(400).json({ message: 'Invalid data structure' });

        game_id = game_id.trim();

        const gamesData = await fs.readFile(GAMES_DB_FILE, 'utf-8');
        const games = JSON.parse(gamesData);
        const currentGame = games.find(game => game.game_id === game_id);
        const client_email = currentGame ? currentGame.client_email : null;

        const questionsData = await fs.readFile(QUESTIONS_DB_FILE, 'utf-8');
        const questions = JSON.parse(questionsData);
        const questionMap = questions.reduce((map, q) => { map[q.question_id] = q; return map; }, {});

        const individual_results = [];
        const group_element_totals = {};
        // [חדש] אובייקט לסכימת כל האחוזים במשחק
        const game_grand_totals = { fire: 0, water: 0, air: 0, earth: 0 }; 

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

            // [חדש] הוספת האחוזים של המשתתף לסך הכללי של המשחק
            Object.keys(profile).forEach(elem => {
                game_grand_totals[elem] += profile[elem];
            });

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
            group_results[groupName] = {
                profile: Object.keys(data.counts).reduce((prof, key) => {
                    prof[key] = data.counts[key] / data.participant_count;
                    return prof;
                }, {}),
                participant_count: data.participant_count
            };
        }

        // [חדש] חישוב הממוצע הכללי של המשחק
        const totalParticipants = individual_results.length;
        const game_average_profile = {
            fire: totalParticipants > 0 ? game_grand_totals.fire / totalParticipants : 0,
            water: totalParticipants > 0 ? game_grand_totals.water / totalParticipants : 0,
            air: totalParticipants > 0 ? game_grand_totals.air / totalParticipants : 0,
            earth: totalParticipants > 0 ? game_grand_totals.earth / totalParticipants : 0,
        };
        
        // הרכבת אובייקט התוצאה הסופי
        const finalResult = {
            game_id,
            client_email,
            processed_at: new Date().toISOString(),
            game_average_profile, // <-- הוספנו את הממוצע הכללי
            individual_results,
            group_results
        };

        const resultFilePath = path.join(RESULTS_DIR, `results_${game_id}.json`);
        await fs.writeFile(resultFilePath, JSON.stringify(finalResult, null, 2));
        console.log(`✅ תוצאות עבור משחק ${game_id} עובדו ונשמרו.`);

     // --- שליחת Webhooks על בסיס קובץ הגדרות ---
        let settings = {};
        try {
            const settingsData = await fs.readFile(SETTINGS_DB_FILE, 'utf-8');
            settings = JSON.parse(settingsData);
        } catch (e) {
            console.warn('⚠️ Could not read settings file, skipping webhooks.');
        }

        // 1. Webhook סיכום למנהל
        if (settings.summary_webhook_url) {
            try {
                const payload = { ...finalResult, client_dashboard_url: `https://masaa.clicker.co.il/results/${game_id}` };
                await axios.post(settings.summary_webhook_url, payload);
                console.log(`📢 Webhook סיכום נשלח בהצלחה`);
            } catch (e) { console.error(`❌ Error sending summary webhook: ${e.message}`); }
        }

        // 2. Webhook לכל משתתף
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
//                          SERVER STARTUP
// ===================================================================
app.listen(PORT, '0.0.0.0', async () => {
    await ensurePathExists(DATA_DIR, true);
    await ensurePathExists(GAMES_DB_FILE, false);
    await ensurePathExists(QUESTIONS_DB_FILE, false);
    await ensurePathExists(RESULTS_DIR, true);
    await ensurePathExists(INSIGHTS_DB_FILE, false, JSON.stringify({ dominant_insights: {}, general_insights: {} }));
    await ensurePathExists(SETTINGS_DB_FILE, false, JSON.stringify({ summary_webhook_url: '', participant_webhook_url: '' }));

    console.log(`✅ Server is running on port ${PORT}`);
    console.log(`🗄️ Persistent data directory is at: ${DATA_DIR}`);
    console.log(`🚀 MASTER ADMIN is available at http://localhost:${PORT}/master_admin`);
});