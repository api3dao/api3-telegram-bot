const { bot } = require('./bot');
const fs = require('fs');
const logger = require('./logger');
const CONFIG = JSON.parse(fs.readFileSync('./config.json', 'utf-8'))[process.env.NODE_ENV];
const RULES = fs.readFileSync('./src/rules.txt', 'utf-8');

/**
 * Timeout a user for 24 hours.
 */
async function startHelpCommand() {
  bot.command('chatrules', async (ctx) => {
    // Prevent anyone the talks to the bot from sending multiple/chatrules commands
    // Also the command cannot be send unless it came from the main chat
    if (CONFIG.chats.main !== ctx.chat.id) {
      return;
    }

    // Sent help message
    bot.telegram
      .sendMessage(
        CONFIG.chats.main,
        `<b>Chat rules</b> (message removed in 30 seconds)
------------------
${RULES}`,
        {
          parse_mode: 'HTML'
        }
      )
      .then((res) => {
        // Delete the message after 30 seconds
        setTimeout(() => {
          bot.telegram.deleteMessage(CONFIG.chats.main, Number(res.message_id)).catch(() => {
            // ignore
          });
        }, 30000);
      })
      .catch((error) => {
        logger.error(`Error sending /rules message: ${error}`);
      });
  });
}

module.exports = {
  startHelpCommand
};
