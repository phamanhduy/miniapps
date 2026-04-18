import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema.js';
import path from 'path';
import fs from 'fs';
// Use path.resolve() for portable mode compatibility
const __dirname = path.resolve();
// Ensure we point to the db file in the backend root or specified path
const dbPath = process.env.DATABASE_URL?.replace('file:', '') ||
    (fs.existsSync(path.join(__dirname, 'zalocrm.db')) ? path.join(__dirname, 'zalocrm.db') :
        fs.existsSync(path.join(__dirname, '../zalocrm.db')) ? path.join(__dirname, '../zalocrm.db') :
            path.join(__dirname, 'zalocrm.db'));
// Handle ESM/CJS constructor interop for better-sqlite3
const DatabaseConstructor = typeof Database.default === 'function' ? Database.default : Database;
const sqlite = new DatabaseConstructor(dbPath, {
    // Helpful for bundled environments
    nativeBinding: fs.existsSync(path.join(__dirname, 'better_sqlite3.node'))
        ? path.join(__dirname, 'better_sqlite3.node')
        : undefined
});
// Enable foreign keys for SQLite
sqlite.pragma('foreign_keys = ON');
export const db = drizzle(sqlite, { schema });
//# sourceMappingURL=db.js.map