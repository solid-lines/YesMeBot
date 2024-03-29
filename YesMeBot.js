const dotenv = require('dotenv');
const path = require('path');
var express = require("express");
var bodyParser = require("body-parser");
const logger = require('./logger');


//Imports required
const { BotFrameworkAdapter, ConversationState, MemoryStorage, UserState } = require('botbuilder');

// Import required bot configuration.
const { BotConfiguration } = require('botframework-config');

// This bot's main dialog.
const { YesMeBot } = require('./bot');

// Read botFilePath and botFileSecret from .env file
// Note: Ensure you have a .env file and include botFilePath and botFileSecret.
const ENV_FILE = path.join(__dirname, '.env');
dotenv.config({ path: ENV_FILE });

// bot name as defined in .bot file
// See https://aka.ms/about-bot-file to learn more about .bot file its use and bot configuration.
const BOT_CONFIGURATION = (process.env.environment);

// Creamos HTTP Server
const server = express();
server.use(bodyParser.urlencoded({ extended: false }));
server.use(bodyParser.json());
server.listen(process.env.port, "0.0.0.0", function () {
    logger.info(`\n${server.name} listening to ${server.url}`);
    logger.info(`\nGet Bot Framework Emulator: https://aka.ms/botframework-emulator`);
    logger.info(`\nTo talk to your bot, open simplePrompts.bot file in the Emulator`);
});

// .bot file path
const BOT_FILE = path.join(__dirname, (process.env.botFilePath || ''));

// Read bot configuration from .bot file.
let botConfig;
try {
    logger.info("BOTFILE:" + BOT_FILE);
    botConfig = BotConfiguration.loadSync(BOT_FILE, process.env.botFileSecret);
} catch (err) {
    logger.error("ERROR: " + err);
    logger.error(`\nError reading bot file. Please ensure you have valid botFilePath and botFileSecret set for your environment.`);
    logger.error(`\n - The botFileSecret is available under appsettings for your Azure Bot Service bot.`);
    logger.error(`\n - If you are running this bot locally, consider adding a .env file with botFilePath and botFileSecret.`);
    logger.error(`\n - See https://aka.ms/about-bot-file to learn more about .bot file its use and bot configuration.\n\n`);
    process.exit();
}

// Get bot endpoint configuration by service name
const endpointConfig = botConfig.findServiceByNameOrId(BOT_CONFIGURATION);

// Create adapter.
// See https://aka.ms/about-bot-adapter to learn more about .bot file its use and bot configuration.
const adapter = new BotFrameworkAdapter({
    appId: endpointConfig.appId,
    appPassword: endpointConfig.appPassword
});

// Create conversation and user state with in-memory storage provider.
const memoryStorage = new MemoryStorage();
const conversationState = new ConversationState(memoryStorage);
const userState = new UserState(memoryStorage);

const yesMeBot = new YesMeBot(conversationState, userState, endpointConfig);

// Catch-all for errors.
adapter.onTurnError = async (context, error) => {
    // This check writes out errors to log .vs. app insights.
    logger.error(`\n [onTurnError]: ${error}`);
    // Send a message to the user
    context.sendActivity(`Oops. Something went wrong!`);
    // Clear out state
    await conversationState.load(context);
    await conversationState.clear(context);
    await userState.load(context);
    await userState.clear(context);
    // Save state changes.
    await conversationState.saveChanges(context);
    await userState.saveChanges(context);
};

// Ruta de la pagina index
server.get("/", function (req, res) {
    res.send("YesMeBot Deployed!");
});

// Listen for incoming requests.
server.post('/api/messages', (req, res) => {
    logger.info("**** POST RECEIVED****");
    logger.info(req.body);
    logger.info("****************************");

    adapter.processActivity(req, res, async (context) => {
        // Route to main dialog.
        await yesMeBot.onTurn(context);
    });
});