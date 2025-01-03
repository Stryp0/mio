import { Message } from 'discord.js';
import { playbackHandler } from '../handlers/PlaybackHandler';
import { messageHandler } from '../handlers/MessageHandler';

export default {
    name: 'skip',
    description: 'Skips the current song and plays the next one',
    requirements: {
        voiceChannel: true
    },
    execute: async (message: Message) => {
        if (!message.guild) {
            await messageHandler.replyToMessage(message, 'This command can only be used in a server!', true);
            return;
        }

        try {
            playbackHandler.skipSong(message.guild);
            await messageHandler.replyToMessage(message, 'Skipping to next song...', true);
        } catch (error) {
            if (error instanceof Error) {
                await messageHandler.replyToMessage(message, error.message, true);
            }
        }
    }
}
