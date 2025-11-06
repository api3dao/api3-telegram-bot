/*
Get a chat object with user info by username

const targetUsername = '@SomeUser'; // Must include the '@'
try {
    // This resolves the username to a full chat object, which contains the ID
    const chat = await bot.telegram.getChat(targetUsername);
    const userId = chat.id;

    // Now you can use the userId to send messages reliably
    await bot.telegram.sendMessage(userId, 'Hello there!');

} catch (error) {
    console.error(`Could not find user ${targetUsername} or the bot is not in a shared chat with them.`, error);
}

*/
