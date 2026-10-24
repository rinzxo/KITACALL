import { initTables, dbPool } from './initTables';

async function main() {
  try {
    await initTables();
    console.log('[Migration] Migration complete.');
  } catch (err) {
    console.error('[Migration] Migration failed:', err);
  } finally {
    await dbPool.end();
  }
}

main();
