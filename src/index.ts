import { Client, GatewayIntentBits } from 'discord.js';
import { commandHandler } from './handlers/CommandHandler';
import { configHandler } from './handlers/ConfigHandler';
import { uiHandler } from './handlers/UIHandler';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent,
    ],
});

commandHandler.initialize(client);

client.once('ready', () => {
    console.log(`Logged in as ${client.user?.tag}!`);
    console.log(`Bot is ready and serving in ${client.guilds.cache.size} servers!`);
    commandHandler.listen(); // Start listening for commands
});

// Handle button interactions
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    await uiHandler.handleButtonInteraction(interaction);
});

// Error handling
client.on('error', (error) => {
    console.error('Discord client error:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
});

// Verifying environment variables
const token = configHandler.DISCORD_TOKEN;

// Login to Discord
client.login(token).catch(error => {
    console.error('Failed to login:', error);
    process.exit(1);
});
