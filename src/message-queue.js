const { bot } = require('./bot');
const logger = require('./logger');
const fs = require('fs');
const CONFIG = JSON.parse(fs.readFileSync('./config.json', 'utf-8'))[process.env.NODE_ENV];
const QUEUE = [];

//////////// TEST ////////////////////////////////////
/*let count = 0;
const intervalId = setInterval(async function () {
  try {
    await newMessageMain(`Leaf Main: ${count}`);
  } catch (error) {
    console.error(error);
  }
  count++;
  if (count === 25) {
    clearInterval(intervalId); // Stop the interval after 5 executions
  }
}, 1000);*/
//////////////// END TEST /////////////////////////////

/** QUEUE
 * Process the queue, only send one message for each
 * cycle of setInterval.
 */
setInterval(async function () {
  try {
    if (QUEUE.length === 0) return;
    const item = QUEUE[0];
    if (item.ts < Date.now()) {
      //
      // Retry new or delete
      if (item.function === 'newMessageMain') await newMessageMain(item.message);
      else if (item.function === 'newMessageAdmin') await newMessageAdmin(item.message);

      QUEUE.splice(0, 1); // Remove 1 element at index 0
      console.log(`>>> Process now: ${JSON.stringify(item)}`);
      console.log(`>>> QUEUE.length: ${QUEUE.length}`);
    }
  } catch (error) {
    logger.error(error);
  }
}, 3000);

/**
 * parse_mode: allows HTML tags for formatting
 * disable_web_page_preview: set to true to disable a web page preview for any links in the text
 * @param {*} message
 */
async function newMessageMain(message) {
  //console.log('newMessageMain() ----------------------');
  //console.log(message);
  bot.telegram
    .sendMessage(CONFIG.chats.main, message, { parse_mode: 'HTML', disable_web_page_preview: true })
    .catch((error) => {
      if (error.code === 429) {
        const retryAfter = error.response.parameters.retry_after || 30; // Default to 30 seconds if not provided
        QUEUE.push({ function: 'newMessageMain', message: message, ts: Date.now() + retryAfter * 1000 });
      }
      error['api3'] = { file: 'message-queue', function: 'newMessageMain', message };
      logger.error(error);
    });
}

/**
 * parse_mode: allows HTML tags for formatting
 * @param {*} message
 */
async function newMessageAdmin(message) {
  //console.log('newMessageAdmin() ----------------------');
  //console.log(message);
  bot.telegram
    .sendMessage(CONFIG.chats.admin, message, { parse_mode: 'HTML', disable_web_page_preview: true })
    .catch((error) => {
      if (error.code === 429) {
        const retryAfter = error.response.parameters.retry_after || 30; // Default to 30 seconds if not provided
        QUEUE.push({ function: 'newMessageAdmin', message: message, ts: Date.now() + retryAfter * 1000 });
      }
      error['api3'] = { file: 'message-queue', function: 'newMessageAdmin', message };
      logger.error(error);
    });
}

module.exports = {
  newMessageMain,
  newMessageAdmin
};
