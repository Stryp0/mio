import fs from 'fs';
import { downloadHandler } from './DownloadHandler';
import { configHandler } from './ConfigHandler';

export interface Song {
    Artist: string;
    Title: string;
    Thumbnail: string;
    Filename: string | null; // null when not yet downloaded
    Link: string;
    Track: string;
    ID: string;
    Duration: number;
}

export class MetaHandler {
    private songs: Map<string, Song>;

    constructor() {
        this.songs = new Map<string, Song>();
        this.initializeCache();
        this.loadSongsDatabase();
    }

    private initializeCache(): void {
        // Check and create cache directory
        if (!fs.existsSync(configHandler.CACHE_DIR)) {
            fs.mkdirSync(configHandler.CACHE_DIR);
        }

        // Check and create songs directory
        if (!fs.existsSync(configHandler.SONGS_DIR)) {
            fs.mkdirSync(configHandler.SONGS_DIR);
        }

        // Check and create songs.json if it doesn't exist
        if (!fs.existsSync(configHandler.METADATA_FILE)) {
            fs.writeFileSync(configHandler.METADATA_FILE, JSON.stringify({}));
        }
    }

    private loadSongsDatabase(): void {
        try {
            const data = fs.readFileSync(configHandler.METADATA_FILE, 'utf8');
            const songsObject = JSON.parse(data);
            
            // Convert the plain object to Map
            this.songs = new Map(Object.entries(songsObject));
        } catch (error) {
            console.error('Error loading songs database:', error);
            this.songs = new Map();
        }
    }

    private saveSongsDatabase(): void {
        try {
            const songsObject = Object.fromEntries(this.songs);
            fs.writeFileSync(configHandler.METADATA_FILE, JSON.stringify(songsObject, null, 2));
        } catch (error) {
            console.error('Error saving songs database:', error);
        }
    }

    public async getSongMetadata(link: string): Promise<{ metadata: Song | null, downloadPromise: Promise<boolean> }> {
        // Check if song exists in database
        if (this.songs.has(link)) {
            return { 
                metadata: this.songs.get(link) || null,
                downloadPromise: Promise.resolve(true)
            };
        }
        
        // If not found, request DownloadHandler to fetch metadata and download song
        const result = await downloadHandler.downloadSongAndMetadata(link);
        if (result.metadata) {
            // Save metadata immediately for quick response
            this.songs.set(link, result.metadata);
            this.saveSongsDatabase();

            // Update filename after download completes
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

// Create a singleton instance
export const metaHandler = new MetaHandler();
