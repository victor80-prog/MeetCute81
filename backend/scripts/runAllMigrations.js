const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const pool = require('../config/db');

class MigrationRunner {
  constructor() {
    this.migrationsPath = path.join(__dirname, '../migrations');
    this.migrationsTable = 'schema_migrations';
  }

  async init() {
    await this.createMigrationsTable();
  }

  async createMigrationsTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS ${this.migrationsTable} (
        id SERIAL PRIMARY KEY,
        version BIGINT NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    await pool.query(query);
    console.log('✅ Migration table verified/created');
  }

  async getAppliedMigrations() {
    const result = await pool.query(
      `SELECT version FROM ${this.migrationsTable} ORDER BY version ASC`
    );
    return new Set(result.rows.map(row => parseInt(row.version)));
  }

  async getMigrationFiles() {
    const files = fs.readdirSync(this.migrationsPath)
      .filter(file => file.endsWith('.sql'))
      .sort();

    return files.map(file => {
      const version = parseInt(file.split('_')[0]);
      return {
        version,
        name: file,
        path: path.join(this.migrationsPath, file)
      };
    });
  }

  async runMigration(client, migration) {
    console.log(`🚀 Running migration: ${migration.name}`);
    
    // Read the migration file
    const sql = fs.readFileSync(migration.path, 'utf8');
    
    // Start a transaction
    await client.query('BEGIN');
    
    try {
      // Run the migration
      await client.query(sql);
      
      // Record the migration
      await client.query(
        `INSERT INTO ${this.migrationsTable} (version, name) VALUES ($1, $2)`,
        [migration.version, migration.name]
      );
      
      await client.query('COMMIT');
      console.log(`✅ Applied migration: ${migration.name}`);
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`❌ Failed to apply migration ${migration.name}:`, error.message);
      throw error;
    }
  }

  async run() {
    const client = await pool.connect();
    
    try {
      await this.init();
      
      const appliedMigrations = await this.getAppliedMigrations();
      const migrationFiles = await this.getMigrationFiles();
      
      console.log(`🔍 Found ${migrationFiles.length} migration files, ${appliedMigrations.size} already applied`);
      
      let appliedCount = 0;
      
      for (const migration of migrationFiles) {
        if (!appliedMigrations.has(migration.version)) {
          await this.runMigration(client, migration);
          appliedCount++;
        } else {
          console.log(`⏩ Skipping already applied migration: ${migration.name}`);
        }
      }
      
      if (appliedCount === 0) {
        console.log('✅ No new migrations to apply');
      } else {
        console.log(`✨ Successfully applied ${appliedCount} migration(s)`);
      }
      
    } catch (error) {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    } finally {
      client.release();
      await pool.end();
      process.exit(0);
    }
  }
}

// Run the migrations
new MigrationRunner().run().catch(console.error);
