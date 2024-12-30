import path from 'path';
import dotenv from 'dotenv';
import Database from 'better-sqlite3';
import { Guild } from 'discord.js';
import * as fs from 'fs';

dotenv.config();

export class ConfigHandler {
    private static instance: ConfigHandler;
    private db: Database | null = null;
    
    private constructor() {
        this.initializeDatabase();
    }

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

    private initializeDatabase(): void {
        try {
            // Ensure cache directory exists
            const cacheDir = this.CACHE_DIR;
            if (!fs.existsSync(cacheDir)) {
                fs.mkdirSync(cacheDir, { recursive: true });
            }

            // Open SQLite database
            this.db = new Database(path.join(cacheDir, 'guild_settings.db'), {
                verbose: console.log
            });

            // Create settings table if it doesn't exist
            this.db.exec(`
                CREATE TABLE IF NOT EXISTS guild_settings (
                    guild_id TEXT,
                    setting_key TEXT,
                    setting_value TEXT,
                    PRIMARY KEY (guild_id, setting_key)
                )
            `);

            // Prepare statements for better performance
            this.db.pragma('journal_mode = WAL');
        } catch (error) {
            console.error('Failed to initialize database:', error);
            throw error;
        }
    }

    private getEnvOrDefault(key: string, defaultValue: string): string {
        return process.env[key] || defaultValue;
    }

    // Global Settings (from .env)
    public get DISCORD_TOKEN(): string {
        return this.getEnvOrDefault('DISCORD_TOKEN', '');
    }

    public get CLIENT_ID(): string {
        return this.getEnvOrDefault('CLIENT_ID', '');
    }

    public get CACHE_DIR(): string {
        return this.getEnvOrDefault('CACHE_DIR', './cache');
    }

    public get SONGS_DIR(): string {
        return path.join(this.CACHE_DIR, 'songs');
    }

    public get METADATA_FILE(): string {
        return path.join(this.CACHE_DIR, 'songs.json');
    }

    // Per-Guild Settings
    public getGuildSetting(guild: Guild | string, settingKey: string): string {
        const guildId = typeof guild === 'string' ? guild : guild.id;
        
        try {
            if (!this.db) {
                this.initializeDatabase();
            }

            // Try to get the guild-specific setting
            const stmt = this.db!.prepare('SELECT setting_value FROM guild_settings WHERE guild_id = ? AND setting_key = ?');
            const result = stmt.get(guildId, settingKey) as { setting_value: string } | undefined;

            if (result) {
                return result.setting_value;
            }

            // If no guild-specific setting, get from .env
            const envValue = this.getEnvOrDefault(settingKey, '');
            if (envValue !== '') {
                return envValue;
            }

            throw new Error(`Setting '${settingKey}' not found for guild ${guildId}`);
        } catch (error) {
            console.error(`Error getting setting '${settingKey}' for guild ${guildId}:`, error);
            throw error;
        }
    }

    public setGuildSetting(guild: Guild | string, settingKey: string, value: string): void {
        const guildId = typeof guild === 'string' ? guild : guild.id;
        
        try {
            if (!this.db) {
                this.initializeDatabase();
            }

            const stmt = this.db!.prepare(`
                INSERT INTO guild_settings (guild_id, setting_key, setting_value)
                VALUES (?, ?, ?)
                ON CONFLICT(guild_id, setting_key) DO UPDATE SET setting_value = ?
            `);
            
            stmt.run(guildId, settingKey, value, value);
        } catch (error) {
            console.error(`Error setting '${settingKey}' for guild ${guildId}:`, error);
            throw error;
        }
    }
}

export const configHandler = ConfigHandler.getInstance();
