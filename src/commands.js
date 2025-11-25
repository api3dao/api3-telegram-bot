/**
 * src/commands.js
 *
 * Only handles bot commands such as /chatrules and /allowedlinks
 *
 * IMPORTANT: Commands cannot be sent unless it came from the main chat and thus
 * this will also exclude unauthorized groups using this bot. Unauthorized groups get
 * notice because we send a message to their chat.
 */

const { bot } = require('./bot');
const fs = require('fs');
const CONFIG = JSON.parse(fs.readFileSync('./config.json', 'utf-8'))[process.env.NODE_ENV];
const RULES = fs.readFileSync('./src/commands/rules.txt', 'utf-8');
const ALLOWED_LINKS = fs.readFileSync('./src/commands/allowed-links.txt', 'utf-8');
const { newMessageMain } = require('./message-queue');

/**
 * Command: /chatrules
 * See the notes at the top of this file.
 */
async function startChatRulesCommand() {
  bot.command('chatrules', async (ctx) => {
    if (CONFIG.chats.main !== ctx.chat.id) {
      ctx
        .reply(
          'This group is not authorized to use the requested bot command. Please contact your Telegram administrator. -200'
        )
        .catch((error) => {
          console.error(`-200: ${error.message}`);
        });
      return;
    }
    newMessageMain(
      `<i>This message will be removed after 45 seconds.</i>\n-----\nGlad to help out ${ctx.update.message.from.first_name}, here are the chat rules.\n\n${RULES}`,
      45000
    );
  });
}

/**
 * Command: /allowedlinks
 * See the notes at the top of this file.
 */
async function startAllowedLinksCommand() {
  bot.command('allowedlinks', async (ctx) => {
    if (CONFIG.chats.main !== ctx.chat.id) {
      ctx
        .reply(
          'This group is not authorized to use the requested bot command. Please contact your Telegram administrator. -300'
        )
        .catch((error) => {
          console.error(`-300: ${error.message}`);
        });
      return;
    }
    newMessageMain(
      `<i>This message will be removed after 45 seconds.</i>\n-----\nGlad to help out ${ctx.update.message.from.first_name}, here are the allowed links.\n\n${ALLOWED_LINKS}`,
      60000
    );
  });
}

module.exports = {
  startChatRulesCommand,
  startAllowedLinksCommand
};
