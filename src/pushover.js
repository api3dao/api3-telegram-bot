/**
 * This module provides functionality to send push notifications via the Pushover service.
 * It only uses two priority levels (0 and 2)and includes a pause mechanism to prevent notification flooding.
 *
 * Configuration is read from a config.json file, which includes the API token and group key.
 *
 * This service can be turned off by setting the "pushover.enabled" to false in the config.json file.
 */

const logger = require('./logger');
const fs = require('fs');
const CONFIG = JSON.parse(fs.readFileSync('./config.json', 'utf-8'))['pushover'];
let PAUSE = false;
const TOKENS = JSON.parse(fs.readFileSync('./config.json', 'utf-8'))['pushover'][process.env.NODE_ENV];

async function sendPushNotification(priority, title, message) {
  if (!CONFIG.enabled) {
    return;
  }

  // If the priority param is 2 and notifications are paused, set priority to 0
  const priorityLevel = PAUSE && priority > 0 ? 0 : priority;
  const sound = priorityLevel === 2 ? 'climb' : 'falling';
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
        sound,
        url: 'tg://resolve', // Optional: URL to open when the notification is clicked
        priority: priorityLevel, // Optional: set priority (-2 to 2)
        expire: 3600, // 60 minutes - Optional: time in seconds before the notification expires
        retry: 120, // 2 minutes - Optional: time in seconds between retries
        ttl: 8000 // 133 minutes - Optional: time in seconds before it is deleted in the app
      })
    });

    // Pause further notifications (priority 2 only) for 3 minutes
    if (priority > 0) {
      PAUSE = true;
      setTimeout(() => {
        PAUSE = false;
      }, 180000);
    }
  } catch (error) {
    logger.error('Error sending Pushover notification:', error.message);
  }
}

module.exports = {
  sendPushNotification
};
