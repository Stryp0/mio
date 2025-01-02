import { Message } from 'discord.js';
import { queueHandler } from '../handlers/QueueHandler';
import { configHandler } from '../handlers/ConfigHandler';
import { messageHandler } from '../handlers/MessageHandler';

export default {
    name: 'remove',
    aliases: ['rm', 'delete', 'del', 'delete'],
    arguments: '<position>',
    description: 'Removes a song from the queue',
    execute: async (message: Message, args: string[]) => {
        if (!message.guild) {
            await messageHandler.replyToMessage(message, 'This command can only be used in a server!', true);
            return;
        }

        if (args.length !== 1) {
            await messageHandler.replyToMessage(message, 'Please provide the position of the song to remove (e.g., !remove 3).', true);
            return;
        }

        const index = parseInt(args[0]);

        if (isNaN(index)) {
            await messageHandler.replyToMessage(message, 'Please provide a valid number for the position.', true);
            return;
        }

        const queue = queueHandler.getQueue(message.guild);
        if (index <= 0 || index > queue.length) {
            await messageHandler.replyToMessage(message, `Please provide a position between 1 and ${queue.length}!`, true);
            return;
        }

        const removedSong = queueHandler.removeSong(message.guild, index);
        
        if (removedSong) {
            await messageHandler.replyToMessage(message, `Removed **${removedSong.song.Track}** from the queue.`, true);
        } else {
            await messageHandler.replyToMessage(message, 'Failed to remove song. Please check that the position is valid.', true);
        }
    }
}
