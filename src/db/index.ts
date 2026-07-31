import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';

export const sqliteDb = SQLite.openDatabaseSync('coinquest.db');

export const db = drizzle(sqliteDb, { schema });

export type DB = typeof db;
