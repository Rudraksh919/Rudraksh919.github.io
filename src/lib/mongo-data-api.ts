// MongoDB Data API Configuration
const DATA_API_KEY = process.env.NEXT_PUBLIC_MONGO_DATA_API_KEY;
const DATA_API_URL = process.env.NEXT_PUBLIC_MONGO_DATA_API_URL;

if (!DATA_API_KEY || !DATA_API_URL) {
  console.warn('MongoDB Data API credentials not found');
}

// Helper function for Data API calls
async function dataApiRequest(action: string, body: any) {
  try {
    const response = await fetch(`${DATA_API_URL}/action/${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apiKey': DATA_API_KEY as string,
      },
      body: JSON.stringify({
        ...body,
        dataSource: 'Cluster0',
        database: 'passkode',
        collection: 'vaults',
      }),
    });

    if (!response.ok) {
      throw new Error('API request failed');
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Data API error:', error);
    throw error;
  }
}

export async function findVault(email: string) {
  const result = await dataApiRequest('findOne', {
    filter: { email }
  });
  return result.document;
}

export async function createVault(data: any) {
  const result = await dataApiRequest('insertOne', {
    document: data
  });
  return result;
}

export async function updateVault(email: string, data: any) {
  const result = await dataApiRequest('updateOne', {
    filter: { email },
    update: { $set: data }
  });
  return result;
}

export async function deleteVault(email: string) {
  const result = await dataApiRequest('deleteOne', {
    filter: { email }
  });
  return result;
}