const { bot } = require('./bot');
const { Markup } = require('telegraf');
const { message } = require('telegraf/filters');
const { handleMessage } = require('./handlers');
const logger = require('./logger');
const { newMessageMain, newMessageAdmin, newMessageLogging } = require('./message-queue');
const {
  startActionTimeout24,
  startActionTimeoutForever,
  startActionTimeoutClear,
  startActionRestoreMessage,
  startActionBanUser,
  startActionUnbanUser,
  startActionWelcome
} = require('./actions');
const { processNewMember } = require('./welcome');
const { startAllowedLinksCommand, startChatRulesCommand } = require('./commands');
const fs = require('fs');
const CONFIG = JSON.parse(fs.readFileSync('./config.json', 'utf-8'))[process.env.NODE_ENV];

logger.ntfy(`Bot starting in ${process.env.NODE_ENV} mode`, 'rocket', 'Startup');

// COMMANDS: Declare commands here before any other event handlers
startAllowedLinksCommand();
startChatRulesCommand();

/**
 * Handles incoming text messages
 * If the message violates rules, put the user in timeout and delete the message
 * Then notify the user
 * It is important that this is placed *after* all other specific command handlers
 * But can come before the action handlers
 * @param {Telegraf.Context} ctx - The Telegraf context object
 */
