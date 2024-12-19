import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

export class ConfigHandler {
    private static instance: ConfigHandler;
    
    private constructor() {}

    public static getInstance(): ConfigHandler {
        
        if (!ConfigHandler.instance) {
            ConfigHandler.instance = new ConfigHandler();
        }

        // Check if required environment variables are set
        if (!ConfigHandler.instance.DISCORD_TOKEN || !ConfigHandler.instance.CLIENT_ID) {
            throw new Error('DISCORD_TOKEN and CLIENT_ID environment variables must be set');
        }

        return ConfigHandler.instance;
    }

    private getEnvOrDefault(key: string, defaultValue: string): string {
        return process.env[key] || defaultValue;
    }

    // Bot Configuration
    public get DISCORD_TOKEN(): string {
        return this.getEnvOrDefault('DISCORD_TOKEN', '');
    }

    public get CLIENT_ID(): string {
        return this.getEnvOrDefault('CLIENT_ID', '');
    }

    public get COMMAND_PREFIX(): string {
        return this.getEnvOrDefault('COMMAND_PREFIX', '!');
    }

    // File System Configuration
    public get CACHE_DIR(): string {
        return this.getEnvOrDefault('CACHE_DIR', './cache');
    }

    public get SONGS_DIR(): string {
        return path.join(this.CACHE_DIR, 'songs');
    }

    public get METADATA_FILE(): string {
        return path.join(this.CACHE_DIR, 'songs.json');
    }

    // Bot Behavior Configuration
    public get DELETE_BOT_COMMANDS(): boolean {
        return this.getEnvOrDefault('DELETE_BOT_COMMANDS', 'false') === 'true';
    }

    public get SEARCH_USE_SELECTMENU(): boolean {
        return this.getEnvOrDefault('SEARCH_USE_SELECTMENU', 'false') === 'true';
    }
}

export const configHandler = ConfigHandler.getInstance();
