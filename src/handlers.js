const { chat } = require('./llm');
const fs = require('fs');

/**
 * Returns the opinion of an AI openrouter model for a message passed. The call from here
 * continues onto the llm.js file function chat(messages).
 *
 * Example usage: const returnedArray = await handleMessage(ctx.update.message.text);
 * @param {*} message
 * @returns
 */
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
  if (!response) {
    return undefined;
  } else {
    const [result, reason] = response.split('|');
    return [result, reason]; // YES or NO and reason
  }
};

module.exports = {
  handleMessage
};
