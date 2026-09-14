import {
  type Conversation,
  type InsertConversation,
  conversations,
  type Message,
  type InsertMessage,
  messages,
  type AiProposal,
  type InsertAiProposal,
  aiProposals,
  authTokens,
} from "@shared/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import type { db as DbType } from "../db";

type Db = typeof DbType;

export async function getAuthToken(db: Db, token: string): Promise<{ userId: string; userEmail: string; userName: string; expiresAt: Date } | undefined> {
  const [result] = await db.select().from(authTokens).where(eq(authTokens.token, token));
  if (!result) return undefined;
  return {
    userId: result.userId,
    userEmail: result.userEmail,
    userName: result.userName,
    expiresAt: result.expiresAt,
  };
}

export async function createAuthToken(db: Db, token: string, userId: string, userEmail: string, userName: string, expiresAt: Date): Promise<void> {
  await db.insert(authTokens).values({
    token,
    userId,
    userEmail,
    userName,
    expiresAt,
  });
}

export async function deleteAuthToken(db: Db, token: string): Promise<void> {
  await db.delete(authTokens).where(eq(authTokens.token, token));
}

export async function getProposal(db: Db, id: string, userId: string): Promise<AiProposal | undefined> {
  const [proposal] = await db.select()
    .from(aiProposals)
    .where(and(
      eq(aiProposals.id, id),
      eq(aiProposals.userId, userId)
    ));
  return proposal;
}

export async function getProposalsByUser(db: Db, userId: string, projectId?: string): Promise<AiProposal[]> {
  if (projectId) {
    return db.select()
      .from(aiProposals)
      .where(and(
        eq(aiProposals.userId, userId),
        eq(aiProposals.projectId, projectId)
      ))
      .orderBy(desc(aiProposals.createdAt));
  }
  return db.select()
    .from(aiProposals)
    .where(eq(aiProposals.userId, userId))
    .orderBy(desc(aiProposals.createdAt));
}

export async function createProposal(db: Db, proposal: InsertAiProposal): Promise<AiProposal> {
  const [created] = await db.insert(aiProposals).values(proposal).returning();
  return created;
}

export async function updateProposalStatus(db: Db, id: string, userId: string, status: string, reason?: string): Promise<AiProposal | undefined> {
  const [updated] = await db.update(aiProposals)
    .set({
      status,
      resolvedAt: new Date(),
    })
    .where(and(
      eq(aiProposals.id, id),
      eq(aiProposals.userId, userId)
    ))
    .returning();
  return updated;
}

export async function deleteProposal(db: Db, id: string, userId: string): Promise<boolean> {
  const result = await db.delete(aiProposals)
    .where(and(
      eq(aiProposals.id, id),
      eq(aiProposals.userId, userId)
    ));
  return (result.rowCount ?? 0) > 0;
}

export async function getConversationsByProject(db: Db, projectId: string, userId: string): Promise<Conversation[]> {
  return db.select()
    .from(conversations)
    .where(and(
      eq(conversations.projectId, projectId),
      eq(conversations.userId, userId)
    ))
    .orderBy(desc(conversations.createdAt));
}

export async function getProjectConversation(db: Db, projectId: string, userId: string): Promise<Conversation | undefined> {
  const [existing] = await db.select()
    .from(conversations)
    .where(and(
      eq(conversations.projectId, projectId),
      eq(conversations.userId, userId)
    ))
    .orderBy(desc(conversations.createdAt))
    .limit(1);
  
  return existing;
}

export async function getOrCreateProjectConversation(db: Db, projectId: string, userId: string): Promise<Conversation> {
  const existing = await getProjectConversation(db, projectId, userId);
  
  if (existing) {
    return existing;
  }
  
  // Create new conversation with conflict handling for race conditions
  // If another request creates the conversation between our check and insert,
  // we catch the conflict and return the existing one
  try {
    const [created] = await db.insert(conversations)
      .values({
        projectId,
        userId,
        title: 'AI Conversation',
      })
      .returning();
    
    console.log(`[ConversationPersistence] Created new conversation ${created.id} for project ${projectId}`);
    return created;
  } catch (error: any) {
    // Handle race condition - another request may have created the conversation
    if (error.code === '23505') { // Postgres unique violation
      console.log(`[ConversationPersistence] Race condition detected, fetching existing conversation`);
      const existingAfterRace = await getProjectConversation(db, projectId, userId);
      if (existingAfterRace) {
        return existingAfterRace;
      }
    }
    throw error;
  }
}

