import { Guild, GuildMember } from 'discord.js';
import { 
    createAudioResource, 
    createAudioPlayer, 
    joinVoiceChannel, 
    DiscordGatewayAdapterCreator,
    AudioPlayerStatus,
    VoiceConnection
} from '@discordjs/voice';
import { queueHandler, QueuedSong } from './QueueHandler';
import { configHandler } from './ConfigHandler';
import path from 'path';

export class PlaybackHandler {
    private static instance: PlaybackHandler;
    private readonly DOWNLOAD_CHECK_INTERVAL = 1000; // Check every second
    private readonly MAX_WAIT_TIME = 300000; // 5 minutes max wait time
    private connections: Map<string, VoiceConnection>;
    private players: Map<string, ReturnType<typeof createAudioPlayer>>;

    private constructor() {
        this.connections = new Map();
        this.players = new Map();
    }

    public static getInstance(): PlaybackHandler {
        if (!PlaybackHandler.instance) {
            PlaybackHandler.instance = new PlaybackHandler();
        }
        return PlaybackHandler.instance;
    }

    private async waitForDownload(queuedSong: QueuedSong): Promise<boolean> {
        const startTime = Date.now();
        
        while (queuedSong.song.Filename === null) {
            if (Date.now() - startTime > this.MAX_WAIT_TIME) {
                throw new Error('Timed out waiting for song to download');
            }
            
            await new Promise(resolve => setTimeout(resolve, this.DOWNLOAD_CHECK_INTERVAL));
        }
        
        return true;
    }

    private async playNextSong(guild: Guild): Promise<void> {
        const nextSong = queueHandler.getNextQueueItem(guild);
        if (!nextSong) {
            // No more songs in queue, only cleanup the player but keep the connection
            this.players.delete(guild.id);
            return;
        }

        try {
            // Wait for the song to be downloaded
            await this.waitForDownload(nextSong);

            // Create and play audio resource
            const audioPath = path.join(configHandler.SONGS_DIR, nextSong.song.Filename!);
            const resource = createAudioResource(audioPath);
            const player = this.players.get(guild.id);
            
            if (player) {
                player.play(resource);
            }
        } catch (error) {
            console.error('Error playing next song:', error);
            // Try to play the next song if this one fails
            this.playNextSong(guild);
        }
    }

    private getPlayer(guild: Guild): ReturnType<typeof createAudioPlayer> | null {
        return this.players.get(guild.id) || null;
    }

    private isPlaying(guild: Guild): boolean {
        const player = this.getPlayer(guild);
        return player?.state.status === AudioPlayerStatus.Playing;
    }

    public async startPlayback(guild: Guild, member: GuildMember): Promise<void> {
        // Check if user is in a voice channel
        const voiceChannel = member.voice.channel;
        if (!voiceChannel) {
            throw new Error('You must be in a voice channel to play music!');
        }

        // Get the current song from queue
        const currentSong = queueHandler.getCurrentQueueItem(guild);
        if (!currentSong) {
            throw new Error('No songs in queue!');
        }

        // If music is already playing, don't restart the current song
        if (this.isPlaying(guild)) {
            return;
        }

        try {
            // Wait for the song to be downloaded
            await this.waitForDownload(currentSong);

            // Create audio player if it doesn't exist
            let player = this.players.get(guild.id);
            if (!player) {
                player = createAudioPlayer();
                this.players.set(guild.id, player);

                // Set up player event handlers
                player.on('error', error => {
                    console.error('Error:', error);
                    this.playNextSong(guild);
                });

                player.on(AudioPlayerStatus.Idle, () => {
                    this.playNextSong(guild);
                });
            }

            // Create or get existing connection
            let connection = this.connections.get(guild.id);
            if (!connection) {
                connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: guild.id,
                    adapterCreator: guild.voiceAdapterCreator as DiscordGatewayAdapterCreator,
                });
                this.connections.set(guild.id, connection);
            }

            // Create and play audio resource
            const audioPath = path.join(configHandler.SONGS_DIR, currentSong.song.Filename!);
            const resource = createAudioResource(audioPath);
            player.play(resource);

            // Subscribe connection to player if not already
            if (!connection.subscribe(player)) {
                throw new Error('Failed to subscribe connection to player');
            }
            
        } catch (error) {
            throw error;
        }
    }

    public pausePlayback(guild: Guild): boolean {
        const player = this.getPlayer(guild);
        if (!player) {
            throw new Error('No active player found for this guild');
        }

        return player.pause();
    }

    public resumePlayback(guild: Guild): boolean {
        const player = this.getPlayer(guild);
        if (!player) {
            throw new Error('No active player found for this guild');
        }

        return player.unpause();
    }

    public stopPlayback(guild: Guild): void {
        const connection = this.connections.get(guild.id);
        const player = this.players.get(guild.id);

        if (player) {
            player.stop();
            this.players.delete(guild.id);
        }

        if (connection) {
            connection.disconnect();
            this.connections.delete(guild.id);
        }

        // Clear the guild's queue
        queueHandler.clearQueue(guild);
    }

    public skipSong(guild: Guild): void {
        const player = this.getPlayer(guild);
        if (!player) {
            throw new Error('No active player found for this guild');
        }

        // Stop the current song, which will trigger the 'idle' event
        // and automatically play the next song
        player.stop();
    }

    public isGuildPlayerPaused(guild: Guild): boolean {
        const player = this.getPlayer(guild);
        return player ? player.state.status === AudioPlayerStatus.Paused : null;
    }

    public getPlaybackProgress(guild: Guild): number | null {
        const player = this.getPlayer(guild);
        if (player && player.state.status === AudioPlayerStatus.Playing) {
            const duration = player.state.playbackDuration;
            return duration / 1000; 
        }
        return null;
    }
}

export const playbackHandler = PlaybackHandler.getInstance();
