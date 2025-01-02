import { Message } from 'discord.js';
import { queueHandler } from '../handlers/QueueHandler';
import { MessageHandler, messageHandler } from '../handlers/MessageHandler';
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
    name: 'playnext',
    aliases: ['next', 'pn', 'n'],
    arguments: '<YouTube link>',
    description: 'Adds a song to play next in the queue',
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
            const loadingMsg = await messageHandler.replyToMessage(message, 'Adding song to play next...');
            const result = await queueHandler.addLinkToQueue(message.guild, cleanUrl, message.author);

            if (!result.metadata) {
                await messageHandler.editReply(loadingMsg,'Failed to add song to queue.', true);
                return;
            }

            // Get the current queue length and move the newly added song to position 1 (right after currently playing)
            const queue = queueHandler.getQueue(message.guild);

            if (queue.length > 2) {
                const success = queueHandler.moveSong(message.guild, queue.length - 1, 1);

                if (success) {
                    await messageHandler.editReply(loadingMsg,'**${result.metadata.Track}** will play next!', true);
                } else {
                    // This should literally never happen
                    await messageHandler.editReply(loadingMsg,'**${result.metadata.Track}** added to queue, but couldn\'t move it to play next.', true);
                }
            } else {
                await messageHandler.editReply(loadingMsg,'**${result.metadata.Track}** will play next!', true);
            }

            // Wait for download to complete in the background
            result.downloadPromise.catch(error => {
                console.error('Error downloading song:', error);
            });
        } catch (error) {
            await messageHandler.replyToMessage(message, 'Sorry, the link seems to be invalid. If you are sure it is correct, please try again.', true);
        }
    }
}
