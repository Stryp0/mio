import { Message } from 'discord.js';
import { playbackHandler } from '../handlers/PlaybackHandler';
import { messageHandler } from '../handlers/MessageHandler';

export default {
    name: 'pause',
    description: 'Pauses the playback',
    requirements: {
        userInVoiceChannel: true,
        messageSentInGuild: true
    },
    execute: async (message: Message) => {
        try {
            const paused = playbackHandler.pausePlayback(message.guild);
            if (paused) {
                await messageHandler.replyToMessage(message, 'Playback paused.', true);
            } else {
                await messageHandler.replyToMessage(message, 'Failed to pause playback. The player might already be paused.', true);
            }
        } catch (error) {
            if (error instanceof Error) {
                await messageHandler.replyToMessage(message, error.message);
            }
        }
    }
}
