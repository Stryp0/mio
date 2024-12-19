import { Message } from 'discord.js';
import { playbackHandler } from '../handlers/PlaybackHandler';

export default {
    name: 'stop',
    description: 'Stops playback and clears the queue',
    execute: async (message: Message) => {
        if (!message.guild) {
            await message.reply('This command can only be used in a server!');
            return;
        }

        try {
            playbackHandler.stopPlayback(message.guild);
            await message.reply('Playback stopped and queue cleared.');
        } catch (error) {
            if (error instanceof Error) {
                await message.reply(error.message);
            }
        }
    }
}
