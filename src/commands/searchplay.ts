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
            q: query,
            maxResults: 1,
            type: ['video'],
            videoCategoryId: '10', // Category ID for Music
            regionCode: 'US' // Optional: helps in getting relevant categories if needed elsewhere, but good for consistency
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

        const query = args.join(' ');
        const loadingMsg = await messageHandler.replyToMessage(message, `🔎 Searching YouTube Music for "${query}"...`);

        try {
            const searchResult = await searchYouTubeMusic(query);

            if (!searchResult) {
                return messageHandler.editReply(loadingMsg, 'No music results found for your query.', true);
            }

            // Ensure message.guild and message.member are not null
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
            // If the queue length is 1, it means this song is the first and will start playing.
            // The queueHandler.addLinkToQueue already handles starting playback if it's the first song.
            if (queue.length <= 1) { 
                await messageHandler.editReply(loadingMsg, `**${queueAddResult.metadata.Track}** added to queue and will start playing shortly!`, true);
            } else {
                // The queue is 0-indexed, so findIndex will give the correct index.
                // We display position as index + 1 for user-friendliness.
                const position = queue.findIndex(item => item.song.Link === url); 
                await messageHandler.editReply(loadingMsg, `**${queueAddResult.metadata.Track}** added to queue at position ${position + 1}!`, true);
            }

            // The downloadPromise is handled by queueHandler/playbackHandler, no need to await here
            queueAddResult.downloadPromise?.catch(error => {
                console.error('Error downloading song in searchplay:', error);
                // Optionally, notify the user if download fails, though this might be handled globally or by PlaybackHandler
            });

        } catch (error) {
            console.error('Error in searchplay command:', error);
            await messageHandler.editReply(loadingMsg, 'An error occurred while trying to search and play the song.', true);
        }
    }
};
