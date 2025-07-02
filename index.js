const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const PORT = 3000;

app.use(bodyParser.json());

app.post('/api/submit-results', (req, res) => {
  console.log('📥 קיבלנו נתונים:', req.body);
  res.json({ status: 'success', message: 'הנתונים התקבלו' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server is running on port ${PORT}`);
});
