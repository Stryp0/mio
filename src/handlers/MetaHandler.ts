import fs from 'fs';
import { downloadHandler } from './DownloadHandler';
import { configHandler } from './ConfigHandler';

export interface Song {
    Artist: string;
    Title: string;
    Thumbnail: string;
    Filename: string | null;
    Link: string;
    Track: string;
    ID: string;
    Duration: number;
}

    /**
     * A class that handles the metadata of songs, such as the artist, title, and link.
     * 
     * The class is responsible for:
     * - Initializing the cache directory and songs directory if they do not exist
     * - Loading the songs database from the metadata file
     * - Saving the songs database to the metadata file
     * - Getting the metadata of a song from the database, or downloading it from YouTube if it does not exist
     */
export class MetaHandler {
    private static instance: MetaHandler;
    private songs: Map<string, Song>;

    private constructor() {
        this.songs = new Map<string, Song>();
        this.initializeCache();
        this.loadSongsDatabase();
    }

    public static getInstance(): MetaHandler {
        if (!MetaHandler.instance) {
            MetaHandler.instance = new MetaHandler();
        }
        return MetaHandler.instance;
    }

        /**
         * Initializes the cache directory, songs directory, and metadata file if they do not exist.
         * 
         * This method is called in the constructor of the MetaHandler class.
         * The cache directory and songs directory are created if they do not exist.
         * The metadata file is created if it does not exist, and an empty object is written to it as the initial contents.
         */
    private initializeCache(): void {
        if (!fs.existsSync(configHandler.CACHE_DIR)) {
            fs.mkdirSync(configHandler.CACHE_DIR);
        }

        if (!fs.existsSync(configHandler.SONGS_DIR)) {
            fs.mkdirSync(configHandler.SONGS_DIR);
        }

        if (!fs.existsSync(configHandler.METADATA_FILE)) {
            fs.writeFileSync(configHandler.METADATA_FILE, JSON.stringify({}));
        }
    }

        /**
         * Loads the songs database from the metadata file.
         * 
         * This method is called in the constructor of the MetaHandler class.
         * The method reads the contents of the metadata file, parses it as a JSON object,
         * and creates a new Map from the object's entries.
         * If the metadata file does not exist or could not be parsed, an empty Map is created instead.
         */
    private loadSongsDatabase(): void {
        try {
            const data = fs.readFileSync(configHandler.METADATA_FILE, 'utf8');
            const songsObject = JSON.parse(data);
            
            this.songs = new Map(Object.entries(songsObject));
        } catch (error) {
            console.error('Error loading songs database:', error);
            this.songs = new Map();
        }
    }

        /**
         * Saves the songs database to the metadata file.
         * 
         * This method converts the songs Map to an object, then writes it to the metadata file as a JSON string.
         * If the write fails, an error is logged to the console.
         */
    private saveSongsDatabase(): void {
        try {
            const songsObject = Object.fromEntries(this.songs);
            fs.writeFileSync(configHandler.METADATA_FILE, JSON.stringify(songsObject, null, 2));
        } catch (error) {
            console.error('Error saving songs database:', error);
        }
    }

        /**
         * Gets the metadata of a song from the provided link.
         * 
         * The method first checks if the song is in the cache, and if it is, it returns the cached metadata and a resolved promise.
         * If the song is not in the cache, it downloads the metadata and adds it to the cache.
         * The method returns an object containing the song metadata and a download promise.
         * The download promise is resolved when the song has finished downloading.
         * If the song is already in the cache, the download promise is resolved immediately.
         * If the song metadata could not be fetched, the method returns null for the metadata and a rejected promise.
         * 
         * @param link The YouTube link of the song for which to get the metadata.
         * @returns An object containing the song metadata and a download promise.
         */
    public async getSongMetadata(link: string): Promise<{ metadata: Song | null, downloadPromise: Promise<boolean> }> {
        if (this.songs.has(link)) {
            return { 
                metadata: this.songs.get(link) || null,
                downloadPromise: Promise.resolve(true)
            };
        }
        
        const result = await downloadHandler.downloadSongAndMetadata(link);
        if (result.metadata) {
            this.songs.set(link, result.metadata);
            this.saveSongsDatabase();

            result.downloadPromise.then(() => {
                if (result.metadata) {
                    this.songs.set(link, result.metadata);
                    this.saveSongsDatabase();
                }
            }).catch(error => {
                console.error('Error updating song filename:', error);
            });
        }
        
        return result;
    }
}

export const metaHandler = MetaHandler.getInstance();
