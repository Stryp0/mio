import { Message } from 'discord.js';
import { playbackHandler } from '../handlers/PlaybackHandler';

export default {
    name: 'skip',
    description: 'Skip the current song and play the next one',
    execute: async (message: Message) => {
        if (!message.guild) {
            await message.reply('This command can only be used in a server!');
            return;
        }

        try {
            playbackHandler.skipSong(message.guild);
            await message.reply('Skipping to next song...');
        } catch (error) {
            if (error instanceof Error) {
                await message.reply(error.message);
            }
        }
    }
}
