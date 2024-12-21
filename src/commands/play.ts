import { Message } from 'discord.js';
import { queueHandler } from '../handlers/QueueHandler';
import { playbackHandler } from '../handlers/PlaybackHandler';
import { configHandler } from '../handlers/ConfigHandler';

function validateAndCleanYouTubeUrl(url: string): string | null {
    const pattern = /(?:https?:\/\/)?(?:www.)?youtu(?:be\.com|\.be)\/(?:watch\?v=)?(.+?)(?:(\?|&| ).+)?$/;
    const matches = url.match(pattern);

    if (matches && matches[1]) {
        return `https://www.youtube.com/watch?v=${matches[1].trim()}`;
    }
    return null;
}

export default {
    name: 'play',
    aliases: ['p'],
    arguments: '<YouTube link>',
    description: 'Plays a song from a YouTube link',
    altDescription: 'If playback is already ongoing, adds it to the end of the queue',
    execute: async (message: Message, args: string[]) => {
        if (!message.guild || !message.member) {
            await message.reply('This command can only be used in a server!');
            return;
        }

        if (args.length < 1) {
            await message.reply('Please provide a YouTube link to play!');
            return;
        }

        const link = args[0];
        const cleanUrl = validateAndCleanYouTubeUrl(link);

        if (!cleanUrl) {
            await message.reply('Please provide a valid YouTube URL!');
            return;
        }

        try {
            const loadingMsg = await message.reply('Adding song to queue...');
            const result = await queueHandler.addLinkToQueue(message.guild, cleanUrl, message.author);

            if (!result.metadata) {
                await loadingMsg.edit('Failed to add song to queue.');
                return;
            }

            const queue = queueHandler.getQueue(message.guild);
            if (queue.length <= 1) {
                await loadingMsg.edit(`**${result.metadata.Track}** added to queue and will start playing shortly!`);
            } else {
                const position = queue.length - 1;
                await loadingMsg.edit(`**${result.metadata.Track}** added to queue at position ${position}!`);
            }

            // Wait for download to complete in the background
            result.downloadPromise.catch(error => {
                console.error('Error downloading song:', error);
            });
        } catch (error) {
            await message.reply('Sorry, the link seems to be invalid. If you are sure it is correct, please try again.');
        }
        // Delete the original message if configured to do so
        if (configHandler.DELETE_BOT_COMMANDS) {
            await message.delete();
        }
    }
}