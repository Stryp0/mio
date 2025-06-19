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
    requirements: {
        userInVoiceChannel: true,
        messageSentInGuild: true
    },
    execute: async (message: Message, args: string[]) => {
        if (args.length < 1) {
            await messageHandler.replyToMessage(message, 'Please provide a YouTube link to play!', true);
            return;
        }

            const link = args[0];
            let desiredPosition: number | null = null;
            if (args.length >= 2) {
                const maybeNumber = parseInt(args[1]);
                if (!isNaN(maybeNumber) && maybeNumber > 0) {
                    desiredPosition = maybeNumber;
                }
            }
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

            if (desiredPosition !== null && desiredPosition < queue.length - 1) {
                const fromIndex = queue.length - 1;
                const toIndex = desiredPosition;

                const moved = queueHandler.moveSong(message.guild, fromIndex, toIndex);
                if (moved) {
                    await messageHandler.editReply(loadingMsg, `**${result.metadata.Track}** added to queue and moved to position ${desiredPosition}!`, true);
                    return;
                }
            }
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