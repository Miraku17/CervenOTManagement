import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';

// Generate a random KB code that's simple but not predictable
// Format: KB-XXXX where X is alphanumeric (excluding confusing characters)
function generateRandomKbCode(): string {
  // Use characters that are easy to read and distinguish
  // Exclude: 0 (zero), O (letter O), 1 (one), I (letter I), l (lowercase L)
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';

  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return `KB-${code}`;
}

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }

    // Generate a unique KB code
    let attempts = 0;
    const maxAttempts = 10;
    let kbCode = '';
    let isUnique = false;

    while (!isUnique && attempts < maxAttempts) {
      kbCode = generateRandomKbCode();

      // Check if this code already exists
      const { data: existingArticle } = await supabaseAdmin
        .from('knowledge_base')
        .select('kb_code')
        .eq('kb_code', kbCode)
        .single();

      if (!existingArticle) {
        isUnique = true;
      }

      attempts++;
    }

    if (!isUnique) {
      throw new Error('Failed to generate unique KB code after multiple attempts');
    }

    return res.status(200).json({ kb_code: kbCode });
  } catch (error: any) {
    console.error('Error generating KB code:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate KB code' });
  }
}

export default withAuth(handler, { requireRole: ['admin', 'employee'] });
