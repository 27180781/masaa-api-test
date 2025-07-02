const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = 3000;
const GAMES_DB_FILE = path.join(__dirname, 'games.json');
const QUESTIONS_DB_FILE = path.join(__dirname, 'questions.json');

app.use(express.json());

const ensureDbFileExists = async (filePath, defaultContent = '[]') => {
  try {
    await fs.access(filePath);
  } catch (error) {
    await fs.writeFile(filePath, defaultContent);
  }
};

// ====[ נתיב חדש להצגת דף הניהול ]====
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// ====[ נתיבי API לניהול שאלות ]====

app.get('/api/questions', async (req, res) => {
  try {
    const questionsData = await fs.readFile(QUESTIONS_DB_FILE, 'utf-8');
    res.json(JSON.parse(questionsData));
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Internal Server Error' });
  }
});

app.post('/api/questions', async (req, res) => {
  try {
    const newQuestion = req.body;
    if (!newQuestion.question_id || !newQuestion.question_text || !newQuestion.answers_mapping) {
      return res.status(400).json({ status: 'error', message: 'Invalid question format' });
    }
    const questionsData = await fs.readFile(QUESTIONS_DB_FILE, 'utf-8');
    const questions = JSON.parse(questionsData);
    questions.push(newQuestion);
    await fs.writeFile(QUESTIONS_DB_FILE, JSON.stringify(questions, null, 2));
    res.status(201).json({ status: 'success', message: 'Question added successfully' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Internal Server Error' });
  }
});

// ====[ נתיב חדש למחיקת שאלה ]====
app.delete('/api/questions/:questionId', async (req, res) => {
    try {
        const { questionId } = req.params;
        const questionsData = await fs.readFile(QUESTIONS_DB_FILE, 'utf-8');
        let questions = JSON.parse(questionsData);

        // סינון המערך - משאירים את כל השאלות שה-ID שלהן לא תואם לזה שנרצה למחוק
        const updatedQuestions = questions.filter(q => q.question_id !== questionId);

        if (questions.length === updatedQuestions.length) {
            return res.status(404).json({ status: 'error', message: 'Question not found' });
        }

        await fs.writeFile(QUESTIONS_DB_FILE, JSON.stringify(updatedQuestions, null, 2));
        res.json({ status: 'success', message: `Question ${questionId} deleted successfully` });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Internal Server Error' });
    }
});


// ====[ נתיבי API קיימים ]====
app.get('/', (req, res) => {
  res.send('Go to /admin to manage questions.');
});
// ... שאר הנתיבים שלך ...
app.post('/api/submit-results', (req, res) => { /* ... */ });
app.post('/api/games', (req, res) => { /* ... */ });

// הפעלת השרת
app.listen(PORT, '0.0.0.0', async () => {
  await ensureDbFileExists(GAMES_DB_FILE);
  await ensureDbFileExists(QUESTIONS_DB_FILE);
  console.log(`✅ Server is running on port ${PORT}`);
  console.log(`🚀 Admin interface is available at http://localhost:${PORT}/admin`);
});