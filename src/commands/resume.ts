import { Message } from 'discord.js';
import { playbackHandler } from '../handlers/PlaybackHandler';

export default {
    name: 'resume',
    description: 'Resumes the paused playback',
    execute: async (message: Message) => {
        if (!message.guild) {
            await message.reply('This command can only be used in a server!');
            return;
        }

        try {
            const resumed = playbackHandler.resumePlayback(message.guild);
            if (resumed) {
                await message.reply('Playback resumed.');
            } else {
                await message.reply('Failed to resume playback. The player might not be paused.');
            }
        } catch (error) {
            if (error instanceof Error) {
                await message.reply(error.message);
            }
        }
    }
}
