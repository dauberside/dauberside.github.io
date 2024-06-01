const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

app.post('/webhook', async (req, res) => {
  const message = req.body.text;

  try {
    const response = await axios.post('https://api.openai.com/v1/engines/davinci-codex/completions', {
      prompt: `Notify: ${message}`,
      max_tokens: 50,
      n: 1,
      stop: null,
      temperature: 1.0,
    }, {
      headers: {
        'Authorization': `Bearer YOUR_OPENAI_API_KEY`
      }
    });

    res.status(200).send(response.data.choices[0].text);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});