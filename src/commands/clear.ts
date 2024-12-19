import { Message } from 'discord.js';
import { queueHandler } from '../handlers/QueueHandler';

export default {
    name: 'clear',
    description: 'Clears the queue',
    altDescription: 'Current song will finish playback',
    execute: async (message: Message) => {
        if (!message.guild) {
            await message.reply('This command can only be used in a server!');
            return;
        }

        try {
            queueHandler.clearQueueExceptCurrent(message.guild);
            await message.reply('Queue cleared. Current song will finish playback.');
        } catch (error) {
            if (error instanceof Error) {
                await message.reply(error.message);
            }
        }
    }
}
