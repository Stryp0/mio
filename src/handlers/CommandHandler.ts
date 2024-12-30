import { Client, Message } from "discord.js";
import fs from "fs";
import path from "path";
import { configHandler } from "./ConfigHandler";

type Command = {
    name: string;
    aliases?: string[];
    execute: (message: Message, args: string[]) => void;
};

class CommandHandler {
    private static instance: CommandHandler;
    private client: Client;
    private commands: Map<string, Command> = new Map();
    private aliases: Map<string, string> = new Map();

    private constructor(client: Client) {
        this.client = client;
        this.loadCommands();
    }

    public static getInstance(client: Client): CommandHandler {
        if (!CommandHandler.instance) {
            CommandHandler.instance = new CommandHandler(client);
        }
        return CommandHandler.instance;
    }

    private loadCommands(): void {
        const commandsPath = path.resolve(__dirname, "../commands");
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".ts"));

        for (const file of commandFiles) {
            const commandPath = path.join(commandsPath, file);
            const command = require(commandPath).default as Command;
            this.commands.set(command.name, command);
            
            // Register aliases if they exist
            if (command.aliases) {
                for (const alias of command.aliases) {
                    this.aliases.set(alias, command.name);
                }
            }
        }

        console.log(`Loaded ${this.commands.size} commands with ${this.aliases.size} aliases.`);
    }

    public handleMessage(message: Message): void {
        // Get guild-specific prefix (falls back to .env if not set)
        const prefix = configHandler.getGuildSetting(message.guild || message.guildId || '', 'COMMAND_PREFIX');

        // Ignore messages from bots or messages not starting with the prefix
        if (!message.content.startsWith(prefix) || message.author.bot) return;

        // Parse command and arguments
        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const commandName = args.shift()?.toLowerCase();

        if (!commandName) return;

        // Find and execute the command (check both command name and aliases)
        const mainCommandName = this.aliases.get(commandName) || commandName;
        const command = this.commands.get(mainCommandName);
        if (command) {
            try {
                command.execute(message, args);
            } catch (error) {
                console.error(`Error executing command ${mainCommandName}:`, error);
                message.reply("There was an error while executing that command!");
            }
        } else {
            message.reply("I don't recognize that command!");
        }
    }

    public listen(): void {
        this.client.on("messageCreate", (message) => this.handleMessage(message));
    }
}

export default CommandHandler.getInstance;
