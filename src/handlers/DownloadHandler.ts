import { promisify } from 'util';
import { exec } from 'child_process';
import path from 'path';
import { Song } from './MetaHandler';
import { configHandler } from './ConfigHandler';

const execPromise = promisify(exec);

export class DownloadHandler {
    constructor() {}

    private extractVideoId(url: string): string | null {
        const pattern = /(?:https?:\/\/)?(?:www\.)?youtu(?:be\.com|\.be)\/(?:watch\?v=)?([^&]+)/;
        const match = url.match(pattern);
        return match ? match[1] : null;
    }

    public async downloadSongMetadata(link: string): Promise<Song | null> {
        const videoId = this.extractVideoId(link);
        if (!videoId) {
            throw new Error('Invalid YouTube URL');
        }

        try {
            const cmd = `yt-dlp -j ${link}`;
            const { stdout } = await execPromise(cmd);
            const videoInfo = JSON.parse(stdout);
            const videoArtist = (videoInfo.channel || videoInfo.uploader)?.replace(' - Topic', '') || 'Unknown Artist';

            const song: Song = {
                Artist: videoArtist,
                Title: videoInfo.title,
                Thumbnail: videoInfo.thumbnail,
                Filename: null, // Start with null, will be set after download
                Link: link,
                Track: videoArtist + ' - ' + videoInfo.title,
                ID: videoId,
                Duration: videoInfo.duration
            };

            return song;
        } catch (error) {
            console.error('Error downloading song metadata:', error);
            return null;
        }
    }

    private async downloadSong(song: Song): Promise<boolean> {
        try {
            const filename = `${song.ID}.opus`;
            const outputPath = path.join(configHandler.SONGS_DIR, filename);
            const cmd = `yt-dlp -x --audio-format opus -o "${outputPath}" ${song.Link}`;
            
            await execPromise(cmd);
            
            // Update the song's filename after successful download
            song.Filename = filename;
            return true;
        } catch (error) {
            console.error('Error downloading song file:', error);
            return false;
        }
    }

    public async downloadSongAndMetadata(link: string): Promise<{ metadata: Song | null, downloadPromise: Promise<boolean> }> {
        // First get metadata
        const songMetadata = await this.downloadSongMetadata(link);
        if (!songMetadata) {
            return { metadata: null, downloadPromise: Promise.resolve(false) };
        }

        // Start the download process but don't wait for it
        const downloadPromise = this.downloadSong(songMetadata);

        return { metadata: songMetadata, downloadPromise };
    }
}

// Create a singleton instance
export const downloadHandler = new DownloadHandler();
