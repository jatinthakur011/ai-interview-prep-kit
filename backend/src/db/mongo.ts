import { MongoClient, type Db } from "mongodb";

let client: MongoClient | null = null;
let db: Db | null = null;

/** Connects once and reuses the connection/pool for the life of the process. */
export async function connectDb(env = process.env): Promise<Db> {
  if (db) return db;
  const uri = env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set (see .env.example)");
  client = new MongoClient(uri);
  await client.connect();
  db = client.db(env.MONGODB_DB_NAME || "prepkit");
  await ensureIndexes(db);
  return db;
}

export function getDb(): Db {
  if (!db) throw new Error("Database not connected yet — call connectDb() first");
  return db;
}

export async function closeDb(): Promise<void> {
  await client?.close();
  client = null;
  db = null;
}

async function ensureIndexes(database: Db): Promise<void> {
  await database.collection("users").createIndex({ email: 1 }, { unique: true });
  await database.collection("kits").createIndex({ userId: 1, createdAt: -1 });
}
