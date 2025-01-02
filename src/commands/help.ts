import { Message, EmbedBuilder } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { configHandler } from '../handlers/ConfigHandler';
import { messageHandler } from '../handlers/MessageHandler';

export default {
    name: 'help',
    aliases: ['h', 'commands', 'cmds'],
    description: 'Shows all available commands and their usage',
    execute: async (message: Message) => {
        if (!message.guild) {
            await messageHandler.replyToMessage(message, 'This command can only be used in a server!', true);
            return;
        }

        const commandsPath = path.join(__dirname);
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.ts'));

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Available Commands')
            .setDescription('Here are all the available commands:');

        const prefix = configHandler.getGuildSetting(message.guild, 'COMMAND_PREFIX', 'string');

        for (const file of commandFiles) {
            const command = require(`./${file}`).default;
            const aliases = command.aliases ? ` *(${command.aliases.map(alias => `${prefix}${alias}`).join(', ')})*` : '';
            const fieldName = `${prefix}${command.name}${command.arguments ? ` ${command.arguments}` : ''}${aliases}`;
            const fieldValue = `${command.description || 'No description available'}\n${command.altDescription ? `*${command.altDescription}*` : ''}`;
            embed.addFields({ name: fieldName, value: fieldValue });
        }

        embed.setFooter({ text: `Use ${prefix} prefix before each command` });

        await messageHandler.replyToMessage(message, { embeds: [embed] });
        messageHandler.deleteMessage(message);
    }
}