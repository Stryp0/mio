import { Guild, GuildMember, Collection } from 'discord.js';
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
import { client } from '../index';

    /**
     * Class that handles playback of songs in a guild.
     *
     * Contains methods for starting and stopping playback, pausing and resuming playback, skipping songs, and getting the progress of the current song.
     *
     * Also contains methods for checking if the player is paused or playing, and for getting the player itself.
     *
     * The class is a singleton and should be accessed using the getInstance() method.
     */
export class PlaybackHandler {
    private static instance: PlaybackHandler;
    private readonly DOWNLOAD_CHECK_INTERVAL = 1000;
    private readonly MAX_WAIT_TIME = 300000;
    private readonly IDLE_CHECK_INTERVAL = 10000;
    private connections: Map<string, VoiceConnection>;
    private players: Map<string, ReturnType<typeof createAudioPlayer>>;
    private idleTimestamps: Map<string, number> = new Map();

    private constructor() {
        this.connections = new Map();
        this.players = new Map();
        this.startIdleCheck();
    }

    public static getInstance(): PlaybackHandler {
        if (!PlaybackHandler.instance) {
            PlaybackHandler.instance = new PlaybackHandler();
        }
        return PlaybackHandler.instance;
    }

        /**
         * Waits for a song to finish downloading.
         *
         * @param queuedSong The song to wait for.
         * @returns A promise that resolves when the song has finished downloading.
         * @throws {Error} If the song takes longer than {@link MAX_WAIT_TIME} to download.
         */
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

        /**
         * Plays the next song in the queue for a guild.
         *
         * @param guild The guild to play the next song in.
         * @throws {Error} If an error occurs while trying to play the song.
         */
    private async playNextSong(guild: Guild): Promise<void> {
        const nextSong = queueHandler.getNextQueueItem(guild);
        if (!nextSong) {
            this.players.delete(guild.id);
            return;
        }

        try {
            await this.waitForDownload(nextSong);

            const audioPath = path.join(configHandler.SONGS_DIR, nextSong.song.Filename!);
            const resource = createAudioResource(audioPath);
            const player = this.players.get(guild.id);

            if (player) {
                player.play(resource);
            }
        } catch (error) {
            console.error('Error playing next song:', error);
            this.playNextSong(guild);
        }
    }

    /**
     * Retrieves the audio player for the specified guild.
     *
     * @param guild The guild for which to get the audio player.
     * @returns The audio player associated with the guild, or null if not found.
     */
    private getPlayer(guild: Guild): ReturnType<typeof createAudioPlayer> | null {
        return this.players.get(guild.id) || null;
    }

        /**
         * Checks if a song is currently playing in a guild.
         *
         * @param guild The guild to check.
         * @returns True if a song is playing, false otherwise.
         */
    private isPlaying(guild: Guild): boolean {
        const player = this.getPlayer(guild);
        return player?.state.status === AudioPlayerStatus.Playing;
    }

        /**
         * Starts a timer that checks for idle voice channels and stops playback in them.
         *
         * This function is used to implement the `PLAYBACK_IDLE_TIMEOUT` and `PLAYBACK_ACTIVE_TIMEOUT` settings.
         * It checks every {@link IDLE_CHECK_INTERVAL} milliseconds if there is only one person in the voice channel.
         * If there is, it checks how long the channel has been idle. If the idle time is greater than the idle timeout,
         * it stops playback. If the idle time is greater than the active timeout, it pauses playback.
         * If there is more than one person in the voice channel, it resets the idle time.
         */
    private startIdleCheck() {
        setInterval(() => {
            this.connections.forEach((connection, guildId) => {
                const guild = client.guilds.cache.get(guildId);
                const channel = connection.joinConfig.channelId;
                const voiceChannel = guild?.channels.cache.get(channel);

                if (voiceChannel && voiceChannel.members) {
                    if ('size' in voiceChannel.members) {
                        const memberCount = (voiceChannel.members as Collection<string, GuildMember>).size;
                        const now = Date.now();
                        const isPlaying = this.isPlaying(guild);
                        const idleTime = now - (this.idleTimestamps.get(guildId) || now);

                        if (memberCount === 1) {
                            if (!this.idleTimestamps.has(guildId)) {
                                this.idleTimestamps.set(guildId, now);
                            }
                            const idleTimeout = configHandler.getGuildSetting(guildId, 'PLAYBACK_IDLE_TIMEOUT', 'number');
                            const activeTimeout = configHandler.getGuildSetting(guildId, 'PLAYBACK_ACTIVE_TIMEOUT', 'number');

                            if (!isPlaying && idleTime > idleTimeout * 1000) {
                                this.stopPlayback(guild);
                            } else if (isPlaying && idleTime > activeTimeout * 1000) {
                                this.pausePlayback(guild);
                            }
                        } else {
                            this.idleTimestamps.delete(guildId);
                        }
                    }
                }
            });
        }, this.IDLE_CHECK_INTERVAL);
    }

