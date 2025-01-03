import { Message } from 'discord.js';
import { queueHandler } from '../handlers/QueueHandler';
import { messageHandler } from '../handlers/MessageHandler';
import { configHandler } from '../handlers/ConfigHandler';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

function validateAndCleanYouTubePlaylistUrl(url: string): string | null {
    const pattern = /(?:https?:\/\/)?(?:www\.|music\.)?youtube\.com\/(?:.*?(?:\?|&)list=|browse\/VL)([a-zA-Z0-9_-]+)/;
    const matches = url.match(pattern);

    if (matches && matches[1]) {
        return `https://www.youtube.com/playlist?list=${matches[1].trim()}`;
    }
    return null;
}

async function getPlaylistVideos(playlistUrl: string): Promise<string[]> {
    try {
        // Use yt-dlp to get video URLs from playlist
        const cmd = `yt-dlp --flat-playlist --get-id ${playlistUrl}`;
        const { stdout } = await execPromise(cmd);
        
        // Split output into individual video IDs and convert to full URLs
        return stdout.split('\n')
            .filter(id => id.trim()) // Remove empty lines
            .map(id => `https://www.youtube.com/watch?v=${id.trim()}`);
    } catch (error) {
        console.error('Error fetching playlist:', error);
        throw new Error('Failed to fetch playlist videos');
    }
}

export default {
    name: 'playlist',
    aliases: ['pl', 'list', 'l'],
    description: 'Adds all songs from a YouTube playlist to the queue',
    execute: async (message: Message, args: string[]) => {
        if (!message.guild || !message.member) {
            await messageHandler.replyToMessage(message, 'This command can only be used in a server!', true);
            return;
        }

        if (args.length < 1) {
            await messageHandler.replyToMessage(message, 'Please provide a YouTube playlist link!', true);
            return;
        }

        const link = args[0];
        const cleanUrl = validateAndCleanYouTubePlaylistUrl(link);

        if (!cleanUrl) {
            await messageHandler.replyToMessage(message, 'Please provide a valid YouTube playlist URL!', true);
            return;
        }

        try {
            const loadingMsg = await messageHandler.replyToMessage(message, 'Fetching playlist videos...');
            const videoUrls = await getPlaylistVideos(cleanUrl);

            if (videoUrls.length === 0) {
                await messageHandler.editReply(loadingMsg,'No videos found in the playlist.', true);
                return;
            }

            await messageHandler.editReply(loadingMsg,`Found ${videoUrls.length} videos. Adding to queue...`, true);
            
            let addedCount = 0;

            for (const videoUrl of videoUrls) {
                try {
                    const result = await queueHandler.addLinkToQueue(message.guild, videoUrl, message.author);
                    if (result.metadata) {
                        addedCount++;

                        // Let the download happen in background
                        result.downloadPromise.catch(error => {
                            console.error('Error downloading song:', error);
                        });
                    }
                } catch (error) {
                    console.error('Error adding video to queue:', error);
                }
            }

            await messageHandler.editReply(loadingMsg,`Successfully added ${addedCount} songs to the queue!`, true);

        } catch (error) {
            await messageHandler.replyToMessage(message, 'Sorry, there was an error processing the playlist. Please try again later.', true);
        }
    }
}
