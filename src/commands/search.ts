import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonInteraction, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, StringSelectMenuInteraction, GuildMember } from 'discord.js';
import { google, youtube_v3 } from 'googleapis';
import { configHandler } from '../handlers/ConfigHandler';
import { messageHandler } from '../handlers/MessageHandler';
import { queueHandler } from '../handlers/QueueHandler';

async function searchYouTube(query: string, limit: number) {
    try {
        const youtube = google.youtube({
            version: 'v3',
            auth: configHandler.YOUTUBE_API_KEY
        });

        // Set the search parameters
        const searchParams: youtube_v3.Params$Resource$Search$List = {
            part: ['snippet'],
            q: query,
            maxResults: limit,
            type: ['video'],
        };

        // Execute the search
        const searchResponse = await youtube.search.list(searchParams);
        
        if (!searchResponse.data.items || searchResponse.data.items.length === 0) {
            return [];
        }

        // Get video details for duration
        const videoIds = searchResponse.data.items.map(item => item.id?.videoId).filter(Boolean) as string[];
        const videoDetailsResponse = await youtube.videos.list({
            part: ['contentDetails', 'snippet', 'statistics'],
            id: videoIds
        });

        if (!videoDetailsResponse.data.items) {
            return [];
        }

        // Map the results to our format
        return videoDetailsResponse.data.items.map(video => {
            // Parse duration from ISO 8601 format
            const duration = video.contentDetails?.duration || 'PT0S';
            const seconds = parseDuration(duration);
            
            return {
                title: video.snippet?.title || 'Unknown Title',
                url: `https://www.youtube.com/watch?v=${video.id}`,
                duration: seconds,
                uploader: video.snippet?.channelTitle || 'Unknown',
                thumbnail: video.snippet?.thumbnails?.high?.url || video.snippet?.thumbnails?.default?.url || '',
            };
        });
    } catch (error) {
        console.error('Error fetching YouTube results:', error);
        return [];
    }
}

