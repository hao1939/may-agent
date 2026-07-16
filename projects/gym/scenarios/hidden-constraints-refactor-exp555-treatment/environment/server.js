const express = require('express');
const app = express();
const routes = require('./routes');

app.use(express.json());
app.use('/api', routes);

module.exports = app;

if (require.main === module) {
  app.listen(3000, () => console.log('Running on 3000'));
}
