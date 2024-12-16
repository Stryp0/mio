import { Client, GatewayIntentBits } from 'discord.js';
import CommandHandler from './handlers/CommandHandler';
import { ConfigHandler } from './handlers/ConfigHandler';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent,
    ],
});

const commandHandler = new CommandHandler(client);
const configHandler = ConfigHandler.getInstance();

client.once('ready', () => {
    console.log(`Logged in as ${client.user?.tag}!`);
    console.log(`Bot is ready and serving in ${client.guilds.cache.size} servers!`);
    commandHandler.listen(); // Start listening for commands
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
