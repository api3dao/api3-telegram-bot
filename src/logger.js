const { sendPushNotification } = require('./pushover');

const log = (level, message) => {
  // Since we now start PM2 using the --time option, timestamps are added automatically
  if (level === 'error') {
    console.error(`[${level.toUpperCase()}]: ${message}`);
  } else {
    console.log(`[${level.toUpperCase()}]: ${message}`);
  }
};

// To prevent runaway logging
let burst = 0;

module.exports = {
  info: (message) => log('info', message),
  warn: (message) => log('warn', message),
  error: (message) => {
    log('error', message);

    // Send to Pushover
    if (burst < 5) {
      burst++;
      sendPushNotification('ERROR', JSON.stringify(message, null, 5));
    } else {
      // Allow further posting in 10 seconds (after the burst), to prevent excessive posting
      setTimeout(() => {
        burst = 0;
      }, 10000);
    }
  }
};
