import * as dotenv from "dotenv";
dotenv.config();

import { Client } from "pg";
import { hashWithSalt } from "./src/utils/crypto/password-hashing.util";

const client = new Client({
  connectionString: process.env.DATABASE_URL || "postgresql://user:pass@127.0.0.1:5432/tfg"
});

async function main() {
  await client.connect();

  // Asegura compatibilidad del esquema con el código actual
  await client.query("ALTER TABLE \"auth_users\" ADD COLUMN IF NOT EXISTS \"role\" varchar(16) NOT NULL DEFAULT 'viewer'");
  await client.query('ALTER TABLE "auth_users" ADD COLUMN IF NOT EXISTS "moodleToken" varchar(128)');

  // Borra datos previos
  await client.query('DELETE FROM "auth_users"');

  const users = [
    {
      name: "Administrador",
      lastName: "General",
      email: "admin@demo.com",
      username: "admin",
      password: hashWithSalt("12345678"),
      role: "admin",
    },
    {
      name: "Juan",
      lastName: "Pérez",
      email: "juan@demo.com",
      username: "juanperez",
      password: hashWithSalt("123456"),
      role: "viewer",
    },
    {
      name: "Ana",
      lastName: "García",
      email: "ana@demo.com",
      username: "anagarcia",
      password: hashWithSalt("abcdef"),
      role: "viewer",
    },
  ];

  await client.query(
    `INSERT INTO "auth_users" ("name", "lastName", "email", "username", "password", "role")
     VALUES
     ($1, $2, $3, $4, $5, $6),
     ($7, $8, $9, $10, $11, $12),
     ($13, $14, $15, $16, $17, $18)`,
    [
      users[0].name, users[0].lastName, users[0].email, users[0].username, users[0].password, users[0].role,
      users[1].name, users[1].lastName, users[1].email, users[1].username, users[1].password, users[1].role,
      users[2].name, users[2].lastName, users[2].email, users[2].username, users[2].password, users[2].role,
    ]
  );

  await client.end();
  console.log("Datos de prueba insertados en auth_users");
}

main().catch(console.error);
