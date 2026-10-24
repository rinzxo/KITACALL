import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  },
  realtime: {
    // @ts-ignore
    transport: WebSocket
  }
});

async function run() {
  const { data: orgs, error } = await supabase
    .from('organizations')
    .select('id, name, slug, logo_url')
    .limit(5);

  console.log('ORGANIZATIONS FOUND:', orgs?.length);
  if (orgs && orgs.length > 0) {
    orgs.forEach(o => console.log(`- [${o.id}] ${o.name} (${o.slug})`));

    const { data: members, error: memErr } = await supabase
      .from('organization_members')
      .select('id, organization_id, profile_id, role, profiles(id, full_name, email, avatar_url)')
      .eq('organization_id', orgs[0].id)
      .limit(5);

    console.log(`MEMBERS OF ${orgs[0].name}:`, JSON.stringify(members, null, 2));
  }
}

run();
