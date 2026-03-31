import { randomBytes, createHmac } from "node:crypto";

export function generateToken(length = 32): string {
  return randomBytes(length).toString("hex");
}

export async function hashPassword(password: string): Promise<string> {
  const { scrypt } = await import("node:crypto");
  return new Promise((resolve, reject) => {
    const salt = randomBytes(16).toString("hex");
    scrypt(password, salt, 64, (err, derived) => {
      if (err) reject(err);
      else resolve(salt + ":" + derived.toString("hex"));
    });
  });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const { scrypt } = await import("node:crypto");
  const [salt, key] = hash.split(":");
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, (err, derived) => {
      if (err) reject(err);
      else resolve(derived.toString("hex") === key);
    });
  });
}

export function createSessionToken(userId: string, expiresIn = 86400): string {
  const payload = { userId, exp: Date.now() + expiresIn * 1000 };
  const sig = createHmac("sha256", "jim-session-secret").update(JSON.stringify(payload)).digest("hex");
  return Buffer.from(JSON.stringify(payload)).toString("base64url") + "." + sig;
}

export function verifySessionToken(token: string): { userId: string; exp: number } | null {
  try {
    const [data, sig] = token.split(".");
    const payload = JSON.parse(Buffer.from(data, "base64url").toString());
    const expected = createHmac("sha256", "jim-session-secret").update(JSON.stringify(payload)).digest("hex");
    if (sig !== expected || payload.exp < Date.now()) return null;
    return payload;
  } catch { return null; }
}
