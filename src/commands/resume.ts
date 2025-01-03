import { Message } from 'discord.js';
import { playbackHandler } from '../handlers/PlaybackHandler';
import { messageHandler } from '../handlers/MessageHandler';

export default {
    name: 'resume',
    description: 'Resumes the paused playback',
    requirements: {
        userInVoiceChannel: true,
        messageSentInGuild: true
    },
    execute: async (message: Message) => {
        try {
            const resumed = playbackHandler.resumePlayback(message.guild);
            if (resumed) {
            await messageHandler.replyToMessage(message, 'Playback resumed.', true);
            } else {
                await messageHandler.replyToMessage(message, 'Failed to resume playback. The player might not be paused.', true);
            }
        } catch (error) {
            if (error instanceof Error) {
                await messageHandler.replyToMessage(message, error.message);
            }
        }
    }
};