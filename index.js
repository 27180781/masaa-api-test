const express = require('express');
// אין צורך יותר ב-require('body-parser');

const app = express();
const PORT = 3000;

// השתמש ביכולת המובנית של Express לפענח JSON
app.use(express.json());

app.get('/', (req, res) => {
  res.send('API is running ✅');
});

app.post('/api/submit-results', (req, res) => {
  console.log('📥 קיבלנו נתונים:', req.body);
  res.json({ status: 'success', message: 'הנתונים התקבלו' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server is running on port ${PORT}`);
});