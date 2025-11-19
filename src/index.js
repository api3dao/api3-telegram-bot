const { bot } = require('./bot');
const { Markup } = require('telegraf');
const { message } = require('telegraf/filters');
const { handleMessage } = require('./handlers');
const logger = require('./logger');
const { newMessageMain, newMessageAdmin } = require('./message-queue');
const {
  startActionTimeout24,
  startActionTimeoutForever,
  startActionTimeoutClear,
  startActionRestoreMessage,
  startActionBanUser,
  startActionUnbanUser,
  startActionWelcome
} = require('./actions');
const { setupWelcome } = require('./welcome');
const { startHelpCommand } = require('./commands');
const fs = require('fs');
const CONFIG = JSON.parse(fs.readFileSync('./config.json', 'utf-8'))[process.env.NODE_ENV];

// COMMANDS: If any are needed, DECLARE ALL COMMANDS HERE, before any other event handlers
startHelpCommand();

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
    // If an unauthorized group is using this bot, tell them to remove it
    if (!Object.values(CONFIG.chats).includes(ctx.update.message.chat.id)) {
      logger.info(`>>> ${ctx.update.message.chat.id} not an authorized chatId.`);
      try {
        ctx.sendMessage(
          'This is a private bot for use by the organization that created it. It will just cause chatter if you add it to your own group. So please do not use this bot and never trust a bot you do not know.'
        );
      } catch (error) {
        return;
      }
      return;
    }

    // MISS ROSE SHOULD BE DELETING COMMANDS FOR NOW
    // Delete any commands that arrives here
    /*if (ctx.update.message.text.startsWith('/')) {
      // The message may not exist if there was a bot restart
      ctx.deleteMessage().catch((error) => {
        logger.error('Error deleting message for / (harmless):', error);
      });
      return;
    }*/

    // If the user has immunity, skip processing
    if (CONFIG.immunity.includes(ctx.update.message.from.username)) {
      return;
    }

    // Check message against AI rules
    const returnedArray = await handleMessage(ctx.update.message.text);

    // If rules were violated send message to admin group and timeout user
    if (returnedArray[0] === 'YES') {
      /**
       * Notify "Curt Administrators" about the message
       * IMPORTANT: Must use a promise to catch errors and not rely on await as
       * sendMessage can throw its own error that will terminate the Nodejs process
       * Do not use periods (.) in the Markup text
       *
       */
      bot.telegram
        .sendMessage(
          CONFIG.chats.admin,
          await getAiMessageBody(ctx, returnedArray),
          Markup.inlineKeyboard([
            [
              Markup.button.callback(`Timeout 24 Hours`, `action_timeout_24-${ctx.update.message.message_id}`),
              Markup.button.callback(`Timeout Forever`, `action_timeout_forever-${ctx.update.message.message_id}`)
            ],
            [
              Markup.button.callback(`Clear Timeout`, `action_timeout_clear-${ctx.update.message.message_id}`),
              Markup.button.callback(`Restore Message`, `action_restore_message-${ctx.update.message.message_id}`)
            ],
            [
              Markup.button.callback(`Ban User`, `action_ban_user-${ctx.update.message.message_id}`),
              Markup.button.callback(`Kick User`, `action_unban_user-${ctx.update.message.message_id}`)
            ]
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

      // Timeout user 60 minutes, which is 24 hours
      const timeoutMinutes = 1440; // Unix timestamp for the timeout in minutes
      const until_date = Math.floor(Date.now() / 1000) + timeoutMinutes * 60;
      await ctx.telegram.restrictChatMember(ctx.update.message.chat.id, ctx.update.message.from.id, {
        permissions: { permissions: { can_send_messages: false } },
        until_date: until_date
      });

      // Reply to user in main group
      newMessageMain(
        `@${ctx.update.message.from.username} Sorry your post is on hold and in review.\nRules: click or enter /chatrules`
      );
    }

    // Notify the admin channel if someone uses the string "admin" in their first_name
    if (ctx.update.message.from.first_name.toLowerCase().indexOf('admin') > -1) {
      const warn = `WARNING - @${ctx.update.message.from.username} - ${ctx.update.message.from.id} uses the word "admin" in their first name.`;
      newMessageAdmin(warn);
    }
  } catch (error) {
    logger.error(error);
  }
});

/**
 * Capture new members event.
 */
bot.on('new_chat_members', async (ctx) => {
  setupWelcome(ctx);
});

// Start the Nodejs process via bot
bot.launch();

// Enable graceful stop
process.once('SIGINT', () => {
  bot.stop('SIGINT');
});
process.once('SIGTERM', () => {
  bot.stop('SIGTERM');
});

// START ACTIONS
startActionTimeout24();
startActionTimeoutForever();
startActionTimeoutClear();
startActionRestoreMessage();
startActionBanUser();
startActionUnbanUser();
startActionWelcome();

async function createMessageDiskObj(ctx) {
  const obj = {
    message_id: ctx.message.message_id,
    from: ctx.message.from,
    text: ctx.message.text,
    ttl: Date.now()
  };
  return obj;
}

async function getAiMessageBody(ctx, returnedArray) {
  return `Message was removed by the AI handler.
----------
Username: @${ctx.update.message.from.username}
User ID: ${ctx.update.message.from.id}
First name: ${ctx.update.message.from.first_name}
Is bot: ${ctx.update.message.from.is_bot}
----------
Reason:\n${returnedArray[1]}
----------
Message:\n${ctx.update.message.text}`;
}
