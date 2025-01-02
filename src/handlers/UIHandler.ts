import { TextChannel, EmbedBuilder, Guild, ActionRowBuilder, ButtonBuilder, ButtonStyle, ButtonInteraction } from 'discord.js';
import { queueHandler, QueuedSong } from './QueueHandler';
import { playbackHandler } from './PlaybackHandler';
import { messageHandler } from '../handlers/MessageHandler';

/**
 * UIHandler manages the user interface for the music queue system.
 * It handles displaying the now-playing embed, queue updates, control buttons, and user interactions.
 */
export class UIHandler {
    private static instance: UIHandler;
    private nowPlayingMessages: Map<string, { channelId: string, messageId: string, currentPage: number }>;
    private readonly SONGS_PER_PAGE = 10;

    private constructor() {
        this.nowPlayingMessages = new Map();
        queueHandler.on('queueUpdate', async (guild: Guild) => {
            await this.updateExistingMessage(guild);
        });
    }

    public static getInstance(): UIHandler {
        if (!UIHandler.instance) {
            UIHandler.instance = new UIHandler();
        }
        return UIHandler.instance;
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

    private createNowPlayingEmbed(currentItem: QueuedSong | null, queueItems: QueuedSong[], page: number = 0): EmbedBuilder {
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

            const startIdx = page * this.SONGS_PER_PAGE + 1;
            const endIdx = startIdx + this.SONGS_PER_PAGE;
            const nextSongs = queueItems.slice(startIdx, endIdx);

            if (nextSongs.length > 0) {
                const nextSongsList = nextSongs
                    .map((item, index) => 
                        `${startIdx + index}. **${item.song.Artist} - ${item.song.Title}** ` +
                        `(${this.formatDuration(item.song.Duration)}) *- by ${item.requestedBy.username}*`
                    )
                    .join('\n');

                embed.addFields({
                    name: page === 0 ? 'Up Next' : `Queue (Page ${page + 1})`,
                    value: nextSongsList
                });
            }

            const remainingSongs = queueItems.length - endIdx;
            if (remainingSongs > 0) {
                embed.setFooter({ 
                    text: `And ${remainingSongs} more songs in queue...\n` +
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

    /**
     * Updates the now-playing message in the specified guild, refreshing the embed and controls.
     * @param {Guild} guild - The guild where the message should be updated.
     * @returns {Promise<void>} A promise that resolves when the update is complete.
     */
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
                const maxPages = Math.ceil((queueItems.length - 1) / this.SONGS_PER_PAGE);
                if (messageInfo.currentPage >= maxPages) {
                    messageInfo.currentPage = Math.max(0, maxPages - 1);
                }

                const embed = this.createNowPlayingEmbed(currentItem, queueItems, messageInfo.currentPage);
                const row = this.createControlButtons(guild);

                await message.edit({ embeds: [embed], components: [row] });

                await message.reactions.removeAll();
                
                if (messageInfo.currentPage > 0) {
                    await message.react('⬅️');
                }
                if (messageInfo.currentPage < maxPages - 1) {
                    await message.react('➡️');
                }
            }
        } catch (error) {
            console.error('Failed to update message:', error);
            this.nowPlayingMessages.delete(guild.id);
        }
    }

    /**
     * Handles button interactions for music controls such as skip, shuffle, pause, and stop.
     * @param {ButtonInteraction} interaction - The button interaction from the user.
     * @returns {Promise<void>} A promise that resolves when the interaction is handled.
     */
    public async handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
        if (!interaction.guild) return;

        try {
            switch (interaction.customId) {
                case 'skip':
                    playbackHandler.skipSong(interaction.guild);
                    await messageHandler.replyToInteraction(interaction,{ content: 'Skipped the current song!'}, true);
                    break;
                case 'shuffle':
                    queueHandler.shuffleQueue(interaction.guild);
                    await messageHandler.replyToInteraction(interaction,{ content: 'Queue has been shuffled!'}, true);
                    break;
                case 'pause':
                    const isPaused = playbackHandler.isGuildPlayerPaused(interaction.guild);
                    if (isPaused) {
                        playbackHandler.resumePlayback(interaction.guild);
                        await messageHandler.replyToInteraction(interaction,{ content: 'Resumed playback!'}, true);
                    } else {
                        playbackHandler.pausePlayback(interaction.guild);
                        await messageHandler.replyToInteraction(interaction,{ content: 'Paused playback!'}, true);
                    }
                    await this.updateExistingMessage(interaction.guild);
                    break;
                case 'stop':
                    playbackHandler.stopPlayback(interaction.guild);
                    await messageHandler.replyToInteraction(interaction,{ content: 'Stopped playback and cleared the queue!'}, true);
                    break;
            }
        } catch (error) {
            console.error('Error handling button interaction:', error);
            await messageHandler.replyToInteraction(interaction,{ 
                content: 'There was an error while executing that action!'
            });
        }
    }

    /**
     * Handles reactions added to the now-playing message for pagination purposes.
     * @param {Guild} guild - The guild where the reaction was added.
     * @param {string} messageId - The ID of the message the reaction was added to.
     * @param {string} emoji - The emoji used in the reaction.
     * @param {string} userId - The ID of the user who added the reaction.
     * @returns {Promise<void>} A promise that resolves when the reaction is handled.
     */
    public async handleReactionAdd(guild: Guild, messageId: string, emoji: string, userId: string): Promise<void> {
        const messageInfo = this.nowPlayingMessages.get(guild.id);
        if (!messageInfo || messageInfo.messageId !== messageId) return;

        const channel = guild.channels.cache.get(messageInfo.channelId) as TextChannel;
        if (!channel) return;

        try {
            const message = await channel.messages.fetch(messageId);
            const queueItems = queueHandler.getQueue(guild);
            const maxPages = Math.ceil(queueItems.length / this.SONGS_PER_PAGE);

            if (emoji === '⬅️' && messageInfo.currentPage > 0) {
                messageInfo.currentPage--;
                await this.updateExistingMessage(guild);
            } else if (emoji === '➡️' && messageInfo.currentPage < maxPages - 1) {
                messageInfo.currentPage++;
                await this.updateExistingMessage(guild);
            }

            const userReactions = message.reactions.cache.filter(reaction => reaction.users.cache.has(userId));
            try {
                for (const reaction of userReactions.values()) {
                    await reaction.users.remove(userId);
                }
            } catch (error) {
                console.error('Failed to remove reactions:', error);
            }
        } catch (error) {
            console.error('Error handling reaction:', error);
        }
    }

    /**
     * Displays the queue in the specified text channel with pagination and control buttons.
     * @param {TextChannel} channel - The channel where the queue should be displayed.
     * @param {Guild} guild - The guild where the queue belongs.
     * @returns {Promise<void>} A promise that resolves when the queue is displayed.
     */
    public async displayQueue(channel: TextChannel, guild: Guild): Promise<void> {
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

        if (!currentItem && queueItems.length === 0) {
            await channel.send('The queue is empty!');
            return;
        }

        const embed = this.createNowPlayingEmbed(currentItem, queueItems, 0);
        const row = this.createControlButtons(guild);
        const message = await channel.send({ embeds: [embed], components: [row] });

        if (queueItems.length > this.SONGS_PER_PAGE) {
            await message.react('➡️');
        }

        this.nowPlayingMessages.set(guild.id, {
            channelId: channel.id,
            messageId: message.id,
            currentPage: 0
        });
    }

    /**
     * Updates the now-playing message in the specified guild, refreshing the embed and controls.
     * @param {Guild} guild - The guild where the message should be updated.
     * @returns {Promise<void>} A promise that resolves when the update is complete.
     */
    public async updateNowPlaying(guild: Guild): Promise<void> {
        await this.updateExistingMessage(guild);
    }
}

export const uiHandler = UIHandler.getInstance();
