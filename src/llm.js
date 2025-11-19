const fs = require('fs');
const logger = require('./logger');
const OPENROUTER_TOKEN = JSON.parse(fs.readFileSync('./config.json', 'utf-8')).openrouter_token;

async function chat(messages) {
  try {
    return await chatWithOpenRouter('anthropic/claude-sonnet-4', messages);
  } catch (errorOpenrouter) {
    logger.error(`chatWithOpenRouter() error:\n ${JSON.stringify(errorOpenrouter, null, 4)}`);
  }
}

async function chatWithOpenRouter(model, messages) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages
    })
  });

  const responseJson = await response.json();
  if (!response.ok) throw responseJson;
  else return responseJson.choices[0].message.content;
}

module.exports = {
  chat
};
