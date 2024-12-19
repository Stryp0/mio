import { Message } from 'discord.js';
import { queueHandler } from '../handlers/QueueHandler';
import { configHandler } from '../handlers/ConfigHandler';

export default {
    name: 'move',
    aliases: ['mv'],
    arguments: '<current position> <target position>',
    description: 'Moves a song to a different position in the queue',
    altDescription: 'All other songs will descend in position',
    execute: async (message: Message, args: string[]) => {
        if (!message.guild) {
            await message.reply('This command can only be used in a server!');
            return;
        }

        if (args.length !== 2) {
            await message.reply('Please provide both the current position and the target position (e.g., !move 3 1).');
            return;
        }

        const fromIndex = parseInt(args[0]);
        const toIndex = parseInt(args[1]);

        if (isNaN(fromIndex) || isNaN(toIndex)) {
            await message.reply('Please provide valid numbers for the positions.');
            return;
        }

        const queue = queueHandler.getQueue(message.guild);
        if (fromIndex <= 0 || toIndex <= 0 || fromIndex > queue.length || toIndex > queue.length) {
            await message.reply(`Please provide positions between 1 and ${queue.length}!`);
            return;
        }

        const MovedSong = queue[fromIndex];
        const success = queueHandler.moveSong(message.guild, fromIndex, toIndex);
        
        if (success) {
            await message.reply(`Moved **${MovedSong.song.Track}** from position ${fromIndex} to ${toIndex}.`);
        } else {
            await message.reply('Failed to move song. Please check that the positions are valid.');
        }

        // Delete the original message if configured to do so
        if (configHandler.DELETE_BOT_COMMANDS) {
            await message.delete();
        }
    }
}
