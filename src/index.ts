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
        GatewayIntentBits.GuildMessageReactions,
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

// Handle reaction events
client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return; // Ignore bot reactions
    
    try {
        // When we receive a reaction we check if the message needs to be fetched
        if (reaction.partial) {
            await reaction.fetch();
        }

        const guild = reaction.message.guild;
        if (!guild) return;

        await uiHandler.handleReactionAdd(
            guild,
            reaction.message.id,
            reaction.emoji.name ?? '',
            user.id
        );
    } catch (error) {
        console.error('Error handling reaction:', error);
    }
});

// Error handling
client.on('error', (error) => {
    console.error('Discord client error:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
});

// Graceful shutdown handler
const handleGracefulShutdown = async (signal: string) => {
    console.log(`\n${signal} signal received. Starting graceful shutdown...`);
    
    try {
        // Set bot status to "invisible" before disconnecting
        await client.user?.setStatus('invisible');
        console.log('Bot status set to invisible');
        
        // Clean up all voice connections
        const { playbackHandler } = require('./handlers/PlaybackHandler');
        const cleanupCount = playbackHandler.cleanupAllConnections();
        console.log(`Cleaned up ${cleanupCount} voice connections`);
        
        // Destroy the client connection
        console.log('Destroying Discord client connection...');
        await client.destroy();
        console.log('Discord client connection destroyed successfully');
        
        // Exit process with success code
        console.log('Shutdown complete. Exiting process...');
        process.exit(0);
    } catch (error) {
        console.error('Error during graceful shutdown:', error);
        process.exit(1);
    }
};

// Register shutdown handlers
process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));
process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));

// Verifying environment variables
const token = configHandler.DISCORD_TOKEN;

// Login to Discord
client.login(token).catch(error => {
    console.error('Failed to login:', error);
    process.exit(1);
});

export { client };
