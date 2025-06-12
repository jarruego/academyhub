import * as dotenv from "dotenv";
dotenv.config();

import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import { userTable } from "./src/database/schema/tables/user.table";
import { companyTable } from "./src/database/schema/tables/company.table";
import { centerTable } from "./src/database/schema/tables/center.table";
import { courseTable } from "./src/database/schema/tables/course.table";
import { groupTable } from "./src/database/schema/tables/group.table";
import { userCenterTable } from "./src/database/schema/tables/user_center.table";
import { userGroupTable } from "./src/database/schema/tables/user_group.table";
import { userCourseTable } from "./src/database/schema/tables/user_course.table";
import { userCourseMoodleRoleTable } from "./src/database/schema/tables/user_course_moodle_role.table";

const client = new Client({
  connectionString: process.env.DATABASE_URL || "postgresql://user:pass@127.0.0.1:5432/tfg"
});

async function clearAllTables(db: any) {
  // Borra datos previos (orden importa por claves foráneas)
  await db.delete(userCourseMoodleRoleTable);
  await db.delete(userCourseTable);
  await db.delete(userGroupTable);
  await db.delete(userCenterTable);
  await db.delete(groupTable);
  await db.delete(courseTable);
  await db.delete(centerTable);
  await db.delete(companyTable);
  await db.delete(userTable);
}

