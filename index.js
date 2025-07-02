// ===================================================================
//                                SETUP
// ===================================================================
const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = 3000;
const GAMES_DB_FILE = path.join(__dirname, 'games.json');
const QUESTIONS_DB_FILE = path.join(__dirname, 'questions.json');
const RESULTS_DIR = path.join(__dirname, 'results');

// Middleware גלובלי לפענוח JSON
app.use(express.json());

// פונקציית עזר שמוודאת שקובץ או תיקייה קיימים
const ensurePathExists = async (filePath, isDirectory = false, defaultContent = '[]') => {
  try {
    await fs.access(filePath);
  } catch (error) {
    if (isDirectory) {
      await fs.mkdir(filePath);
    } else {
      await fs.writeFile(filePath, defaultContent);
    }
  }
};

// ===================================================================
//                      PUBLIC & ADMIN ROUTES
// ===================================================================

// נתיב ראשי לבדיקת סטטוס
app.get('/', (req, res) => {
  res.send('API is running. Go to /admin to manage questions.');
});

// נתיב להצגת דף הניהול
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});


// ===================================================================
//                  API ROUTES - ניהול שאלות
// ===================================================================

// GET - קבלת כל השאלות
app.get('/api/questions', async (req, res) => {
  try {
    const questionsData = await fs.readFile(QUESTIONS_DB_FILE, 'utf-8');
    res.json(JSON.parse(questionsData));
  } catch (error) {
    res.status(500).json({ message: 'Error reading questions file' });
  }
});

// POST - הוספת שאלה חדשה
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
    res.status(201).json({ message: 'Question added successfully', question: newQuestion });
  } catch (error) {
    res.status(500).json({ message: 'Error saving question' });
  }
});

// DELETE - מחיקת שאלה
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
        res.json({ message: `Question ${questionId} deleted successfully` });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting question' });
    }
});


// ===================================================================
//                  API ROUTES - ניהול ותוצאות משחקים
// ===================================================================

// POST - יצירת משחק חדש (שיוך מזהה למייל)
app.post('/api/games', async (req, res) => {
  try {
    const { game_id, client_email } = req.body;
    if (!game_id || !client_email) {
      return res.status(400).json({ message: 'game_id and client_email are required' });
    }
    const gamesData = await fs.readFile(GAMES_DB_FILE, 'utf-8');
    const games = JSON.parse(gamesData);
    games.push({ game_id, client_email, createdAt: new Date() });
    await fs.writeFile(GAMES_DB_FILE, JSON.stringify(games, null, 2));
    res.status(201).json({ message: 'המשחק נשמר בהצלחה' });
  } catch (error) {
    res.status(500).json({ message: 'Error saving game' });
  }
});

// POST - קבלת תוצאות ועיבודן
app.post('/api/submit-results', async (req, res) => {
    try {
        const { game_id, participants } = req.body;
        if (!game_id || !participants) {
            return res.status(400).json({ message: 'Missing game_id or participants' });
        }
        
        const questionsData = await fs.readFile(QUESTIONS_DB_FILE, 'utf-8');
        const questions = JSON.parse(questionsData);
        const questionMap = questions.reduce((map, q) => { map[q.question_id] = q; return map; }, {});

        const individual_results = [];
        const group_element_totals = {};

        for (const participant of participants) {
            const elementCounts = { fire: 0, water: 0, air: 0, earth: 0 };
            const totalAnswers = Object.keys(participant.answers).length;
            for (const [questionId, answerChoice] of Object.entries(participant.answers)) {
                const question = questionMap[questionId];
                if (question) {
                    const element = question.answers_mapping[answerChoice];
                    if (element) elementCounts[element]++;
                }
            }
            const profile = Object.keys(elementCounts).reduce((prof, key) => {
                prof[key] = totalAnswers > 0 ? (elementCounts[key] / totalAnswers) * 100 : 0;
                return prof;
            }, {});
            
            const access_code = Math.floor(1000 + Math.random() * 9000).toString();
            individual_results.push({ name: participant.name, group_name: participant.group_name, profile, access_code });

            if (!group_element_totals[participant.group_name]) {
                group_element_totals[participant.group_name] = { counts: { fire: 0, water: 0, air: 0, earth: 0 }, participant_count: 0 };
            }
            Object.keys(profile).forEach(elem => group_element_totals[participant.group_name].counts[elem] += profile[elem]);
            group_element_totals[participant.group_name].participant_count++;
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

        const finalResult = { game_id, processed_at: new Date().toISOString(), individual_results, group_results };
        const resultFilePath = path.join(RESULTS_DIR, `results_${game_id}.json`);
        await fs.writeFile(resultFilePath, JSON.stringify(finalResult, null, 2));

        console.log(`✅ תוצאות עבור משחק ${game_id} עובדו ונשמרו.`);
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
  await ensurePathExists(GAMES_DB_FILE, false);
  await ensurePathExists(QUESTIONS_DB_FILE, false);
  await ensurePathExists(RESULTS_DIR, true);
  
  console.log(`✅ Server is running on port ${PORT}`);
  console.log(`🚀 Admin interface is available at http://localhost:${PORT}/admin`);
});