import {
  type User,
  type InsertUser,
  type PasswordResetToken,
  users,
  passwordResetTokens,
} from "@shared/schema";
import { eq, and, isNull } from "drizzle-orm";
import type { db as DbType } from "../db";
import { randomUUID } from "crypto";

type Db = typeof DbType;

export async function getUser(db: Db, id: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user;
}

export async function getUserByEmail(db: Db, email: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
  return user;
}

export async function createUser(db: Db, insertUser: InsertUser): Promise<User> {
  const id = randomUUID();
  const [user] = await db.insert(users).values({
    id,
    ...insertUser,
  }).returning();
  return user;
}

export async function updateUser(db: Db, id: string, updates: Partial<Pick<User, 'name' | 'passwordHash' | 'salt' | 'googleId'>>): Promise<User | undefined> {
  const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
  return user;
}

export async function createPasswordResetToken(db: Db, userId: string, token: string, expiresAt: Date): Promise<PasswordResetToken> {
  const id = randomUUID();
  const [row] = await db.insert(passwordResetTokens).values({ id, userId, token, expiresAt }).returning();
  return row;
}

export async function getPasswordResetToken(db: Db, token: string): Promise<PasswordResetToken | undefined> {
  const [row] = await db.select().from(passwordResetTokens)
    .where(and(eq(passwordResetTokens.token, token), isNull(passwordResetTokens.usedAt)));
  return row;
}

export async function markTokenUsed(db: Db, tokenId: string): Promise<void> {
  await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, tokenId));
}
