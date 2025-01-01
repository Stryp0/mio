import { Message, InteractionReplyOptions, CommandInteraction, MessageCreateOptions, MessageEditOptions } from 'discord.js';
import { configHandler } from './ConfigHandler';

    /**
     * A class that handles message replies and edits with auto-deletion.
     * 
     * MessageHandler provides methods to reply to command interactions and regular messages, and to edit existing messages.
     * It also handles auto-deletion of messages based on guild settings.
     */
export class MessageHandler {
    private static instance: MessageHandler;

    private constructor() {}

    public static getInstance(): MessageHandler {
        if (!MessageHandler.instance) {
            MessageHandler.instance = new MessageHandler();
        }
        return MessageHandler.instance;
    }

    /**
     * Replies to a command interaction with the specified content and optionally handles auto-deletion.
     * 
     * @param interaction - The command interaction to reply to.
     * @param content - The content or options to use for the interaction reply.
     * @param isFinal - Indicates whether the reply should be auto-deleted after sending.
     */
    public async replyToInteraction(
        interaction: CommandInteraction,
        content: string | InteractionReplyOptions,
        isFinal: boolean = false
    ): Promise<void> {
        const options: InteractionReplyOptions = typeof content === 'string' 
            ? { content } 
            : content;

        // If ephemeral is enabled in config, set it
        if (configHandler.getGuildSetting(interaction.guild!, 'PRIVATE_BOT_REPLIES', 'boolean')) {
            options.ephemeral = true;
        }

        await interaction.reply(options);

        // Auto-delete if enabled and message is not ephemeral and is final
        if (isFinal && configHandler.getGuildSetting(interaction.guild!, 'DELETE_BOT_REPLIES', 'boolean') && !options.ephemeral) {
            setTimeout(async () => {
                try {
                    if (interaction.replied) {
                        const reply = await interaction.fetchReply();
                        await reply.delete();
                    }
                } catch (error) {
                    console.error('Failed to delete interaction reply:', error);
                }
            }, configHandler.getGuildSetting(interaction.guild!, 'DELETE_DELAY', 'number') * 1000);
        }
    }

    /**
     * Replies to a regular message with new content and optionally handles auto-deletion.
     * 
     * @param message - The original message to be replied to.
     * @param content - The new content or options for the message reply.
     * @param isFinal - Indicates whether the message should be auto-deleted after replying.
     * @returns The replied message.
     */
    public async replyToMessage(
        message: Message,
        content: string | MessageCreateOptions,
        isFinal: boolean = false
    ): Promise<Message> {
        const options: MessageCreateOptions = typeof content === 'string' 
            ? { content } 
            : content;

        const reply = await message.reply(options);

        if (isFinal) {
            // Handle auto-deletion based on settings
            const deleteDelay = configHandler.getGuildSetting(message.guild!, 'DELETE_DELAY', 'number') * 1000;
            
            // Delete bot reply if enabled
            if (configHandler.getGuildSetting(message.guild!, 'DELETE_BOT_REPLIES', 'boolean')) {
                setTimeout(async () => {
                    try {
                        await reply.delete();
                    } catch (error) {
                        console.error('Failed to delete bot reply:', error);
                    }
                }, deleteDelay);
            }

            // Delete user command if enabled
            if (configHandler.getGuildSetting(message.guild!, 'DELETE_USER_COMMANDS', 'boolean')) {
                setTimeout(async () => {
                    try {
                        await message.delete();
                    } catch (error) {
                        console.error('Failed to delete user command:', error);
                    }
                }, deleteDelay);
            }
        }

        return reply;
    }

    /**
     * Edits an existing message with new content and optionally handles auto-deletion.
     * 
     * @param message - The original message to be edited.
     * @param content - The new content or options for the message edit.
     * @param isFinal - Indicates whether the message should be auto-deleted after editing.
     * @returns The edited message.
     */
    public async editReply(
        message: Message,
        content: string | MessageEditOptions,
        isFinal: boolean = false
    ): Promise<Message> {
        const options: MessageEditOptions = typeof content === 'string'
            ? { content }
            : { ...content };

        const editedMessage = await message.edit(options);

        if (isFinal) {
            // Handle auto-deletion based on settings
            const deleteDelay = configHandler.getGuildSetting(message.guild!, 'DELETE_DELAY', 'number') * 1000;
            
            // Delete bot reply if enabled
            if (configHandler.getGuildSetting(message.guild!, 'DELETE_BOT_REPLIES', 'boolean')) {
                setTimeout(async () => {
                    try {
                        await editedMessage.delete();
                    } catch (error) {
                        console.error('Failed to delete bot reply:', error);
                    }
                }, deleteDelay);
            }
        }

        return editedMessage;
    }
}

export const messageHandler = MessageHandler.getInstance();
