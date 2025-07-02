/**
 * API "מסע אל תוך עצמי" – גרסת ייצור בסיסית
 * מאזין ל־POST /api/submit-results ושומר/מדפיס נתונים ללוג
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// --- נקודת קצה עיקרית ---
app.post('/api/submit-results', (req, res) => {
  console.log('📥 התקבלו נתונים מהמשחק:');
  console.log(JSON.stringify(req.body, null, 2));

  // שמירת הנתונים לקובץ לוג אחרון (אופציונלי)
  try {
    const outPath = path.join(__dirname, 'last-results.json');
    fs.writeFileSync(outPath, JSON.stringify(req.body, null, 2), 'utf8');
  } catch (err) {
    console.error('❌ שגיאה בכתיבת קובץ:', err.message);
  }

  res.json({ status: 'success', message: 'הנתונים התקבלו בהצלחה 🎉' });
});

// --- דף בדיקה בסיסי ---
app.get('/', (req, res) => {
  res.send('🚀 API מסע אל תוך עצמי פעיל – הכתובת לקבלת נתונים: POST /api/submit-results');
});

app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});