    /**
     * Starts playback of the current song in the queue for the specified guild and member.
     *
     * @param guild The guild in which to start playback.
     * @param member The member requesting playback, used to determine the voice channel.
     * @throws {Error} If the member is not in a voice channel or if there are no songs in the queue.
     * Also throws if the connection cannot be subscribed to the player.
     */
    public async startPlayback(guild: Guild, member: GuildMember): Promise<void> {
        const voiceChannel = member.voice.channel;
        if (!voiceChannel) {
            throw new Error('You must be in a voice channel to play music!');
        }

        const currentSong = queueHandler.getCurrentQueueItem(guild);
        if (!currentSong) {
            throw new Error('No songs in queue!');
        }

        if (this.isPlaying(guild)) {
            return;
        }

        try {
            await this.waitForDownload(currentSong);

            let player = this.players.get(guild.id);
            if (!player) {
                player = createAudioPlayer();
                this.players.set(guild.id, player);

                player.on('error', error => {
                    console.error('Error:', error);
                    this.playNextSong(guild);
                });

                player.on(AudioPlayerStatus.Idle, () => {
                    this.playNextSong(guild);
                });
            }

            let connection = this.connections.get(guild.id);
            if (!connection) {
                connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: guild.id,
                    adapterCreator: guild.voiceAdapterCreator as DiscordGatewayAdapterCreator,
                });
                this.connections.set(guild.id, connection);
            }

            const audioPath = path.join(configHandler.SONGS_DIR, currentSong.song.Filename!);
            const resource = createAudioResource(audioPath);
            player.play(resource);

            if (!connection.subscribe(player)) {
                throw new Error('Failed to subscribe connection to player');
            }

        } catch (error) {
            throw error;
        }
    }



    /**
     * Pauses the playback for the specified guild.
     *
     * @param guild The guild for which to pause playback.
     * @returns True if the player was successfully paused, false otherwise.
     */
    public pausePlayback(guild: Guild): boolean {
        const player = this.getPlayer(guild);
        if (!player) {
            return false;
        }

        return player.pause();
    }

    /**
     * Resumes the playback for the specified guild.
     *
     * @param guild The guild for which to resume playback.
     * @returns True if the player was successfully resumed, false otherwise.
     */
    public resumePlayback(guild: Guild): boolean {
        const player = this.getPlayer(guild);
        if (!player) {
            return false;
        }

        return player.unpause();
    }

    /**
     * Stops the playback for the specified guild.
     *
     * This method stops the currently playing song, disconnects the voice connection, and clears the queue.
     *
     * @param guild The guild for which to stop playback.
     */
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

        queueHandler.clearQueue(guild);
    }

    /**
     * Skips the current song and plays the next one in the queue.
     *
     * If no active player is found for the guild, an error is thrown.
     *
     * @param guild The guild for which to skip the song.
     */
    public skipSong(guild: Guild): void {
        const player = this.getPlayer(guild);
        if (!player) {
            throw new Error('No active player found for this guild');
        }

        player.stop();
    }

    /**
     * Checks if the player is paused in the specified guild.
     *
     * Returns true if the player is paused, false if it is not, and null if no active player is found for the guild.
     *
     * @param guild The guild for which to check the player's state.
     * @returns True if the player is paused, false if it is not, or null if no active player is found.
     */
    public isGuildPlayerPaused(guild: Guild): boolean {
        const player = this.getPlayer(guild);
        return player ? player.state.status === AudioPlayerStatus.Paused : null;
    }

    /**
     * Returns the current playback progress in seconds for the specified guild.
     *
     * Returns null if no active player is found for the guild or if the player is not currently playing a song.
     *
     * @param guild The guild for which to get the playback progress.
     * @returns The playback progress in seconds, or null if not applicable.
     */
    public getPlaybackProgress(guild: Guild): number | null {
        const player = this.getPlayer(guild);
        if (player && player.state.status === AudioPlayerStatus.Playing) {
            const duration = player.state.playbackDuration;
            return duration / 1000;
        }
        return null;
    }

    /**
     * Cleans up all voice connections and players across all guilds.
     * This is primarily used during bot shutdown to ensure all resources are properly released.
     * 
     * @returns The number of connections that were cleaned up
     */
    public cleanupAllConnections(): number {
        let cleanupCount = 0;
        
        // Stop all players
        this.players.forEach((player, guildId) => {
            try {
                player.stop();
                this.players.delete(guildId);
                cleanupCount++;
            } catch (error) {
                console.error(`Error stopping player for guild ${guildId}:`, error);
            }
        });
        
        // Disconnect all voice connections
        this.connections.forEach((connection, guildId) => {
            try {
                connection.disconnect();
                this.connections.delete(guildId);
            } catch (error) {
                console.error(`Error disconnecting from guild ${guildId}:`, error);
            }
        });
        
        return cleanupCount;
    }
}

export const playbackHandler = PlaybackHandler.getInstance();
