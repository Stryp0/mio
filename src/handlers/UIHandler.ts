import { TextChannel, EmbedBuilder, Guild, ActionRowBuilder, ButtonBuilder, ButtonStyle, Message, ButtonInteraction } from 'discord.js';
import { queueHandler, QueuedSong } from './QueueHandler';
import { playbackHandler } from './PlaybackHandler';

export class UIHandler {
    private nowPlayingMessages: Map<string, { channelId: string, messageId: string }>;
    private readonly SONGS_PER_PAGE = 10;

    constructor() {
        this.nowPlayingMessages = new Map();
    }

    private formatDuration(seconds: number): string {
        if (seconds < 3600) {
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
        } else {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const remainingSeconds = seconds % 60;
            return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
        }
    }

    private createNowPlayingEmbed(currentItem: QueuedSong | null, queueItems: QueuedSong[]): EmbedBuilder {
        const embed = new EmbedBuilder()
            .setColor('#23A55A')
            .setTitle('🎵 Now Playing');

        if (currentItem) {
            embed
                .setTitle(currentItem.song.Title)
                .setURL(currentItem.song.Link)
                .setAuthor({ name: currentItem.song.Artist })
                .setThumbnail(currentItem.song.Thumbnail)
                .addFields({
                    name: `Requested by: ${currentItem.requestedBy.username}`,
                    value: `Duration: ${this.formatDuration(currentItem.song.Duration)}`
                });

            // Add up to X next songs as a simple list
            const nextSongs = queueItems.slice(0, this.SONGS_PER_PAGE);
            if (nextSongs.length > 0) {
                const nextSongsList = nextSongs
                    .map((item, index) => 
                        `${index + 1}. **${item.song.Artist} - ${item.song.Title}** ` +
                        `(${this.formatDuration(item.song.Duration)}) *- by ${item.requestedBy.username}*`
                    )
                    .join('\n');

                embed.addFields({
                    name: 'Up Next',
                    value: nextSongsList
                });
            }

            // If there are more songs in queue, add a note
            if (queueItems.length > this.SONGS_PER_PAGE) {
                embed.setFooter({ 
                    text: `And ${queueItems.length - this.SONGS_PER_PAGE} more songs in queue...\n` +
                    `Total queue duration: ${this.formatDuration(queueItems.reduce((total, item) => total + item.song.Duration, 0))}`
                });
            } else {
                embed.setFooter({
                    text: `Total queue duration: ${this.formatDuration(queueItems.reduce((total, item) => total + item.song.Duration, 0))}`
                });
            }
        } else {
            embed
                .setDescription('Nothing is playing right now')
                .setColor('#ff0000');
        }

        return embed;
    }

    private createControlButtons(guild: Guild): ActionRowBuilder<ButtonBuilder> {
        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('skip')
                    .setLabel('Skip')
                    .setEmoji('⏭️')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('shuffle')
                    .setLabel('Shuffle')
                    .setEmoji('🔀')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('pause')
                    .setLabel(playbackHandler.isGuildPlayerPaused(guild) ? 'Resume' : 'Pause')
                    .setEmoji(playbackHandler.isGuildPlayerPaused(guild) ? '▶️' : '⏸️')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('stop')
                    .setLabel('Stop')
                    .setEmoji('⏹️')
                    .setStyle(ButtonStyle.Danger)
            );
        return row;
    }

    public async handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
        if (!interaction.guild) return;

        try {
            switch (interaction.customId) {
                case 'skip':
                    playbackHandler.skipSong(interaction.guild);
                    await interaction.reply({ content: 'Skipped the current song!', ephemeral: true });
                    break;
                case 'shuffle':
                    queueHandler.shuffleQueue(interaction.guild);
                    await interaction.reply({ content: 'Queue has been shuffled!', ephemeral: true });
                    break;
                case 'pause':
                    const isPaused = playbackHandler.isGuildPlayerPaused(interaction.guild);
                    if (isPaused) {
                        playbackHandler.resumePlayback(interaction.guild);
                        await interaction.reply({ content: 'Resumed playback!', ephemeral: true });
                    } else {
                        playbackHandler.pausePlayback(interaction.guild);
                        await interaction.reply({ content: 'Paused playback!', ephemeral: true });
                    }
                    break;
                case 'stop':
                    playbackHandler.stopPlayback(interaction.guild);
                    await interaction.reply({ content: 'Stopped playback and cleared the queue!', ephemeral: true });
                    break;
            }

            // Update the now playing message to reflect the new state
            await this.updateNowPlaying(interaction.guild);
        } catch (error) {
            console.error('Error handling button interaction:', error);
            await interaction.reply({ 
                content: 'There was an error while executing that action!', 
                ephemeral: true 
            });
        }
    }

    public async displayNowPlaying(guild: Guild, channel: TextChannel, currentItem: QueuedSong): Promise<void> {
        const queue = queueHandler.getQueue(guild);
        const queueItems = queue.slice(1); // Exclude current song
        const embed = this.createNowPlayingEmbed(currentItem, queueItems);
        const row = this.createControlButtons(guild);

        // Check if there's an existing now playing message
        const existingMessage = this.nowPlayingMessages.get(guild.id);
        if (existingMessage) {
            try {
                const messageChannel = await guild.channels.fetch(existingMessage.channelId);
                if (messageChannel?.isTextBased()) {
                    const message = await messageChannel.messages.fetch(existingMessage.messageId);
                    await message.edit({ embeds: [embed], components: [row] });
                    return;
                }
            } catch (error) {
                console.error('Error updating now playing message:', error);
            }
        }

        // If no existing message or failed to update, send a new one
        const message = await channel.send({ embeds: [embed], components: [row] });
        this.nowPlayingMessages.set(guild.id, { 
            channelId: channel.id, 
            messageId: message.id 
        });
    }

    public async updateNowPlaying(guild: Guild): Promise<void> {
        const currentItem = queueHandler.getCurrentQueueItem(guild);
        const existingMessage = this.nowPlayingMessages.get(guild.id);

        if (currentItem && existingMessage) {
            try {
                const channel = await guild.channels.fetch(existingMessage.channelId);
                if (channel?.isTextBased()) {
                    await this.displayNowPlaying(guild, channel as TextChannel, currentItem);
                }
            } catch (error) {
                console.error('Error updating now playing message:', error);
            }
        }
    }
}

// Create a singleton instance
export const uiHandler = new UIHandler();
