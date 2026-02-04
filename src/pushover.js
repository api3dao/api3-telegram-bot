/**
 * This module provides functionality to send push notifications via the Pushover service.
 * It only uses one priority level (0).
 * Configuration is read from a config.json file, which includes the API token and group key.
 * This service can be turned off by setting the "pushover.enabled" to false in the config.json file.
 *
 * WARNING: Be cautious when using this module in conjunction with a logger that sends error notifications,
 * as it may lead to infinite loops if not handled properly.
 */

const fs = require('fs');
const CONFIG = JSON.parse(fs.readFileSync('./config.json', 'utf-8'))['pushover'];

const TOKENS = JSON.parse(fs.readFileSync('./config.json', 'utf-8'))['pushover'][process.env.NODE_ENV];

async function sendPushNotification(title, message) {
  if (!CONFIG.enabled) {
    return;
  }

  try {
    await fetch(CONFIG.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json' // Inform the server the body is JSON
      },
      body: JSON.stringify({
        user: TOKENS.group_key,
        token: TOKENS.api_token,
        title,
        message,
        sound: 'climb',
        priority: 0, // Optional: set priority (-2 to 2)
        ttl: 7200 // 120 minutes - Optional: time in seconds before it is deleted in the app
      })
    });
  } catch (error) {
    // Do not call logger.error here to avoid potential infinite loop
    console.error('Error sending Pushover notification:', error.message);
  }
}

module.exports = {
  sendPushNotification
};
