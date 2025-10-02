import * as dotenv from "dotenv";
dotenv.config();

import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import { authUserTable } from "./src/database/schema/tables/auth_user.table";
import { hashWithSalt } from "./src/utils/crypto/password-hashing.util";

const client = new Client({
  connectionString: process.env.DATABASE_URL || "postgresql://user:pass@127.0.0.1:5432/tfg"
});

async function main() {
  await client.connect();
  const db = drizzle(client);

  // Borra datos previos
  await db.delete(authUserTable);

  // Inserta datos de ejemplo
  await db.insert(authUserTable).values([
    {
      name: "Administrador",
      lastName: "General",
      email: "admin@demo.com",
      username: "admin",
      password: hashWithSalt("12345678"),
      role: "admin"
    },
    {
      name: "Juan",
      lastName: "Pérez",
      email: "juan@demo.com",
      username: "juanperez",
      password: hashWithSalt("123456"),
      role: "viewer"
    },
    {
      name: "Ana",
      lastName: "García",
      email: "ana@demo.com",
      username: "anagarcia",
      password: hashWithSalt("abcdef"),
      role: "viewer"
    }
  ]);

  await client.end();
  console.log("Datos de prueba insertados en auth_users");
}

main().catch(console.error);
