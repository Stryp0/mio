import { Client, Message } from "discord.js";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

type Command = {
    name: string;
    execute: (message: Message, args: string[]) => void;
};

class CommandHandler {
    private client: Client;
    private commands: Map<string, Command> = new Map();
    private prefix: string;

    constructor(client: Client) {
        this.client = client;
        this.prefix = process.env.COMMAND_PREFIX || "!";
        this.loadCommands();
    }

    private loadCommands(): void {
        const commandsPath = path.resolve(__dirname, "../commands");
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".ts"));

        for (const file of commandFiles) {
            const commandPath = path.join(commandsPath, file);
            const command = require(commandPath).default as Command;
            this.commands.set(command.name, command);
        }

        console.log(`Loaded ${this.commands.size} commands.`);
    }

    public handleMessage(message: Message): void {
        // Ignore messages from bots or messages not starting with the prefix
        if (!message.content.startsWith(this.prefix) || message.author.bot) return;

        // Parse command and arguments
        const args = message.content.slice(this.prefix.length).trim().split(/ +/);
        const commandName = args.shift()?.toLowerCase();

        if (!commandName) return;

        // Find and execute the command
        const command = this.commands.get(commandName);
        if (command) {
            try {
                command.execute(message, args);
            } catch (error) {
                console.error(`Error executing command ${commandName}:`, error);
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

export default CommandHandler;
