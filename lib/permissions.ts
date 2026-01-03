import { supabaseAdmin } from './supabase-server';

/**
 * Check if a user has a specific permission based on their position
 */
export async function userHasPermission(
  userId: string,
  permissionKey: string
): Promise<boolean> {
  try {
    if (!supabaseAdmin) {
      console.error('Supabase admin client not available');
      return false;
    }

    // Get user's position
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('position_id')
      .eq('id', userId)
      .single();

    if (profileError || !profile?.position_id) {
      console.error('Error fetching user profile:', profileError);
      return false;
    }

    // Check if position has the permission
    const { data: permissionData, error: permissionError } = await supabaseAdmin
      .from('position_permissions')
      .select(`
        permissions!inner(key)
      `)
      .eq('position_id', profile.position_id)
      .eq('permissions.key', permissionKey)
      .single();

    if (permissionError) {
      // No permission found (not an error, just means they don't have it)
      return false;
    }

    return !!permissionData;
  } catch (error) {
    console.error('Error checking permission:', error);
    return false;
  }
}

/**
 * Get all permissions for a user based on their position
 */
export async function getUserPermissions(userId: string): Promise<string[]> {
  try {
    if (!supabaseAdmin) {
      console.error('Supabase admin client not available');
      return [];
    }

    // Get user's position
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('position_id')
      .eq('id', userId)
      .single();

    if (profileError || !profile?.position_id) {
      console.error('❌ [getUserPermissions] Error fetching user profile:', profileError);
      console.error('❌ [getUserPermissions] Profile data:', profile);
      return [];
    }

    console.log('✅ [getUserPermissions] User position_id:', profile.position_id);

    // Get all permissions for this position
    const { data: permissions, error: permissionsError } = await supabaseAdmin
      .from('position_permissions')
      .select(`
        permissions(key)
      `)
      .eq('position_id', profile.position_id);

    if (permissionsError) {
      console.error('❌ [getUserPermissions] Error fetching permissions:', permissionsError);
      return [];
    }

    console.log('✅ [getUserPermissions] Raw permissions data:', permissions);

    const permissionKeys = permissions
      .map((p: any) => p.permissions?.key)
      .filter(Boolean);

    console.log('✅ [getUserPermissions] Permission keys:', permissionKeys);

    return permissionKeys;
  } catch (error) {
    console.error('Error getting user permissions:', error);
    return [];
  }
}
