const express = require('express');
const bodyParser = require('body-parser');

const app = express();
const port = 3000;

const jsonParser = bodyParser.json()

app.get('/', (req, res) => {
    res.sendFile('./static/index.html', { root: __dirname });
});

app.get('/api/login', (req, res) => {
  console.log(req.query);
  if (req.query.login && req.query.password) {
      return res
          .status(200)
          .send({ message: 'Login OK' })
  } else
      return res
        .status(400)
        .send({ message: 'Bad request.' })
})
app.post('/api/login', jsonParser, (req, res) => {
  console.log(req.body);
  if (req.body.login && req.body.password) {
      return res
        .status(200)
        .send({ message: 'User created.' })
  } else
      return res
        .status(400)
        .send({ message: 'Bad request.' })
});

app.listen(port, () => console.log(`listening on port ${port}!`));