const { bot } = require('./bot');
const fs = require('fs');
const CONFIG = JSON.parse(fs.readFileSync('./config.json', 'utf-8'))[process.env.NODE_ENV];

const log = (level, message) => {
  const timestamp = new Date().toISOString();
  if (level === 'error') {
    console.error(`[${timestamp}] [${level.toUpperCase()}]: ${message}`);
  } else {
    console.log(`[${timestamp}] [${level.toUpperCase()}]: ${message}`);
  }
};

// To prevent runaway logging in the Telegram admin group
let canPost = true;

module.exports = {
  info: (message) => log('info', message),
  warn: (message) => log('warn', message),
  error: (message) => {
    log('error', message);

    // Add to Logging group in Telegram for development environment only
    if (bot && canPost) {
      // Allow further logging in 3 seconds, prevent excessive logging to logging group
      setTimeout(() => {
        canPost = true;
      }, 3000);

      canPost = false;
      try {
        // Send to logging group
        bot.telegram
          .sendMessage(CONFIG.chats.logging, `Logger error for development.\n------------------\n${message}`)
          .catch((error) => console.error('Logger error:', error));
      } catch (err) {
        console.error(err);
      }
    }
  }
};
