import { Message } from 'discord.js';
import { queueHandler } from '../handlers/QueueHandler';
import { configHandler } from '../handlers/ConfigHandler';
import { messageHandler } from '../handlers/MessageHandler';

export default {
    name: 'move',
    aliases: ['mv'],
    arguments: '<current position> <target position>',
    description: 'Moves a song to a different position in the queue',
    altDescription: 'All other songs will descend in position',
    requirements: {
        userInVoiceChannel: true,
        messageSentInGuild: true
    },
    execute: async (message: Message, args: string[]) => {

        if (args.length !== 2) {
            await messageHandler.replyToMessage(message, `Please provide both the current position and the target position (e.g., ${configHandler.getGuildSetting(message.guild, 'COMMAND_PREFIX', 'string')}move 3 1).`, true);
            return;
        }

        const fromIndex = parseInt(args[0]);
        const toIndex = parseInt(args[1]);

        if (isNaN(fromIndex) || isNaN(toIndex)) {
            await messageHandler.replyToMessage(message, 'Please provide valid numbers for the positions.', true);
            return;
        }

        const queue = queueHandler.getQueue(message.guild);
        if (fromIndex <= 0 || toIndex <= 0 || fromIndex > queue.length || toIndex > queue.length) {
            await messageHandler.replyToMessage(message, `Please provide positions between 1 and ${queue.length}!`, true);
            return;
        }

        const MovedSong = queue[fromIndex];
        const success = queueHandler.moveSong(message.guild, fromIndex, toIndex);
        
        if (success) {
            await messageHandler.replyToMessage(message, `Moved **${MovedSong.song.Track}** from position ${fromIndex} to ${toIndex}.`, true);
        } else {
            await messageHandler.replyToMessage(message, 'Failed to move song. Please check that the positions are valid.', true);
        }
    }
}
