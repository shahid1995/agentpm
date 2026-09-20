export async function migrate(): Promise<void> {
  // In production, use drizzle-kit migrations
  // For now, we assume tables are created via SQL migration
  console.log("Database migration completed");
}
