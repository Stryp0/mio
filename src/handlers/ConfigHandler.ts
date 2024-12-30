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

    private getEnvOrThrow(key: string): string {
        const value = process.env[key];
        if (!value) {
            throw new Error(`Environment variable '${key}' must be set in .env file`);
        }
        return value;
    }

    private convertToBoolean(value: string): boolean {
        const lowercased = value.toLowerCase();
        if (lowercased === 'true') return true;
        if (lowercased === 'false') return false;
        throw new Error(`Invalid boolean value: ${value}`);
    }

    private convertToNumber(value: string): number {
        const num = Number(value);
        if (isNaN(num)) {
            throw new Error(`Invalid number value: ${value}`);
        }
        return num;
    }

    // Global Settings (from .env)
    public get DISCORD_TOKEN(): string {
        return this.getEnvOrThrow('DISCORD_TOKEN');
    }

    public get CLIENT_ID(): string {
        return this.getEnvOrThrow('CLIENT_ID');
    }

    public get CACHE_DIR(): string {
        return this.getEnvOrThrow('CACHE_DIR');
    }

    public get SONGS_DIR(): string {
        return path.join(this.CACHE_DIR, 'songs');
    }

    public get METADATA_FILE(): string {
        return path.join(this.CACHE_DIR, 'songs.json');
    }

    // Per-Guild Settings with type conversion
    public getGuildSetting(guild: Guild | string, settingKey: string, type: 'string'): string;
    public getGuildSetting(guild: Guild | string, settingKey: string, type: 'number'): number;
    public getGuildSetting(guild: Guild | string, settingKey: string, type: 'boolean'): boolean;
    public getGuildSetting(guild: Guild | string, settingKey: string, type: 'string' | 'number' | 'boolean' = 'string'): string | number | boolean {
        const guildId = typeof guild === 'string' ? guild : guild.id;
        
        try {
            if (!this.db) {
                this.initializeDatabase();
            }

            // Try to get the guild-specific setting
            const stmt = this.db!.prepare('SELECT setting_value FROM guild_settings WHERE guild_id = ? AND setting_key = ?');
            const result = stmt.get(guildId, settingKey) as { setting_value: string } | undefined;

            // Get the value either from DB or .env
            const rawValue = result ? result.setting_value : this.getEnvOrThrow(settingKey);

            // Convert the value based on the requested type
            switch (type) {
                case 'boolean':
                    return this.convertToBoolean(rawValue);
                case 'number':
                    return this.convertToNumber(rawValue);
                default:
                    return rawValue;
            }
        } catch (error) {
            console.error(`Error getting setting '${settingKey}' for guild ${guildId}:`, error);
            throw error;
        }
    }

    public setGuildSetting(guild: Guild | string, settingKey: string, value: string | number | boolean): void {
        const guildId = typeof guild === 'string' ? guild : guild.id;
        const stringValue = String(value);
        
        try {
            if (!this.db) {
                this.initializeDatabase();
            }

            const stmt = this.db!.prepare(`
                INSERT INTO guild_settings (guild_id, setting_key, setting_value)
                VALUES (?, ?, ?)
                ON CONFLICT(guild_id, setting_key) DO UPDATE SET setting_value = ?
            `);
            
            stmt.run(guildId, settingKey, stringValue, stringValue);
        } catch (error) {
            console.error(`Error setting '${settingKey}' for guild ${guildId}:`, error);
            throw error;
        }
    }
}

export const configHandler = ConfigHandler.getInstance();
