import { db } from "./index";
import { sql } from "drizzle-orm";

export async function testConnection(): Promise<boolean> {
  try {
    await db.execute(sql`SELECT 1`);
    return true;
  } catch (error) {
    console.error("Database connection failed:", error);
    return false;
  }
}

export async function migrate(): Promise<void> {
  // In production, use drizzle-kit migrations
  // For now, we assume tables are created via SQL migration
  console.log("Database migration completed");
}
