import { spawnSync } from "child_process";
import { sql, query as sql_query } from "./sql";
import { createInterface } from "readline";

export const MIGRATIONS = [
    // Create the migrations table to keep track of how far migrations have come along
    [
        `CREATE TABLE IF NOT EXISTS Migrations (timestamp TIMESTAMPTZ NOT NULL, index INTEGER);`,
    ],

    // The below tables are required by authjs (Nextauth) for email sessions
    // https://authjs.dev/getting-started/adapters/pg
    [
        `
        CREATE TABLE IF NOT EXISTS verification_token
            (
            identifier TEXT NOT NULL,
            expires TIMESTAMPTZ NOT NULL,
            token TEXT NOT NULL,
            PRIMARY KEY (identifier, token)
            )
        ;`,
        `CREATE TABLE IF NOT EXISTS accounts
        (
          id SERIAL,
          "userId" INTEGER NOT NULL,
          type VARCHAR(255) NOT NULL,
          provider VARCHAR(255) NOT NULL,
          "providerAccountId" VARCHAR(255) NOT NULL,
          refresh_token TEXT,
          access_token TEXT,
          expires_at BIGINT,
          id_token TEXT,
          scope TEXT,
          session_state TEXT,
          token_type TEXT,
         
          PRIMARY KEY (id)
        );`,
        `CREATE TABLE IF NOT EXISTS sessions
        (
          id SERIAL,
          "userId" INTEGER NOT NULL,
          expires TIMESTAMPTZ NOT NULL,
          "sessionToken" VARCHAR(255) NOT NULL,
         
          PRIMARY KEY (id)
        );`,
        `CREATE TABLE IF NOT EXISTS users
        (
          id SERIAL,
          name VARCHAR(255),
          email VARCHAR(255),
          "emailVerified" TIMESTAMPTZ,
          image TEXT,
         
          PRIMARY KEY (id)
        );`,
    ],
];

async function getCurrentMigrationIndex() : Promise<number | null> {
    try {
        const current_migration = await sql<{index: number}>`SELECT MAX(index) as index from Migrations`;
        return current_migration.rows[0].index;
    } catch (error: any) {
        if (error?.message === 'relation "migrations" does not exist') {
            console.log('Ignoring error cause it likely means table does not exist')
            return null;
        }

        // Unknown errors will rethrow
        throw error;
    }

}

export async function run_migrations() {
    // Find any pending migrations
    const currentMigrationIndex = await getCurrentMigrationIndex();
    const pendingMigrations = Array.from(MIGRATIONS.entries().filter(([index, statements]) => {
        return currentMigrationIndex === null || index > currentMigrationIndex;
    }));

    if (Array.from(pendingMigrations).length === 0) {
        console.log('No migrations to run, already up to date');
        process.exit();
    }

    // PGDump backup
    const readline = createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    const docker_command = 'docker compose --env-file ./envs/local.env exec -it pgbackups3 /bin/sh backup.sh';
    readline.question(`Did you run backup command: ${docker_command}`, async name => {
        await migrate(pendingMigrations);
    });

}

async function migrate(selected_migrations: Array<[number, string[]]>) {
    console.log(`Running ${selected_migrations.length} migrations out of ${MIGRATIONS.length}`);
    // Execute migration twice (for indepodence test)
    for (const migration of selected_migrations) {
        const [migration_index, statements] = migration;
        console.log(`Running migration ${migration_index}`);
        for (const [statement_index, statement] of statements.entries()) {
            console.log(`Running statement ${statement_index}`);
            console.log(statement);
            await sql_query(statement);
        }
        console.log(`Running migration again ${migration_index}`);
        for (const [statement_index, statement] of statements.entries()) {
            console.log(`Running statement ${statement_index}`);
            console.log(statement);
            await sql_query(statement);
        }

        // Upgrade migration entry
        await sql`INSERT INTO Migrations (timestamp, index) VALUES (NOW(), ${migration_index});`;
    }

    // Because async causes us to wait on event loop forever
    process.exit();
}