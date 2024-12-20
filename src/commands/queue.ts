import { Message, TextChannel } from 'discord.js';
import { queueHandler } from '../handlers/QueueHandler';
import { uiHandler } from '../handlers/UIHandler';

export default {
    name: 'queue',
    aliases: ['np', 'nowplaying', 'q'],
    description: 'Displays the currently playing song and queue',
    altDescription: 'This message will auto-update, and has useful buttons to control playback',
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
                await uiHandler.displayQueue(message.channel, message.guild);
            }
        } catch (error) {
            if (error instanceof Error) {
                await message.reply(error.message);
            }
        }
    }
}
