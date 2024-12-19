import { Message } from 'discord.js';
import { queueHandler } from '../handlers/QueueHandler';
import { configHandler } from '../handlers/ConfigHandler';

export default {
    name: 'remove',
    aliases: ['rm', 'delete', 'del', 'delete'],
    arguments: '<position>',
    description: 'Removes a song from the queue',
    execute: async (message: Message, args: string[]) => {
        if (!message.guild) {
            await message.reply('This command can only be used in a server!');
            return;
        }

        if (args.length !== 1) {
            await message.reply('Please provide the position of the song to remove (e.g., !remove 3).');
            return;
        }

        const index = parseInt(args[0]);

        if (isNaN(index)) {
            await message.reply('Please provide a valid number for the position.');
            return;
        }

        const queue = queueHandler.getQueue(message.guild);
        if (index <= 0 || index > queue.length) {
            await message.reply(`Please provide a position between 1 and ${queue.length}!`);
            return;
        }

        const removedSong = queueHandler.removeSong(message.guild, index);
        
        if (removedSong) {
            await message.reply(`Removed **${removedSong.song.Track}** from the queue.`);
        } else {
            await message.reply('Failed to remove song. Please check that the position is valid.');
        }

        // Delete the original message if configured to do so
        if (configHandler.DELETE_BOT_COMMANDS) {
            await message.delete();
        }
    }
}
