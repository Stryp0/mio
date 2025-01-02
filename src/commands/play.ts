import { Message } from 'discord.js';
import { queueHandler } from '../handlers/QueueHandler';
import { messageHandler } from '../handlers/MessageHandler';

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
            await messageHandler.replyToMessage(message, 'This command can only be used in a server!', true);
            return;
        }

        if (args.length < 1) {
            await messageHandler.replyToMessage(message, 'Please provide a YouTube link to play!', true);
            return;
        }

        const link = args[0];
        const cleanUrl = validateAndCleanYouTubeUrl(link);

        if (!cleanUrl) {
            await messageHandler.replyToMessage(message, 'Please provide a valid YouTube URL!', true);
            return;
        }

        try {
            const loadingMsg = await messageHandler.replyToMessage(message, 'Adding song to queue...');
            const result = await queueHandler.addLinkToQueue(message.guild, cleanUrl, message.author);

            if (!result.metadata) {
                await messageHandler.editReply(loadingMsg, 'Failed to add song to queue.', true);
                return;
            }

            const queue = queueHandler.getQueue(message.guild);
            if (queue.length <= 1) {
                await messageHandler.editReply(loadingMsg, `**${result.metadata.Track}** added to queue and will start playing shortly!`, true);
            } else {
                const position = queue.length - 1;
                await messageHandler.editReply(loadingMsg, `**${result.metadata.Track}** added to queue at position ${position}!`, true);
            }

            result.downloadPromise.catch(error => {
                console.error('Error downloading song:', error);
            });
        } catch (error) {
            await messageHandler.replyToMessage(message, 'Sorry, the link seems to be invalid. If you are sure it is correct, please try again.', true);
        }
    }
}