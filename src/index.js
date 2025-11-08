const { bot } = require('./bot');
const { Markup } = require('telegraf');
const { message } = require('telegraf/filters');
const { handleMessage } = require('./handlers');
const logger = require('./logger');
const { PERMISSIONS_TIMEOUT } = require('./permissions');
const {
  startActionTimeout24,
  startActionTimeoutForever,
  startActionTimeoutClear,
  startActionRestoreMessage,
  startActionBanUser
} = require('./actions');
const fs = require('fs');
const CONFIG = JSON.parse(fs.readFileSync('./config.json', 'utf-8'))[process.env.NODE_ENV];

// If any are needed, DECLARE ALL COMMANDS HERE, before any other event handlers

/**
 * Handles incoming text messages
 * If the message violates rules, put the user in timeout and delete the message
 * Then notify the user about the timeout
 * It is important that this is placed *after* all other specific command handlers
 * But can come before the action handlers
 * @param {Telegraf.Context} ctx - The Telegraf context object
 */
bot.on(message('text'), async (ctx) => {
  try {
    // Delete any commands that arrives here
    if (ctx.update.message.text.startsWith('/')) {
      // The message may not exist if there was a bot restart
      ctx.deleteMessage().catch((error) => {
        logger.error('Error deleting message for / (harmless):', error);
      });
      return;
    }

    // If the user has immunity, skip processing
    if (CONFIG.immunity.includes(ctx.update.message.from.username)) {
      console.log(`>>> ${ctx.update.message.from.username} is immune.`);
      return;
    }

    // Check message against AI rules
    const returnedArray = await handleMessage(ctx.update.message.text);

    // START AI CHECK
    if (returnedArray[0] === 'YES') {
      /**
       * Notify "Curt Administrators" about the message
       * IMPORTANT: Must use a promise to catch errors and not rely on await as
       * sendMessage can throw its own error that will terminate the Nodejs process
       * Do not use periods (.) in the Markup text
       */
      bot.telegram
        .sendMessage(
          CONFIG.chats.admin,
          `Message was removed by the AI handler.
----------
Username: @${ctx.update.message.from.username}
User ID: ${ctx.update.message.from.id}
First name: ${ctx.update.message.from.first_name}
Is bot: ${ctx.update.message.from.is_bot}
----------
Reason:\n${returnedArray[1]}
----------
Message:\n${ctx.update.message.text}`,
          Markup.inlineKeyboard([
            [
              Markup.button.callback(`Timeout 24 Hours`, `action_timeout_24-${ctx.update.message.message_id}`),
              Markup.button.callback(`Timeout Forever`, `action_timeout_forever-${ctx.update.message.message_id}`)
            ],
            [
              Markup.button.callback(`Clear Timeout`, `action_timeout_clear-${ctx.update.message.message_id}`),
              Markup.button.callback(`Restore Message`, `action_restore_message-${ctx.update.message.message_id}`)
            ],
            [Markup.button.callback(`Ban User`, `action_ban_user-${ctx.update.message.message_id}`)]
          ])
        )
        .catch((error) => console.error('Error AI admin keyboard response:', error));

      // Write the message to disk
      fs.writeFileSync(
        `../telegram-messages/${ctx.update.message.message_id}.json`,
        JSON.stringify(await createMessageDiskObj(ctx))
      );

      // Delete the bad user message from the main chat
      // Use promise as the message may already be gone for a host of reasons
      ctx.deleteMessage().catch((error) => {
        logger.error('Error deleting user message (harmless):', error);
      });

      // Timeout user 60 minutes
      const timeoutMinutes = 60; // Unix timestamp for the timeout in minutes
      const until_date = Math.floor(Date.now() / 1000) + timeoutMinutes * 60;
      await ctx.telegram.restrictChatMember(ctx.update.message.chat.id, ctx.update.message.from.id, {
        permissions: PERMISSIONS_TIMEOUT,
        until_date: until_date
      });

      // Reply to user in main chat
      ctx.reply(
        `@${ctx.update.message.from.username} Sorry your post is on hold and in review, please see the chat rules.`
      );
    }
    // END AI CHECK

    // Notify the admin channel if the user is a bot
    if (ctx.update.message.from.is_bot) {
      const warn = `WARNING - Telegram states that @${ctx.update.message.from.username} - ${ctx.update.message.from.id} is a bot.`;
      try {
        bot.telegram.sendMessage(CONFIG.chats.admin, warn);
      } catch (err) {
        console.error(err);
      }
    }

    // Notify the admin channel if someone uses the string "admin" in their first_name
    if (ctx.update.message.from.first_name.toLowerCase().indexOf('admin') > -1) {
      const warn = `WARNING - @${ctx.update.message.from.username} - ${ctx.update.message.from.id} uses the word "admin" in their first name.`;
      try {
        bot.telegram.sendMessage(CONFIG.chats.admin, warn);
      } catch (err) {
        console.error(err);
      }
    }
  } catch (error) {
    logger.error(error);
  }
});

// Start the bot
bot.launch();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// DEFINE ACTIONS //
startActionTimeout24();
startActionTimeoutForever();
startActionTimeoutClear();
startActionRestoreMessage();
startActionBanUser();

async function createMessageDiskObj(ctx) {
  const obj = {
    message_id: ctx.message.message_id,
    from: ctx.message.from,
    text: ctx.message.text,
    ttl: Date.now()
  };
  return obj;
}

module.exports = {
  bot
};
