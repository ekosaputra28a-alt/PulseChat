import { MongoClient } from "mongodb";

let db;

export async function connectDB() {
  try {
    const client = new MongoClient(process.env.MONGO_URI);

    await client.connect();

    db = client.db("pulsechat");

    console.log("MongoDB Connected 🚀");
  } catch (err) {
    console.error("MongoDB Error:", err);
  }
}

export function getDB() {
  return db;
}
