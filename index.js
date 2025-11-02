/*
 * TELEGRAM BOT SERVER (Version 2.0 Feature)
 *
 * This is your "robot at the front door."
 *
 * Its only job is to listen for a user to type "/start" in your bot's chat.
 * When it hears "/start", it replies with a "Welcome" message and
 * your custom inline keyboard buttons.
 */

// 1. Import the libraries we need
// We're using 'telegraf', a popular library for making Telegram bots
const { Telegraf, Markup } = require("telegraf");

// 2. Get your Bot's "Secret Key" (Token)
//    You get this from @BotFather.
//    You must add this to your "Environment Variables" on your server.
const BOT_TOKEN = process.env.BOT_TOKEN;

// 3. Get your Mini App's URL
//    This is the GitHub Pages link to your taskverse-app.html file.
//    You must add this to your "Environment Variables" on your server.
const WEB_APP_URL = process.env.WEB_APP_URL;

// Check if the keys are missing
if (!BOT_TOKEN || !WEB_APP_URL) {
  console.error(
    "ERROR: BOT_TOKEN and WEB_APP_URL must be set in your environment variables."
  );
  process.exit(1);
}

// 4. Create your bot
const bot = new Telegraf(BOT_TOKEN);

// 5. Define the "Welcome" Message
//    This is the text that gets sent with your buttons.
const welcomeMessage = `
👋 *Welcome to kkoin earner!*

The best place to earn $KKoin tokens by completing simple tasks.

*🚀 Click "Open App" to start earning!*
`;

// 6. Define the "Inline Keyboard" (Your Buttons)
//    This creates the buttons that attach to the welcome message.
const inlineKeyboard = Markup.inlineKeyboard([
  // Row 1: The "Open App" button
  // This button is special: it launches your Mini App
  [Markup.button.webApp("🚀 Open App", WEB_APP_URL)],

  // Row 2: Your support and channel links
  [
    Markup.button.url("💬 Support", "https://t.me/kkoinearner_support"),
    Markup.button.url("📣 Channel", "https://t.me/kkoinearner"),
  ],
]);

// 7. Set up the "/start" command listener
//    This tells the bot what to do when someone types "/start"
bot.start((ctx) => {
  try {
    // Reply to the user with:
    // 1. The welcomeMessage
    // 2. The inlineKeyboard
    // 3. 'MarkdownV2' mode to make the text bold.
    ctx.replyWithMarkdownV2(welcomeMessage, inlineKeyboard);
  } catch (e) {
    console.error("Error sending start message:", e);
  }
});

// 8. Start the server
//    This tells your bot to start listening for messages
try {
  bot.launch();
  console.log("Bot server started successfully!");
} catch (e) {
  console.error("Error starting bot server:", e);
}

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

