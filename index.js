const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.post('/api/submit-results', (req, res) => {
  console.log('📥 נתונים התקבלו מהמשחק:');
  console.log(JSON.stringify(req.body, null, 2));
  res.json({ status: 'success', message: 'הנתונים התקבלו 🎉' });
});

app.get('/', (req, res) => {
  res.send('🔧 שרת בדיקות פעיל');
});

app.listen(port, () => {
  console.log(`✅ מאזין בפורט ${port}`);
});
