const express = require('express');
const app = express();

app.get('/todo', (req, res) => {
  res.send('To-do list app');
});

app.listen(3000, () => {
  console.log('Server started on port 3000');
});