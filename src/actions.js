const { bot } = require('./bot');
const { newMessageMain, newMessageAdmin } = require('./message-queue');
const fs = require('fs');
const logger = require('./logger');
const CONFIG = JSON.parse(fs.readFileSync('./config.json', 'utf-8'))[process.env.NODE_ENV];
// Store of welcome message IDs for users that have joined but need to confirm they are human
let WELCOME_MSG_IDS = {}; // {userId:<id>, msgId:<msgId}

/**
 * Timeout a user for 24 hours.
 */
async function startActionTimeout24() {
  bot.action(/^action_timeout_24-(\d+)/, async (ctx) => {
    try {
      const msgId = ctx.match[1];

      // Get the message from disk
      // Without the message we cannot proceed
      const msg = await getMessageFromDisk(ctx, 'Timeout 24', msgId);
      if (!msg) return;

      const userId = msg.from.id;
      const chatId = CONFIG.chats.main;

      // Set timeout
      const timeoutMinutes = 1440; // Unix timestamp for the timeout in minutes
      const until_date = Math.floor(Date.now() / 1000) + timeoutMinutes * 60;
      await ctx.telegram.restrictChatMember(chatId, userId, {
        permissions: { can_send_messages: false },
        until_date: until_date
      });

      // Send message to admin chat
      const reply = `User (${msg.from.first_name} / ${userId}) timeout set for 24 hours. The user can only read messages.`;
      ctx.answerCbQuery(reply);
      newMessageAdmin(reply);
    } catch (error) {
      // Send message to admin chat
      ctx.answerCbQuery(`FAILED`);
      newMessageAdmin(`Set timeout 24 hours FAILED. Please notify bot developer.`);
      logger.error(error.stack);
    }
  });
}

/**
 * Timeout a user forever, makes them read only.
 */
async function startActionTimeoutForever() {
  bot.action(/^action_timeout_forever-(\d+)/, async (ctx) => {
    try {
      const msgId = ctx.match[1];

      // Get the message from disk
      // Without the message we cannot proceed
      const msg = await getMessageFromDisk(ctx, 'Timeout Forever', msgId);
      if (!msg) return;

      const userId = msg.from.id;
      const chatId = CONFIG.chats.main;

      // Set timeout
      await ctx.telegram.restrictChatMember(chatId, userId, { permissions: { can_send_messages: false } });

      // Send message to admin chat
      const reply = `User (${msg.from.first_name} / ${userId}) timeout set for forever. The user can only read messages.`;
      ctx.answerCbQuery(reply);
      newMessageAdmin(reply);
    } catch (error) {
      // Send message to admin chat
      ctx.answerCbQuery(`FAILED`);
      newMessageAdmin(`Set timeout forever FAILED. Please notify bot developer.`);
      logger.error(error.stack);
    }
  });
}

/**
 * Clears any timeout that may have been applied to a user.
 */
async function startActionTimeoutClear() {
  try {
    bot.action(/^action_timeout_clear-(\d+)/, async (ctx) => {
      try {
        const msgId = ctx.match[1];

        // Get the message from disk
        // Without the message we cannot proceed
        const msg = await getMessageFromDisk(ctx, 'Clear Timeout', msgId);
        if (!msg) return;

        const userId = msg.from.id;
        const chatId = CONFIG.chats.main;

        // Clear timeout
        const res = await bot.telegram.restrictChatMember(chatId, userId, { permissions: { can_send_messages: true } });

        if (!res) throw new Error(`Failed to clear timeout for ${msg.from.first_name} / ${userId}`);

        // Send message to admin chat
        const reply = `User (${msg.from.first_name} / ${userId}) timeout cleared. The user can send and read messages.`;
        ctx.answerCbQuery(reply);
        newMessageAdmin(reply);
      } catch (error) {
        // Send message to admin chat
        ctx.answerCbQuery(`FAILED`);
        newMessageAdmin(`Clear timeout FAILED. Please notify bot developer.`);
        logger.error(error.stack);
      }
    });
  } catch (error) {
    logger.error(error);
  }
}

/**
 * Restore message from disk storage. Any timeout applied to the user is removed.
 */
async function startActionRestoreMessage() {
  bot.action(/^action_restore_message-(\d+)/, async (ctx) => {
    try {
      const msgId = ctx.match[1];

      // Get the message from disk
      // Without the message we cannot proceed
      const msg = await getMessageFromDisk(ctx, 'Restore Message', msgId);
      if (!msg) return;

      const userId = msg.from.id;
      const chatId = CONFIG.chats.main;
      let restoreMsg = `<i>An admin told me to re-post a message I had removed earlier.</i>\n-----`;

      if (msg.quote) {
        const truncated = msg.quote.text.length > 90 ? `${msg.quote.text.slice(0, 90).trim()}...` : msg.quote.text;
        restoreMsg += `\n<blockquote>${msg.external_reply.origin.sender_user.first_name}\n<code>(external reply)</code>\n${truncated}</blockquote>`;
      }
      if (msg.reply_to_message) {
        const truncated2 =
          msg.reply_to_message.text.length > 90
            ? `${msg.reply_to_message.text.slice(0, 90).trim()}...`
            : msg.reply_to_message.text;
        restoreMsg += `\n<blockquote>${msg.reply_to_message.from.first_name}\n${truncated2}</blockquote>`;
      }
      restoreMsg += `\n${msg.from.first_name} @${msg.from.username}`;

      restoreMsg += `\n${msg.text}`;

      // Send user's message back to the main chat
      newMessageMain(restoreMsg);

      // Clear timeout
      await bot.telegram.restrictChatMember(chatId, userId, { permissions: { can_send_messages: true } });

      // Send message to admin chat
      const reply = `User (${msg.from.first_name} / ${userId}) message restored and timeout (if any) removed.  The user can send and read messages.`;
      ctx.answerCbQuery(reply);
      newMessageAdmin(reply);
      //ctx.reply(reply);
    } catch (error) {
      // Send message to admin chat
      ctx.answerCbQuery(`FAILED`);
      newMessageAdmin(`Restore message FAILED. Please notify bot developer`);
      logger.error(error.stack);
    }
  });
}

