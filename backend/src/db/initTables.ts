import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

export const dbPool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

export async function initTables() {
  const client = await dbPool.connect();
  try {
    console.log('[DB] Ensuring KitaCom tables exist in Supabase...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS kitacom_channels (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        code VARCHAR(20) NOT NULL,
        name VARCHAR(100) NOT NULL,
        category VARCHAR(50) NOT NULL DEFAULT 'Security Main Channel',
        description TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
        UNIQUE(organization_id, code)
      );

      CREATE TABLE IF NOT EXISTS kitacom_channel_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        channel_id UUID NOT NULL REFERENCES kitacom_channels(id) ON DELETE CASCADE,
        profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        tactical_role VARCHAR(50) NOT NULL DEFAULT 'ANGGOTA_KEAMANAN',
        pos_jaga VARCHAR(100) DEFAULT 'Patroli Lapangan',
        is_priority BOOLEAN DEFAULT false,
        joined_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(channel_id, profile_id)
      );

      CREATE INDEX IF NOT EXISTS idx_kitacom_channels_org ON kitacom_channels(organization_id);
      CREATE INDEX IF NOT EXISTS idx_kitacom_channel_members_chan ON kitacom_channel_members(channel_id);
      CREATE INDEX IF NOT EXISTS idx_kitacom_channel_members_prof ON kitacom_channel_members(profile_id);
    `);

    console.log('[DB] KitaCom tables initialized successfully!');
  } catch (err) {
    console.error('[DB Error] Failed to initialize tables:', err);
  } finally {
    client.release();
  }
}
