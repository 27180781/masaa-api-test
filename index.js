const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.post('/api/submit-results', (req, res) => {
  console.log('📥 התקבלו נתונים:', req.body);
  res.json({ status: 'success', message: 'הנתונים התקבלו' });
});

app.get('/', (req, res) => {
  res.send('🔧 שרת פעיל');
});

app.listen(port, () => {
  console.log(`✅ שרת מאזין על פורט ${port}`);
});
