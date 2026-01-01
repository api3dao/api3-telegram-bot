const { bot } = require('./bot');
const fs = require('fs');
const { sendPushNotification } = require('./pushover');
const CONFIG = JSON.parse(fs.readFileSync('./config.json', 'utf-8'))[process.env.NODE_ENV];

const log = (level, message) => {
  // Since we now start PM2 using the --time option, timestamps are added automatically
  if (level === 'error') {
    console.error(`[${level.toUpperCase()}]: ${message}`);
  } else {
    console.log(`[${level.toUpperCase()}]: ${message}`);
  }
};

// To prevent runaway logging
let canPost = true;

module.exports = {
  info: (message) => log('info', message),
  warn: (message) => log('warn', message),
  error: (message) => {
    log('error', message);

    // Add to Logging group in Telegram and posting to Pushover
    if (bot && canPost) {
      // Allow further logging and posting in 10 seconds, prevent excessive logging to logging group and Pushover posting
      setTimeout(() => {
        canPost = true;
      }, 10000);

      canPost = false;

      // Send to Pushover
      sendPushNotification(0, 'ERROR', message);

      // Send to logging group
      bot.telegram
        .sendMessage(CONFIG.chats.logging, `Logger error for development.\n------------------\n${message}`)
        .catch((error) => console.error('Logger error:', error));
    }
  }
};
