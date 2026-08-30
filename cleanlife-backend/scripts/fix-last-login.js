const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const config = require('../src/config/env');

async function fixLastLogin() {
    const client = new Client({ 
        connectionString: config.databaseUrl, 
        ssl: config.databaseSsl ? { rejectUnauthorized: false } : false 
    });
    
    try {
        await client.connect();
        console.log('Adding last_login column to collectors table if not exists...');
        
        await client.query('ALTER TABLE collectors ADD COLUMN IF NOT EXISTS last_login TIMESTAMP NULL');
        
        console.log('✓ Successfully added last_login column to collectors table');
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

fixLastLogin();