/**
 * Ban a user, they are not kicked from the group but are moved to the "removed users" list.
 */
async function startActionBanUser() {
  bot.action(/^action_ban_user-(\d+)/, async (ctx) => {
    try {
      // console.log('>>> action_ban_user');
      const msgId = ctx.match[1];

      // Get the message from disk
      // Without the message we cannot proceed
      const msg = await getMessageFromDisk(ctx, 'Ban User', msgId);
      if (!msg) return;

      const userId = msg.from.id;
      const chatId = CONFIG.chats.main;

      // Clear timeout
      const res = await bot.telegram.banChatMember(chatId, userId);
      if (!res) throw new Error(`Failed to ban user for ${msg.from.first_name} / ${userId}`);

      // Send message to admin chat
      const reply = `User (${msg.from.first_name} / ${userId}) is banned. They cannot rejoin the group until they are kicked.`;
      ctx.answerCbQuery(reply);
      newMessageAdmin(reply);
    } catch (error) {
      // Send message to admin chat
      ctx.answerCbQuery(`FAILED`);
      newMessageAdmin(`User ban FAILED. Please notify bot developer.`);
      logger.error(error.stack);
    }
  });
}

/**
 * Un-ban a user (kicked), they are kicked from the group. If they are in the "removed users" list then
 * they are removed from it. Kicked users can rejoin the group by themselves.
 */
async function startActionUnbanUser() {
  bot.action(/^action_unban_user-(\d+)/, async (ctx) => {
    try {
      // console.log('>>> action_unban_user');
      const msgId = ctx.match[1];

      // Get the message from disk
      // Without the message we cannot proceed
      const msg = await getMessageFromDisk(ctx, 'Ban User', msgId);
      if (!msg) return;

      const userId = msg.from.id;
      const chatId = CONFIG.chats.main;

      // Clear timeout
      const res = await bot.telegram.unbanChatMember(chatId, userId);
      if (!res) throw new Error(`Failed to unban user for ${msg.from.first_name} / ${userId}`);

      // Send message to admin chat
      const reply = `User (${msg.from.first_name} / ${userId}) is kicked. Once a user is kicked they must rejoin the group themselves.`;
      ctx.answerCbQuery(reply);
      newMessageAdmin(reply);
    } catch (error) {
      // Send message to admin chat
      ctx.answerCbQuery(`FAILED`);
      newMessageAdmin(`User kick FAILED. Please notify bot developer.`);
      logger.error(error.stack);
    }
  });
}

/**
 * Action that (confirms) welcomes a new user
 * The welcome message has a life of 1 minute.
 */
async function startActionWelcome() {
  bot.action(/^action_welcome-(\d+)/, async (ctx) => {
    // The userId that the Welcome message was for
    const userId = Number(ctx.match[1]);

    // Who pushed the button
    const from = ctx.update.callback_query.from;
    try {
      // The user that the Welcome msg is for, must be the user that pushed the button.
      // userId is String, from.id is a Number
      if (userId != from.id) {
        ctx.answerCbQuery(`Action rejected. You are not the user the invite is for.`);
        return;
      }

      // Clear user timeout (restriction)
      await bot.telegram.restrictChatMember(CONFIG.chats.main, userId, { permissions: { can_send_messages: true } });

      // Delete the Welcome message the user just verified
      const msgId = WELCOME_MSG_IDS[userId];
      await bot.telegram.deleteMessage(CONFIG.chats.main, msgId);

      // Remove the msgId for the user from WELCOME_MSG_IDS
      delete WELCOME_MSG_IDS[userId];

      const name = from.first_name || `@${from.username}`;
      newMessageMain(
        `<i>This message will be removed after five minutes.</i>\n-----\nWelcome ${name}! Its great that you are here. You can now send messages to the group. Please read the /chatrules`,
        300000
      );

      // Output welcome message to main group for a new user
      // logger.info(`Welcome action completed for user ${name} / ${userId}`);

      // Send message to main group
      const reply = `${from.first_name} can now send and read messages.`;
      ctx.answerCbQuery(reply);
    } catch (error) {
      // Log error
      logger.error(error.message);
      logger.error(error.stack);
    }
  });
}

/**
 * Gets a message that has been stored on disk for a max of 7.1 days.
 * @param {*} ctx
 * @param {*} action
 * @param {*} msgId
 * @returns
 */
async function getMessageFromDisk(ctx, action, msgId) {
  try {
    return JSON.parse(fs.readFileSync(`../telegram-messages/${msgId}.json`));
  } catch (error) {
    const reply = `Error: The disk message was not found. The action ${action} was aborted. ${error.message}`;
    ctx.answerCbQuery(reply);
    ctx.reply(reply);
    return undefined;
  }
}

module.exports = {
  startActionTimeout24,
  startActionTimeoutForever,
  startActionTimeoutClear,
  startActionRestoreMessage,
  startActionBanUser,
  startActionUnbanUser,
  startActionWelcome,
  WELCOME_MSG_IDS
};
