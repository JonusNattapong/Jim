import { z } from "zod";
import type { ToolDefinition, ToolHandler } from "./types.js";
import { MailboxService } from "../services/mailbox.ts";

export const mailbox_definition: ToolDefinition = {
  name: "mailbox",
  function: {
    name: "mailbox",
    description: "Send or read messages to/from the agent mailbox. Useful for sub-agents to report progress or for the main agent to check for task updates.",
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["send", "read", "clear"], description: "The action to perform" },
        from: { type: "string", description: "Sender name (for 'send')" },
        to: { type: "string", description: "Recipient name (defaults to 'main')" },
        subject: { type: "string", description: "Message subject" },
        body: { type: "string", description: "Message body content" }
      },
      required: ["action"]
    }
  }
};

export const mailbox_handler: ToolHandler = async (args: any, context) => {
  const mailbox = new MailboxService(context.projectRoot || process.cwd());
  await mailbox.init();

  switch (args.action) {
    case "send": {
      if (!args.subject || !args.body) {
        return { content: "Error: 'subject' and 'body' are required for 'send'.", isError: true };
      }
      const id = await mailbox.sendMessage(args.from || "unknown", args.subject, args.body, args.to);
      return { content: `Message sent to ${args.to || "main"} with ID: ${id}` };
    }
    case "read": {
      const messages = await mailbox.readMessages(args.to || "main");
      if (messages.length === 0) return { content: "Mailbox is empty." };
      
      const formatted = messages.map(m => 
        `--- FROM: ${m.from} --- SUBJECT: ${m.subject} ---\n${m.body}\n`
      ).join("\n");
      
      return { content: `Messages for ${args.to || "main"}:\n\n${formatted}` };
    }
    case "clear": {
      await mailbox.clearMailbox(args.to || "main");
      return { content: `Mailbox for ${args.to || "main"} cleared.` };
    }
    default:
      return { content: `Invalid action: ${args.action}`, isError: true };
  }
};
