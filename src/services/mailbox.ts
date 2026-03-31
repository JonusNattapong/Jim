import fs from "fs/promises";
import path from "path";

export interface MailboxMessage {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  timestamp: number;
  read: boolean;
}

export class MailboxService {
  private mailboxPath: string;

  constructor(workspaceDir: string) {
    this.mailboxPath = path.join(workspaceDir, ".jim", "mailbox", "messages.json");
  }

  async init(): Promise<void> {
    await fs.mkdir(path.dirname(this.mailboxPath), { recursive: true });
    try {
      await fs.access(this.mailboxPath);
    } catch {
      await fs.writeFile(this.mailboxPath, JSON.stringify([], null, 2));
    }
  }

  async sendMessage(from: string, subject: string, body: string, to: string = "main"): Promise<string> {
    const data = await fs.readFile(this.mailboxPath, "utf-8");
    const messages: MailboxMessage[] = JSON.parse(data);
    
    const id = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const msg: MailboxMessage = {
      id,
      from,
      to,
      subject,
      body,
      timestamp: Date.now(),
      read: false,
    };
    
    messages.push(msg);
    await fs.writeFile(this.mailboxPath, JSON.stringify(messages, null, 2));
    return id;
  }

  async readMessages(to: string = "main", includeRead: boolean = false): Promise<MailboxMessage[]> {
    const data = await fs.readFile(this.mailboxPath, "utf-8");
    const messages: MailboxMessage[] = JSON.parse(data);
    
    const result = messages.filter(m => m.to === to && (includeRead || !m.read));
    
    // Mark as read
    for (const m of messages) {
      if (m.to === to) m.read = true;
    }
    await fs.writeFile(this.mailboxPath, JSON.stringify(messages, null, 2));
    
    return result;
  }

  async clearMailbox(to: string = "main"): Promise<void> {
    const data = await fs.readFile(this.mailboxPath, "utf-8");
    let messages: MailboxMessage[] = JSON.parse(data);
    messages = messages.filter(m => m.to !== to);
    await fs.writeFile(this.mailboxPath, JSON.stringify(messages, null, 2));
  }
}
