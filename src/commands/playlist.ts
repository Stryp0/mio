import { Message } from 'discord.js';
import { queueHandler } from '../handlers/QueueHandler';
import { playbackHandler } from '../handlers/PlaybackHandler';
import { configHandler } from '../handlers/ConfigHandler';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

function validateAndCleanYouTubePlaylistUrl(url: string): string | null {
    const pattern = /(?:https?:\/\/)?(?:www\.)?youtube\.com\/.*?(?:\?|&)list=([a-zA-Z0-9_-]+)/;
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
            await message.reply('This command can only be used in a server!');
            return;
        }

        if (args.length < 1) {
            await message.reply('Please provide a YouTube playlist link!');
            return;
        }

        const link = args[0];
        const cleanUrl = validateAndCleanYouTubePlaylistUrl(link);

        if (!cleanUrl) {
            await message.reply('Please provide a valid YouTube playlist URL!');
            return;
        }

        try {
            const loadingMsg = await message.reply('Fetching playlist videos...');
            const videoUrls = await getPlaylistVideos(cleanUrl);

            if (videoUrls.length === 0) {
                await loadingMsg.edit('No videos found in the playlist.');
                return;
            }

            await loadingMsg.edit(`Found ${videoUrls.length} videos. Adding to queue...`);
            
            let addedCount = 0;
            let firstSong = true;

            // Process each video URL
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

            await loadingMsg.edit(`Successfully added ${addedCount} songs to the queue!`);

        } catch (error) {
            await message.reply('Sorry, there was an error processing the playlist. Please try again later.');
        }

        // Delete the original message if configured to do so
        if (configHandler.DELETE_BOT_COMMANDS) {
            await message.delete();
        }
    }
}
