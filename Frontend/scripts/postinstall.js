/* Conditional prisma generate for Vercel and local installs.
 * Runs `npx prisma generate` only when DATABASE_URL is set.
 */
const { execSync } = require('child_process');

const url = process.env.DATABASE_URL;
if (!url || !url.trim()) {
  console.log('[postinstall] Skipping prisma generate (no DATABASE_URL set)');
  process.exit(0);
}

try {
  console.log('[postinstall] Running `npx prisma generate`...');
  execSync('npx prisma generate', { stdio: 'inherit' });
  console.log('[postinstall] Prisma client generated');
} catch (e) {
  console.error('[postinstall] Prisma generate failed:', e?.message || e);
  process.exit(1);
}

