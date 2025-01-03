import { Message } from 'discord.js';
import { queueHandler } from '../handlers/QueueHandler';
import { messageHandler } from '../handlers/MessageHandler';

export default {
    name: 'clear',
    description: 'Clears the queue',
    altDescription: 'Current song will finish playback',
    requirements: {
        userInVoiceChannel: true,
        messageSentInGuild: true
    },
    execute: async (message: Message) => {
        try {
            queueHandler.clearQueueExceptCurrent(message.guild);
            await messageHandler.replyToMessage(message, 'Queue cleared. Current song will finish playback.', true);
        } catch (error) {
            if (error instanceof Error) {
                await messageHandler.replyToMessage(message, error.message);
            }
        }
    }
};