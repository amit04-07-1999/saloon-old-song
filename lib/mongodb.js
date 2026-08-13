import { MongoClient } from "mongodb";
import dns from "node:dns";

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("Please add MONGODB_URI to your environment variables.");
}

// Some home/ISP DNS servers block MongoDB Atlas SRV lookups. Use reliable
// public resolvers only during local development; Vercel keeps its own DNS.
if (process.env.NODE_ENV === "development" && uri.startsWith("mongodb+srv://")) {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
}

let clientPromise;

if (process.env.NODE_ENV === "development") {
  if (!global._mongoClientPromise) {
    global._mongoClientPromise = new MongoClient(uri).connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  clientPromise = new MongoClient(uri).connect();
}

export default clientPromise;
