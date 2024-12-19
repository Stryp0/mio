import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ButtonInteraction, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, StringSelectMenuInteraction, GuildMember } from 'discord.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { queueHandler } from '../handlers/QueueHandler';
import { configHandler } from '../handlers/ConfigHandler';

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
                .setURL(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`)
                .setThumbnail('https://pic.surf/cwv');

            const allResults = [...ytMusicResults, ...youtubeResults];
            const emojis = ['🟦', '⬛', '🟩', '🟥'];
            allResults.forEach((result, index) => {
                mainEmbed.addFields({
                    name: `${emojis[index] || '▫️'} ${index + 1}. ${sanitizeTitle(result.title, result.uploader)}`,
                    value: `By: ${result.uploader} (${formatDuration(result.duration)})`,
                    inline: true,
                });

                if (index === 1) {
                    mainEmbed.addFields({ name: '\u200B', value: '\u200B', inline: false });
                }
            });

            const imageEmbeds = allResults.map(result =>
                new EmbedBuilder().setURL('https://music.youtube.com').setImage(result.thumbnail)
            );

            // Create components based on config
            const components: ActionRowBuilder<any>[] = [];

            // Add buttons
            if (!configHandler.SEARCH_USE_SELECTMENU) {
                const buttonRow = new ActionRowBuilder<ButtonBuilder>()
                    .addComponents(
                        ...allResults.map((result, index) =>
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
                        allResults.map((result, index) =>
                            new StringSelectMenuOptionBuilder()
                                .setLabel(`${emojis[index] || '▫️'}${index + 1}. ${sanitizeTitle(result.title, result.uploader)}`)
                                .setDescription(`By: ${result.uploader} (${formatDuration(result.duration)})`)
                                .setValue(`${index}`)
                        )
                    );

                const selectRow = new ActionRowBuilder().addComponents(select);
                components.push(selectRow);
            }

            const response = await loadingMsg.edit({
                content: `Results for: **${query}**`,
                embeds: [mainEmbed, ...imageEmbeds],
                components: components
            });

            // Create collector for both buttons and select menu
            const collector = response.createMessageComponentCollector({
                time: 120000 // 2 minute timeout
            });

            collector.on('collect', async (interaction: ButtonInteraction | StringSelectMenuInteraction) => {
                if (!interaction.guild) return;
                if (interaction.user.id !== message.author.id) {
                    await interaction.reply({
                        content: 'Only the person who searched can use these controls!',
                        ephemeral: true
                    });
                    return;
                } else {
                    await interaction.reply({
                        content: 'Adding song to queue...',
                        ephemeral: true
                    });
                }

                const member = interaction.member as GuildMember;
                if (!member.voice.channel) {
                    await interaction.editReply({
                        content: 'You need to be in a voice channel to use this command!'
                    });
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

                const selectedResult = allResults[selectedIndex];
                if (!selectedResult) return;
                const result = await queueHandler.addLinkToQueue(
                    interaction.guild,
                    selectedResult.url,
                    interaction.user
                );

                if (result.metadata) {
                    await interaction.editReply({
                        content: `Added **${selectedResult.title}** to the queue!`
                    });
                } else {
                    await interaction.editReply({
                        content: 'Failed to add song to queue.'
                    });
                }
            });

            collector.on('end', () => {
                if (response.editable) {
                    response.edit({ components: [] }).catch(console.error);
                }
            });
        } catch (error) {
            console.error('Search error:', error);
            await message.reply('Sorry, there was an error fetching search results. Please try again.');
        }
    },
};