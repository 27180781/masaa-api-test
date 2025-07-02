const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = 3000;
const GAMES_DB_FILE = path.join(__dirname, 'games.json');
const QUESTIONS_DB_FILE = path.join(__dirname, 'questions.json');
const RESULTS_DIR = path.join(__dirname, 'results'); // תיקייה חדשה לשמירת התוצאות

app.use(express.json());

const ensureDbFileExists = async (filePath, defaultContent = '[]') => {
  try {
    await fs.access(filePath);
  } catch (error) {
    await fs.writeFile(filePath, defaultContent);
  }
};

const ensureResultsDirExists = async () => {
    try {
        await fs.access(RESULTS_DIR);
    } catch (error) {
        await fs.mkdir(RESULTS_DIR);
    }
};

// ====[ לוגיקת עיבוד התוצאות המרכזית ]====
app.post('/api/submit-results', async (req, res) => {
    try {
        const { game_id, participants } = req.body;
        if (!game_id || !participants) {
            return res.status(400).json({ status: 'error', message: 'Missing game_id or participants' });
        }

        // 1. טעינת "מילון" השאלות
        const questionsData = await fs.readFile(QUESTIONS_DB_FILE, 'utf-8');
        const questions = JSON.parse(questionsData);
        // המרת המערך לאובייקט לגישה מהירה יותר
        const questionMap = questions.reduce((map, q) => {
            map[q.question_id] = q;
            return map;
        }, {});

        const individual_results = [];
        const group_element_totals = {};

        // 2. חישוב תוצאות אישיות
        for (const participant of participants) {
            const elementCounts = { fire: 0, water: 0, air: 0, earth: 0 };
            const totalAnswers = Object.keys(participant.answers).length;

            for (const [questionId, answerChoice] of Object.entries(participant.answers)) {
                const question = questionMap[questionId];
                if (question) {
                    const element = question.answers_mapping[answerChoice];
                    if (element) {
                        elementCounts[element]++;
                    }
                }
            }
            
            const profile = {
                fire: totalAnswers > 0 ? (elementCounts.fire / totalAnswers) * 100 : 0,
                water: totalAnswers > 0 ? (elementCounts.water / totalAnswers) * 100 : 0,
                air: totalAnswers > 0 ? (elementCounts.air / totalAnswers) * 100 : 0,
                earth: totalAnswers > 0 ? (elementCounts.earth / totalAnswers) * 100 : 0,
            };
            
            // יצירת קוד גישה אישי
            const access_code = Math.floor(1000 + Math.random() * 9000).toString();

            individual_results.push({
                name: participant.name,
                group_name: participant.group_name,
                profile,
                access_code
            });

            // צבירת נתונים לקבוצות
            if (!group_element_totals[participant.group_name]) {
                group_element_totals[participant.group_name] = { counts: { fire: 0, water: 0, air: 0, earth: 0 }, participant_count: 0 };
            }
            group_element_totals[participant.group_name].counts.fire += profile.fire;
            group_element_totals[participant.group_name].counts.water += profile.water;
            group_element_totals[participant.group_name].counts.air += profile.air;
            group_element_totals[participant.group_name].counts.earth += profile.earth;
            group_element_totals[participant.group_name].participant_count++;
        }
        
        // 3. חישוב ממוצעים קבוצתיים
        const group_results = {};
        for(const [groupName, data] of Object.entries(group_element_totals)) {
            group_results[groupName] = {
                profile: {
                    fire: data.counts.fire / data.participant_count,
                    water: data.counts.water / data.participant_count,
                    air: data.counts.air / data.participant_count,
                    earth: data.counts.earth / data.participant_count,
                },
                participant_count: data.participant_count
            };
        }

        // 4. הרכבת אובייקט התוצאה הסופי
        const finalResult = {
            game_id,
            processed_at: new Date().toISOString(),
            individual_results,
            group_results
        };

        // 5. שמירת התוצאות בקובץ ייעודי
        const resultFilePath = path.join(RESULTS_DIR, `results_${game_id}.json`);
        await fs.writeFile(resultFilePath, JSON.stringify(finalResult, null, 2));

        console.log(`✅ תוצאות עבור משחק ${game_id} עובדו ונשמרו.`);
        res.json({ status: 'success', message: 'Game results processed successfully' });

    } catch (error) {
        console.error(`❌ Error processing results for game:`, error);
        res.status(500).json({ status: 'error', message: 'Internal Server Error' });
    }
});


// ... כאן מגיע שאר הקוד שלך (ניהול שאלות, ניהול משחקים וכו'). השאר אותו כמו שהוא ...


// הפעלת השרת
app.listen(PORT, '0.0.0.0', async () => {
  await ensureDbFileExists(GAMES_DB_FILE);
  await ensureDbFileExists(QUESTIONS_DB_FILE);
  await ensureResultsDirExists(); // נוודא שהתיקייה קיימת
  
  console.log(`✅ Server is running on port ${PORT}`);
  console.log(`🚀 Admin interface is available at http://localhost:${PORT}/admin`);
});