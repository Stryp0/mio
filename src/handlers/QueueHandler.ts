import { Guild, User, GuildMember } from 'discord.js';
import { Song, metaHandler } from './MetaHandler';
import { EventEmitter } from 'events';
import { playbackHandler } from './PlaybackHandler';

export interface QueuedSong {
    song: Song;
    requestedBy: {
        id: string;
        username: string;
    };
}

/**
 * Class responsible for handling the queue of songs for a guild.
 * 
 * The QueueHandler class manages operations on the song queue, such as adding, removing, and shuffling songs. 
 * It also handles events related to queue updates and ensures that playback is started when necessary.
 */
export class QueueHandler extends EventEmitter {
    private static instance: QueueHandler;
    private queues: Map<string, QueuedSong[]>;

    private constructor() {
        super();
        this.queues = new Map<string, QueuedSong[]>();
    }

    public static getInstance(): QueueHandler {
        if (!QueueHandler.instance) {
            QueueHandler.instance = new QueueHandler();
        }
        return QueueHandler.instance;
    }

    /**
     * Clears the queue for a guild.
     * 
     * @param guild The guild for which to clear the queue.
     */
    public clearQueue(guild: Guild): void {
        this.queues.set(guild.id, []);
        this.emit('queueUpdate', guild);
    }

    /**
     * Adds a song link to the queue for a guild.
     *
     * This method fetches the song metadata from the provided link and adds it to the guild's queue.
     * It emits a 'queueUpdate' event after modifying the queue.
     * If the queue was previously empty, it attempts to start playback for the guild.
     *
     * @param guild The guild for which to add the song to the queue.
     * @param link The YouTube link of the song to be added.
     * @param requestedBy The user who requested the song.
     * @returns An object containing the song metadata and a download promise.
     * @throws {Error} If the song metadata could not be fetched.
     */
    public async addLinkToQueue(guild: Guild, link: string, requestedBy: User): Promise<{ metadata: Song | null, downloadPromise: Promise<boolean> }> {
        const result = await metaHandler.getSongMetadata(link);
        if (!result.metadata) {
            throw new Error('Could not fetch song metadata');
        }
        
        if (!this.queues.has(guild.id)) {
            this.queues.set(guild.id, []);
        }
        
        const queue = this.queues.get(guild.id);
        this.queues.get(guild.id)?.push({
            song: result.metadata,
            requestedBy: {
                id: requestedBy.id,
                username: requestedBy.username
            }
        });
        this.emit('queueUpdate', guild);
        
        if (queue && queue.length <= 1) {
            try {
                const member = await guild.members.fetch(requestedBy.id);
                await playbackHandler.startPlayback(guild, member);
            } catch (error) {
                console.error('Error starting playback:', error);
            }
        }
        
        return { metadata: result.metadata, downloadPromise: result.downloadPromise };
    }

    /**
     * Retrieves the current song being played in the queue for a guild.
     * 
     * @param guild The guild for which to get the current queue item.
     * @returns The current queued song, or null if the queue is empty.
     */
    public getCurrentQueueItem(guild: Guild): QueuedSong | null {
        const queue = this.queues.get(guild.id);
        if (!queue || queue.length === 0) {
            return null;
        }
        return queue[0];
    }

    /**
     * Retrieves the next song in the queue for a guild, removing it from the queue in the process.
     * 
     * @param guild The guild for which to get the next queue item.
     * @returns The next queued song, or null if the queue is empty.
     */
    public getNextQueueItem(guild: Guild): QueuedSong | null {
        const queue = this.queues.get(guild.id);
        if (!queue || queue.length === 0) {
            return null;
        }

        queue.shift();
        
        this.emit('queueUpdate', guild);
        
        return queue.length > 0 ? queue[0] : null;
    }

    /**
     * Clears the queue for a guild, except for the current song.
     * 
     * @param guild The guild for which to clear the queue.
     */
    public clearQueueExceptCurrent(guild: Guild): void {
        const queue = this.queues.get(guild.id);
        if (!queue || queue.length === 0) {
            return;
        }
        
        const currentSong = queue[0];
        this.queues.set(guild.id, [currentSong]);
        this.emit('queueUpdate', guild);
    }

    /**
     * Shuffles the queue of songs for a guild, except for the current song.
     * 
     * @param guild The guild for which to shuffle the queue.
     */
    public shuffleQueue(guild: Guild): void {
        const queue = this.queues.get(guild.id);
        if (!queue || queue.length <= 1) {
            return;
        }

        const currentSong = queue[0];
        const remainingSongs = queue.slice(1);

        for (let i = remainingSongs.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [remainingSongs[i], remainingSongs[j]] = [remainingSongs[j], remainingSongs[i]];
        }

        this.queues.set(guild.id, [currentSong, ...remainingSongs]);
        this.emit('queueUpdate', guild);
    }

    /**
     * Moves a song from one index to another in the queue for a guild.
     * 
     * @param guild The guild for which to move the song.
     * @param fromIndex The index of the song to move.
     * @param toIndex The new index of the song.
     * @returns True if the song was successfully moved, false if the indices were invalid.
     */
    public moveSong(guild: Guild, fromIndex: number, toIndex: number): boolean {
        const queue = this.queues.get(guild.id);
        if (!queue || queue.length === 0) {
            return false;
        }

        if (fromIndex < 0 || fromIndex >= queue.length || 
            toIndex < 0 || toIndex >= queue.length ||
            fromIndex === toIndex) {
            return false;
        }

        const [song] = queue.splice(fromIndex, 1);
        queue.splice(toIndex, 0, song);
        this.emit('queueUpdate', guild);
        return true;
    }

    /**
     * Removes a song from the queue for a guild at a specified index.
     *
     * @param guild The guild for which to remove the song.
     * @param index The index of the song to remove.
     * @returns The removed song, or null if the index was invalid.
     */
    public removeSong(guild: Guild, index: number): QueuedSong | null {
        const queue = this.queues.get(guild.id);
        if (!queue || queue.length === 0) {
            return null;
        }

        if (index < 0 || index >= queue.length) {
            return null;
        }

        const [removedSong] = queue.splice(index, 1);
        this.emit('queueUpdate', guild);
        return removedSong;
    }

    /**
     * Retrieves the queue of songs for a guild.
     *
     * @param guild The guild for which to get the queue.
     * @returns The queue of songs, or an empty array if the queue is empty.
     */
    public getQueue(guild: Guild): QueuedSong[] {
        return this.queues.get(guild.id) || [];
    }
}

export const queueHandler = QueueHandler.getInstance();
