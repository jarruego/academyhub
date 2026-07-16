import {
  AuditLinkRow,
  AuditMoodleUser,
  AuditUserRef,
  classifyMoodleLinks,
  toAuditMoodleUser,
} from "./moodle-audit.util";
import { moodleUserDniKeys, compactDniKey } from "src/api/moodle/moodle-user-matching.util";
import { MoodleUser } from "src/types/moodle/user";

// DNIs con letra de control válida usados en los tests
const DNI_A = "18457959E";
const DNI_B = "12345678Z";

function moodleUser(partial: Partial<MoodleUser>): MoodleUser {
  return {
    id: 1,
    username: "user1",
    firstname: "Nombre",
    lastname: "Apellido",
    fullname: "Nombre Apellido",
    email: "u@example.com",
    department: "",
    firstaccess: 0,
    lastaccess: 0,
    auth: "manual",
    suspended: false,
    confirmed: true,
    lang: "es",
    theme: "",
    timezone: "99",
    mailformat: 1,
    description: "",
    descriptionformat: 1,
    city: "",
    country: "ES",
    profileimageurlsmall: "",
    profileimageurl: "",
    roles: [],
    ...partial,
  } as MoodleUser;
}

function auditMoodle(partial: Partial<AuditMoodleUser>): AuditMoodleUser {
  return {
    moodle_id: 1,
    username: "user1",
    fullname: "Nombre Apellido",
    email: "u@example.com",
    suspended: false,
    dni_keys: [],
    ...partial,
  };
}

function userRef(partial: Partial<AuditUserRef> & { id_user: number }): AuditUserRef {
  return {
    name: "Nombre",
    first_surname: "Apellido",
    second_surname: null,
    dni: null,
    nss: null,
    email: null,
    courses_count: 1,
    groups_count: 1,
    moodle_count: 1,
    ...partial,
  };
}

function link(partial: Partial<AuditLinkRow> & { id_moodle_user: number; id_user: number; moodle_id: number }): AuditLinkRow {
  return {
    moodle_username: "user1",
    is_main_user: true,
    user_course_refs: 0,
    token_links: 0,
    ...partial,
  };
}

describe("moodleUserDniKeys / compactDniKey", () => {
  it("normaliza el customfield dni a compacto-mayúsculas", () => {
    const mu = moodleUser({
      username: "cualquiera",
      customfields: [{ type: "text", value: ` ${DNI_A.toLowerCase()} `, name: "DNI", shortname: "dni" }],
    });
    expect(moodleUserDniKeys(mu)).toEqual([DNI_A]);
  });

  it("usa el username solo cuando valida como documento", () => {
    expect(moodleUserDniKeys(moodleUser({ username: DNI_B.toLowerCase() }))).toEqual([DNI_B]);
    expect(moodleUserDniKeys(moodleUser({ username: "pepe.garcia" }))).toEqual([]);
  });

  it("dedupe cuando customfield y username son el mismo documento", () => {
    const mu = moodleUser({
      username: DNI_A.toLowerCase(),
      customfields: [{ type: "text", value: DNI_A, name: "DNI", shortname: "dni" }],
    });
    expect(moodleUserDniKeys(mu)).toEqual([DNI_A]);
  });

  it("compactDniKey quita separadores y pasa a mayúsculas", () => {
    expect(compactDniKey(" 12.345.678-z ")).toBe(DNI_B);
    expect(compactDniKey(null)).toBe("");
  });
});

describe("toAuditMoodleUser", () => {
  it("proyecta los campos y calcula dni_keys", () => {
    const projected = toAuditMoodleUser(moodleUser({ id: 7, username: DNI_A.toLowerCase(), suspended: true }));
    expect(projected).toMatchObject({ moodle_id: 7, username: DNI_A.toLowerCase(), suspended: true, dni_keys: [DNI_A] });
  });
});

