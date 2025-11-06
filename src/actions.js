/*

https://hackage.haskell.org/package/telegram-bot-api-7.4.4/docs/Telegram-Bot-API-Methods-RestrictChatMember.html
Date when restrictions will be lifted for the user, unix time. If user is restricted for more 
than 366 days or less than 30 seconds from the current time, 
they are considered to be restricted forever.

 */

const { bot } = require('./bot');
const fs = require('fs');
const logger = require('./logger');
const { PERMISSIONS_TIMEOUT } = require('./permissions');
const CONFIG = JSON.parse(fs.readFileSync('./config.json', 'utf-8'))[process.env.NODE_ENV];

/**
 * Timeout 24 hours
 * @param {*} bot
 */
async function startActionTimeout24() {
  try {
    bot.action(/^action_timeout_24-(\d+)/, async (ctx) => {
      // console.log('>>> action_timeout_24');
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
        permissions: PERMISSIONS_TIMEOUT,
        until_date: until_date
      });

      // Send message to admin chat
      const reply = `User (${msg.from.first_name} / ${userId}) timeout set for 24 hours. The user can only read messages.`;
      ctx.answerCbQuery(reply);
      ctx.reply(reply);
    });
  } catch (error) {
    logger.error(error.message);
    logger.error(error.stack);
  }
}

/**
 * Timeout forever
 * @param {*} bot
 */
async function startActionTimeoutForever() {
  bot.action(/^action_timeout_forever-(\d+)/, async (ctx) => {
    try {
      // console.log('>>> action_timeout_forever');
      const msgId = ctx.match[1];

      // Get the message from disk
      // Without the message we cannot proceed
      const msg = await getMessageFromDisk(ctx, 'Timeout Forever', msgId);
      if (!msg) return;

      const userId = msg.from.id;
      const chatId = CONFIG.chats.main;

      // Set timeout
      await ctx.telegram.restrictChatMember(chatId, userId, PERMISSIONS_TIMEOUT);

      // Send message to admin chat
      const reply = `User (${msg.from.first_name} / ${userId}) timeout set for forever. The user can only read messages.`;
      ctx.answerCbQuery(reply);
      ctx.reply(reply);
    } catch (error) {
      // Send message to admin chat
      ctx.answerCbQuery(`FAILED`);
      ctx.reply(`Set timeout forever. Please notify bot developer.`);
      // Log error
      logger.error(error.message);
      logger.error(error.stack);
    }
  });
}

/**
 * Clear timeout
 * @param {*} bot
 */
async function startActionTimeoutClear() {
  bot.action(/^action_timeout_clear-(\d+)/, async (ctx) => {
    try {
      // console.log('>>> action_timeout_clear');
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
      ctx.reply(reply);
    } catch (error) {
      // Send message to admin chat
      ctx.answerCbQuery(`FAILED`);
      ctx.reply(`Clear timeout failed. Please notify bot developer.`);
      // Log error
      logger.error(error.message);
      logger.error(error.stack);
    }
  });
}

/**
 * Restore message
 * @param {*} bot
 */
async function startActionRestoreMessage() {
  bot.action(/^action_restore_message-(\d+)/, async (ctx) => {
    try {
      // console.log('>>> action_restore_message');
      const msgId = ctx.match[1];

      // Get the message from disk
      // Without the message we cannot proceed
      const msg = await getMessageFromDisk(ctx, 'Restore Message', msgId);
      if (!msg) return;

      const userId = msg.from.id;
      const chatId = CONFIG.chats.main;

      // Send user's message back to the main chat
      bot.telegram.sendMessage(
        chatId,
        `An admin told me to re-post a message I had removed.\n-----\nFrom username: @${msg.from.username} / ${msg.from.first_name}\n${msg.text}`
      );

      // Clear timeout
      await bot.telegram.restrictChatMember(chatId, userId, { permissions: { can_send_messages: true } });

      // Send message to admin chat
      const reply = `User (${msg.from.first_name} / ${userId}) message restored and timeout (if any) removed.  The user can send and read messages.`;
      ctx.answerCbQuery(reply);
      ctx.reply(reply);
    } catch (error) {
      // Send message to admin chat
      ctx.answerCbQuery(`FAILED`);
      ctx.reply(`Restore message failed. Please notify bot developer`);
      // Log error
      logger.error(error.message);
      logger.error(error.stack);
    }
  });
}

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
  startActionRestoreMessage
};
