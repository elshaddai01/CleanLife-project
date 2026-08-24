// One-time bootstrap: run manually to create the first super_admin account.
// Usage: node scripts/createSuperAdmin.js <username> <password>
const { pool } = require('../src/db/pool');
const { hashPassword } = require('../src/utils/password');

async function main() {
    const username = process.argv[2];
    const password = process.argv[3];
    if (!username || !password) {
        console.error('Usage: node scripts/createSuperAdmin.js <username> <password>');
        process.exit(1);
    }
    if (password.length < 8) {
        console.error('Password must be at least 8 characters.');
        process.exit(1);
    }
    const password_hash = await hashPassword(password);
    try {
        const result = await pool.query(
            `INSERT INTO admins (username, password_hash, role, company_id)
             VALUES ($1, $2, 'super_admin', NULL)
             RETURNING id, username, role`,
            [username, password_hash]
        );
        console.log('Super admin created:', result.rows[0]);
    } catch (err) {
        console.error('Failed to create super admin:', err.message);
    } finally {
        await pool.end();
    }
}

main();