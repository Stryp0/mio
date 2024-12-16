import { TextChannel, EmbedBuilder, Guild } from 'discord.js';
import { queueHandler, QueuedSong } from './QueueHandler';

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
                    `Total duration: ${this.formatDuration(queueItems.reduce((total, item) => total + item.song.Duration, 0))}`
                });
            } else {
                embed.setFooter({
                    text: `Total duration: ${this.formatDuration(queueItems.reduce((total, item) => total + item.song.Duration, 0))}`
                });
            }
        } else {
            embed
                .setDescription('Nothing is playing right now')
                .setColor('#ff0000');
        }

        return embed;
    }

    public async displayNowPlaying(guild: Guild, channel: TextChannel, currentSong: QueuedSong | null): Promise<void> {
        const queue = queueHandler.getQueue(guild).slice(1); // Get queue without current song
        const embed = this.createNowPlayingEmbed(currentSong, queue);
        
        try {
            const existingMessage = this.nowPlayingMessages.get(guild.id);
            if (existingMessage && existingMessage.channelId === channel.id) {
                // Update existing message
                const message = await channel.messages.fetch(existingMessage.messageId);
                await message.edit({ embeds: [embed] });
            } else {
                // Send new message
                const message = await channel.send({ embeds: [embed] });
                this.nowPlayingMessages.set(guild.id, {
                    channelId: channel.id,
                    messageId: message.id
                });
            }
        } catch (error) {
            console.error('Error updating now playing message:', error);
            // Clear stored message reference if there was an error
            this.nowPlayingMessages.delete(guild.id);
        }
    }
}

// Create a singleton instance
export const uiHandler = new UIHandler();
