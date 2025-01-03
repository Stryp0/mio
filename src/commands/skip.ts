import { Message } from 'discord.js';
import { playbackHandler } from '../handlers/PlaybackHandler';
import { messageHandler } from '../handlers/MessageHandler';

export default {
    name: 'skip',
    description: 'Skips the current song and plays the next one',
    requirements: {
        userInVoiceChannel: true,
        messageSentInGuild: true
    },
    execute: async (message: Message) => {
        try {
            playbackHandler.skipSong(message.guild);
            await messageHandler.replyToMessage(message, 'Skipped current song.', true);
        } catch (error) {
            if (error instanceof Error) {
                await messageHandler.replyToMessage(message, error.message, true);
            }
        }
    }
};