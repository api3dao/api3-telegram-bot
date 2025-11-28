const { bot } = require('./bot');
const fs = require('fs');
const logger = require('./logger');
const { WELCOME_MSG_IDS } = require('./actions');
const CONFIG = JSON.parse(fs.readFileSync('./config.json', 'utf-8'))[process.env.NODE_ENV];

async function processNewMember(ctx) {
  //console.log('----- START processNewMember -----');
  ctx.update.message.new_chat_members.forEach(async (user) => {
    try {
      const userId = user.id;

      // Check if the user is in the immunity list
      if (CONFIG.immunity.includes(user.username)) {
        console.log(`User ${user.username} is in the immunity list, skipping welcome message.`);
        return;
      }

      // Set them to restricted mode forever for now
      // It seems to important for browser users, web.telegram.org that we use await ctx.telegram.restrictChatMember
      // and not await bot.telegram.restrictChatMember
      //await ctx.telegram.restrictChatMember(CONFIG.chats.main, user.id, { permissions: { can_send_messages: false } });

      const timeoutMinutes = 2; // Unix timestamp for the timeout in minutes
      const until_date = Math.floor(Date.now() / 1000) + timeoutMinutes * 60;
      await ctx.telegram.restrictChatMember(CONFIG.chats.main, userId, {
        permissions: { can_send_messages: false },
        until_date: until_date
      });

      const inlineKeyboard = {
        inline_keyboard: [[{ text: `Click here to prove you're human`, callback_data: `action_welcome-${userId}` }]]
      };
      const res = await bot.telegram.sendMessage(
        CONFIG.chats.main,
        await getWelcomeMsgText(user.first_name, user.username),
        {
          parse_mode: 'HTML',
          disable_notification: true,
          reply_markup: inlineKeyboard
        }
      );
      // Add the msg id from action to WELCOME_MSG_IDS from actions.js for the message can be deleted
      // if the user clicks the "am human" button
      WELCOME_MSG_IDS[userId] = res.message_id;

      // Set timer to remove the Welcome message after 1 minute
      setTimeout(deleteWelcomeMessage, 60000, res.message_id, user);
    } catch (error) {
      bot.telegram.sendMessage(
        CONFIG.chats.admin,
        `Failed to welcome ${user.first_name} (${user.username}). Address this issue manually. DM them to be sure they are human, then remove the timeout.`
      );
      logger.error(error);
    }
  });
}

/**
 * Delete the welcome message which likely no longer exists.
 * This will fail silently if the user has already verified as a human.
 * If the user did not click the button attached to the Welcome message
 * then they get kicked.
 * @param {*} msgId
 */
async function deleteWelcomeMessage(msgId, user) {
  try {
    // If the message does not exist <promise>.catch fires
    bot.telegram
      .deleteMessage(CONFIG.chats.main, Number(msgId))
      .then(async () => {
        // Remove the msgId for the user from actions.js WELCOME_MSG_IDS json obj, may not exist
        delete WELCOME_MSG_IDS[user.id];

        // Kick the user from the group
        const resKick = await bot.telegram.unbanChatMember(CONFIG.chats.main, user.id);
        if (!resKick)
          throw new Error(`After closing the welcome message. Failed to kick user ${user.first_name} / ${user.id}`);
      })
      .catch(() => {
        // The user almost always clicked the "am human" button, harmless error either way
      });
  } catch (error) {
    console.error(error);
  }
}

/**
 * The text used in the welcome message
 * @param {*} first
 * @param {*} username
 * @returns
 */
async function getWelcomeMsgText(first, username) {
  const name = first || `@${username}`;
  return `Hey ${name}. Are you human? <b>You have 1 minute to prove it.</b> Otherwise rejoin again later.`;
}

module.exports = {
  processNewMember
};
