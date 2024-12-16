import { Message, TextChannel } from 'discord.js';
import { queueHandler } from '../handlers/QueueHandler';
import { uiHandler } from '../handlers/UIHandler';

export default {
    name: 'queue',
    aliases: ['np', 'nowplaying', 'q'],
    description: 'Display the current song and queue',
    execute: async (message: Message) => {
        if (!message.guild) {
            await message.reply('This command can only be used in a server!');
            return;
        }

        if (!(message.channel instanceof TextChannel)) {
            await message.reply('This command can only be used in text channels!');
            return;
        }

        try {
            const currentSong = queueHandler.getCurrentQueueItem(message.guild);
            if (!currentSong) {
                await message.reply('There is nothing playing!');
            } else {
                await uiHandler.displayNowPlaying(message.guild, message.channel, currentSong);
            }
        } catch (error) {
            if (error instanceof Error) {
                await message.reply(error.message);
            }
        }
    }
}
