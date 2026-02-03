/**
 * Database utility functions
 * The database is a simple file-based structure stored in ../file-db/telegram
 * The app api-social-media uses the db to post daily community messages to Slack
 * This app uses the db to restore deleted messages if needed
 *
 * The api-discord-bot uses the same structure
 */

const fs = require('fs');
const { getDateUtcDbFormat } = require('./utc');
const logger = require('../logger');

/**
 * Adds a new valid file to file-db/telegram
 * @param {*} msg
 */
async function addFileDb(msg) {
  try {
    const today = '_db_' + getDateUtcDbFormat();

    // Delete folders other than "today" to keep the file-db size manageable
    const files = fs.readdirSync('../file-db/telegram');
    files.forEach((item) => {
      if (item.indexOf('_db_') === 0 && item !== today) {
        fs.rm(`../file-db/telegram/${item}`, { recursive: true, force: true }, (err) => {
          if (err) {
            return console.error(`Error deleting old file-db telegram directory: ${err}`);
          }
        });
      }
    });

    // First create the folder structure if it does not exist
    const flag = fs.existsSync(`../file-db/telegram/${today}`);
    if (!flag) {
      fs.mkdirSync(`../file-db/telegram/${today}`, { recursive: false });
    }

    // Now add the file to the folder
    fs.writeFileSync(`../file-db/telegram/${today}/${msg.message_id}.json`, JSON.stringify(msg, null, 5));
  } catch (err) {
    logger.error(`Error creating file-db directory: ${err}`);
  }
}

async function addDeletedFileDb(msg) {
  try {
    const fullPath = `../telegram-messages/${msg.message_id}.json`;
    fs.writeFileSync(fullPath, JSON.stringify(msg, null, 5));
  } catch (err) {
    logger.error(`Error storing deleted file: ${err}`);
  }
}

module.exports = {
  addFileDb,
  addDeletedFileDb
};
