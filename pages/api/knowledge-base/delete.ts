import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';

const ALLOWED_DELETE_POSITIONS = [
  'Operations Manager',
  'Technical Support Engineer',
  'Operations Technical Lead'
];

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', ['DELETE']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { id } = req.body;

  try {
    if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }

    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!id) {
      return res.status(400).json({ error: 'Article ID is required' });
    }

    // Get user's position from profile (using positions table relationship)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('positions(name)')
      .eq('id', req.user.id)
      .single();

    const userPosition = profile?.positions ? (profile.positions as any).name : null;

    if (profileError || !userPosition) {
      return res.status(403).json({ error: 'Unable to verify user permissions' });
    }

    // Check if user has permission to delete
    if (!ALLOWED_DELETE_POSITIONS.includes(userPosition)) {
      return res.status(403).json({
        error: 'Forbidden: Only Operations Manager, Technical Support Engineer, or Operations Technical Lead can delete articles'
      });
    }

    // Check if article exists
    const { data: existingArticle, error: fetchError } = await supabaseAdmin
      .from('knowledge_base')
      .select('id, title, deleted_at')
      .eq('id', id)
      .single();

    if (fetchError || !existingArticle) {
      return res.status(404).json({ error: 'Article not found' });
    }

    // Check if already deleted
    if (existingArticle.deleted_at) {
      return res.status(400).json({ error: 'Article is already deleted' });
    }

    // Soft delete by setting deleted_at timestamp and tracking who deleted it
    const { data: deletedArticle, error: deleteError } = await supabaseAdmin
      .from('knowledge_base')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: req.user.id, // Track who deleted the article
        published: false // Also unpublish the article
      })
      .eq('id', id)
      .select()
      .single();

    if (deleteError) {
      throw deleteError;
    }

    return res.status(200).json({
      success: true,
      message: 'Article deleted successfully',
      article: deletedArticle
    });
  } catch (error: any) {
    console.error('Error deleting knowledge base article:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete article' });
  }
}

export default withAuth(handler, { requireRole: ['admin', 'employee'] });
