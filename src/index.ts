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

// Verifying environment variables
const token = configHandler.DISCORD_TOKEN;

// Login to Discord
client.login(token).catch(error => {
    console.error('Failed to login:', error);
    process.exit(1);
});
