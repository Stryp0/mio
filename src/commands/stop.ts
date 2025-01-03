import { Message } from 'discord.js';
import { playbackHandler } from '../handlers/PlaybackHandler';
import { messageHandler } from '../handlers/MessageHandler';

export default {
    name: 'stop',
    description: 'Stops playback and clears the queue',
    requirements: {
        voiceChannel: true
    },
    execute: async (message: Message) => {
        if (!message.guild) {
            await messageHandler.replyToMessage(message, 'This command can only be used in a server!', true);
            return;
        }

        try {
            playbackHandler.stopPlayback(message.guild);
            await messageHandler.replyToMessage(message, 'Playback stopped and queue cleared.', true);
        } catch (error) {
            if (error instanceof Error) {
                await messageHandler.replyToMessage(message, error.message, true);
            }
        }
    }
}
