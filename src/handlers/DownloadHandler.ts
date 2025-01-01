import { promisify } from 'util';
import { exec } from 'child_process';
import path from 'path';
import { Song } from './MetaHandler';
import { configHandler } from './ConfigHandler';

const execPromise = promisify(exec);

    /**
     * Class responsible for downloading songs and their metadata from YouTube.
     *
     * The DownloadHandler class is responsible for downloading the metadata of songs from YouTube,
     * as well as downloading the song files themselves. It provides methods for downloading
     * song metadata, downloading song files, and downloading both simultaneously.
     */
export class DownloadHandler {
    private static instance: DownloadHandler;

    private constructor() {}

    public static getInstance(): DownloadHandler {
        if (!DownloadHandler.instance) {
            DownloadHandler.instance = new DownloadHandler();
        }
        return DownloadHandler.instance;
    }

    /**
     * Extracts the video ID from a YouTube URL.
     *
     * @param url - The YouTube URL to extract the video ID from.
     * @returns The extracted video ID if the URL is valid, otherwise null.
     */
    private extractVideoId(url: string): string | null {
        const pattern = /(?:https?:\/\/)?(?:www\.)?youtu(?:be\.com|\.be)\/(?:watch\?v=)?([^&]+)/;
        const match = url.match(pattern);
        return match ? match[1] : null;
    }

    /**
     * Removes markdown characters from a given text string.
     *
     * This function strips characters commonly used for markdown formatting,
     * such as asterisks, underscores, and brackets, to prevent formatting 
     * issues when displaying text in environments that interpret markdown.
     *
     * @param text - The input text from which to remove markdown characters.
     * @returns A new string with markdown characters removed.
     */
    private cleanMarkdownCharacters(text: string): string {
        return text.replace(/[\*\_\#\[\]\(\)\~\`\>\|\\\{\}]/g, '');
    }

    /**
     * Downloads the metadata for a given YouTube song.
     *
     * This method uses yt-dlp to fetch the metadata of a YouTube video, including
     * the video title, artist (uploader), thumbnail, and duration.
     *
     * @param link - The YouTube URL of the song to download.
     * @returns A Song object containing the fetched metadata if the operation is
     * successful, otherwise null.
     * @throws {Error} If the YouTube URL is invalid.
     */
    public async downloadSongMetadata(link: string): Promise<Song | null> {
        const videoId = this.extractVideoId(link);
        if (!videoId) {
            throw new Error('Invalid YouTube URL');
        }

        try {
            const cmd = `yt-dlp -j ${link}`;
            const { stdout } = await execPromise(cmd);
            const videoInfo = JSON.parse(stdout);
            const rawVideoArtist = (videoInfo.channel || videoInfo.uploader)?.replace(' - Topic', '') || 'Unknown Artist';
            const videoArtist = this.cleanMarkdownCharacters(rawVideoArtist);
            const videoTitle = this.cleanMarkdownCharacters(videoInfo.title);

            const song: Song = {
                Artist: videoArtist,
                Title: videoTitle,
                Thumbnail: videoInfo.thumbnail,
                Filename: null,
                Link: link,
                Track: videoArtist + ' - ' + videoTitle,
                ID: videoId,
                Duration: videoInfo.duration
            };

            return song;
        } catch (error) {
            console.error('Error downloading song metadata:', error);
            return null;
        }
    }

    /**
     * Downloads the audio file for a given song.
     *
     * This method uses yt-dlp to download the audio file for a YouTube video.
     * It saves the file in the directory specified in the SONGS_DIR environment variable,
     * with the filename being the video ID with an .opus extension.
     *
     * @param song - The song to download the audio file for.
     * @returns A boolean indicating whether the download was successful.
     * @throws {Error} If the download fails for any reason.
     */
    private async downloadSong(song: Song): Promise<boolean> {
        try {
            const filename = `${song.ID}.opus`;
            const outputPath = path.join(configHandler.SONGS_DIR, filename);
            const cmd = `yt-dlp -x --audio-format opus -o "${outputPath}" ${song.Link}`;
            
            await execPromise(cmd);
            
            song.Filename = filename;
            return true;
        } catch (error) {
            console.error('Error downloading song file:', error);
            return false;
        }
    }

    /**
     * Downloads the metadata and audio file for a given song.
     *
     * This method first downloads the metadata for the song using downloadSongMetadata.
     * If the metadata download fails, it returns an object with null metadata and a resolved promise.
     * If the metadata download succeeds, it downloads the audio file for the song using downloadSong,
     * and returns an object with the metadata and a promise that resolves when the download is complete.
     *
     * @param link - The YouTube link of the song to download.
     * @returns An object containing the song metadata and a download promise.
     */
    public async downloadSongAndMetadata(link: string): Promise<{ metadata: Song | null, downloadPromise: Promise<boolean> }> {
        const songMetadata = await this.downloadSongMetadata(link);
        if (!songMetadata) {
            return { metadata: null, downloadPromise: Promise.resolve(false) };
        }

        const downloadPromise = this.downloadSong(songMetadata);

        return { metadata: songMetadata, downloadPromise };
    }
}

export const downloadHandler = DownloadHandler.getInstance();
