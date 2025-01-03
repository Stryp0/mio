import { Message } from 'discord.js';
import { queueHandler } from '../handlers/QueueHandler';
import { messageHandler } from '../handlers/MessageHandler';

export default {
    name: 'clear',
    description: 'Clears the queue',
    altDescription: 'Current song will finish playback',
    requirements: {
        voiceChannel: true
    },
    execute: async (message: Message) => {
        if (!message.guild) {
            await messageHandler.replyToMessage(message, 'This command can only be used in a server!', true);
            return;
        }

        try {
            queueHandler.clearQueueExceptCurrent(message.guild);
            await messageHandler.replyToMessage(message, 'Queue cleared. Current song will finish playback.', true);
        } catch (error) {
            if (error instanceof Error) {
                await messageHandler.replyToMessage(message, error.message);
            }
        }
    }
}
