import { Message } from 'discord.js';
import { queueHandler } from '../handlers/QueueHandler';
import { messageHandler } from '../handlers/MessageHandler';

export default {
    name: 'shuffle',
    description: 'Shuffles the songs in the queue',
    requirements: {
        userInVoiceChannel: true,
        messageSentInGuild: true
    },
    execute: async (message: Message) => {
        try {
            queueHandler.shuffleQueue(message.guild);
            await messageHandler.replyToMessage(message, 'Queue has been shuffled!', true);
        } catch (error) {
            if (error instanceof Error) {
                await messageHandler.replyToMessage(message, error.message, true);
            }
        }
    }
};