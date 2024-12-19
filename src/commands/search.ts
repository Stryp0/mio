import { Message, EmbedBuilder } from 'discord.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

async function searchYouTube(query, limit, isMusic = false) {
    const searchType = isMusic ? 'ytmsearch' : 'ytsearch';
    const baseCmd = isMusic
        ? `yt-dlp --print title --print id --print duration --print uploader --print thumbnail --playlist-end ${limit} --default-search "https://music.youtube.com/search?q=" "${query}"`
        : `yt-dlp --print title --print id --print duration --print uploader --print thumbnail "${searchType}${limit}:${query}"`;

    try {
        const { stdout } = await execPromise(baseCmd);
        return stdout.split('\n').filter(Boolean).reduce((results, line, index) => {
            if (index % 5 === 0) {
                results.push({
                    title: line,
                    url: `https://www.youtube.com/watch?v=${stdout.split('\n')[index + 1]}`,
                    duration: parseInt(stdout.split('\n')[index + 2]) || 0,
                    uploader: stdout.split('\n')[index + 3] || 'Unknown',
                    thumbnail: stdout.split('\n')[index + 4] || '',
                });
            }
            return results;
        }, []);
    } catch (error) {
        console.error('Error fetching YouTube results:', error);
        return [];
    }
}

function formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
}

function sanitizeTitle(title, uploader) {
    if (!uploader) return title;
    const patterns = [
        new RegExp(`^${uploader} - `), // Uploader at the beginning
        new RegExp(` - ${uploader}$`), // Uploader at the end
    ];
    return patterns.reduce((cleanTitle, pattern) => cleanTitle.replace(pattern, '').trim(), title);
}

export default {
    name: 'search',
    aliases: ['s'],
    description: 'Searches YouTube Music and YouTube for songs',
    async execute(message, args) {
        if (!message.guild || !message.member) return message.reply('This command can only be used in a server!');
        if (!args.length) return message.reply('Please provide a search query!');

        const query = args.join(' ');
        const loadingMsg = await message.reply('🔎 Searching...');

        try {
            const [ytMusicResults, youtubeResults] = await Promise.all([
                searchYouTube(query, 2, true),
                searchYouTube(query, 2, false),
            ]);

            if (!ytMusicResults.length && !youtubeResults.length) {
                return loadingMsg.edit('No results found for your search query.');
            }

            const mainEmbed = new EmbedBuilder()
                .setColor('#F23F43')
                .setTitle('Search Results')
                .setDescription(`Results for: ${query}`)
                .setURL('https://music.youtube.com');

            [...ytMusicResults, ...youtubeResults].forEach((result, index) => {
                mainEmbed.addFields({
                    name: `${index + 1}. ${sanitizeTitle(result.title, result.uploader)}`,
                    value: `By: ${result.uploader} (${formatDuration(result.duration)})`,
                    inline: true,
                });
                
                // Add empty field after the second result
                if (index === 1) {
                    mainEmbed.addFields({ name: '\u200B', value: '\u200B', inline: false });
                }
            });

            const imageEmbeds = [...ytMusicResults, ...youtubeResults].map(result =>
                new EmbedBuilder().setURL('https://music.youtube.com').setImage(result.thumbnail)
            );

            await loadingMsg.edit({
                content: `Results for: **${query}**`,
                embeds: [mainEmbed, ...imageEmbeds],
            });
        } catch (error) {
            console.error('Search error:', error);
            await message.reply('Sorry, there was an error fetching search results. Please try again.');
        }
    },
};