describe("classifyMoodleLinks", () => {
  it("cuenta como OK el vínculo cuyo DNI casa con el usuario vinculado", () => {
    const result = classifyMoodleLinks({
      snapshot: [auditMoodle({ moodle_id: 10, dni_keys: [DNI_A] })],
      links: [link({ id_moodle_user: 1, id_user: 100, moodle_id: 10 })],
      usersById: new Map([[100, userRef({ id_user: 100, dni: DNI_A })]]),
      userIdByDniKey: new Map([[DNI_A, 100]]),
    });
    expect(result.ok_count).toBe(1);
    expect(result.incorrectLinks).toHaveLength(0);
    expect(result.unverifiable).toHaveLength(0);
  });

  it("detecta vínculo incorrecto: el DNI casa con otro usuario local (caso duplicado del import antiguo)", () => {
    const duplicado = userRef({ id_user: 200, name: "Nombre", first_surname: "Apellido", dni: null, courses_count: 2 });
    const original = userRef({ id_user: 100, name: "nombre", first_surname: "apellido", dni: DNI_A, courses_count: 5 });
    const result = classifyMoodleLinks({
      snapshot: [auditMoodle({ moodle_id: 10, dni_keys: [DNI_A] })],
      links: [link({ id_moodle_user: 1, id_user: 200, moodle_id: 10 })],
      usersById: new Map([[100, original], [200, duplicado]]),
      userIdByDniKey: new Map([[DNI_A, 100]]),
    });
    expect(result.ok_count).toBe(0);
    expect(result.incorrectLinks).toHaveLength(1);
    expect(result.incorrectLinks[0]).toMatchObject({
      id_moodle_user: 1,
      linkedUser: { id_user: 200 },
      expectedUser: { id_user: 100 },
      nameMatch: true, // nombres iguales tras normalizar mayúsculas/acentos
    });
  });

  it("marca nameMatch=false cuando los nombres de los dos usuarios locales no coinciden", () => {
    const result = classifyMoodleLinks({
      snapshot: [auditMoodle({ moodle_id: 10, dni_keys: [DNI_A] })],
      links: [link({ id_moodle_user: 1, id_user: 200, moodle_id: 10 })],
      usersById: new Map([
        [100, userRef({ id_user: 100, name: "Ana", first_surname: "López", dni: DNI_A })],
        [200, userRef({ id_user: 200, name: "Pedro", first_surname: "Gómez" })],
      ]),
      userIdByDniKey: new Map([[DNI_A, 100]]),
    });
    expect(result.incorrectLinks[0].nameMatch).toBe(false);
  });

  it("clasifica como no verificable sin DNI (no-dni) o con DNI desconocido en la BD (dni-not-found)", () => {
    const result = classifyMoodleLinks({
      snapshot: [
        auditMoodle({ moodle_id: 10, dni_keys: [] }),
        auditMoodle({ moodle_id: 11, dni_keys: [DNI_B] }),
      ],
      links: [
        link({ id_moodle_user: 1, id_user: 100, moodle_id: 10 }),
        link({ id_moodle_user: 2, id_user: 101, moodle_id: 11 }),
      ],
      usersById: new Map([
        [100, userRef({ id_user: 100 })],
        [101, userRef({ id_user: 101 })],
      ]),
      userIdByDniKey: new Map(),
    });
    expect(result.unverifiable).toHaveLength(2);
    expect(result.unverifiable.map(u => u.reason).sort()).toEqual(["dni-not-found", "no-dni"]);
  });

  it("detecta huérfanos (moodle_id fuera del snapshot) con contadores y otras cuentas del usuario", () => {
    const result = classifyMoodleLinks({
      snapshot: [auditMoodle({ moodle_id: 10, dni_keys: [] })],
      links: [
        link({ id_moodle_user: 1, id_user: 100, moodle_id: 10 }), // viva
        link({ id_moodle_user: 2, id_user: 100, moodle_id: 99, is_main_user: false, user_course_refs: 3, token_links: 1 }), // huérfana
      ],
      usersById: new Map([[100, userRef({ id_user: 100, courses_count: 3 })]]),
      userIdByDniKey: new Map(),
    });
    expect(result.orphans).toHaveLength(1);
    expect(result.orphans[0]).toMatchObject({
      id_moodle_user: 2,
      moodle_id: 99,
      user_course_refs: 3,
      token_links: 1,
      other_accounts: 1,
      user: { id_user: 100 },
    });
  });

  it("detecta cuentas vinculadas sin ningún curso en la BD", () => {
    const result = classifyMoodleLinks({
      snapshot: [auditMoodle({ moodle_id: 10, dni_keys: [DNI_A] })],
      links: [link({ id_moodle_user: 1, id_user: 100, moodle_id: 10 })],
      usersById: new Map([[100, userRef({ id_user: 100, dni: DNI_A, courses_count: 0 })]]),
      userIdByDniKey: new Map([[DNI_A, 100]]),
    });
    expect(result.ok_count).toBe(1); // el vínculo es correcto…
    expect(result.noCourses).toHaveLength(1); // …pero sin cursos en la BD
  });

  it("detecta cuentas de Moodle sin vínculo local, con el usuario que casaría por DNI", () => {
    const result = classifyMoodleLinks({
      snapshot: [
        auditMoodle({ moodle_id: 10, dni_keys: [DNI_A] }),
        auditMoodle({ moodle_id: 11, dni_keys: [] }),
      ],
      links: [],
      usersById: new Map([[100, userRef({ id_user: 100, dni: DNI_A })]]),
      userIdByDniKey: new Map([[DNI_A, 100]]),
    });
    expect(result.unlinked).toHaveLength(2);
    const byId = new Map(result.unlinked.map(u => [u.moodle.moodle_id, u]));
    expect(byId.get(10)?.wouldMatchUser?.id_user).toBe(100);
    expect(byId.get(11)?.wouldMatchUser).toBeNull();
  });

  it("detecta usernames desactualizados como dimensión independiente (el vínculo puede ser OK)", () => {
    const result = classifyMoodleLinks({
      snapshot: [
        auditMoodle({ moodle_id: 10, username: DNI_A.toLowerCase(), dni_keys: [DNI_A] }),
        auditMoodle({ moodle_id: 11, username: "nuevo.username", dni_keys: [] }),
      ],
      links: [
        // username guardado con mayúsculas distintas del real → desfase (comparación exacta)
        link({ id_moodle_user: 1, id_user: 100, moodle_id: 10, moodle_username: DNI_A }),
        // username antiguo completamente distinto
        link({ id_moodle_user: 2, id_user: 101, moodle_id: 11, moodle_username: "viejo.username" }),
      ],
      usersById: new Map([
        [100, userRef({ id_user: 100, dni: DNI_A })],
        [101, userRef({ id_user: 101 })],
      ]),
      userIdByDniKey: new Map([[DNI_A, 100]]),
    });
    expect(result.ok_count).toBe(1); // el vínculo 1 es correcto por DNI…
    expect(result.usernameMismatches).toHaveLength(2); // …pero ambos usernames están desfasados
    expect(result.usernameMismatches[0]).toMatchObject({
      id_moodle_user: 1,
      stored_username: DNI_A,
      real_username: DNI_A.toLowerCase(),
    });
    expect(result.usernameMismatches[1]).toMatchObject({
      id_moodle_user: 2,
      stored_username: "viejo.username",
      real_username: "nuevo.username",
    });
  });

  it("no marca desfase de username en huérfanos (no hay username real con el que comparar)", () => {
    const result = classifyMoodleLinks({
      snapshot: [],
      links: [link({ id_moodle_user: 1, id_user: 100, moodle_id: 99, moodle_username: "cualquiera" })],
      usersById: new Map([[100, userRef({ id_user: 100 })]]),
      userIdByDniKey: new Map(),
    });
    expect(result.usernameMismatches).toHaveLength(0);
    expect(result.orphans).toHaveLength(1);
  });

  it("un usuario local desconocido en el mapa no rompe la clasificación (placeholder)", () => {
    const result = classifyMoodleLinks({
      snapshot: [auditMoodle({ moodle_id: 10, dni_keys: [DNI_A] })],
      links: [link({ id_moodle_user: 1, id_user: 999, moodle_id: 10 })],
      usersById: new Map([[100, userRef({ id_user: 100, dni: DNI_A })]]),
      userIdByDniKey: new Map([[DNI_A, 100]]),
    });
    expect(result.incorrectLinks[0].linkedUser).toMatchObject({ id_user: 999, name: null });
  });
});
