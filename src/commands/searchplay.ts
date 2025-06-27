import { Message } from 'discord.js';
import { google, youtube_v3 } from 'googleapis';
import { configHandler } from '../handlers/ConfigHandler';
import { messageHandler } from '../handlers/MessageHandler';
import { queueHandler } from '../handlers/QueueHandler';

async function searchYouTubeMusic(query: string): Promise<{ url: string; title: string; } | null> {
    try {
        const youtube = google.youtube({
            version: 'v3',
            auth: configHandler.YOUTUBE_API_KEY
        });

        const searchParams: youtube_v3.Params$Resource$Search$List = {
            part: ['snippet'],
            q: query + " audio",
            maxResults: 1,
            type: ['video'],
            videoCategoryId: '10'
        };

        const searchResponse = await youtube.search.list(searchParams);

        if (!searchResponse.data.items || searchResponse.data.items.length === 0) {
            return null;
        }

        const firstResult = searchResponse.data.items[0];
        const videoId = firstResult.id?.videoId;
        const videoTitle = firstResult.snippet?.title;

        if (videoId && videoTitle) {
            return {
                url: `https://www.youtube.com/watch?v=${videoId}`,
                title: videoTitle
            };
        }
        return null;
    } catch (error) {
        console.error('Error searching YouTube Music:', error);
        return null;
    }
}

export default {
    name: 'searchplay',
    aliases: ['sp'],
    arguments: '<search query>',
    description: 'Searches YouTube, prefers Music, for a song and plays the first result.',
    requirements: {
        userInVoiceChannel: true,
        messageSentInGuild: true
    },
    async execute(message: Message, args: string[]) {
        if (!args.length) {
            return messageHandler.replyToMessage(message, 'Please provide a search query!', true);
        }

        let desiredPosition: number | null = null;
        if (args.length >= 2) {
            const maybeNumber = parseInt(args[args.length - 1]);
            if (!isNaN(maybeNumber) && maybeNumber > 0) {
                desiredPosition = maybeNumber;
                args = args.slice(0, -1);
            }
        }

        const query = args.join(' ');
        const loadingMsg = await messageHandler.replyToMessage(message, `🔎 Searching YouTube Music for "${query}"...`);

        try {
            const searchResult = await searchYouTubeMusic(query);

            if (!searchResult) {
                return messageHandler.editReply(loadingMsg, 'No music results found for your query.', true);
            }

            if (!message.guild || !message.member) {
                console.error('Guild or member is null in searchplay command.');
                return messageHandler.editReply(loadingMsg, 'An error occurred: Could not identify server or user.', true);
            }

            const { url, title } = searchResult;
            await messageHandler.editReply(loadingMsg, `Found "${title}". Adding to queue...`);
            
            const queueAddResult = await queueHandler.addLinkToQueue(message.guild, url, message.author);

            if (!queueAddResult.metadata) {
                await messageHandler.editReply(loadingMsg, `Failed to add "${title}" to the queue.`, true);
                return;
            }

            const queue = queueHandler.getQueue(message.guild);

            if (desiredPosition !== null && desiredPosition < queue.length - 1) {
                const fromIndex = queue.length - 1;
                const toIndex = desiredPosition;
                const moved = queueHandler.moveSong(message.guild, fromIndex, toIndex);
                if (moved) {
                    await messageHandler.editReply(loadingMsg, `**${queueAddResult.metadata.Track}** added to queue and moved to position ${desiredPosition}!`, true);
                    return;
                }
            }
            if (queue.length <= 1) { 
                await messageHandler.editReply(loadingMsg, `**${queueAddResult.metadata.Track}** added to queue and will start playing shortly!`, true);
            } else {
                const position = queue.findIndex(item => item.song.Link === url); 
                await messageHandler.editReply(loadingMsg, `**${queueAddResult.metadata.Track}** added to queue at position ${position}!`, true);
            }

            queueAddResult.downloadPromise?.catch(error => {
                console.error('Error downloading song in searchplay:', error);
            });

        } catch (error) {
            console.error('Error in searchplay command:', error);
            await messageHandler.editReply(loadingMsg, 'An error occurred while trying to search and play the song.', true);
        }
    }
};
