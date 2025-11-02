// --- Telegram Bot and Secure Postback Server ---
// This file initializes a bot to send welcome messages
// AND runs a small web server (Express) to securely receive Monetag's
// Server-to-Server (S2S) postback, ensuring cheat-proof ad rewards.
// -----------------------------------------------------

const { Telegraf } = require('telegraf');
const express = require('express');
const bodyParser = require('body-parser');
// These modules are required for the live database connection
const { initializeApp, applicationDefault, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

// --- 1. CONFIGURATION & ENVIRONMENT VARIABLES ---

// Your Bot Token (From BotFather)
const BOT_TOKEN = process.env.BOT_TOKEN;
// Your Mini App URL (From GitHub Pages/Render)
const WEB_APP_URL = process.env.WEB_APP_URL;
// Your shared secret key (Must match the one you set in Monetag's Postback settings)
const REWARD_ENDPOINT_SECRET = process.env.REWARD_ENDPOINT_SECRET;
// Your Firebase Service Account Key (Base64 encoded string from your host's environment)
const FIREBASE_SERVICE_KEY = process.env.FIREBASE_SERVICE_KEY;

// Check for critical variables
if (!BOT_TOKEN || !WEB_APP_URL || !REWARD_ENDPOINT_SECRET || !FIREBASE_SERVICE_KEY) {
    console.error("CRITICAL ERROR: Missing one or more environment variables.");
    console.error("Required: BOT_TOKEN, WEB_APP_URL, REWARD_ENDPOINT_SECRET, FIREBASE_SERVICE_KEY.");
    // Exit if configuration is incomplete
    process.exit(1);
}

// --- 2. FIREBASE INITIALIZATION ---

// Decode the service key from base64 (used by some hosting providers like Render)
const serviceAccount = JSON.parse(Buffer.from(FIREBASE_SERVICE_KEY, 'base64').toString('ascii'));

// Initialize Firebase Admin SDK
initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();
const APP_ID = serviceAccount.project_id; // Using project ID as the app ID for nesting

// --- 3. TELEGRAM BOT SETUP (WELCOME MESSAGE) ---

const bot = new Telegraf(BOT_TOKEN);

// Handles the /start command, which is the user's first interaction.
bot.start((ctx) => {
    // Check if the /start command included a referral parameter
    const refCode = ctx.startPayload;
    if (refCode) {
        // Handle referral logic if needed, or simply pass the user to the app
        console.log(`New user referral detected: ${refCode}`);
    }

    // This creates the inline keyboard buttons for the welcome message
    const welcomeKeyboard = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '🚀 Open kkoin earner', web_app: { url: WEB_APP_URL } }
                ],
                [
                    { text: '📣 Join Our Channel', url: 'https://t.me/kkoinearner' },
                    { text: '💬 Contact Support', url: 'https://t.me/kkoinearner_support' }
                ]
            ]
        }
    };

    ctx.reply(`Welcome to the kkoin earner app! Tap the button below to start earning your $KKoin tokens right away.`, welcomeKeyboard);
});

// Launch the Telegram bot
bot.launch();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// --- 4. EXPRESS SERVER SETUP (POSTBACK LISTENER) ---

const app = express();
const PORT = process.env.PORT || 3000;

// Use body-parser middleware for JSON and URL-encoded bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

/**
 * Endpoint for Monetag's Server-to-Server (S2S) Postback.
 * This is the secure way to grant rewards.
 * Monetag calls this URL when a user successfully watches a rewarded ad.
 * URL: /monetag-reward?user_id=[USER_ID]&secret=[SECRET_PHRASE]&points=[POINTS]
 */
app.get('/monetag-reward', async (req, res) => {
    const { user_id, secret, points } = req.query;
    const rewardPoints = parseInt(points);

    // 1. SECURITY CHECK: Validate the secret key
    if (secret !== REWARD_ENDPOINT_SECRET) {
        console.warn(`SECURITY ALERT: Invalid secret key received from IP: ${req.ip}`);
        // Return 403 Forbidden to stop Monetag from retrying if the secret is wrong
        return res.status(403).send('Invalid secret.');
    }

    // 2. DATA VALIDATION: Check for necessary parameters
    if (!user_id || isNaN(rewardPoints) || rewardPoints <= 0) {
        return res.status(400).send('Invalid parameters.');
    }

    // 3. SECURE REWARD TRANSACTION
    const userDocRef = db.collection('artifacts').doc(APP_ID)
                        .collection('users').doc(user_id)
                        .collection('data').doc('profile');

    try {
        // Use a Firestore Transaction to ensure the operation is atomic (cheat-proof)
        await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userDocRef);

            if (!userDoc.exists) {
                // If the user somehow doesn't exist, create a new profile with the reward
                transaction.set(userDocRef, {
                    userId: user_id,
                    points: rewardPoints,
                    referrals: 0,
                    claimedTasks: [],
                    // Set a base ad watch date to prevent immediate ad grinding
                    lastAdWatchDate: new Date().toDateString(),
                    adsWatchedToday: 1, 
                    processingWithdrawal: false
                });
                console.log(`New user created and rewarded: ${user_id}`);
                return;
            }

            // User exists: safely update their points
            transaction.update(userDocRef, {
                points: FieldValue.increment(rewardPoints),
                // The client app handles adsWatchedToday and lastAdWatchDate for the UI.
                // For secure, postback-only reward, we just increment points here.
            });

            console.log(`User ${user_id} successfully rewarded ${rewardPoints} points via postback.`);
        });

        // 4. Send success response to Monetag
        res.status(200).send('Reward processed.');

    } catch (error) {
        console.error(`Postback transaction failed for user ${user_id}:`, error);
        // Send a temporary error response (500) so Monetag might retry later
        res.status(500).send('Server Error during reward transaction.');
    }
});

// Simple endpoint for checking server status
app.get('/', (req, res) => {
    res.send('kkoin earner Bot Server is running and listening for postbacks.');
});

// Start the Express server
app.listen(PORT, () => {
    console.log(`kkoin earner Postback Server running on port ${PORT}`);
});
