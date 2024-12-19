import { Message } from 'discord.js';
import { playbackHandler } from '../handlers/PlaybackHandler';

export default {
    name: 'pause',
    description: 'Pauses the playback',
    execute: async (message: Message) => {
        if (!message.guild) {
            await message.reply('This command can only be used in a server!');
            return;
        }

        try {
            const paused = playbackHandler.pausePlayback(message.guild);
            if (paused) {
                await message.reply('Playback paused.');
            } else {
                await message.reply('Failed to pause playback. The player might already be paused.');
            }
        } catch (error) {
            if (error instanceof Error) {
                await message.reply(error.message);
            }
        }
    }
}
