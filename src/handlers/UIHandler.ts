import { TextChannel, EmbedBuilder, Guild, ActionRowBuilder, ButtonBuilder, ButtonStyle, Message, ButtonInteraction } from 'discord.js';
import { queueHandler, QueuedSong } from './QueueHandler';
import { playbackHandler } from './PlaybackHandler';

export class UIHandler {
    private nowPlayingMessages: Map<string, { channelId: string, messageId: string }>;
    private readonly SONGS_PER_PAGE = 10;

    constructor() {
        this.nowPlayingMessages = new Map();
        
        // Listen for queue updates
        queueHandler.on('queueUpdate', async (guild: Guild) => {
            await this.updateExistingMessage(guild);
        });
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
            const nextSongs = queueItems.slice(1, this.SONGS_PER_PAGE);
            if (nextSongs.length > 0) {
                const nextSongsList = nextSongs
                    .map((item, index) => 
                        `${index}. **${item.song.Artist} - ${item.song.Title}** ` +
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

    private async updateExistingMessage(guild: Guild): Promise<void> {
        const messageInfo = this.nowPlayingMessages.get(guild.id);
        if (!messageInfo) return;

        const channel = guild.channels.cache.get(messageInfo.channelId) as TextChannel;
        if (!channel) return;

        try {
            const message = await channel.messages.fetch(messageInfo.messageId);
            const currentItem = queueHandler.getCurrentQueueItem(guild);
            const queueItems = queueHandler.getQueue(guild);

            if (!currentItem && queueItems.length === 0) {
                await message.delete();
                this.nowPlayingMessages.delete(guild.id);
            } else {
                const embed = this.createNowPlayingEmbed(currentItem, queueItems);
                const row = this.createControlButtons(guild);
                await message.edit({ embeds: [embed], components: [row] });
            }
        } catch (error) {
            console.error('Failed to update message:', error);
            this.nowPlayingMessages.delete(guild.id);
        }
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
                    await this.updateExistingMessage(interaction.guild);
                    break;
                case 'stop':
                    playbackHandler.stopPlayback(interaction.guild);
                    await interaction.reply({ content: 'Stopped playback and cleared the queue!', ephemeral: true });
                    break;
            }
        } catch (error) {
            console.error('Error handling button interaction:', error);
            await interaction.reply({ 
                content: 'There was an error while executing that action!', 
                ephemeral: true 
            });
        }
    }

    public async displayQueue(channel: TextChannel, guild: Guild): Promise<void> {
        // Delete existing message if it exists
        const existingMessage = this.nowPlayingMessages.get(guild.id);
        if (existingMessage) {
            try {
                const oldChannel = guild.channels.cache.get(existingMessage.channelId) as TextChannel;
                if (oldChannel) {
                    const oldMessage = await oldChannel.messages.fetch(existingMessage.messageId);
                    await oldMessage.delete();
                }
            } catch (error) {
                console.error('Failed to delete old queue message:', error);
            }
        }

        const currentItem = queueHandler.getCurrentQueueItem(guild);
        const queueItems = queueHandler.getQueue(guild);

        // Don't create a new message if there's nothing to show
        if (!currentItem && queueItems.length === 0) {
            this.nowPlayingMessages.delete(guild.id);
            return;
        }

        const embed = this.createNowPlayingEmbed(currentItem, queueItems);
        const row = this.createControlButtons(guild);

        const message = await channel.send({ embeds: [embed], components: [row] });
        this.nowPlayingMessages.set(guild.id, { 
            channelId: channel.id, 
            messageId: message.id 
        });
    }

    public async updateNowPlaying(guild: Guild): Promise<void> {
        await this.updateExistingMessage(guild);
    }
}

// Create a singleton instance
export const uiHandler = new UIHandler();
