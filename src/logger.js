const { bot } = require('./bot');
const fs = require('fs');
const CONFIG = JSON.parse(fs.readFileSync('./config.json', 'utf-8'))[process.env.NODE_ENV];

const log = (level, message) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level.toUpperCase()}]: ${message}`);
};

// To prevent runaway logging in the Telegram admin group
let canPost = true;

module.exports = {
  info: (message) => log('info', message),
  warn: (message) => log('warn', message),
  error: (message) => {
    log('error', message);

    // Add to admin group
    if (bot && canPost) {
      // Allow further logging in 2 minutes, prevent excessive logging to admin group
      setTimeout(() => {
        canPost = true;
      }, 120000);

      canPost = false;
      try {
        bot.telegram.sendMessage(CONFIG.chats.admin, `Logger error for development.\n${message}`);
      } catch (err) {
        console.error(err);
      }
    }
  }
};
