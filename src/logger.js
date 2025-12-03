const { bot } = require('./bot');
const fs = require('fs');
const CONFIG = JSON.parse(fs.readFileSync('./config.json', 'utf-8'))[process.env.NODE_ENV];

const NTFY_URL =
  process.env.NODE_ENV === 'production' ? 'https://ntfy.sh/Api3-Telegram' : 'https://ntfy.sh/Api3-Telegram-dev';

const log = (level, message) => {
  // Since we now start PM2 using the --time option, timestamps are added automatically
  // const timestamp = new Date().toISOString();
  if (level === 'error') {
    console.error(`[${level.toUpperCase()}]: ${message}`);
  } else {
    console.log(`[${level.toUpperCase()}]: ${message}`);
  }
};

/**
 * Send notification via Ntfy
 * @param {*} message
 * @param {*} tags
 * @param {*} title
 */
const ntfySend = (message, tags, title) => {
  // Send to Ntfy
  try {
    fetch(NTFY_URL, {
      method: 'POST', // PUT works too
      body: message,
      headers: {
        Title: title || 'Api3 Telegram Bot Notification',
        Tags: tags
      }
    });
  } catch (err) {
    console.error('Ntfy error:', err);
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

      // Send to Ntfy
      ntfySend(message, 'exclamation', 'Logger Error');

      // Send to logging group
      bot.telegram
        .sendMessage(CONFIG.chats.logging, `Logger error for development.\n------------------\n${message}`)
        .catch((error) => console.error('Logger error:', error));
    }
  },
  ntfy: (message, tags, title) => {
    try {
      ntfySend(message, tags, title);
    } catch (err) {
      console.error('Ntfy error:', err);
    }
  }
};

/*function ntfySend(message, tags, title) {
  try {
    fetch(NTFY_URL, {
      method: 'POST', // PUT works too
      body: message,
      headers: {
        Title: title || 'Api3 Telegram Bot Notification',
        Tags: tags
      }
    });
  } catch (err) {
    console.error('Ntfy error:', err);
  }
}*/
