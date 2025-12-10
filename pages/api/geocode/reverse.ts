import type { NextApiResponse } from 'next';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { lat, lon } = req.query;

  if (!lat || !lon || typeof lat !== 'string' || typeof lon !== 'string') {
    return res.status(400).json({ error: 'Latitude and longitude are required' });
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'CerventechHR/1.0',
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch address from geocoding service');
    }

    const data = await response.json();

    return res.status(200).json({
      address: data.display_name || null,
      details: {
        city: data.address?.city || data.address?.town || data.address?.village,
        state: data.address?.state,
        country: data.address?.country,
        postcode: data.address?.postcode,
      },
    });
  } catch (error: any) {
    console.error('Reverse geocoding error:', error);
    return res.status(500).json({
      error: 'Failed to get address',
      message: error.message,
    });
  }
}

export default withAuth(handler);