export async function createConversationWithFirstMessage(
  db: Db,
  projectId: string,
  userId: string,
  userMessage: string,
  assistantMessage: string,
  assistantMetadata?: Record<string, any>
): Promise<{ conversation: Conversation; userMessageId: string | null; assistantMessageId: string | null }> {
  // Transactional creation of conversation + first messages
  // This ensures atomicity: either all succeed or all fail
  return db.transaction(async (tx) => {
    // Create conversation
    const [conversation] = await tx.insert(conversations)
      .values({
        projectId,
        userId,
        title: 'AI Conversation',
      })
      .returning();
    
    console.log(`[ConversationPersistence] Created conversation ${conversation.id} in transaction`);
    
    let userMessageId: string | null = null;
    let assistantMessageId: string | null = null;
    let messageCount = 0;
    
    // Create user message if provided
    if (userMessage) {
      const [userMsg] = await tx.insert(messages)
        .values({
          conversationId: conversation.id,
          role: 'user',
          content: userMessage,
        })
        .returning();
      userMessageId = userMsg.id;
      messageCount++;
    }
    
    // Create assistant message if provided
    if (assistantMessage) {
      const [assistantMsg] = await tx.insert(messages)
        .values({
          conversationId: conversation.id,
          role: 'assistant',
          content: assistantMessage,
          ...(assistantMetadata && Object.keys(assistantMetadata).length > 0 ? { metadata: assistantMetadata } : {}),
        })
        .returning();
      assistantMessageId = assistantMsg.id;
      messageCount++;
    }
    
    console.log(`[ConversationPersistence] Created ${messageCount} messages in transaction for conversation ${conversation.id}`);
    
    return {
      conversation,
      userMessageId,
      assistantMessageId,
    };
  });
}

export async function getConversationById(db: Db, id: string, userId: string): Promise<Conversation | undefined> {
  const [conversation] = await db.select()
    .from(conversations)
    .where(and(
      eq(conversations.id, id),
      eq(conversations.userId, userId)
    ));
  return conversation;
}

export async function createConversation(db: Db, conversation: InsertConversation): Promise<Conversation> {
  const [created] = await db.insert(conversations).values(conversation).returning();
  return created;
}

export async function updateConversation(db: Db, id: string, userId: string, updates: Partial<InsertConversation>): Promise<Conversation | undefined> {
  const [updated] = await db.update(conversations)
    .set(updates)
    .where(and(
      eq(conversations.id, id),
      eq(conversations.userId, userId)
    ))
    .returning();
  return updated;
}

export async function deleteConversation(db: Db, id: string, userId: string): Promise<boolean> {
  await db.delete(messages).where(eq(messages.conversationId, id));
  const result = await db.delete(conversations)
    .where(and(
      eq(conversations.id, id),
      eq(conversations.userId, userId)
    ));
  return (result.rowCount ?? 0) > 0;
}

export async function getMessagesByConversation(db: Db, conversationId: string, userId: string): Promise<Message[]> {
  const conv = await getConversationById(db, conversationId, userId);
  if (!conv) return [];
  
  return db.select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt));
}

export async function createMessage(db: Db, message: InsertMessage): Promise<Message> {
  const [created] = await db.insert(messages).values(message).returning();
  return created;
}

export async function updateMessage(db: Db, id: string, updates: Partial<InsertMessage>): Promise<Message | undefined> {
  const [updated] = await db.update(messages)
    .set(updates)
    .where(eq(messages.id, id))
    .returning();
  return updated;
}

export async function deleteMessage(db: Db, id: string): Promise<boolean> {
  const result = await db.delete(messages).where(eq(messages.id, id));
  return (result.rowCount ?? 0) > 0;
}
