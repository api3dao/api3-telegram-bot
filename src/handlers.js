const { chat } = require('./llm');
const fs = require('fs');

const handleMessage = async (message) => {
  // Get the prompt
  const prompt = fs.readFileSync('./prompt.txt', 'utf-8');

  // Prepare messages for LLM
  const messages = [
    {
      role: 'system',
      content: prompt
    },
    {
      role: 'user',
      content: message
    }
  ];

  const response = await chat(messages);
  const [result, reason] = response.split('|');
  return [result, reason]; // YES or NO and reason
};

module.exports = {
  handleMessage
};
