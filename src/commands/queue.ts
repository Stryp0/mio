import { Message, TextChannel } from 'discord.js';
import { queueHandler } from '../handlers/QueueHandler';
import { uiHandler } from '../handlers/UIHandler';
import { messageHandler } from '../handlers/MessageHandler';

export default {
    name: 'queue',
    aliases: ['np', 'nowplaying', 'q'],
    description: 'Displays the currently playing song and queue',
    altDescription: 'This message will auto-update, and has useful buttons to control playback',
    requirements: {
        voiceChannel: true
    },
    execute: async (message: Message) => {
        if (!message.guild) {
            await messageHandler.replyToMessage(message, 'This command can only be used in a server!', true);
            return;
        }

        if (!(message.channel instanceof TextChannel)) {
            await messageHandler.replyToMessage(message, 'This command can only be used in text channels!', true);
            return;
        }

        try {
            const currentSong = queueHandler.getCurrentQueueItem(message.guild);
            if (!currentSong) {
                await messageHandler.replyToMessage(message, 'There is nothing playing!', true);
            } else {
                await uiHandler.displayQueue(message.channel, message.guild);
                await messageHandler.deleteMessage(message);
            }
        } catch (error) {
            if (error instanceof Error) {
                await messageHandler.replyToMessage(message, error.message, true);
            }
        }
    }
}
