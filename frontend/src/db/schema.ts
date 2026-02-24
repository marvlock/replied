import { pgTable, text, timestamp, boolean, uuid } from "drizzle-orm/pg-core";

export const profiles = pgTable("profiles", {
    id: uuid("id").primaryKey(), // Usually mapped to auth.users.id
    username: text("username").unique().notNull(),
    displayName: text("display_name"),
    avatarUrl: text("avatar_url"),
    bio: text("bio"),
    email: text("email"),
    isPaused: boolean("is_paused").default(false),
    blockedPhrases: text("blocked_phrases").array().default([]),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const messages = pgTable("messages", {
    id: uuid("id").defaultRandom().primaryKey(),
    receiverId: uuid("receiver_id").references(() => profiles.id, { onDelete: 'cascade' }).notNull(),
    content: text("content").notNull(),
    isAnonymous: boolean("is_anonymous").default(true).notNull(),
    status: text("status", { enum: ["pending", "replied", "archived"] }).default("pending").notNull(),
    senderId: uuid("sender_id").references(() => profiles.id, { onDelete: 'set null' }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const replies = pgTable("replies", {
    id: uuid("id").defaultRandom().primaryKey(),
    messageId: uuid("message_id").references(() => messages.id, { onDelete: 'cascade' }).unique().notNull(),
    senderId: uuid("sender_id").references(() => profiles.id, { onDelete: 'cascade' }).notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const friendships = pgTable("friendships", {
    id: uuid("id").defaultRandom().primaryKey(),
    senderId: uuid("sender_id").references(() => profiles.id, { onDelete: 'cascade' }).notNull(),
    receiverId: uuid("receiver_id").references(() => profiles.id, { onDelete: 'cascade' }).notNull(),
    status: text("status", { enum: ["pending", "accepted"] }).default("pending").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
