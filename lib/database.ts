import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

interface DatabaseConfig {
  filename: string;
  verbose?: boolean;
}

class DatabaseConnection {
  private static instance: DatabaseConnection;
  private db: Database.Database;

  private constructor() {
    // Ensure data directory exists
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const dbPath = process.env.DB_PATH || path.join(dataDir, 'ind_appointments.db');
    const dbExists = fs.existsSync(dbPath);

    console.log('Database configuration:', {
      DB_PATH: dbPath,
      exists: dbExists
    });

    // Initialize SQLite database
    this.db = new Database(dbPath, {
      verbose: process.env.NODE_ENV === 'development' ? console.log : undefined
    });

    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');

    // Set journal mode to WAL for better concurrency
    this.db.pragma('journal_mode = WAL');

    console.log('SQLite database connection established');

    // Test the connection
    this.testConnection();

    // Initialize schema if database is new or tables don't exist
    if (!dbExists || !this.tablesExist()) {
      this.initSchema();
    }
  }

  public static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  private testConnection(): void {
    try {
      const result = this.db.prepare('SELECT 1 as test').get();
      console.log('Database connection test successful:', result);
    } catch (error) {
      console.error('Database connection test failed:', error);
      throw error;
    }
  }

  private tablesExist(): boolean {
    try {
      const result = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
      return !!result;
    } catch (error) {
      return false;
    }
  }

  /**
   * Execute a query and return all rows
   */
  public query<T = any>(sql: string, params?: any[]): T[] {
    try {
      const stmt = this.db.prepare(sql);

      // Check if it's a SELECT query
      if (sql.trim().toUpperCase().startsWith('SELECT')) {
        return stmt.all(params || []) as T[];
      } else {
        // For INSERT, UPDATE, DELETE
        const result = stmt.run(params || []);
        return [result as any] as T[];
      }
    } catch (error) {
      console.error('Database query error:', { sql, params, error });
      throw error;
    }
  }

  /**
   * Execute a query and return a single row
   */
  public queryOne<T = any>(sql: string, params?: any[]): T | undefined {
    try {
      const stmt = this.db.prepare(sql);
      return stmt.get(params || []) as T | undefined;
    } catch (error) {
      console.error('Database queryOne error:', { sql, params, error });
      throw error;
    }
  }

  /**
   * Execute a query with no return value
   */
  public exec(sql: string): void {
    try {
      this.db.exec(sql);
    } catch (error) {
      console.error('Database exec error:', { sql, error });
      throw error;
    }
  }

  /**
   * Run a prepared statement
   */
  public run(sql: string, params?: any[]): Database.RunResult {
    try {
      const stmt = this.db.prepare(sql);
      return stmt.run(params || []);
    } catch (error) {
      console.error('Database run error:', { sql, params, error });
      throw error;
    }
  }

  /**
   * Execute multiple statements in a transaction
   */
  public transaction<T>(callback: () => T): T {
    const trx = this.db.transaction(callback);
    return trx();
  }

  /**
   * Close the database connection
   */
  public close(): void {
    this.db.close();
  }

  /**
   * Get the underlying database instance
   */
  public getDb(): Database.Database {
    return this.db;
  }

  /**
   * Initialize database schema
   */
  public initSchema(): void {
    const schemaPath = path.join(process.cwd(), 'database', 'schema.sql');

    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf-8');
      console.log('Initializing database schema...');
      this.db.exec(schema);
      console.log('Database schema initialized successfully');
    } else {
      console.warn('Schema file not found at:', schemaPath);
    }
  }
}

export const db = DatabaseConnection.getInstance();
export default db;
