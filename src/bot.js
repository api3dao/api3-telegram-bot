/**
 * This file creates the bot for other files to use including setting the bot options such
 * actions. The bot is exported.
 *
 * It also purges messages that are stored on disk once they exceed 7.1 days in age.
 */

const { Telegraf } = require('telegraf');
//const { useNewReplies } = require('telegraf/future');
const fs = require('fs');
const path = require('path');
const BOT_TOKEN = JSON.parse(fs.readFileSync('./config.json', 'utf-8')).bot_token;

// Initialize bot with your bot token, bot is used to talk to the Telegram API via Telegraf
let bot = undefined;

if (!bot) {
  // Initialize bot with bot token, bot is used to talk to the Telegram API via Telegraf.
  bot = new Telegraf(BOT_TOKEN);
  //bot.use(useNewReplies());
  console.info('The bot is ready.');
}

// Poor man's database
// Start an interval to purge disk messages after 3 days
const folderPath = '../telegram-messages';
setInterval(function () {
  try {
    const files = fs.readdirSync(folderPath);

    files.forEach((file) => {
      const fullPath = path.join(folderPath, file);

      if (!file.startsWith('.')) {
        const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));

        // 6.134e+8 is 7.1 days
        if (data.ttl < Date.now() - 6.134e8) {
          const filePath = `../telegram-messages/${file}`;
          fs.unlinkSync(filePath);
          console.log(`Removed msg file: ${file}`);
        }
      }
    });
  } catch (err) {
    console.error('Error reading directory:', err);
  }
}, 3.6e6); // Interval executes every hour

module.exports = {
  bot
};
