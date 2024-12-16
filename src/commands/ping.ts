import { Message } from "discord.js";

export default {
    name: "ping",
    execute: (message: Message) => {
        message.reply("pong!");
    },
};