async function main() {
  await client.connect();
  const db = drizzle(client);

  // Descomenta la siguiente línea para borrar los datos previos
  await clearAllTables(db);

  // Empresas (fusionadas)
  const empresasData = [
    { company_name: "Empresa Demo", corporate_name: "Empresa Demo S.A.", cif: "A12345678" },
    { company_name: "Empresa Test", corporate_name: "Empresa Test S.L.", cif: "B87654321" },
    { company_name: "Empresa Extra", corporate_name: "Empresa Extra SLU", cif: "C11223344" },
    { company_name: "Empresa Avanzada", corporate_name: "Empresa Avanzada S.A.", cif: "D12345678" },
    { company_name: "Empresa Servicios", corporate_name: "Servicios Globales S.L.", cif: "E87654321" }
  ];
  const empresas = await db.insert(companyTable).values(empresasData).returning();

  // Centros (fusionados)
  const centrosData = [
    { center_name: "Centro Demo", id_company: empresas[0].id_company, employer_number: "1234A" },
    { center_name: "Centro Test", id_company: empresas[1].id_company, employer_number: "5678B" },
    { center_name: "Centro Extra", id_company: empresas[2].id_company, employer_number: "9999C" },
    { center_name: "Centro Norte", id_company: empresas[3].id_company, employer_number: "1111D" },
    { center_name: "Centro Sur", id_company: empresas[4].id_company, employer_number: "2222E" }
  ];
  const centros = await db.insert(centerTable).values(centrosData).returning();

  // Usuarios (fusionados)
  const userData = [
    {
      name: "Juan",
      first_surname: "Pérez",
      second_surname: "López",
      email: "juan@demo.com",
      moodle_username: "juanperez",
      moodle_password: "pass123",
      dni: "12345678Z",
      phone: "600111111",
      nss: "12345678901",
      document_type: "DNI",
      gender: "Male",
      professional_category: "1",
      disability: false,
      terrorism_victim: false,
      gender_violence_victim: false,
      education_level: "2",
      address: "Calle Falsa 123",
      postal_code: "28080",
      city: "Madrid",
      province: "Madrid",
      country: "España",
      observations: "Sin observaciones",
      seasonalWorker: false,
      erteLaw: false,
      accreditationDiploma: "N"
    },
    {
      name: "Ana",
      first_surname: "García",
      second_surname: "Ruiz",
      email: "ana@demo.com",
      moodle_username: "anagarcia",
      moodle_password: "pass456",
      dni: "87654321X",
      phone: "600222222",
      nss: "23456789012",
      document_type: "DNI",
      gender: "Female",
      professional_category: "2",
      disability: true,
      terrorism_victim: false,
      gender_violence_victim: false,
      education_level: "3",
      address: "Avenida Real 45",
      postal_code: "08080",
      city: "Barcelona",
      province: "Barcelona",
      country: "España",
      observations: "Alergia a penicilina",
      seasonalWorker: false,
      erteLaw: true,
      accreditationDiploma: "S"
    },
    {
      name: "Luis",
      first_surname: "Martín",
      second_surname: "Santos",
      email: "luis@demo.com",
      moodle_username: "luismartin",
      moodle_password: "pass789",
      dni: "11223344B",
      phone: "600333333",
      nss: "34567890123",
      document_type: "DNI",
      gender: "Male",
      professional_category: "3",
      disability: false,
      terrorism_victim: true,
      gender_violence_victim: false,
      education_level: "4",
      address: "Plaza Mayor 1",
      postal_code: "41001",
      city: "Sevilla",
      province: "Sevilla",
      country: "España",
      observations: "",
      seasonalWorker: true,
      erteLaw: false,
      accreditationDiploma: "N"
    },
    {
      name: "Marta",
      first_surname: "Sánchez",
      second_surname: "Gómez",
      email: "marta@demo.com",
      moodle_username: "martasanchez",
      moodle_password: "pass321",
      dni: "55667788Z",
      phone: "600444444",
      nss: "45678901234",
      document_type: "DNI",
      gender: "Female",
      professional_category: "4",
      disability: false,
      terrorism_victim: false,
      gender_violence_victim: true,
      education_level: "5",
      address: "Calle Nueva 77",
      postal_code: "29009",
      city: "Málaga",
      province: "Málaga",
      country: "España",
      observations: "",
      seasonalWorker: false,
      erteLaw: false,
      accreditationDiploma: "S"
    },
    {
      name: "Carlos",
      first_surname: "López",
      second_surname: "Martínez",
      email: "carlos@demo.com",
      moodle_username: "carloslopez",
      moodle_password: "passcarlos",
      dni: "99887766P",
      phone: "600555555",
      nss: "56789012345",
      document_type: "DNI",
      gender: "Male",
      professional_category: "5",
      disability: false,
      terrorism_victim: false,
      gender_violence_victim: false,
      education_level: "1",
      address: "Calle Sol 10",
      postal_code: "28010",
      city: "Madrid",
      province: "Madrid",
      country: "España",
      observations: "Usuario extra 1",
      seasonalWorker: false,
      erteLaw: false,
      accreditationDiploma: "N"
    },
    {
      name: "Elena",
      first_surname: "Moreno",
      second_surname: "Díaz",
      email: "elena@demo.com",
      moodle_username: "elenamoreno",
      moodle_password: "passenena",
      dni: "44556677L",
      phone: "600666666",
      nss: "67890123456",
      document_type: "DNI",
      gender: "Female",
      professional_category: "1",
      disability: true,
      terrorism_victim: false,
      gender_violence_victim: false,
      education_level: "2",
      address: "Avenida Paz 22",
      postal_code: "08010",
      city: "Barcelona",
      province: "Barcelona",
      country: "España",
      observations: "Usuario extra 2",
      seasonalWorker: false,
      erteLaw: false,
      accreditationDiploma: "S"
    },
    {
      name: "Pedro",
      first_surname: "Ramírez",
      second_surname: "García",
      email: "pedro@demo.com",
      moodle_username: "pedroramirez",
      moodle_password: "passpedro",
      dni: "10293847J",
      phone: "600777777",
      nss: "78901234567",
      document_type: "DNI",
      gender: "Male",
      professional_category: "2",
      disability: false,
      terrorism_victim: false,
      gender_violence_victim: false,
      education_level: "3",
      address: "Calle Norte 1",
      postal_code: "33001",
      city: "Oviedo",
      province: "Asturias",
      country: "España",
      observations: "Usuario avanzado 1",
      seasonalWorker: false,
      erteLaw: false,
      accreditationDiploma: "N"
    },
    {
      name: "Lucía",
      first_surname: "Fernández",
      second_surname: "Soto",
      email: "lucia@demo.com",
      moodle_username: "luciafernandez",
      moodle_password: "passlucia",
      dni: "74839201F",
      phone: "600888888",
      nss: "89012345678",
      document_type: "DNI",
      gender: "Female",
      professional_category: "3",
      disability: false,
      terrorism_victim: false,
      gender_violence_victim: false,
      education_level: "4",
      address: "Avenida Sur 2",
      postal_code: "41002",
      city: "Sevilla",
      province: "Sevilla",
      country: "España",
      observations: "Usuario avanzado 2",
      seasonalWorker: false,
      erteLaw: false,
      accreditationDiploma: "S"
    },
    // Usuarios nuevos con los DNIs restantes
    {
      name: "Sergio",
      first_surname: "Gómez",
      second_surname: "Ruiz",
      email: "sergio@demo.com",
      moodle_username: "sergiogomez",
      moodle_password: "passsergio",
      dni: "83746592G",
      phone: "600123456",
      nss: "11122233344",
      document_type: "DNI",
      gender: "Male",
      professional_category: "2",
      disability: false,
      terrorism_victim: false,
      gender_violence_victim: false,
      education_level: "2",
      address: "Calle Sur 10",
      postal_code: "28020",
      city: "Madrid",
      province: "Madrid",
      country: "España",
      observations: "Usuario nuevo 1",
      seasonalWorker: false,
      erteLaw: false,
      accreditationDiploma: "N"
    },
    {
      name: "Patricia",
      first_surname: "López",
      second_surname: "Santos",
      email: "patricia@demo.com",
      moodle_username: "patricialopez",
      moodle_password: "passpatricia",
      dni: "92038475L",
      phone: "600234567",
      nss: "22233344455",
      document_type: "DNI",
      gender: "Female",
      professional_category: "3",
      disability: false,
      terrorism_victim: false,
      gender_violence_victim: false,
      education_level: "3",
      address: "Avenida Oeste 5",
      postal_code: "08030",
      city: "Barcelona",
      province: "Barcelona",
      country: "España",
      observations: "Usuario nuevo 2",
      seasonalWorker: false,
      erteLaw: false,
      accreditationDiploma: "S"
    },
    {
      name: "Raúl",
      first_surname: "Serrano",
      second_surname: "Vega",
      email: "raul@demo.com",
      moodle_username: "raulserrano",
      moodle_password: "passraul",
      dni: "38475629X",
      phone: "600345678",
      nss: "33344455566",
      document_type: "DNI",
      gender: "Male",
      professional_category: "4",
      disability: false,
      terrorism_victim: false,
      gender_violence_victim: false,
      education_level: "4",
      address: "Calle Este 8",
      postal_code: "41010",
      city: "Sevilla",
      province: "Sevilla",
      country: "España",
      observations: "Usuario nuevo 3",
      seasonalWorker: false,
      erteLaw: false,
      accreditationDiploma: "N"
    },
    {
      name: "Beatriz",
      first_surname: "Martínez",
      second_surname: "Díaz",
      email: "beatriz@demo.com",
      moodle_username: "beatrizmartinez",
      moodle_password: "passbeatriz",
      dni: "29384756W",
      phone: "600456789",
      nss: "44455566677",
      document_type: "DNI",
      gender: "Female",
      professional_category: "1",
      disability: false,
      terrorism_victim: false,
      gender_violence_victim: false,
      education_level: "1",
      address: "Calle Norte 12",
      postal_code: "33010",
      city: "Oviedo",
      province: "Asturias",
      country: "España",
      observations: "Usuario nuevo 4",
      seasonalWorker: false,
      erteLaw: false,
      accreditationDiploma: "S"
    },
    {
      name: "Alberto",
      first_surname: "Fernández",
      second_surname: "Soto",
      email: "alberto@demo.com",
      moodle_username: "albertofernandez",
      moodle_password: "passalberto",
      dni: "18273645F",
      phone: "600567890",
      nss: "55566677788",
      document_type: "DNI",
      gender: "Male",
      professional_category: "2",
      disability: false,
      terrorism_victim: false,
      gender_violence_victim: false,
      education_level: "2",
      address: "Avenida Central 3",
      postal_code: "29010",
      city: "Málaga",
      province: "Málaga",
      country: "España",
      observations: "Usuario nuevo 5",
      seasonalWorker: false,
      erteLaw: false,
      accreditationDiploma: "N"
    },
    {
      name: "Cristina",
      first_surname: "Santos",
      second_surname: "Gómez",
      email: "cristina@demo.com",
      moodle_username: "cristinagomez",
      moodle_password: "passcristina",
      dni: "56473829C",
      phone: "600678901",
      nss: "66677788899",
      document_type: "DNI",
      gender: "Female",
      professional_category: "3",
      disability: false,
      terrorism_victim: false,
      gender_violence_victim: false,
      education_level: "3",
      address: "Calle Oeste 7",
      postal_code: "08040",
      city: "Barcelona",
      province: "Barcelona",
      country: "España",
      observations: "Usuario nuevo 6",
      seasonalWorker: false,
      erteLaw: false,
      accreditationDiploma: "S"
    },
    {
      name: "Javier",
      first_surname: "Ruiz",
      second_surname: "Martín",
      email: "javier@demo.com",
      moodle_username: "javierruiz",
      moodle_password: "passjavier",
      dni: "83726194F",
      phone: "600789012",
      nss: "77788899900",
      document_type: "DNI",
      gender: "Male",
      professional_category: "4",
      disability: false,
      terrorism_victim: false,
      gender_violence_victim: false,
      education_level: "4",
      address: "Avenida Este 9",
      postal_code: "41020",
      city: "Sevilla",
      province: "Sevilla",
      country: "España",
      observations: "Usuario nuevo 7",
      seasonalWorker: false,
      erteLaw: false,
      accreditationDiploma: "N"
    }
  ];
  // Insertar usuarios de prueba
  const users = await db.insert(userTable).values(userData).returning();

  // Cursos de prueba
  const cursosData = [
    {
      course_name: "Curso Node.js",
      category: "Programación",
      short_name: "NODEJS",
      start_date: new Date("2024-01-10T09:00:00+01:00"),
      end_date: new Date("2024-02-10T18:00:00+01:00"),
      modality: "Online",
      hours: 40,
      price_per_hour: 15.5,
      active: true,
      fundae_id: "FND001"
    },
    {
      course_name: "Curso React",
      category: "Frontend",
      short_name: "REACT",
      start_date: new Date("2024-03-01T09:00:00+01:00"),
      end_date: new Date("2024-04-01T18:00:00+01:00"),
      modality: "Presencial",
      hours: 30,
      price_per_hour: 20.0,
      active: true,
      fundae_id: "FND002"
    },
    {
      course_name: "Curso SQL",
      category: "Bases de datos",
      short_name: "SQL",
      start_date: new Date("2024-05-01T09:00:00+01:00"),
      end_date: new Date("2024-06-01T18:00:00+01:00"),
      modality: "Online",
      hours: 25,
      price_per_hour: 12.0,
      active: false,
      fundae_id: "FND003"
    },
    {
      course_name: "Curso Python",
      category: "Programación",
      short_name: "PYTHON",
      start_date: new Date("2024-07-01T09:00:00+01:00"),
      end_date: new Date("2024-08-01T18:00:00+01:00"),
      modality: "Online",
      hours: 50,
      price_per_hour: 18.0,
      active: true,
      fundae_id: "FND004"
    },
    {
      course_name: "Curso Excel",
      category: "Ofimática",
      short_name: "EXCEL",
      start_date: new Date("2024-09-01T09:00:00+01:00"),
      end_date: new Date("2024-10-01T18:00:00+01:00"),
      modality: "Presencial",
      hours: 20,
      price_per_hour: 10.0,
      active: true,
      fundae_id: "FND005"
    },
    {
      course_name: "Curso Java",
      category: "Programación",
      short_name: "JAVA",
      start_date: new Date("2024-11-01T09:00:00+01:00"),
      end_date: new Date("2024-12-01T18:00:00+01:00"),
      modality: "Online",
      hours: 60,
      price_per_hour: 22.0,
      active: true,
      fundae_id: "FND006"
    },
    {
      course_name: "Curso Power BI",
      category: "Datos",
      short_name: "POWERBI",
      start_date: new Date("2025-01-10T09:00:00+01:00"),
      end_date: new Date("2025-02-10T18:00:00+01:00"),
      modality: "Presencial",
      hours: 35,
      price_per_hour: 25.0,
      active: true,
      fundae_id: "FND007"
    }
  ];
  // Insertar cursos de prueba
  const cursos = await db.insert(courseTable).values(cursosData).returning();

  // Grupos de prueba
  const gruposData = [
    {
      group_name: "Grupo 1",
      id_course: cursos[0].id_course,
      description: "Grupo de Node.js",
      start_date: new Date("2024-01-10T09:00:00+01:00"),
      end_date: new Date("2024-02-10T18:00:00+01:00"),
      fundae_id: "GND001"
    },
    {
      group_name: "Grupo 2",
      id_course: cursos[1].id_course,
      description: "Grupo de React",
      start_date: new Date("2024-03-01T09:00:00+01:00"),
      end_date: new Date("2024-04-01T18:00:00+01:00"),
      fundae_id: "GND002"
    },
    {
      group_name: "Grupo 3",
      id_course: cursos[2].id_course,
      description: "Grupo de SQL",
      start_date: new Date("2024-05-01T09:00:00+01:00"),
      end_date: new Date("2024-06-01T18:00:00+01:00"),
      fundae_id: "GND003"
    },
    {
      group_name: "Grupo Python",
      id_course: cursos[3].id_course,
      description: "Grupo de Python avanzado",
      start_date: new Date("2024-07-01T09:00:00+01:00"),
      end_date: new Date("2024-08-01T18:00:00+01:00"),
      fundae_id: "GND004"
    },
    {
      group_name: "Grupo Excel",
      id_course: cursos[4].id_course,
      description: "Grupo de Excel básico",
      start_date: new Date("2024-09-01T09:00:00+01:00"),
      end_date: new Date("2024-10-01T18:00:00+01:00"),
      fundae_id: "GND005"
    },
    {
      group_name: "Grupo Java",
      id_course: cursos[5].id_course,
      description: "Grupo de Java avanzado",
      start_date: new Date("2024-11-01T09:00:00+01:00"),
      end_date: new Date("2024-12-01T18:00:00+01:00"),
      fundae_id: "GND006"
    },
    {
      group_name: "Grupo Power BI",
      id_course: cursos[6].id_course,
      description: "Grupo de Power BI básico",
      start_date: new Date("2025-01-10T09:00:00+01:00"),
      end_date: new Date("2025-02-10T18:00:00+01:00"),
      fundae_id: "GND007"
    }
  ];
  // Insertar grupos de prueba
  const grupos = await db.insert(groupTable).values(gruposData).returning();

  // Relacionar usuarios con centros (user-center)
  await db.insert(userCenterTable).values([
    { id_user: users[0].id_user, id_center: centros[0].id_center, start_date: new Date("2023-01-01"), end_date: null, is_main_center: true },
    { id_user: users[1].id_user, id_center: centros[0].id_center, start_date: new Date("2023-02-01"), end_date: null, is_main_center: false },
    { id_user: users[2].id_user, id_center: centros[1].id_center, start_date: new Date("2023-03-01"), end_date: null, is_main_center: true },
    { id_user: users[3].id_user, id_center: centros[2].id_center, start_date: new Date("2023-04-01"), end_date: null, is_main_center: true },
    { id_user: users[4].id_user, id_center: centros[0].id_center, start_date: new Date("2024-01-01"), end_date: null, is_main_center: false },
    { id_user: users[5].id_user, id_center: centros[1].id_center, start_date: new Date("2024-02-01"), end_date: null, is_main_center: false },
    { id_user: users[6].id_user, id_center: centros[3].id_center, start_date: new Date("2024-11-01"), end_date: null, is_main_center: true },
    { id_user: users[7].id_user, id_center: centros[4].id_center, start_date: new Date("2025-01-10"), end_date: null, is_main_center: true },
    { id_user: users[8].id_user, id_center: centros[4].id_center, start_date: new Date("2025-01-10"), end_date: null, is_main_center: false }
  ]);

  // Relacionar usuarios con grupos (user-group)
  await db.insert(userGroupTable).values([
    { id_user: users[0].id_user, id_group: grupos[0].id_group, id_center: centros[0].id_center, join_date: new Date("2024-01-10"), completion_percentage: "100", time_spent: 40, last_access: new Date("2024-02-10T18:00:00+01:00") },
    { id_user: users[1].id_user, id_group: grupos[0].id_group, id_center: centros[0].id_center, join_date: new Date("2024-01-10"), completion_percentage: "80", time_spent: 32, last_access: new Date("2024-02-09T17:00:00+01:00") },
    { id_user: users[2].id_user, id_group: grupos[1].id_group, id_center: centros[1].id_center, join_date: new Date("2024-03-01"), completion_percentage: "90", time_spent: 27, last_access: new Date("2024-04-01T18:00:00+01:00") },
    { id_user: users[3].id_user, id_group: grupos[2].id_group, id_center: centros[2].id_center, join_date: new Date("2024-05-01"), completion_percentage: "100", time_spent: 25, last_access: new Date("2024-06-01T18:00:00+01:00") },
    { id_user: users[4].id_user, id_group: grupos[3].id_group, id_center: centros[0].id_center, join_date: new Date("2024-07-01"), completion_percentage: "100", time_spent: 50, last_access: new Date("2024-08-01T18:00:00+01:00") },
    { id_user: users[5].id_user, id_group: grupos[4].id_group, id_center: centros[1].id_center, join_date: new Date("2024-09-01"), completion_percentage: "100", time_spent: 20, last_access: new Date("2024-10-01T18:00:00+01:00") },
    { id_user: users[6].id_user, id_group: grupos[5].id_group, id_center: centros[3].id_center, join_date: new Date("2024-11-01"), completion_percentage: "100", time_spent: 60, last_access: new Date("2024-12-01T18:00:00+01:00") },
    { id_user: users[7].id_user, id_group: grupos[6].id_group, id_center: centros[4].id_center, join_date: new Date("2025-01-10"), completion_percentage: "100", time_spent: 35, last_access: new Date("2025-02-10T18:00:00+01:00") },
    { id_user: users[8].id_user, id_group: grupos[6].id_group, id_center: centros[4].id_center, join_date: new Date("2025-01-10"), completion_percentage: "100", time_spent: 35, last_access: new Date("2025-02-10T18:00:00+01:00") }
  ]);

  // Relacionar usuarios con cursos (user-course)
  await db.insert(userCourseTable).values([
    { id_user: users[0].id_user, id_course: cursos[0].id_course, enrollment_date: new Date("2024-01-10"), completion_percentage: "100", time_spent: 40 },
    { id_user: users[1].id_user, id_course: cursos[0].id_course, enrollment_date: new Date("2024-01-10"), completion_percentage: "80", time_spent: 32 },
    { id_user: users[2].id_user, id_course: cursos[1].id_course, enrollment_date: new Date("2024-03-01"), completion_percentage: "90", time_spent: 27 },
    { id_user: users[3].id_user, id_course: cursos[2].id_course, enrollment_date: new Date("2024-05-01"), completion_percentage: "100", time_spent: 25 },
    { id_user: users[4].id_user, id_course: cursos[3].id_course, enrollment_date: new Date("2024-07-01"), completion_percentage: "100", time_spent: 50 },
    { id_user: users[5].id_user, id_course: cursos[4].id_course, enrollment_date: new Date("2024-09-01"), completion_percentage: "100", time_spent: 20 },
    { id_user: users[6].id_user, id_course: cursos[5].id_course, enrollment_date: new Date("2024-11-01"), completion_percentage: "100", time_spent: 60 },
    { id_user: users[7].id_user, id_course: cursos[6].id_course, enrollment_date: new Date("2025-01-10"), completion_percentage: "100", time_spent: 35 },
    { id_user: users[8].id_user, id_course: cursos[6].id_course, enrollment_date: new Date("2025-01-10"), completion_percentage: "100", time_spent: 35 }
  ]);

  // Relacionar usuarios, cursos y roles de Moodle (user-course-moodle-role)
  await db.insert(userCourseMoodleRoleTable).values([
    { id_user: users[0].id_user, id_course: cursos[0].id_course, id_role: 1, role_shortname: "student" },
    { id_user: users[1].id_user, id_course: cursos[0].id_course, id_role: 2, role_shortname: "teacher" },
    { id_user: users[2].id_user, id_course: cursos[1].id_course, id_role: 1, role_shortname: "student" },
    { id_user: users[3].id_user, id_course: cursos[2].id_course, id_role: 3, role_shortname: "manager" },
    { id_user: users[4].id_user, id_course: cursos[3].id_course, id_role: 1, role_shortname: "student" },
    { id_user: users[5].id_user, id_course: cursos[4].id_course, id_role: 1, role_shortname: "student" },
    { id_user: users[6].id_user, id_course: cursos[5].id_course, id_role: 1, role_shortname: "student" },
    { id_user: users[7].id_user, id_course: cursos[6].id_course, id_role: 1, role_shortname: "student" },
    { id_user: users[8].id_user, id_course: cursos[6].id_course, id_role: 2, role_shortname: "teacher" }
  ]);

  await client.end();
  console.log("Datos de prueba insertados en todas las tablas principales");
}

main().catch(console.error);
