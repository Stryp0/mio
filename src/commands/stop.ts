import { Message } from 'discord.js';
import { playbackHandler } from '../handlers/PlaybackHandler';
import { messageHandler } from '../handlers/MessageHandler';

export default {
    name: 'stop',
    description: 'Stops playback and clears the queue',
    requirements: {
        userInVoiceChannel: true,
        messageSentInGuild: true
    },
    execute: async (message: Message) => {
        try {
            playbackHandler.stopPlayback(message.guild);
            await messageHandler.replyToMessage(message, 'Playback stopped and queue cleared.', true);
        } catch (error) {
            if (error instanceof Error) {
                await messageHandler.replyToMessage(message, error.message, true);
            }
        }
    }
};