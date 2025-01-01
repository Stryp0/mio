import { Client, Message } from "discord.js";
import fs from "fs";
import path from "path";
import { configHandler } from "./ConfigHandler";

type Command = {
    name: string;
    aliases?: string[];
    execute: (message: Message, args: string[]) => void;
};

/**
 * A singleton class responsible for handling command registration and execution.
 * 
 * CommandHandler manages the loading of command modules from a specified directory,
 * maps command names and aliases to their respective command handlers, and listens
 * for incoming messages to execute the appropriate commands based on user input.
 */
export class CommandHandler {
    private static instance: CommandHandler;
    private client: Client;
    private commands: Map<string, Command> = new Map();
    private aliases: Map<string, string> = new Map();

    private constructor() {
        this.commands = new Map();
        this.aliases = new Map();
    }

    public static getInstance(): CommandHandler {
        if (!CommandHandler.instance) {
            CommandHandler.instance = new CommandHandler();
        }
        return CommandHandler.instance;
    }

    public initialize(client: Client): void {
        this.client = client;
        this.loadCommands();
    }

    /**
     * Loads command modules from the specified directory and registers them.
     * 
     * This method reads all TypeScript files in the 'commands' directory, dynamically imports
     * each command module, and populates the `commands` and `aliases` maps with command names
     * and their respective aliases for quick lookup during command execution.
     * 
     * Ensures that each command is registered with its name and any available aliases.
     */
    private loadCommands(): void {
        const commandsPath = path.resolve(__dirname, "../commands");
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".ts"));

        for (const file of commandFiles) {
            const commandPath = path.join(commandsPath, file);
            const command = require(commandPath).default as Command;
            this.commands.set(command.name, command);
            
            if (command.aliases) {
                for (const alias of command.aliases) {
                    this.aliases.set(alias, command.name);
                }
            }
        }

        console.log(`Loaded ${this.commands.size} commands with ${this.aliases.size} aliases.`);
    }

    /**
     * Handles an incoming message from a guild member to see if it's a command invocation.
     * 
     * This method checks if the message content starts with the configured command prefix for
     * the guild, and if the message author is not a bot. If the message passes these checks, it
     * then parses the command name and arguments from the message content, looks up the command
     * in the `commands` map, and executes the command if it exists. If the command does not exist,
     * or if there is an error while executing the command, the user is notified of the error.
     * 
     * @param message - The incoming message to handle.
     */
    public handleMessage(message: Message): void {
        const prefix = configHandler.getGuildSetting(message.guild, 'COMMAND_PREFIX', 'string');

        if (!message.content.startsWith(prefix) || message.author.bot) return;

        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const commandName = args.shift()?.toLowerCase();

        if (!commandName) return;

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

export const commandHandler = CommandHandler.getInstance();