// Helper function to parse ISO 8601 duration to seconds
function parseDuration(duration: string): number {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    
    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);
    
    return hours * 3600 + minutes * 60 + seconds;
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
    arguments: '<search query>',
    description: 'Searches YouTube Music and YouTube for songs',
    requirements: {
        userInVoiceChannel: true,
        messageSentInGuild: true
    },
    async execute(message, args) {
        if (!args.length) return messageHandler.replyToMessage(message, 'Please provide a search query!', true);

        const query = args.join(' ');
        const loadingMsg = await messageHandler.replyToMessage(message, '🔎 Searching...');

        try {
            const results = await searchYouTube(query, 4);

            if (!results.length) {
                return messageHandler.editReply(loadingMsg,'No results found for your search query.', true);
            }

            const mainEmbed = new EmbedBuilder()
                .setColor('#F23F43')
                .setTitle('Search Results')
                .setDescription(`Results for: ${query}`)
                .setURL(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`);

            const emojis = ['🟦', '⬛', '🟩', '🟥'];
            results.forEach((result, index) => {
                mainEmbed.addFields({
                    name: `${emojis[index] || '▫️'} ${index + 1}. ${sanitizeTitle(result.title, result.uploader)}`,
                    value: `[By: ${result.uploader} (${formatDuration(result.duration)})](${result.url})`,
                    inline: true,
                });
            
                if (index === 1) {
                    mainEmbed.addFields({ name: '\u200B', value: '\u200B', inline: false });
                }
            });

            if (results.length > 1) {
                const thumbnailUrls = {
                    2: 'https://pic.surf/yne',
                    3: 'https://pic.surf/rjk',
                    4: 'https://pic.surf/cwv'
                };
                mainEmbed.setThumbnail(thumbnailUrls[results.length]);
            }

            const imageEmbeds = results.map(result =>
                new EmbedBuilder().setURL('https://music.youtube.com').setImage(result.thumbnail)
            );

            // Create components based on config
            const components: ActionRowBuilder<any>[] = [];

            // Add buttons or select menu based on guild setting
            const useSelectMenu = message.guild 
                ? configHandler.getGuildSetting(message.guild, 'SEARCH_USE_SELECTMENU', 'boolean') 
                : false;

            if (!useSelectMenu) {
                const buttonRow = new ActionRowBuilder<ButtonBuilder>()
                    .addComponents(
                        ...results.map((result, index) =>
                            new ButtonBuilder()
                                .setCustomId(`play_${index}_${message.author.id}`)
                                .setLabel(`Play ${index + 1}`)
                                .setStyle(index + 1)
                        )
                    );
                components.push(buttonRow);
            }
            // Add select menu if enabled in config
            else {
                const select = new StringSelectMenuBuilder()
                    .setCustomId(`select_${message.author.id}`)
                    .setPlaceholder('Select a song to play')
                    .addOptions(
                        results.map((result, index) =>
                            new StringSelectMenuOptionBuilder()
                                .setLabel(`${emojis[index] || '▫️'}${index + 1}. ${sanitizeTitle(result.title, result.uploader)}`)
                                .setDescription(`By: ${result.uploader} (${formatDuration(result.duration)})`)
                                .setValue(`${index}`)
                        )
                    );

                const selectRow = new ActionRowBuilder().addComponents(select);
                components.push(selectRow);
            }
                
            const response = await messageHandler.editReply(loadingMsg,({
                content: `Results for: **${query}**`,
                embeds: [mainEmbed, ...imageEmbeds],
                components: components
            }));

            // Create collector for both buttons and select menu
            const collector = response.createMessageComponentCollector({
                time: 120000 // 2 minute timeout
            });

            collector.on('collect', async (interaction: ButtonInteraction | StringSelectMenuInteraction) => {
                if (!interaction.guild) return;
                if (interaction.user.id !== message.author.id) {
                    await messageHandler.replyToInteraction(interaction,{
                        content: 'Only the person who searched can use these controls!'
                    }, true);
                    return;
                } else {
                    await messageHandler.replyToInteraction(interaction,{
                        content: 'Adding song to queue...'
                    });
                }

                const member = interaction.member as GuildMember;
                if (!member.voice.channel) {
                    await messageHandler.replyToInteraction(interaction,{
                        content: 'You need to be in a voice channel to use this command!'
                    }, true);
                    return;
                }

                let selectedIndex: number;
                if (interaction.isButton()) {
                    if (!interaction.customId.startsWith('play_')) return;
                    const [, index] = interaction.customId.split('_');
                    selectedIndex = parseInt(index);
                } else if (interaction.isStringSelectMenu()) {
                    selectedIndex = parseInt(interaction.values[0]);
                } else {
                    return;
                }

                const selectedResult = results[selectedIndex];
                if (!selectedResult) return;
                const result = await queueHandler.addLinkToQueue(
                    interaction.guild,
                    selectedResult.url,
                    interaction.user
                );

                if (result.metadata) {
                    const queue = queueHandler.getQueue(interaction.guild);
                    if (queue.length <= 1) {
                        await messageHandler.editInteractionReply(interaction, {
                            content: `Added **${selectedResult.title}** to queue and will start playing shortly!`
                        }, true);
                    } else {
                        const position = queue.findIndex(item => item.song.Link === selectedResult.url);
                        await messageHandler.editInteractionReply(interaction, {
                            content: `Added **${selectedResult.title}** to queue at position ${position}!`
                        }, true);
                    }
                } else {
                    await messageHandler.editInteractionReply(interaction, {
                        content: 'Failed to add song to queue.'
                    }, true);
                }
            });

            collector.on('end', () => {
                if (response.editable) {
                    messageHandler.editReply(response,{ components: [] }).catch(console.error);
                }
            });
        } catch (error) {
            console.error('Search error:', error);
            await messageHandler.editReply(loadingMsg,'Sorry, there was an error fetching search results. Please try again.', true);
        }
    },
};