bot.on(message('text'), async (ctx) => {
  try {
    const chatId = ctx.update.message.chat.id;

    // If an unauthorized non Api3 group is using this bot, skip the message with notice
    // The notice will entice them to remove the bot
    if (!Object.values(CONFIG.chats).includes(chatId)) {
      ctx
        .reply('This group is not authorized to use this bot. Please contact your Telegram administrator. -100')
        .catch((error) => {
          console.error(`-100: ${error.message}`);
        });
      return;
    }
    // Only process messages from the (Api3 or Curt) main group
    else if (chatId !== CONFIG.chats.main) {
      // Message is not from the main chat, ignore it
      return;
    }

    // If the message is a command, skip processing
    if (ctx.update.message.text.startsWith('/')) {
      return;
    }

    // If the user has immunity, skip processing
    if (CONFIG.immunity.includes(ctx.update.message.from.username)) {
      return;
    }

    // Log all messages to Api3 Logging group
    newMessageLogging(
      `${ctx.update.message.from.first_name || ''} ${ctx.update.message.from.last_name || ''} (@${ctx.update.message.from.username}) (${ctx.update.message.from.id})
Len: ${ctx.update.message.text.length} - Encoded characters: ${detectEncodedCharacters(ctx.update.message.text)} 
-----
${ctx.update.message.text}`
    );

    // Notify the admin channel if someone uses the string "admin" in their first_name or last_name
    if (
      ctx.update.message.from.first_name.toLowerCase().indexOf('admin') > -1 ||
      ctx.update.message.from.last_name.toLowerCase().indexOf('admin') > -1
    ) {
      logger.info('>>> Use of "admin" in name detected, check Admin group');
      const warn = `WARNING: ${ctx.update.message.from.first_name} - ${ctx.update.message.from.last_name} (@${ctx.update.message.from.username}) - (${ctx.update.message.from.id}) uses the word "admin" in their first or last name.`;
      newMessageAdmin(warn);
    }

    // >>> AI CHECK <<<
    const returnedArray = await handleMessage(ctx.update.message.text);

    // A common scam is to use Han characters in the name (that are actually a message) and a few meaningless characters in the actual message
    // Cannot contain more than 3 Han characters in first_name or last_name
    if (
      countHanCharacters(ctx.update.message.from.first_name) > 3 ||
      countHanCharacters(ctx.update.message.from.last_name) > 3
    ) {
      returnedArray[0] = 'YES';
      returnedArray[1] = 'Detected excessive (4+) Han characters in first or last name.';
    }

    // If AI returnedArray is undefined, there was an error with the LLM call
    else if (!returnedArray || returnedArray[0] === undefined || returnedArray[1] === undefined) {
      logger.error(`>>> AI returnedArray malformed\n> Msg: ${ctx.update.message.text}\n> returnArray:${returnedArray}`);
      return;
    }

    // If rules were violated send message to Admin group and timeout user
    // returnedArray[0] could be YES or <result>YES
    if (returnedArray[0].includes('YES')) {
      logger.info(
        `>>> AI returned: (${ctx.update.message.from.first_name}-@${ctx.update.message.from.username}): ${returnedArray}`
      );
      /**
       * Notify Administrators about the message
       * IMPORTANT: Must use a promise to catch errors and not rely on await as
       * sendMessage can throw its own error that will terminate the Nodejs process
       * Do not use periods (.) in the Markup text
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

      // Write the message to disk, used to restore the message later if needed
      fs.writeFileSync(
        `../telegram-messages/${ctx.update.message.message_id}.json`,
        JSON.stringify(await createMessageDiskObj(ctx))
      );

      // Delete the bad user message from the main chat
      // Use promise as the message may already be gone for a host of reasons
      ctx.deleteMessage().catch((error) => {
        logger.error('Error deleting user message (harmless):', error);
      });

      // Timeout user 24 hours
      const timeoutMinutes = 1440; // Unix timestamp for the timeout in minutes
      const until_date = Math.floor(Date.now() / 1000) + timeoutMinutes * 60;
      await ctx.telegram.restrictChatMember(ctx.update.message.chat.id, ctx.update.message.from.id, {
        permissions: { permissions: { can_send_messages: false } },
        until_date: until_date
      });

      // Reply to user in main group about the timeout from AI check
      // It does no good to add /chatrules to the message as the user is in timeout
      await newMessageMain(
        `<i>This message will be removed after one minute.</i>\n-----\nSorry ${ctx.update.message.from.first_name} your post is on hold and in review by an admin.`,
        60000
      );

      // Ntfy notification
      logger.ntfy(
        `USER: ${ctx.update.message.from.first_name} - @${ctx.update.message.from.username} - ${ctx.update.message.from.id}\nREASON: ${returnedArray[1]}\nMESSAGE: ${ctx.update.message.text}`,
        'warning',
        'AI Violation'
      );
    }
  } catch (error) {
    logger.error(error);
  }
});

/**
 * Handle 'new_chat_members' event
 */
bot.on('new_chat_members', async (ctx) => {
  // If an unauthorized group is using this bot
  if (!Object.values(CONFIG.chats).includes(ctx.update.message.chat.id)) {
    ctx
      .reply('This group is not authorized to use this bot. Please contact your Telegram administrator. -400')
      .catch((error) => {
        console.error(`-400: ${error.message}`);
      });
    return;
  }
  processNewMember(ctx);
});

/**
 * Handle 'left_chat_member' event to delete "User left the group" messages
 */
bot.on('left_chat_member', (ctx) => {
  const chatId = ctx.update.message.chat.id;
  const messageId = ctx.update.message.message_id;
  // If an unauthorized group is using this bot
  if (!Object.values(CONFIG.chats).includes(chatId)) {
    // Do nothing the user (from a unauthorized group) is gone
    return;
  }
  // Removes the system message about user leaving the group
  bot.telegram.deleteMessage(chatId, messageId).catch((error) => {
    console.error(`Error deleting message: ${error.message}`);
  });
});

// Start the Nodejs process via bot
bot.launch();

// Enable graceful stop
process.once('SIGINT', () => {
  logger.info('Bot stopping (SIGINT)');
  logger.ntfy('Bot stopping (SIGINT)', 'stop_sign', 'Shutdown');
  bot.stop('SIGINT');
});
process.once('SIGTERM', () => {
  logger.info('Bot stopping (SIGTERM)');
  logger.ntfy('Bot stopping (SIGTERM)', 'stop_sign', 'Shutdown');
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

/**
 * Creates a message object to store on disk for later retrieval
 * This message object is used when an admin wants to restore a message that was removed by the AI handler
 * @param {*} ctx
 * @returns
 */
async function createMessageDiskObj(ctx) {
  const obj = {
    message_id: ctx.message.message_id,
    from: ctx.message.from,
    text: ctx.message.text,
    ttl: Date.now()
  };
  return obj;
}

/**
 * Creates the body of the AI notification message to admins
 * This is the message that is sent to the admin group when a message is removed by the AI handler
 * @param {*} ctx
 * @param {*} returnedArray
 * @returns
 */
async function getAiMessageBody(ctx, returnedArray) {
  return `Message was removed by the AI handler.
----------
Username: @${ctx.update.message.from.username}
User ID: ${ctx.update.message.from.id}
Name: ${ctx.update.message.from.first_name} - ${ctx.update.message.from.last_name}
Is bot: ${ctx.update.message.from.is_bot}
----------
Reason:\n${returnedArray[1]}
----------
Message:\n${ctx.update.message.text}`;
}

/**
 * Check for Han characters in a string
 * @param {*} str
 * @returns boolean
 */
function containsHanCharacters(str) {
  return /\p{Script=Han}/u.test(str);
}

/**
 * js count han characters in mixed string
 * @param {*} str
 * @returns
 */
function countHanCharacters(str) {
  if (!str) return 0;
  const matches = str.match(/\p{Script=Han}/gu);
  return matches ? matches.length : 0;
}

/**
 * Detect encoded HTML characters in a message

 * @param {*} msg
 * @returns boolean
 */
function detectEncodedCharacters(msg) {
  const found = msg.match(/&(#?[a-z0-9]+);/gi); // with ; ending
  const found2 = msg.match(/&(#?[a-z0-9]+)/gi); // without ; ending
  if (found || found2) return true;
  return false;
}
