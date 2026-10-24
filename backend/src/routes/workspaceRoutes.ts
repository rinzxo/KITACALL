import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { dbPool } from '../db/initTables';

const router = Router();

// 1. Get all workspaces / organizations (Admin/Fallback)
router.get('/workspaces', async (req: Request, res: Response) => {
  try {
    const { data: orgs, error } = await supabaseAdmin
      .from('organizations')
      .select('id, name, slug, description, logo_url, created_at')
      .order('name');

    if (error) throw error;
    res.json({ success: true, workspaces: orgs || [] });
  } catch (err: any) {
    console.error('[API] Error fetching workspaces:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 1b. Get workspaces where specific logged-in user is a member
router.get('/users/:profileId/workspaces', async (req: Request, res: Response) => {
  const { profileId } = req.params;
  try {
    const { data: userMemberships, error } = await supabaseAdmin
      .from('organization_members')
      .select(`
        id,
        role,
        organization_id,
        organizations (
          id,
          name,
          slug,
          description,
          logo_url
        )
      `)
      .eq('profile_id', profileId);

    if (error) throw error;

    const workspaces = (userMemberships || [])
      .filter((m: any) => m.organizations)
      .map((m: any) => ({
        id: m.organizations.id,
        name: m.organizations.name,
        slug: m.organizations.slug,
        description: m.organizations.description,
        logo_url: m.organizations.logo_url,
        userRole: m.role
      }));

    res.json({ success: true, workspaces });
  } catch (err: any) {
    console.error('[API] Error fetching user workspaces:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 1c. Get user profile by email (useful when logging in via Google OAuth)
router.get('/users/by-email/:email', async (req: Request, res: Response) => {
  const { email } = req.params;
  try {
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, avatar_url')
      .eq('email', email)
      .maybeSingle();

    if (error) throw error;
    res.json({ success: true, profile });
  } catch (err: any) {
    console.error('[API] Error fetching profile by email:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Get members of a specific workspace
router.get('/workspaces/:orgId/members', async (req: Request, res: Response) => {
  const { orgId } = req.params;
  try {
    const { data: members, error } = await supabaseAdmin
      .from('organization_members')
      .select(`
        id,
        organization_id,
        profile_id,
        role,
        joined_at,
        profiles (
          id,
          full_name,
          email,
          avatar_url
        )
      `)
      .eq('organization_id', orgId);

    if (error) throw error;

    // Format clean profile list
    const formatted = (members || []).map((m: any) => ({
      membershipId: m.id,
      organizationId: m.organization_id,
      profileId: m.profile_id,
      orgRole: m.role,
      fullName: m.profiles?.full_name || m.profiles?.email?.split('@')[0] || 'Anggota',
      email: m.profiles?.email || '',
      avatarUrl: m.profiles?.avatar_url || null
    }));

    res.json({ success: true, members: formatted });
  } catch (err: any) {
    console.error('[API] Error fetching workspace members:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Get channels for a workspace (auto-seed default channels if empty)
router.get('/workspaces/:orgId/channels', async (req: Request, res: Response) => {
  const { orgId } = req.params;
  try {
    const client = await dbPool.connect();
    try {
      const channelQuery = `
        SELECT 
          c.id, 
          c.organization_id, 
          c.code, 
          c.name, 
          c.category, 
          c.description, 
          c.created_at,
          COUNT(cm.id)::int as member_count
        FROM kitacom_channels c
        LEFT JOIN kitacom_channel_members cm ON c.id = cm.channel_id
        WHERE c.organization_id = $1
        GROUP BY c.id
        ORDER BY c.code ASC
      `;
      let result = await client.query(channelQuery, [orgId]);

      // Jika belum ada channel untuk workspace ini, auto-seed default tactical channels
      if (result.rows.length === 0) {
        console.log(`[API] Seeding default channels for workspace: ${orgId}`);
        await client.query(`
          INSERT INTO kitacom_channels (organization_id, code, name, category, description)
          VALUES 
            ($1, 'CH-01', 'Frekuensi Taktis Keamanan', 'Security Main Channel', 'Saluran utama seluruh satgas ketertiban lapangan'),
            ($1, 'CH-02', 'Frekuensi Komando Inti', 'Command Bridge', 'Saluran koordinasi cepat pimpinan & ketua panitia'),
            ($1, 'CH-03', 'Jalur Panggil Paksa Personal', 'Direct HT Bridge', 'Jalur point-to-point langsung tembus personel tertentu')
          ON CONFLICT DO NOTHING
        `, [orgId]);

        result = await client.query(channelQuery, [orgId]);
      }

      // Fetch channel members for each channel
      const channels = await Promise.all(result.rows.map(async (row) => {
        const mems = await client.query(`
          SELECT 
            cm.id,
            cm.channel_id,
            cm.profile_id,
            cm.tactical_role,
            cm.pos_jaga,
            cm.is_priority,
            p.full_name,
            p.email,
            p.avatar_url
          FROM kitacom_channel_members cm
          JOIN profiles p ON cm.profile_id = p.id
          WHERE cm.channel_id = $1
          ORDER BY cm.is_priority DESC, cm.joined_at ASC
        `, [row.id]);

        return {
          id: row.id,
          organizationId: row.organization_id,
          code: row.code,
          name: row.name,
          category: row.category,
          description: row.description,
          memberCount: row.member_count,
          assignedMembers: mems.rows.map(m => ({
            id: m.id,
            profileId: m.profile_id,
            fullName: m.full_name || m.email?.split('@')[0],
            email: m.email,
            tacticalRole: m.tactical_role,
            posJaga: m.pos_jaga,
            isPriority: m.is_priority
          }))
        };
      }));

      res.json({ success: true, channels });
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('[API] Error fetching workspace channels:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Create new channel in workspace
router.post('/workspaces/:orgId/channels', async (req: Request, res: Response) => {
  const { orgId } = req.params;
  const { code, name, category, description, createdBy, initialMemberIds } = req.body;

  if (!code || !name) {
    return res.status(400).json({ success: false, error: 'Code dan Name wajib diisi' });
  }

  try {
    const client = await dbPool.connect();
    try {
      await client.query('BEGIN');

      const insertRes = await client.query(`
        INSERT INTO kitacom_channels (organization_id, code, name, category, description, created_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [
        orgId,
        code.toUpperCase().trim(),
        name.trim(),
        category || 'Security Tactical Channel',
        description || '',
        createdBy || null
      ]);

      const newChannel = insertRes.rows[0];

      // Jika ada initial member IDs yang dipilih
      if (initialMemberIds && Array.isArray(initialMemberIds) && initialMemberIds.length > 0) {
        for (const member of initialMemberIds) {
          const profileId = typeof member === 'string' ? member : member.profileId;
          const tacticalRole = typeof member === 'object' && member.tacticalRole ? member.tacticalRole : 'ANGGOTA_KEAMANAN';
          const posJaga = typeof member === 'object' && member.posJaga ? member.posJaga : 'Patroli Lapangan';
          const isPriority = tacticalRole === 'KOORDINATOR_KEAMANAN' || tacticalRole === 'KETUA_PELAKSANA';

          await client.query(`
            INSERT INTO kitacom_channel_members (channel_id, profile_id, tactical_role, pos_jaga, is_priority)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (channel_id, profile_id) DO NOTHING
          `, [newChannel.id, profileId, tacticalRole, posJaga, isPriority]);
        }
      }

      await client.query('COMMIT');

      res.status(201).json({ success: true, channel: newChannel });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('[API] Error creating channel:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Add a member to a channel
router.post('/channels/:channelId/members', async (req: Request, res: Response) => {
  const { channelId } = req.params;
  const { profileId, tacticalRole, posJaga, isPriority } = req.body;

  if (!profileId) {
    return res.status(400).json({ success: false, error: 'profileId wajib diisi' });
  }

  try {
    const client = await dbPool.connect();
    try {
      const priority = isPriority || tacticalRole === 'KOORDINATOR_KEAMANAN' || tacticalRole === 'KETUA_PELAKSANA';
      const insertRes = await client.query(`
        INSERT INTO kitacom_channel_members (channel_id, profile_id, tactical_role, pos_jaga, is_priority)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (channel_id, profile_id) 
        DO UPDATE SET 
          tactical_role = EXCLUDED.tactical_role,
          pos_jaga = EXCLUDED.pos_jaga,
          is_priority = EXCLUDED.is_priority
        RETURNING *
      `, [
        channelId,
        profileId,
        tacticalRole || 'ANGGOTA_KEAMANAN',
        posJaga || 'Patroli Lapangan',
        priority
      ]);

      res.json({ success: true, member: insertRes.rows[0] });
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('[API] Error adding member to channel:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Remove member from channel
router.delete('/channels/:channelId/members/:profileId', async (req: Request, res: Response) => {
  const { channelId, profileId } = req.params;
  try {
    const client = await dbPool.connect();
    try {
      await client.query(`
        DELETE FROM kitacom_channel_members 
        WHERE channel_id = $1 AND profile_id = $2
      `, [channelId, profileId]);

      res.json({ success: true, message: 'Member removed from channel' });
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('[API] Error removing member from channel:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Delete channel
router.delete('/channels/:channelId', async (req: Request, res: Response) => {
  const { channelId } = req.params;
  try {
    const client = await dbPool.connect();
    try {
      await client.query(`DELETE FROM kitacom_channels WHERE id = $1`, [channelId]);
      res.json({ success: true, message: 'Channel deleted' });
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('[API] Error deleting channel:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
