const express = require('express');
const fs = require('fs').promises; // ייבוא מודול מערכת הקבצים, בגרסה המודרנית
const path = require('path');

const app = express();
const PORT = 3000;
const DB_FILE = path.join(__dirname, 'games.json'); // נגדיר את שם הקובץ שישמש כבסיס נתונים

// Middleware לפענוח גוף הבקשה כ-JSON
app.use(express.json());

// ===================================================================
//      Middleware חדש לדיבאגינג - ירוץ עבור כל בקשה נכנסת
// ===================================================================
app.use((req, res, next) => {
  console.log(`Request received for: ${req.method} ${req.originalUrl}`);
  next(); // ממשיכים לטיפול בבקשה
});


// פונקציית עזר שמוודאת שקובץ בסיס הנתונים קיים
const ensureDbFileExists = async () => {
  try {
    await fs.access(DB_FILE);
  } catch (error) {
    // אם הקובץ לא קיים, ניצור אותו עם מערך ריק
    await fs.writeFile(DB_FILE, JSON.stringify([]));
  }
};


// נקודת קצה קיימת לבדיקה שהשרת רץ
app.get('/', (req, res) => {
  res.send('API is running ✅');
});

// נקודת קצה קיימת לקבלת תוצאות המשחק
app.post('/api/submit-results', (req, res) => {
  console.log('📥 קיבלנו תוצאות משחק:', req.body);
  // כאן בעתיד תהיה הלוגיקה לעיבוד התוצאות
  res.json({ status: 'success', message: 'התוצאות התקבלו בהצלחה' });
});


// נקודת הקצה החדשה לניהול משחקים
app.post('/api/games', async (req, res) => {
  try {
    const { game_id, client_email } = req.body;

    // 1. בדיקת תקינות הקלט
    if (!game_id || !client_email) {
      return res.status(400).json({ status: 'error', message: 'game_id and client_email are required' });
    }

    // 2. קריאת הנתונים הקיימים מהקובץ
    const fileContent = await fs.readFile(DB_FILE, 'utf-8');
    const games = JSON.parse(fileContent);

    // 3. הוספת המשחק החדש למערך
    games.push({ game_id, client_email, createdAt: new Date() });

    // 4. שמירת המערך המעודכן חזרה לקובץ
    await fs.writeFile(DB_FILE, JSON.stringify(games, null, 2));

    console.log(`✅ משחק חדש נשמר: ID=${game_id}, Email=${client_email}`);
    
    // 5. החזרת תשובת הצלחה
    res.status(201).json({ status: 'success', message: 'המשחק נשמר בהצלחה' });

  } catch (error) {
    console.error('❌ Error saving game:', error);
    res.status(500).json({ status: 'error', message: 'Internal Server Error' });
  }
});


// הפעלת השרת
app.listen(PORT, '0.0.0.0', async () => {
  await ensureDbFileExists(); // נוודא שהקובץ קיים לפני שהשרת מתחיל להאזין
  console.log(`✅ Server is running on port ${PORT}`);
  console.log(`🗄️ Database file is at: ${DB_FILE}`);
});