import { NextApiRequest, NextApiResponse } from 'next';
import { clientPromise } from '@/lib/mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const client = await clientPromise;
    const db = client.db('passkode');
    const collection = db.collection('vaults');

    const { action, ...data } = req.body;

    switch (action) {
      case 'get':
        const vault = await collection.findOne({ email: data.email });
        return res.json(vault);

      case 'create':
        await collection.insertOne(data);
        return res.json({ success: true });

      case 'update':
        const { email, ...updateData } = data;
        await collection.updateOne(
          { email },
          { $set: updateData }
        );
        return res.json({ success: true });

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({ error: 'Database error' });
  }
}