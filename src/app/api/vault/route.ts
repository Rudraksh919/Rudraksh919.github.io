import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function POST(req: NextRequest) {
  try {
    const { action, data } = await req.json();
    const client = await clientPromise;
    const db = client.db("passkode");
    const vaults = db.collection("vaults");

    switch (action) {
      case 'create':
        // Create new vault
        const { email, salt, iv, cipher, recoveryHash } = data;
        await vaults.insertOne({
          email,
          salt,
          iv, 
          cipher,
          recoveryHash,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        return NextResponse.json({ success: true });

      case 'update':
        // Update existing vault
        const { email: userEmail, iv: newIv, cipher: newCipher } = data;
        await vaults.updateOne(
          { email: userEmail },
          { 
            $set: { 
              iv: newIv, 
              cipher: newCipher,
              updatedAt: new Date()
            }
          }
        );
        return NextResponse.json({ success: true });

      case 'get':
        // Get vault by email
        const vault = await vaults.findOne({ email: data.email });
        if (!vault) {
          return NextResponse.json({ error: 'Vault not found' }, { status: 404 });
        }
        return NextResponse.json(vault);

      case 'verify-recovery':
        // Verify recovery hash
        const { email: recoveryEmail, recoveryHash: hash } = data;
        const recoveryVault = await vaults.findOne({ 
          email: recoveryEmail,
          recoveryHash: hash 
        });
        if (!recoveryVault) {
          return NextResponse.json({ error: 'Invalid recovery code' }, { status: 404 });
        }
        return NextResponse.json({ success: true });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}