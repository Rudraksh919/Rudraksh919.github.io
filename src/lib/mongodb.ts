import { MongoClient } from 'mongodb';

if (!process.env.MONGO_URI) {
  throw new Error('Please add your Mongo URI to .env.local')
}

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

const uri = process.env.MONGO_URI as string;
const options = {
  connectTimeoutMS: 30000,
  maxPoolSize: 10,
};

if (process.env.NODE_ENV === 'development') {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR
  let globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>
  }

  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(uri, options);
    globalWithMongo._mongoClientPromise = client.connect();
  }
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export { clientPromise };

// Helper functions for vault operations
export async function getVault(email: string) {
  const client = await clientPromise;
  const collection = client.db('passkode').collection('vaults');
  return collection.findOne({ email });
}

export async function createVault(data: any) {
  const client = await clientPromise;
  const collection = client.db('passkode').collection('vaults');
  return collection.insertOne(data);
}

export async function updateVault(email: string, data: any) {
  const client = await clientPromise;
  const collection = client.db('passkode').collection('vaults');
  return collection.updateOne(
    { email },
    { $set: data }
  );
}

export async function deleteVault(email: string) {
  const client = await clientPromise;
  const collection = client.db('passkode').collection('vaults');
  return collection.deleteOne({ email });
}