import { Injectable, Logger, Inject } from '@nestjs/common';
import { Readable } from 'stream';
import * as iconv from 'iconv-lite';
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
const csvParser = require('csv-parser');

import { UserService } from '../user/user.service';
import { MoodleUserService } from '../moodle-user/moodle-user.service';
import { CompanyService } from '../company/company.service';
import { CenterService } from '../center/center.service';
import { CourseService } from '../course/course.service';
import { GroupService } from '../group/group.service';
import { DATABASE_PROVIDER } from 'src/database/database.module';
import { DatabaseService } from 'src/database/database.service';
import { userCenterTable } from 'src/database/schema/tables/user_center.table';
import { eq, and } from 'drizzle-orm';

type Phase = 'users' | 'companies' | 'associate' | 'courses' | 'groups';

@Injectable()
export class ImportVelneoService {
  private readonly logger = new Logger(ImportVelneoService.name);
  private readonly badRowsPath = path.join(process.cwd(), 'import-bad-rows.csv');
  // Control whether we write the bad-rows CSV to disk. Disabled by default in production to
  // avoid creating artefact files. Enable with IMPORT_VELNEO_WRITE_BAD_ROWS=true
  private readonly writeBadRows = (process.env.IMPORT_VELNEO_WRITE_BAD_ROWS || '').toLowerCase() === 'true';

  constructor(
    private readonly userService: UserService,
    private readonly moodleUserService: MoodleUserService,
    private readonly companyService: CompanyService,
    private readonly centerService: CenterService,
    private readonly courseService: CourseService,
    private readonly groupService: GroupService,
    @Inject(DATABASE_PROVIDER) private readonly databaseService: DatabaseService,
  ) {
    try {
      if (this.writeBadRows) {
        if (!fs.existsSync(this.badRowsPath)) fs.writeFileSync(this.badRowsPath, 'row,phase,reason,raw_json\n', 'utf8');
      }
    } catch (e) {
      // ignorar
    }

  }

  private appendBadRow(line: string) {
    if (!this.writeBadRows) return;
    try {
      fs.appendFileSync(this.badRowsPath, line, 'utf8');
    } catch (_) {
      // ignore write errors
    }
  }

  async processCSVAsync(file: Express.Multer.File, phase: Phase = 'users', limitRows?: number) {
    const rows = await this.parseCsvToArray(file.buffer);
    const total = rows.length;
    this.logger.log(`CSV parseado: ${total} filas. Ejecutando fase: ${phase}`);
  // limitRows es opcional; cuando se proporciona procesamos solo ese número de filas

    // cachés
    const normalizeIdKey = (s?: string) => (s ? String(s).replace(/[^A-Za-z0-9]/g, '').toUpperCase() : '');
    const normalizeEmail = (s?: string) => (s ? String(s).trim().toLowerCase() : '');
    const normalizeString = (s?: string) => {
      if (!s) return '';
      try {
  // eliminar diacríticos, colapsar espacios, pasar a minúsculas
        return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
      } catch (e) {
        return String(s).replace(/\s+/g, ' ').trim().toLowerCase();
      }
    };
    const extractSurnamesFromRow = (row: any) => {
      const rawFirst = (row.first_surname || row.FIRST_SURNAME || row.firstSurname || row.FirstSurname || '').toString().trim();
      const rawSecond = (row.second_surname || row.SECOND_SURNAME || row.secondSurname || row.SecondSurname || '').toString().trim();
      const rawApellidos = (row.apellidos || row.APELLIDOS || row.Apellidos || '').toString().trim();
      if (rawFirst || rawSecond) return { first_surname: rawFirst, second_surname: rawSecond };
      if (rawApellidos) {
        const parts = rawApellidos.split(/\s+/).filter(Boolean);
        if (parts.length === 1) return { first_surname: parts[0], second_surname: '' };
        return { first_surname: parts[0], second_surname: parts.slice(1).join(' ') };
      }
      return { first_surname: '', second_surname: '' };
    };

  // Mapear varias representaciones de modalidad a los valores del enum en la BD (definidos en el esquema drizzle)
    const mapCourseModality = (v?: string) => {
      if (!v) return 'Online';
      const s = String(v).trim().toLowerCase();
      if (s === 'online' || s === 'on-line' || s === 'e-learning' || s === 'e learning') return 'Online';
      if (s === 'presencial' || s === 'presencial/semipresencial' || s === 'presencial ') return 'Presencial';
      if (s === 'mixta' || s === 'mixto' || s === 'mixto/online') return 'Mixta';
  // fallback: intentar detectar palabras clave
      if (s.includes('online') || s.includes('e-learning') || s.includes('elearning')) return 'Online';
      if (s.includes('presencial')) return 'Presencial';
      if (s.includes('mixt')) return 'Mixta';
      return 'Online';
    };

  // Parsear muchos formatos comunes de fecha a un objeto JS Date o devolver undefined
    const parseFlexibleDate = (v?: any): Date | undefined => {
      if (v === undefined || v === null) return undefined;
      const s = String(v).trim();
      if (!s) return undefined;
  // Si es un número puro, intentar interpretarlo como segundos o milisegundos
      if (/^-?\d+$/.test(s)) {
        try {
          const n = Number(s);
          // si parece segundos (10 dígitos) tratar como segundos
          if (Math.abs(n) > 1e10) return new Date(n); // ms
          if (Math.abs(n) > 1e9) return new Date(n * 1000); // seconds -> ms
          // números pequeños poco probables (no interpretar como timestamp)
        } catch (e) {}
      }
  // Intentar formato ISO / Date.parse
      const iso = Date.parse(s);
      if (!isNaN(iso)) return new Date(iso);
  // Intentar dd/mm/yyyy o dd-mm-yyyy
      const dmy = /^([0-3]?\d)[\/\-]([0-1]?\d)[\/\-](\d{4})$/.exec(s);
      if (dmy) {
        const day = Number(dmy[1]); const month = Number(dmy[2]) - 1; const year = Number(dmy[3]);
        const dt = new Date(year, month, day);
        if (!isNaN(dt.getTime())) return dt;
      }
  // Intentar yyyy/mm/dd o yyyy-mm-dd
      const ymd = /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/.exec(s);
      if (ymd) {
        const year = Number(ymd[1]); const month = Number(ymd[2]) - 1; const day = Number(ymd[3]);
        const dt = new Date(year, month, day);
        if (!isNaN(dt.getTime())) return dt;
      }
  // Si nada funciona: devolver undefined
      return undefined;
    };

  // Valor máximo aceptable para una columna integer de Postgres (32-bit signed)
    const PG_INT_MAX = 2147483647;

  // Parsear porcentaje de finalización a un número entre 0 y 100 con 2 decimales
    const parseCompletion = (v: any): number | undefined => {
      if (v === undefined || v === null) return undefined;
      const s = String(v).trim();
      if (!s) return undefined;
      const n = Number(s.replace(',', '.'));
      if (isNaN(n)) return undefined;
      let out = Math.round(n * 100) / 100;
      if (out < 0) out = 0;
      if (out > 100) out = 100;
      return out;
    };

  // Parsear cadenas de tiempo a segundos (entero). Acepta números, "HH:MM:SS", "HHh MMm SSs" o segundos en bruto.
  // También maneja valores que parecen milisegundos o números muy grandes intentando convertir ms->s
  // y recortando al PG_INT_MAX para evitar desbordes en la BD.
    const parseTimeToSeconds = (v?: any): number | undefined => {
      if (v === undefined || v === null) return undefined;
      const s = String(v).trim();
      if (!s) return undefined;
      // pure integer-like number (could be seconds or milliseconds)
      if (/^-?\d+$/.test(s)) {
        let n = Math.max(0, Number(s));
        // If it's larger than PG_INT_MAX, try interpreting as milliseconds
        if (n > PG_INT_MAX) {
          const asSeconds = Math.floor(n / 1000);
          if (asSeconds <= PG_INT_MAX) {
            n = asSeconds;
          } else {
            n = PG_INT_MAX;
          }
        }
        return n;
      }
      // hh:mm:ss or mm:ss
      const colon = /^([0-9]{1,2}):([0-9]{1,2})(?::([0-9]{1,2}))?$/.exec(s);
      if (colon) {
        let hours = 0, minutes = 0, seconds = 0;
        if (colon[3] !== undefined) { hours = Number(colon[1]); minutes = Number(colon[2]); seconds = Number(colon[3]); }
        else { minutes = Number(colon[1]); seconds = Number(colon[2]); }
        let total = Math.max(0, (hours * 3600) + (minutes * 60) + seconds);
          if (total > PG_INT_MAX) {
          total = PG_INT_MAX;
        }
        return total;
      }
      // format like "00h 12m 34s"
      const match = /(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:(\d+)s)?/.exec(s);
      if (match) {
        const hh = Number(match[1] || 0);
        const mm = Number(match[2] || 0);
        const ss = Number(match[3] || 0);
        let total = hh * 3600 + mm * 60 + ss;
        if (total > PG_INT_MAX) {
          total = PG_INT_MAX;
        }
        if (total > 0) return total;
      }
  // fallback: intentar parseInt
      const n = parseInt(s, 10);
      if (isNaN(n)) return undefined;
      let nn = Math.max(0, n);
      if (nn > PG_INT_MAX) {
        nn = PG_INT_MAX;
      }
      return nn;
    };

    // Limpia descripciones importadas que contienen marcas HTML o tokens como "br /" o "p /p"
    const sanitizeDescription = (v?: any): string | undefined => {
      if (v === undefined || v === null) return undefined;
      let s = String(v);
      // decode a few common HTML entities
      s = s.replace(/&nbsp;/gi, ' ').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;/g, "'");
      // Remove any real HTML tags, replace them with newlines to preserve separations
      s = s.replace(/<\/?[^>]+>/g, '\n');
      // Replace loose tokens like "br /", "br/", standalone "br" with newline
      s = s.replace(/(?:^|\s)br\s*\/?(?:\s|$)/gi, '\n');
      // Replace tokens like '/p' or standalone 'p' used as pseudo-tags with newline
      s = s.replace(/(?:^|\s)\/?p(?:\s|$)/gi, '\n');
      // Normalize whitespace per line, trim, and remove empty lines
      const lines = s.split(/\r?\n/).map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
      if (lines.length === 0) return undefined;
      return lines.join('\n');
    };

    const allUsers = await this.userService.findAll({} as any);
  const userById = new Map<any, any>();
    const userByDni = new Map<string, any>();
    const userByNss = new Map<string, any>();
    // mapa moodle_id -> moodleUser record
    const userByMoodleId = new Map<string, any>();
    // mapas para usuarios ya procesados en ESTE CSV (evitar duplicados dentro del mismo archivo)
    const seenInCsvByDni = new Map<string, any>();
    const seenInCsvByNss = new Map<string, any>();
    const seenInCsvByFullname = new Map<string, any>();
    const seenInCsvByMoodleId = new Map<string, any[]>();
    for (const u of allUsers) {
      if (u?.id_user) userById.set(String(u.id_user), u);
      if (u?.dni) userByDni.set(normalizeIdKey(u.dni), u);
      if (u?.nss) userByNss.set(normalizeIdKey(u.nss), u);
      // emails are intentionally not used for matching per requested policy
    }

    // intentar cargar referencias moodle existentes (si el servicio expone findAll)
    try {
      const allMoodleUsers = await this.moodleUserService.findAll({} as any);
      for (const mu of allMoodleUsers) {
        try {
          if (mu && mu.moodle_id && mu.id_user) {
            const u = userById.get(String(mu.id_user));
            if (u) userByMoodleId.set(String(mu.moodle_id), u);
          }
        } catch (e) {}
      }
    } catch (e) { /* ignore if not supported */ }

    const markSeen = (u: any) => {
      try {
        if (!u) return;
        if (u.dni) seenInCsvByDni.set(normalizeIdKey(u.dni), u);
        if (u.nss) seenInCsvByNss.set(normalizeIdKey(u.nss), u);
        const fname = normalizeString(((u.name || '') + ' ' + (u.first_surname || '') + ' ' + (u.second_surname || '')).trim());
        if (fname) seenInCsvByFullname.set(fname, u);
        // if we have known moodle mapping for this user, register
        try {
          const mid = (u && (u.moodle_id || u.moodleId || u.moodle_id_user)) ? String(u.moodle_id || u.moodleId || u.moodle_id_user) : null;
          if (mid) {
            const arr = seenInCsvByMoodleId.get(mid) || [];
            arr.push(u);
            seenInCsvByMoodleId.set(mid, arr);
          }
        } catch (e) {}
      } catch (e) { /* ignore */ }
    };

  const allCompanies = await this.companyService.findAll({} as any);
    const companyByCif = new Map<string, any>();
    for (const c of allCompanies) if (c?.cif) companyByCif.set(String(c.cif).replace(/\s+/g, '').toLowerCase(), c);

  const allCenters = await this.centerService.findAll({} as any);
  const centerCache = new Map<string, any>();
  // track center names seen in THIS CSV per company+employerNumber to avoid collapsing
  // multiple distinct centers that share the same employer_number in the CSV
  const seenCentersByEmployerNumber = new Map<string, Set<string>>();
  // map to quickly return a previously processed/created center for company|employerNumber|centerName
  const seenCenterByEmployerKey = new Map<string, any>();
  const norm = (s: string) => normalizeString(String(s || '').trim());
  for (const c of allCenters) if (c?.center_name && c?.id_company) centerCache.set(`${norm(c.center_name)}|${c.id_company}`, c);

    const allCourses = await this.courseService.findAll({} as any);
    const courseByMoodleId = new Map<string, any>();
    for (const co of allCourses) if (co?.moodle_id) courseByMoodleId.set(String(co.moodle_id), co);

    // mapa por nombre completo normalizado para matching exacto (sin acentos/espacios)
    const userByFullname = new Map<string, any>();
    for (const u of allUsers) {
      try {
        const full = normalizeString(((u.name || '') + ' ' + (u.first_surname || '') + ' ' + (u.second_surname || '')).trim());
        if (full) userByFullname.set(full, u);
      } catch (e) {}
    }

    const allGroups = await this.groupService.findAll({} as any);
    const groupByName = new Map<string, any>();
    const groupByMoodleId = new Map<string, any>();
    for (const g of allGroups) {
      if (g?.group_name) groupByName.set(String(g.group_name).trim().toLowerCase(), g);
      if (g?.moodle_id) groupByMoodleId.set(String(g.moodle_id), g);
    }

    const errors: any[] = [];
    const results: any[] = [];

    const normalizeDni = (raw?: string) => {
      if (!raw) return '';
      let s = String(raw).trim();
      s = s.replace(/[\.\,\-\s\u00A0\u200B]+/g, '');
      s = s.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (/^0+$/.test(s) || s === '00000000' || s === '000000000') return '';
      return s;
    };
    const pad7to8 = (s: string) => (/^[0-9]{7}[A-Z]$/i.test(s) ? '0' + s : s);
    const normalizeNss = (raw?: string) => {
      if (!raw) return '';
      let s = String(raw).trim();
      if (/e\+\d+/i.test(s)) {
        try { const n = Number(s); if (!Number.isNaN(n)) return String(Math.trunc(n)); } catch (e) {}
      }
      return s.replace(/[^0-9]/g, '');
    };
    const isValidDniNie = (s?: string) => !!(s && /^(?:\d{8}[A-Z]|[XYZ]\d{7}[A-Z])$/i.test(String(s).toUpperCase()));

  const findUserInCaches = (dni?: string, nss?: string, moodleId?: string, email?: string, name?: string, first_surname?: string, second_surname?: string) => {
      // devuelve { user, matched_by, candidate_count }
      const meta: { user: any | null; matched_by: string; candidate_count: number } = { user: null, matched_by: 'none', candidate_count: 0 };
      // 1) comprobar usuarios ya vistos/creados en ESTE CSV (orden: nss -> dni -> fullname)
      const niSeen = normalizeIdKey(nss);
      if (niSeen && seenInCsvByNss.has(niSeen)) return { user: seenInCsvByNss.get(niSeen), matched_by: 'seen_nss', candidate_count: 1 };
      const diSeen = normalizeIdKey(dni);
      if (diSeen && seenInCsvByDni.has(diSeen)) return { user: seenInCsvByDni.get(diSeen), matched_by: 'seen_dni', candidate_count: 1 };
      // then check moodle_id seen in this CSV (after nss/dni)
      const midSeen = moodleId ? String(moodleId).trim() : '';
      if (midSeen && seenInCsvByMoodleId.has(midSeen)) {
        const arr = seenInCsvByMoodleId.get(midSeen) || [];
        if (arr && arr.length) return { user: arr[0], matched_by: 'seen_moodle_id', candidate_count: 1 };
      }
      const fullNameSeen = normalizeString(((name || '') + ' ' + (first_surname || '') + ' ' + (second_surname || '')).trim());
      if (fullNameSeen && seenInCsvByFullname.has(fullNameSeen)) return { user: seenInCsvByFullname.get(fullNameSeen), matched_by: 'seen_fullname', candidate_count: 1 };

      // 2) comprobar en la base de datos/cache previa (orden: nss -> dni -> fullname)
      const ni = normalizeIdKey(nss);
      if (ni && userByNss.has(ni)) return { user: userByNss.get(ni), matched_by: 'nss', candidate_count: 1 };
      const di = normalizeIdKey(dni);
      if (di && userByDni.has(di)) return { user: userByDni.get(di), matched_by: 'dni', candidate_count: 1 };
      // after nss/dni prefer moodle_id if provided
      const mid = moodleId ? String(moodleId).trim() : '';
      if (mid && userByMoodleId.has(mid)) return { user: userByMoodleId.get(mid), matched_by: 'moodle_id', candidate_count: 1 };
      if (fullNameSeen && userByFullname.has(fullNameSeen)) return { user: userByFullname.get(fullNameSeen), matched_by: 'fullname', candidate_count: 1 };
      // 4) fallback histórico: buscar por name exacto (menos preferido)
      if (name) {
        const nm = String(name).trim().toLowerCase();
        for (const u of allUsers) {
          if (u && u.name && String(u.name).trim().toLowerCase() === nm) return { user: u, matched_by: 'name_exact', candidate_count: 1 };
        }
      }
      return meta;
    };

    const createUserFromRow = async (row: any) => {
      const name = (row.name || row.NAME || row.Nombre || row.NOMBRE || '').toString().trim();
      const { first_surname, second_surname } = extractSurnamesFromRow(row);
      const email = (row.email || row.EMAIL || '').trim() || null;
      const phone = (row.phone || row.PHONE || '').trim() || null;
      let rawDni = (row.dni || row.DNI || '').trim(); rawDni = normalizeDni(rawDni); if (rawDni) rawDni = pad7to8(rawDni);
      const dniToSave = isValidDniNie(rawDni) ? rawDni : (rawDni || null);
      const rawNss = normalizeNss(row.nss || row.NSS || ''); const nssToSave = rawNss && rawNss.length ? rawNss : null;
      const payload: any = {
        name: name || '', first_surname: first_surname || '', second_surname: second_surname || null,
        dni: dniToSave, document_type: dniToSave && /^[XYZ]/i.test(String(dniToSave)) ? 'NIE' : 'DNI',
        email: email || null, phone: phone || null, nss: nssToSave,
        registration_date: null, birth_date: null, gender: 'Other', professional_category: null,
        salary_group: 0, disability: false, terrorism_victim: false, gender_violence_victim: false,
        education_level: row.education_level || null, address: null, postal_code: null, city: null, province: null, country: null,
        observations: null, seasonalWorker: false, erteLaw: false, accreditationDiploma: 'N'
      };
        // last-resort safety: if payload is essentially empty (no name/dni/nss/email/surname), do not create
        try {
          const meaningful = (!!(payload.name && String(payload.name).trim())) || (!!payload.dni) || (!!payload.nss) || (!!(payload.email && String(payload.email).trim())) || (!!(payload.first_surname && String(payload.first_surname).trim()));
      if (!meaningful) {
        return null;
      }
        } catch (e) { /* ignore and proceed to create as a fallback */ }
      const insertResult = await this.userService.create(payload as any) as any;
      let created: any = null;
      try {
        // userService.create returns { insertId } from repository. Fetch the full user row.
        const newId = insertResult?.insertId || insertResult?.insert_id || insertResult?.id || null;
        if (newId) {
          created = await this.userService.findById(Number(newId));
        }
      } catch (e) {
        // ignore - we'll try to use insertResult if findById fails
      }
      // if we couldn't fetch full user, fall back to insertResult object (best-effort)
      if (!created) created = insertResult;

      if (created?.dni) userByDni.set(normalizeIdKey(created.dni), created);
      if (created?.nss) userByNss.set(normalizeIdKey(created.nss), created);
      // emails are not used for matching by request; do not populate email-based maps
      // agregar al mapa por fullname normalizado
      try { const full = normalizeString(((created.name || '') + ' ' + (created.first_surname || '') + ' ' + (created.second_surname || '')).trim()); if (full) userByFullname.set(full, created); } catch (e) {}
      // registrar como visto durante este CSV para evitar duplicados posteriores
      try { markSeen(created); } catch (e) {}
      return created;
    };

    const ensureMoodleUser = async (user: any, row: any) => {
      const midRaw = (row.moodle_id_user || row.moodleIdUser || row.MOODLE_ID_USER || '').toString().trim();
      if (!midRaw) return null;
      const mid = Number(midRaw);
      if (!mid || Number.isNaN(mid)) return null;

  // Elegir un candidato razonable para el nombre de usuario: preferir moodle_username explícito, si no existe generar uno
  let usernameCandidate = (row.moodle_username || row.moodleUsername || row.MOODLE_USERNAME || '').toString().trim();
      if (!usernameCandidate) usernameCandidate = `moodle_${mid}`;

  // 1) Si ya existe un moodle_user para este moodle_id, reutilizarlo (y actualizar id_user solo si falta)
      let mu = await this.moodleUserService.findByMoodleId(mid) as any;
      if (mu) {
        if (!mu.id_user || mu.id_user !== user.id_user) {
          // preserve behaviour: try to link to current user, but do not crash if update fails
          try {
            await this.moodleUserService.update(mu.id_moodle_user, { id_user: user.id_user, moodle_username: row.moodle_username || mu.moodle_username } as any);
            mu = await this.moodleUserService.findByMoodleId(mid) as any;
          } catch (e) { /* keep existing mu if update fails */ }
        }
      } else {
  // 2) No existe moodle_user para este moodle_id -> intentar crear uno, asegurando la unicidad del username
        let usernameToUse = usernameCandidate;
        let attempt = 0;
        while (true) {
          // check if username is already taken
          try {
            const existingByUsername = await this.moodleUserService.findByUsername(usernameToUse) as any;
            if (!existingByUsername) break; // free to use
            // if username exists and points to the same moodle_id (race), reuse it
            if (existingByUsername.moodle_id === mid) { mu = existingByUsername; break; }
            // otherwise username taken: make a deterministic unique variant and retry
            attempt++;
            usernameToUse = `${usernameCandidate}_${mid}_${attempt}`;
            if (attempt > 5) break;
          } catch (e) { break; }
        }

        if (!mu) {
          try {
            // attempt create with chosen username
            await this.moodleUserService.create({ id_user: user.id_user, moodle_id: mid, moodle_username: usernameToUse, moodle_password: row.moodle_password || undefined } as any);
            // fetch persisted row to get full object
            mu = await this.moodleUserService.findByMoodleId(mid) as any;
            if (!mu) mu = await this.moodleUserService.findByUsername(usernameToUse) as any;
          } catch (e) {
            // creation failed (unique constraints or other). Try best-effort fallbacks
            try { mu = await this.moodleUserService.findByMoodleId(mid) as any; } catch (_) { /* ignore */ }
            if (!mu) {
              try { mu = await this.moodleUserService.findByUsername(usernameToUse) as any; } catch (_) { /* ignore */ }
            }
          }
        }
      }

      try {
        if (mu && mu.moodle_id) {
          // update caches with the persisted object
          userByMoodleId.set(String(mu.moodle_id), user);
          const arr = seenInCsvByMoodleId.get(String(mu.moodle_id)) || [];
          arr.push(user);
          seenInCsvByMoodleId.set(String(mu.moodle_id), arr);
        }
      } catch (e) {}
      return mu;
    };

  /**
   * Flujo de resolución/creación de empresas y centros
   * --------------------------------------------------
   * Reglas principales (implementadas aquí y en findOrCreateCenter):
   * 1) Empresas
   *    - Solo se crean/buscan empresas si el CSV contiene un CIF válido.
   *    - Se intenta buscar primero por CIF usando companyService.findByCIF (si existe).
   *    - Si no existe, se intenta crear la empresa con companyService.create y
   *      luego se intenta recuperar la fila persistida (por CIF o por id devuelto)
   *      para asegurarnos de tener el id_company real que usan las tablas relacionadas.
   *    - Si la creación falla por race conditions, se re-intenta la lectura por CIF
   *      para recuperar la fila que haya creado otra ejecución concurrente.
   *
   * 2) Centros (ver findOrCreateCenter abajo)
   *    - El matching prioritario es: import_id (normalizado) === nombre CSV normalizado
   *      dentro de la misma compañía -> cache local -> name exacto -> heurísticas de contains
   *    - No se crean centros si no hay id_company válido (es decir, si no existe empresa con CIF).
   *    - Si el CSV no incluye nombre de centro pero sí CIF de empresa, se crea o reutiliza
   *      un centro con nombre "DESCONOCIDO" ligado a la compañía (comportamiento requerido).
   *    - Evitamos usar employer_number como único criterio de match porque muchos centros
   *      comparten employer_number; solo se usó en heurísticas anteriores y puede causar
   *      conflación de centros distintos. En esta versión se restringe su uso y se prioriza
   *      una igualdad explícita de import_id y el cache local dentro de la misma ejecución.
   *    - Para evitar duplicados durante la misma importación, mantenemos cachés en memoria
   *      (`centerCache`, `seenCentersByEmployerNumber`, `seenCenterByEmployerKey`, `allCenters`)
   *      y las actualizamos cuando creamos/recuperamos centros.
   *
   * Objetivo: minimizar falsos positivos en el matching (p.ej. "ALCOSA" vs "ALCOSA RGA"),
   * garantizar que tras crear una empresa o centro disponemos del objeto persistido con su id,
   * y proporcionar trazabilidad suficiente en los logs para depuración.
   */
  const findOrCreateCompany = async (row: any) => {
      const cif = (row.cif || row.CIF || '').toString().trim();
      // Do NOT create companies when CIF is missing. Return null so caller skips center creation.
      if (!cif) return null;
      const key = cif.replace(/\s+/g, '').toLowerCase();
      if (companyByCif.has(key)) return companyByCif.get(key);
  // intentar buscar por CIF primero
      try {
        const existing = await this.companyService.findByCIF ? await this.companyService.findByCIF(cif) : null;
        if (existing) { companyByCif.set(key, existing); return existing; }
      } catch (e) {}
      // attempt create
      try {
        const createdRes = await this.companyService.create({ cif, company_name: row.company_name || row.COMPANY_NAME || undefined, corporate_name: row.corporate_name || row.CORPORATE_NAME || undefined } as any) as any;
        // companyService.create might return only insert metadata; fetch full row by CIF
        try {
          const fetched = await this.companyService.findByCIF ? await this.companyService.findByCIF(cif) : null;
          if (fetched) { companyByCif.set(key, fetched); return fetched; }
        } catch (e) {}
        if (createdRes && (createdRes.id_company || createdRes.id || createdRes.insertId || createdRes.insert_id)) {
          // intentar recuperar por id si es posible
          const newId = createdRes.id_company || createdRes.id || createdRes.insertId || createdRes.insert_id;
          try { const fetchedById = await this.companyService.findOne ? await this.companyService.findOne(Number(newId)) : null; if (fetchedById) { companyByCif.set(key, fetchedById); return fetchedById; } } catch (e) {}
        }
  // fallback: devolver el objeto createdRes tal cual si no hay otra opción
        if (createdRes) { companyByCif.set(key, createdRes); return createdRes; }
      } catch (e) {
        // on create error, try to re-fetch by CIF (race condition)
        try { const existing2 = await this.companyService.findByCIF ? await this.companyService.findByCIF(cif) : null; if (existing2) { companyByCif.set(key, existing2); return existing2; } } catch (ee) {}
      }
      return null;
    };

    const findOrCreateCenter = async (company: any, row: any) => {
      // (removed verbose per-row debug log)
  const centerNameRaw = (row.center_name || row.CENTER_NAME || '').toString().trim();
  const employerNumber = (row.employer_number || row.EMPLOYER_NUMBER || '').toString().trim();
      const companyId = company?.id_company;
      const norm = (s: string) => normalizeString(String(s || '').trim());
      const centerName = norm(centerNameRaw);

  // Nota: el `id_center` del CSV solo tiene significado dentro del propio archivo CSV
  // y NO debe usarse para emparejar filas en la BD. En su lugar preferimos emparejar
  // centros de la BD por su campo `import_id` (normalizado) comparado con el
  // nombre de centro del CSV.

  // helper para actualizar la caché cuando recuperamos o creamos un centro
      const cacheAndReturn = (c: any, matchedBy?: string) => {
        try {
          const key = `${norm(c.center_name || '')}|${c.id_company}`;
          centerCache.set(key, c);
        } catch (e) {}
        try {
          const exists = allCenters.find((x: any) => x && x.id_center && c && c.id_center && String(x.id_center) === String(c.id_center));
          if (!exists) allCenters.push(c);
        } catch (e) {}
  // (removed verbose matched_by debug log)
        // record seen center name for employerNumber disambiguation within this CSV
        try {
          if (employerNumber && companyId) {
            const sk = `${companyId}|${String(employerNumber).trim()}`;
            const s = seenCentersByEmployerNumber.get(sk) || new Set<string>();
            const nn = norm(c.center_name || '');
            s.add(nn);
            seenCentersByEmployerNumber.set(sk, s);
            // also register the exact center object keyed by company|employer|centerName
            const sk2 = `${companyId}|${String(employerNumber).trim()}|${nn}`;
            try { seenCenterByEmployerKey.set(sk2, c); } catch (e) {}
          }
        } catch (e) {}
        return c;
      };

  // 0) si falta la compañía (company), intentar localizar cualquier centro por nombre normalizado
  //    en todas las empresas (primero coincidencia exacta, luego contains)
      if (!company && centerName) {
        for (const c of allCenters) {
          if (!c) continue;
          const cn = norm(c.center_name || '');
          if (!cn) continue;
          if (cn === centerName) return cacheAndReturn(c);
        }
  // intentar coincidencia por contains entre todas las empresas (nombre BD contenido en CSV o viceversa)
        for (const c of allCenters) {
          if (!c) continue;
          const cn = norm(c.center_name || '');
          if (!cn) continue;
          if (centerName.includes(cn) || cn.includes(centerName)) return cacheAndReturn(c, 'contains_across_companies');
        }
      }

  // 1) Preferir emparejar centros de la BD por su `import_id` (normalizado) usando el nombre del CSV
      if (companyId && centerName) {
        // prefer matching by a company-prefixed import_id: `${companyId}_${centerName}`
        const expectedImportId = String(companyId) + '_' + centerName;
        for (const c of allCenters) {
          if (!c) continue;
          if (String(c.id_company) !== String(companyId)) continue;
          const imp = norm(String(c.import_id || ''));
          if (imp && imp === expectedImportId) return cacheAndReturn(c, 'import_id');
        }

  // 2) coincidencia exacta/normalizada por nombre dentro de la misma compañía (prioridad)
  const key = `${centerName}|${companyId}`;
  if (centerCache.has(key)) return cacheAndReturn(centerCache.get(key), 'cache');

  // intentar coincidencia exacta en allCenters para esta compañía
        for (const c of allCenters) {
          if (!c) continue;
          if (String(c.id_company) !== String(companyId)) continue;
          const cn = norm(c.center_name || '');
          if (!cn) continue;
          if (cn === centerName) return cacheAndReturn(c, 'name_exact');
        }

  // 2b) intentar que el nombre en la BD esté contenido en el nombre del CSV
  //     (ej. BD 'GUADALQUIV' y CSV 'GUADALQUIVIR')
        for (const c of allCenters) {
          if (!c) continue;
          if (String(c.id_company) !== String(companyId)) continue;
          const cn = norm(c.center_name || '');
          if (!cn) continue;
          // aplicar una regla basada en longitud para evitar que nombres DB muy cortos
          // (p.ej. 'ALCOSA') coincidan incorrectamente con nombres CSV más largos
          const minRequired = Math.max(4, Math.round(centerName.length * 0.7));
          if (centerName.includes(cn) && cn.length >= minRequired) return cacheAndReturn(c, 'db_name_in_csv');
          // (removed verbose skip log)
        }

  // 2c) fallback: el nombre CSV contenido en el nombre DB (requiere longitud similar)
        for (const c of allCenters) {
          if (!c) continue;
          if (String(c.id_company) !== String(companyId)) continue;
          const cn = norm(c.center_name || '');
          if (!cn) continue;
          const minRequired2 = Math.max(4, Math.round(cn.length * 0.7));
          if (cn.includes(centerName) && centerName.length >= minRequired2) return cacheAndReturn(c, 'csv_name_in_db');
          // (removed verbose skip log)
        }
      }

  // 3) emparejamiento por employer_number dentro de la misma compañía (solo si es único)
  // Algunos empleadores reutilizan el mismo employer_number para varios centros; en ese caso
  // no hacer auto-match para evitar confluir centros distintos.
      if (employerNumber && companyId) {
        const matches: any[] = [];
        for (const c of allCenters) {
          if (!c) continue;
          if (String(c.id_company) !== String(companyId)) continue;
          if (String(c.employer_number || '').trim() === employerNumber) matches.push(c);
        }
        if (matches.length === 1) {
          // Si ya hemos visto otro nombre de centro en este CSV para la misma
          // company+employerNumber, evitar el auto-match al único candidato en BD
          // porque el CSV indica que varios centros distintos comparten ese employer_number.
          try {
            const sk = `${companyId}|${String(employerNumber).trim()}`;
            const seen = seenCentersByEmployerNumber.get(sk);
            if (seen && seen.size > 0 && !seen.has(centerName)) {
              this.logger.warn(`[import] skipping employer_number match because CSV already contains different center names for companyId=${companyId} employerNumber=${employerNumber} seen=${Array.from(seen).join('|')}`);
            } else {
              return cacheAndReturn(matches[0], 'employer_number_unique');
            }
          } catch (e) { return cacheAndReturn(matches[0], 'employer_number_unique'); }
        }
        if (matches.length > 1) {
          // varios centros comparten este employer_number: intentar desambiguar por nombre normalizado
          for (const c of matches) {
            try {
              const cn = norm(c.center_name || '');
              if (cn && cn === centerName) return cacheAndReturn(c);
            } catch (e) {}
          }
          // registrar candidatos ambiguos
          try { this.logger.warn(`[import][center] employer_number ambiguous candidates: ${matches.map(m=>String(m.id_center)+'|'+(m.center_name||'')).join(',')}`); } catch(e){}
          // si sigue siendo ambiguo, no hacer auto-match por employer_number para evitar conflación
          this.logger.warn(`[import] ambiguous employer_number=${employerNumber} for companyId=${companyId}; ${matches.length} candidate centers found - skipping employer_number auto-match`);
        }
      }

      // 3) existing 'DESCONOCIDO' center for this company
      if (companyId) {
        for (const c of allCenters) if (c && c.id_company === companyId && norm(c.center_name || '') === 'desconocido') return cacheAndReturn(c);
      }

      // 4) try to find any 'DESCONOCIDO' center linked to the same company by cif (as fallback)
      if (companyId) {
        for (const c of allCenters) if (c && norm(c.center_name || '') === 'desconocido' && String(c.id_company) === String(companyId)) return cacheAndReturn(c);
      }

      // 5) create new center associated to company (only if we have a valid companyId)
      if (!companyId) return null;
      // if we've already processed/created this exact center name for the same company+employerNumber
      // earlier in this CSV, reuse it to avoid duplicates
      try {
        if (employerNumber && companyId) {
          const sk2 = `${companyId}|${String(employerNumber).trim()}|${centerName}`;
          if (seenCenterByEmployerKey.has(sk2)) return seenCenterByEmployerKey.get(sk2);
          // also check centerCache for exact normalized name
          const cacheKey = `${centerName}|${companyId}`;
          if (centerCache.has(cacheKey)) {
            const c = centerCache.get(cacheKey);
            seenCenterByEmployerKey.set(sk2, c);
            return c;
          }
        }
      } catch (e) {}
      try {
  const createPayload: any = { center_name: centerNameRaw || 'DESCONOCIDO' };
        createPayload.id_company = companyId;
        if (employerNumber) createPayload.employer_number = employerNumber;
  // almacenar el identificador import_id con el prefijo de companyId: `${companyId}_${centerName}`
  // para que futuras importaciones puedan emparejarlo de manera única por compañía
  if (centerName) createPayload.import_id = String(companyId) + '_' + centerName;

        // Reserva optimista en caché para evitar que otra fila del mismo CSV cree
        // el mismo centro en paralelo. La reserva se limpia/reemplaza tras la creación
        const cacheKey = `${centerName}|${companyId}`;
        try {
          if (centerCache.has(cacheKey)) {
            const cached = centerCache.get(cacheKey);
            // Si la entrada cacheada ya tiene id_center, reutilizarla
            if (cached && cached.id_center) {
              // (removed verbose cache hit log)
              return cacheAndReturn(cached, 'cache_before_create');
            }
            // si hay placeholder reservado, intentar reconsultar BD por import_id o nombre
              if (cached && cached._reserved) {
              try {
                // demote to debug: re-querying reserved placeholder is diagnostic information
                // (removed verbose reserved placeholder log)
                // intentar recuperar por import_id
                if (centerName && this.centerService.findAll) {
                  const expectedImportId = String(companyId) + '_' + centerName;
                  const found = await this.centerService.findAll({ import_id: expectedImportId, id_company: companyId } as any);
                  if (found && found.length) {
                    const fc = Array.isArray(found) ? found[0] : found;
                    centerCache.set(cacheKey, fc);
                    return cacheAndReturn(fc, 'db_after_reserved');
                  }
                }
                // intentar recuperar por name
                if (centerNameRaw && this.centerService.findAll) {
                  const found2 = await this.centerService.findAll({ center_name: centerNameRaw, id_company: companyId } as any);
                  if (found2 && found2.length) {
                    const fc2 = Array.isArray(found2) ? found2[0] : found2;
                    centerCache.set(cacheKey, fc2);
                    return cacheAndReturn(fc2, 'db_after_reserved_name');
                  }
                }
              } catch (e) { /* ignore and proceed to create */ }
            }
          }
          // poner placeholder reservado para bloquear otras creaciones concurrentes
          const placeholder: any = { center_name: createPayload.center_name, id_company: companyId, import_id: String(companyId) + '_' + centerName, _reserved: true };
          centerCache.set(cacheKey, placeholder);
          try { allCenters.push(placeholder); } catch (e) {}
        } catch (e) { /* no-fatal, continuar a crear */ }

        let created = await this.centerService.create(createPayload as any) as any;
  // created puede ser metadatos de insert; intentar recuperar por id devuelto o por nombre+compañía
        try {
          const newId = created?.insertId || created?.insert_id || created?.id || created?.id_center || null;
          if (newId) {
            const fetched = await this.centerService.findById(Number(newId)) as any;
            if (fetched) created = fetched;
          }
        } catch (e) {}
        // if still missing id_center, try to find by name + company or by employerNumber
        if (!created?.id_center) {
          try {
            if (employerNumber) {
              const byEmp = await this.centerService.findAll ? await this.centerService.findAll({ employer_number: employerNumber, id_company: companyId } as any) : null;
              if (byEmp && byEmp.length) { created = byEmp[0]; }
            }
          } catch (e) {}
        }
        if (!created?.id_center) {
          try {
            const byName = await this.centerService.findAll ? await this.centerService.findAll({ center_name: centerNameRaw, id_company: companyId } as any) : null;
            if (byName && byName.length) { created = byName[0]; }
          } catch (e) {}
        }
        // Additional fallback: try fuzzy match in cached allCenters (contains both ways)
        if (!created || !created.id_center) {
          try {
            for (const c of allCenters) {
              if (!c) continue;
              if (String(c.id_company) !== String(companyId)) continue;
              const cn = norm(c.center_name || '');
              if (!cn) continue;
              // if DB name contained in CSV or CSV contained in DB name
              if (centerName.includes(cn) || cn.includes(centerName)) {
                created = c; break;
              }
            }
          } catch (e) {}
        }

        if (!created || !created.id_center) {
          this.logger.error(`[import] created center returned without id for companyId=${companyId} center="${centerNameRaw}" - createPayload=${JSON.stringify(createPayload)}`);
          // final fallback: log details of attempted matches to help debugging
          try {
            const tried: any[] = [];
            for (const c of allCenters) {
              if (!c) continue;
              if (String(c.id_company) !== String(companyId)) continue;
              tried.push({ id_center: c.id_center, center_name: c.center_name });
            }
            this.logger.warn(`[import] center match candidates for companyId=${companyId}: ${JSON.stringify(tried.slice(0,50))}`);
          } catch (e) {}
          // eliminar placeholder si lo dejamos al principio
          try { if (centerCache.get(`${centerName}|${companyId}`)?._reserved) centerCache.delete(`${centerName}|${companyId}`); } catch (ee) {}
          return null;
        }
  // (removed verbose created center log)
        return cacheAndReturn(created);
      } catch (e) {
        this.logger.error(`[import] create center failed for companyId=${companyId} center="${centerNameRaw}" employerNumber="${employerNumber}": ${String((e as any)?.message || e)}`);
        // if create fails, attempt to find any close match in DB
        try {
          for (const c of allCenters) {
            if (!c) continue;
            if (companyId && String(c.id_company) === String(companyId) && norm(c.center_name || '') === centerName) return cacheAndReturn(c);
          }
        } catch (ee) { this.logger.error('[import] fallback center scan failed: ' + String((ee as any)?.message || ee)); }
        // eliminar placeholder si existe (fallo en create)
        try { const ck = `${centerName}|${companyId}`; if (centerCache.get(ck)?._reserved) centerCache.delete(ck); } catch (ee) {}
        return null;
      }
    };

    const findOrCreateCourse = async (row: any) => {
      const midRaw = (row.moodle_id_course || row.moodleIdCourse || '').toString().trim();
      const courseName = (row.course_name || row.COURSE_NAME || '').toString().trim();
      const courseHours = Number(row.course_hours || row.COURSE_HOURS || 0) || 0;
      const pricePerHour = row.price_per_hour ? Number(row.price_per_hour) : undefined;
      const fundaeId = (row.fundae_course_id || row.FUNDAE_COURSE_ID || '').toString().trim() || undefined;

      const tryCacheAdd = (c: any) => {
        try { if (c && c.moodle_id) courseByMoodleId.set(String(c.moodle_id), c); } catch (e) {}
        try { if (c) allCourses.push(c); } catch (e) {}
        return c;
      };

      // 1) If we have moodle_id_course, prefer looking up by that id in cache/DB
      if (midRaw) {
        const mid = String(Number(midRaw));
        if (mid && courseByMoodleId.has(mid)) return courseByMoodleId.get(mid);
        try {
          // intentar buscar en la BD por moodle_id usando un método dedicado del servicio
          if (this.courseService.findByMoodleId) {
            const f = await this.courseService.findByMoodleId(Number(mid));
            if (f) return tryCacheAdd(f);
          } else if (this.courseService.findAll) {
            const fetched = await this.courseService.findAll({ moodle_id: Number(mid) } as any);
            if (fetched && fetched.length) return tryCacheAdd(Array.isArray(fetched) ? fetched[0] : fetched);
          }
        } catch (e) { /* ignore and fallback to name/create */ }
      }

      // 2) Try exact name match in preloaded cache
      // If the CSV provided a moodle_id for this course, DO NOT match by name: moodle_id takes precedence
      if (courseName && !midRaw) {
        const normalized = String(courseName).trim().toLowerCase();
        for (const c of allCourses) {
          if (c && String(c.course_name || '').trim().toLowerCase() === normalized) return c;
        }
        // also try DB exact match
        try {
          if (this.courseService.findAll) {
            const fetched = await this.courseService.findAll({ course_name: courseName } as any);
            if (fetched && fetched.length) return tryCacheAdd(Array.isArray(fetched) ? fetched[0] : fetched);
          }
        } catch (e) { /* ignore */ }
      }

      // 3) Not found -> create course using provided data (with logging + upsert/retry)
      try {
        const payload: any = {
          course_name: courseName || 'SIN_NOMBRE',
          short_name: row.course_short_name || courseName || undefined,
          modality: mapCourseModality(row.course_modality || row.modality || row.modalidad || undefined),
          active: true,
          hours: courseHours,
          fundae_id: fundaeId,
          price_per_hour: pricePerHour
        };
        if (midRaw) payload.moodle_id = Number(midRaw);

        // log payload we are about to insert
        try { this.logger.log(`[import] create course payload: ${JSON.stringify({ moodle_id: payload.moodle_id, course_name: payload.course_name, short_name: payload.short_name, hours: payload.hours, price_per_hour: payload.price_per_hour })}`); } catch (e) {}

  // Preferir un upsert proporcionado por el servicio si está disponible (maneja carreras); si no, crear y usar fallback
        let created: any = null;
        try {
          // Use safe upsert for generic payloads if available (avoids Moodle-specific date handling)
          if (this.courseService.upsertCourse) created = await this.courseService.upsertCourse(payload as any);
          else if (this.courseService.upsertMoodleCourse) created = await this.courseService.upsertMoodleCourse(payload as any);
          else created = await this.courseService.create(payload as any);
        } catch (e) {
          // log error + payload (detailed)
          try {
            this.logger.error(`[import] create course failed: ${String((e as any)?.message || e)} code=${(e as any)?.code || (e as any)?.errno || 'n/a'} payload=${JSON.stringify(payload)}`);
            this.logger.error('[import] full error: ' + util.inspect(e, { depth: 4 }));
          } catch (ee) {}

          // Intentar un reintento tras una breve espera (ayuda con race conditions transitorios)
          try {
            await new Promise((res) => setTimeout(res, 50));
            this.logger.log('[import] retrying create course once for moodle_id=' + String(payload.moodle_id));
            let retryCreated: any = null;
            if (this.courseService.upsertCourse) retryCreated = await this.courseService.upsertCourse(payload as any);
            else if (this.courseService.upsertMoodleCourse) retryCreated = await this.courseService.upsertMoodleCourse(payload as any);
            else retryCreated = await this.courseService.create(payload as any);
            if (retryCreated) {
              try { this.logger.log('[import] retry create succeeded for moodle_id=' + String(payload.moodle_id)); } catch (ee) {}
              created = retryCreated;
            }
          } catch (retryErr) {
            try { this.logger.error('[import] retry create failed: ' + String((retryErr as any)?.message || retryErr) + ' full:' + util.inspect(retryErr, { depth: 4 })); } catch (ee) {}
          }

          // If after retry we have a created object, continue; otherwise attempt fallback fetch
          if (!created) {
            try {
              if (midRaw && this.courseService.findByMoodleId) {
                const f = await this.courseService.findByMoodleId(Number(midRaw)); if (f) return tryCacheAdd(f);
              }
              if (courseName && this.courseService.findAll) {
                const fArr = await this.courseService.findAll({ course_name: courseName } as any); if (fArr && fArr.length) return tryCacheAdd(Array.isArray(fArr) ? fArr[0] : fArr);
              }
            } catch (ee) { try { this.logger.error('[import] fallback fetch after create error failed: ' + String((ee as any)?.message || ee)); } catch (_) {} }
            if (!created) return null;
          }
        }

        // ensure persisted object
        let persisted: any = created;
        try {
          const newId = created?.id_course || created?.id || created?.insertId || created?.insert_id || null;
          if (newId && this.courseService.findById) {
            const f = await this.courseService.findById(Number(newId)); if (f) persisted = f;
          }
        } catch (e) {}
        if ((!persisted || !persisted.id_course) && midRaw && this.courseService.findByMoodleId) {
          try { const f = await this.courseService.findByMoodleId(Number(midRaw)); if (f) persisted = f; } catch (e) {}
        }
        if ((!persisted || !persisted.id_course) && courseName && this.courseService.findAll) {
          try { const fArr = await this.courseService.findAll({ course_name: courseName } as any); if (fArr && fArr.length) persisted = Array.isArray(fArr) ? fArr[0] : fArr; } catch (e) {}
        }
        if (persisted) return tryCacheAdd(persisted);
        return tryCacheAdd(created);
      } catch (e) {
        this.logger.error('[import] create/find course failed: ' + String((e as any)?.message || e));
        return null;
      }
    };

    const findOrCreateGroup = async (row: any, course?: any) => {
      const groupName = (row.group_name || row.GROUP_NAME || '').toString().trim();
      if (!groupName) return null;
      const key = groupName.trim().toLowerCase();
      if (groupByName.has(key)) return groupByName.get(key);

      // If CSV contains moodle_id for the group, prefer exact moodle-id lookup and do NOT fallback to name matching
      const midgRaw = (row.moodle_id_group || row.moodleIdGroup || row.MOODLE_ID_GROUP || '').toString().trim();
      if (midgRaw) {
        const midg = String(Number(midgRaw));
        if (midg && groupByMoodleId.has(midg)) {
          const g = groupByMoodleId.get(midg);
          // If course provided, prefer group with same course; otherwise return found
          if (!course || !course.id_course || g.id_course === course.id_course) {
            groupByName.set(key, g);
            return g;
          } else {
            this.logger.warn(`[import] group moodle_id=${midg} found but belongs to different course id=${g.id_course} vs csv course=${course?.id_course}`);
            groupByName.set(key, g);
            return g;
          }
        }
        try {
          if (this.groupService.findAll) {
            const filter: any = { moodle_id: Number(midg) };
            if (course && course.id_course) filter.id_course = course.id_course;
            const found = await this.groupService.findAll(filter as any);
            if (found && found.length) {
              const g = Array.isArray(found) ? found[0] : found;
              groupByMoodleId.set(String(g.moodle_id), g);
              groupByName.set(key, g);
              return g;
            }
          }
        } catch (e) { /* ignore and proceed to create */ }
        // Not found by moodle_id: we will create a new group with the provided moodle_id below
      } else {
  // Intentar búsqueda exacta en BD primero (por nombre y curso si está disponible) cuando no hay moodle_id
        try {
          if (this.groupService.findAll) {
            const filter: any = { group_name: groupName };
            if (course && course.id_course) filter.id_course = course.id_course;
            const found = await this.groupService.findAll(filter as any);
            if (found && found.length) {
              const g = Array.isArray(found) ? found[0] : found;
              groupByName.set(key, g);
              return g;
            }
          }
        } catch (e) {
          // ignore and fallback to create
        }
      }

      // Not found -> try create and then fetch the persisted row reliably
      try {
  const createPayload: any = { group_name: groupName, id_course: course?.id_course };
  if (midgRaw) createPayload.moodle_id = Number(midgRaw);
  const created = await this.groupService.create(createPayload as any) as any;

  // created puede ser metadatos de insert; intentar resolver/recuperar la fila persistida
        let persisted: any = created;
        try {
          const newId = created?.id_group || created?.id || created?.insertId || created?.insert_id || null;
          if (newId && this.groupService.findById) {
            const f = await this.groupService.findById(Number(newId)); if (f) persisted = f;
          }
        } catch (e) {}

        if ((!persisted || !persisted.id_group) && this.groupService.findAll) {
          try {
            const arr = await this.groupService.findAll({ group_name: groupName, id_course: course?.id_course } as any);
            if (arr && arr.length) persisted = Array.isArray(arr) ? arr[0] : arr;
          } catch (e) {}
        }

        if (persisted) {
          try { if (persisted.moodle_id) groupByMoodleId.set(String(persisted.moodle_id), persisted); } catch (e) {}
          groupByName.set(key, persisted);
          return persisted;
        }

  // fallback: cachear lo que devuelva create
  try { if (created?.moodle_id) groupByMoodleId.set(String(created.moodle_id), created); } catch (e) {}
  groupByName.set(key, created);
  return created;
      } catch (e) {
        // Creation failed: try fuzzy match in cache
        for (const [k, g] of groupByName.entries()) if (k.includes(key) || key.includes(k)) return g;
        return null;
      }
    };

    const processUserPhase = async (row: any, idx: number) => {
      try {
        const rawDni = normalizeDni(row.dni || row.DNI || ''); const padded = pad7to8(rawDni || ''); const nss = normalizeNss(row.nss || row.NSS || '');
  const moodleIdRaw = (row.moodle_id_user || row.moodleIdUser || row.MOODLE_ID_USER || '').toString().trim();
  const lookup = findUserInCaches(padded || rawDni, nss, moodleIdRaw || undefined, row.email, row.name, row.first_surname, row.second_surname);
  let user = lookup.user;
  let matched_by = lookup.matched_by;
  let candidate_count = lookup.candidate_count || 0;
  // (debug logs removed)
  if (user) { try { markSeen(user); } catch (ee) {} }
  if (!user && padded) { try { const found = await this.userService.findByDni(padded); if (found && found.length) user = Array.isArray(found) ? found[0] : found; if (user) { try { markSeen(user); } catch (ee) {} matched_by = matched_by || 'dni_found'; candidate_count = candidate_count || 1; } } catch (e) {} }
  if (!user) {
    // don't create completely empty users: require at least one *valid* identifier or a sensible name/surname
    const rawName = (row.name || row.NAME || row.Nombre || row.NOMBRE || '').toString().trim();
    const rawEmail = (row.email || row.EMAIL || '').toString().trim();
    const { first_surname: rawFirstSurname } = extractSurnamesFromRow(row);
    // stronger heuristics: validate DNI format, require reasonable NSS length, moodle_id numeric, email contains @, or name contains letters
    const hasValidDni = !!(padded && isValidDniNie(padded));
    const hasValidNss = !!(nss && nss.length >= 6);
    const hasValidMoodleId = !!(moodleIdRaw && /^\d+$/.test(moodleIdRaw));
    const hasValidEmail = !!(rawEmail && /@/.test(rawEmail));
    const hasValidName = !!(rawName && /[A-Za-zÀ-ÿ\u00C0-\u017F]/.test(rawName));
    const hasFirstSurname = !!(rawFirstSurname && /[A-Za-zÀ-ÿ]/.test(rawFirstSurname));
    const hasIdentifier = hasValidDni || hasValidNss || hasValidMoodleId || hasValidEmail || hasValidName || hasFirstSurname;
    if (!hasIdentifier) {
      this.logger.warn(`[import] row=${idx} users: insufficient data to create user; skipping`);
      results.push({ row: idx, phase: 'users', status: 'skipped', reason: 'insufficient_user_data' });
      try { this.appendBadRow(`${idx},users,"insufficient_user_data","${JSON.stringify(row).replace(/"/g,'""')}"\n`); } catch (_) {}
      return;
    }
    user = await createUserFromRow(row); matched_by = 'created'; candidate_count = 0;
    // createUserFromRow may return null if it decides the payload is still insufficient
    if (!user) {
      results.push({ row: idx, phase: 'users', status: 'skipped', reason: 'create_failed_insufficient_payload' });
      try { this.appendBadRow(`${idx},users,"create_failed_insufficient_payload","${JSON.stringify(row).replace(/"/g,'""')}"\n`); } catch (_) {}
      return;
    }
  }
  let mu: any = null;
  try {
    if (user) try { markSeen(user); } catch (ee) {}
    mu = await ensureMoodleUser(user, row);
  } catch (e) {}
  // If education_level in CSV is present and user in DB has no education_level, fill it
  try {
    const csvEdu = (row.education_level || row.EDUCATION_LEVEL || row.educationLevel || '').toString().trim();
    if (csvEdu && user && (!user.education_level || String(user.education_level).trim() === '')) {
      try {
        await this.userService.update(user.id_user, { education_level: csvEdu } as any);
        // update local object so later processing sees the new value
        try { user.education_level = csvEdu; } catch (ee) {}
      } catch (ue) { /* non-fatal, continue */ }
    }
  } catch (e) { /* ignore */ }
  // (debug logs removed)
    results.push({ row: idx, phase: 'users', status: 'ok', id_user: user?.id_user, matched_by, candidate_count });
  } catch (e) { errors.push({ row: idx, phase: 'users', error: String(e) }); try { this.appendBadRow(`${idx},users,"create_user_failed","${JSON.stringify(row).replace(/"/g,'""')}"\n`); } catch (_) {} }
    };

    const processCompaniesCentersPhase = async (row: any, idx: number) => {
      try {
        const company = await findOrCreateCompany(row);
        const center = await findOrCreateCenter(company, row);
        if (!company) {
          errors.push({ row: idx, phase: 'companies', error: 'company_not_found' });
          try { this.appendBadRow(`${idx},companies,"company_not_found","${JSON.stringify(row).replace(/"/g,'""')}"\n`); } catch (_) {}
          return;
        }
        if (!center) {
          // still consider company ok, but record that center couldn't be resolved
          this.logger.warn(`[import] center not found/created for row ${idx} company=${company?.id_company} center_raw="${(row.center_name||row.CENTER_NAME||'').toString().trim()}"`);
          results.push({ row: idx, phase: 'companies', status: 'ok', id_company: company?.id_company, id_center: null });
          return;
        }
        results.push({ row: idx, phase: 'companies', status: 'ok', id_company: company?.id_company, id_center: center?.id_center });
      } catch (e) {
        errors.push({ row: idx, phase: 'companies', error: String(e) });
  try { this.appendBadRow(`${idx},companies,"company_center_failed","${JSON.stringify(row).replace(/"/g,'""')}"\n`); } catch (_) {}
      }
    };

    const processCoursesPhase = async (row: any, idx: number) => {
      try {
        const rawDni = normalizeDni(row.dni || row.DNI || '');
        const padded = pad7to8(rawDni || '');
        const nss = normalizeNss(row.nss || row.NSS || '');
        const moodleIdRaw = (row.moodle_id_user || row.moodleIdUser || row.MOODLE_ID_USER || '').toString().trim();
        const lookup = findUserInCaches(padded || rawDni, nss, moodleIdRaw || undefined, row.email, row.name, row.first_surname, row.second_surname);
        let user = lookup.user;
        let matched_by = lookup.matched_by;
        let candidate_count = lookup.candidate_count || 0;
        if (user) { try { markSeen(user); } catch (ee) {} }
        if (!user && padded) {
          try {
            const found = await this.userService.findByDni(padded);
            if (found && found.length) user = Array.isArray(found) ? found[0] : found;
            if (user) { try { markSeen(user); } catch (ee) {} matched_by = matched_by || 'dni_found'; candidate_count = candidate_count || 1; }
          } catch (e) {}
        }

        // IMPORTANT: Do NOT create users in the courses phase. If we don't find a user by NSS/DNI/moodle_id
        // or by exact fullname match, skip the record as requested.
        if (!user) {
          results.push({ row: idx, phase: 'courses', status: 'skipped', reason: 'user_not_found' });
          return;
        }

        const course = await findOrCreateCourse(row);
        if (!course || !course.id_course) {
          results.push({ row: idx, phase: 'courses', status: 'skipped', reason: 'course_not_found' });
          return;
        }

        // update course fields (hours, fundae_id, price_per_hour)
        try {
          await this.courseService.update(course.id_course, {
            hours: Number(row.course_hours || 0) || 0,
            fundae_id: row.fundae_course_id || undefined,
            price_per_hour: row.price_per_hour ? Number(row.price_per_hour) : undefined
          } as any);
        } catch (e) { /* non-fatal */ }

        // ensure moodle user exists/linked
        try {
          const mu = await ensureMoodleUser(user, row);
          const ucPayload: any = { id_user: user?.id_user, id_course: course.id_course };
          if (mu && mu.id_moodle_user) ucPayload.id_moodle_user = mu.id_moodle_user;
          // coerce completion percentage to numeric (decimal) and time_spent to integer seconds
          // use shared parseCompletion helper defined above
          const completionPct = parseCompletion(row.completion_percentage ?? row.COMPLETION_PERCENTAGE ?? row.completion_percentage_raw);
          const timeSeconds = parseTimeToSeconds(row.time_spent_seconds ?? row.time_spent ?? row.TIME_SPENT ?? row.time_spent_raw);
          if (completionPct !== undefined) ucPayload.completion_percentage = completionPct;
          if (timeSeconds !== undefined) ucPayload.time_spent = timeSeconds;

          // Intentar añadir usuario al curso; si hay conflicto (unique) intentar la ruta de actualización
          try {
            await this.courseService.addUserToCourse(ucPayload as any);
          } catch (e) {
            try {
              // best-effort update if add failed (unique constraint)
              await this.courseService.updateUserInCourse(course.id_course, user?.id_user, { completion_percentage: ucPayload.completion_percentage, time_spent: ucPayload.time_spent } as any);
            } catch (_) { /* ignore */ }
          }
        } catch (e) { /* non-fatal */ }

        results.push({ row: idx, phase: 'courses', status: 'ok', id_course: course?.id_course, id_user: user?.id_user, matched_by, candidate_count });
      } catch (e) {
        errors.push({ row: idx, phase: 'courses', error: String(e) });
  try { this.appendBadRow(`${idx},courses,"course_failed","${JSON.stringify(row).replace(/"/g,'""')}"\n`); } catch (_) {}
      }
    };

    const processAssociatePhase = async (row: any, idx: number) => {
      try {
        const rawDni = normalizeDni(row.dni || row.DNI || '');
        const padded = pad7to8(rawDni || '');
        const nss = normalizeNss(row.nss || row.NSS || '');
        const lookup = findUserInCaches(padded || rawDni, nss, undefined, row.email, row.name, row.first_surname, row.second_surname);
        const user = lookup.user;
        if (!user || !user.id_user) {
          // user not found: skip
          results.push({ row: idx, phase: 'associate', status: 'skipped', reason: 'user_not_found' });
          return;
        }

        const centerNameRaw = (row.center_name || row.CENTER_NAME || '').toString().trim();
        if (!centerNameRaw) {
          results.push({ row: idx, phase: 'associate', status: 'skipped', reason: 'center_name_missing' });
          return;
        }
        const centerName = normalizeString(centerNameRaw);

        // find center by import_id. Prefer company-prefixed import_id `${companyId}_${centerName}`
        let center: any = null;
        try {
          const cifRaw = (row.cif || row.CIF || '').toString().trim();
          let companyForRow: any = null;
          if (cifRaw) companyForRow = companyByCif.get(String(cifRaw).replace(/\s+/g, '').toLowerCase());
          if (companyForRow && companyForRow.id_company) {
            const expectedImportId = String(companyForRow.id_company) + '_' + centerName;
            for (const c of allCenters) {
              if (!c || !c.import_id) continue;
              if (norm(String(c.import_id || '')) === expectedImportId) { center = c; break; }
            }
          }
          // fallback: older imports may have stored raw centerName in import_id - try matching that as well
          if (!center) {
            for (const c of allCenters) {
              if (!c || !c.import_id) continue;
              if (normalizeString(String(c.import_id)) === centerName) { center = c; break; }
            }
          }
        } catch (e) {}

        if (!center || !center.id_center) {
          results.push({ row: idx, phase: 'associate', status: 'skipped', reason: 'center_not_found' });
          return;
        }

        const userId = Number(user.id_user);
        const centerId = Number(center.id_center);

        const csvStart = parseFlexibleDate(row.user_center_start_date || row.userCenterStartDate || row.USER_CENTER_START_DATE || row.start_date || row.START_DATE);
        const csvEnd = parseFlexibleDate(row.user_center_end_date || row.userCenterEndDate || row.USER_CENTER_END_DATE || row.end_date || row.END_DATE);

        // perform DB upsert/update within a transaction
        await this.databaseService.db.transaction(async (tx) => {
          // fetch existing association if any
          const existing = await tx.select().from(userCenterTable).where(and(eq(userCenterTable.id_user, userId), eq(userCenterTable.id_center, centerId)));
          const others = await tx.select().from(userCenterTable).where(eq(userCenterTable.id_user, userId));

          // compute is_main: true if csvStart is defined and is strictly greater than all other start_date values
          let isMain = false;
          if (csvStart) {
            let isGreater = true;
            for (const o of others) {
              if (!o) continue;
              // skip current association if present
              if (String(o.id_center) === String(centerId)) continue;
              if (o.start_date) {
                try {
                  const os = new Date(o.start_date);
                  if (!(csvStart.getTime() > os.getTime())) { isGreater = false; break; }
                } catch (e) { /* ignore parse errors */ }
              }
            }
            isMain = isGreater;
          }

          if (existing && existing.length) {
            const ex = existing[0];
            const updatePayload: any = {};
            try {
              if (csvStart) {
                if (!ex.start_date) updatePayload.start_date = csvStart;
                else {
                  const es = new Date(ex.start_date);
                  if (es.getTime() < csvStart.getTime()) updatePayload.start_date = csvStart;
                }
              }
            } catch (e) {}
            try {
              if (csvEnd) {
                if (!ex.end_date) updatePayload.end_date = csvEnd;
                else {
                  const ee = new Date(ex.end_date);
                  if (ee.getTime() < csvEnd.getTime()) updatePayload.end_date = csvEnd;
                }
              }
            } catch (e) {}

            // update is_main_center if necessary
            if (isMain) {
              updatePayload.is_main_center = true;
              // set others to false (best-effort)
              try { await tx.update(userCenterTable).set({ is_main_center: false }).where(eq(userCenterTable.id_user, userId)); } catch (e) { /* best-effort */ }
            }

            if (Object.keys(updatePayload).length > 0) {
              try {
                  await tx.update(userCenterTable).set(updatePayload).where(and(eq(userCenterTable.id_user, userId), eq(userCenterTable.id_center, centerId)));
                } catch (e) { /* non-fatal */ }
            }
            results.push({ row: idx, phase: 'associate', status: 'updated', id_user: userId, id_center: centerId });
            return;
          }

          // not existing -> insert
            try {
            await tx.insert(userCenterTable).values({ id_user: userId, id_center: centerId, start_date: csvStart || null, end_date: csvEnd || null, is_main_center: isMain });
            if (isMain) {
              // set others is_main_center false (best-effort) but avoid clearing the newly inserted row
              try {
                for (const o of others) {
                  if (!o) continue;
                  if (String(o.id_center) === String(centerId)) continue;
                  try { await tx.update(userCenterTable).set({ is_main_center: false }).where(and(eq(userCenterTable.id_user, userId), eq(userCenterTable.id_center, Number(o.id_center)))); } catch (e) { /* best-effort per-row */ }
                }
              } catch (e) {}
            }
            results.push({ row: idx, phase: 'associate', status: 'created', id_user: userId, id_center: centerId });
            return;
          } catch (e) {
            // try fallback: if insert failed try to update existing row if any
            try {
              const exist2 = await tx.select().from(userCenterTable).where(and(eq(userCenterTable.id_user, userId), eq(userCenterTable.id_center, centerId)));
              if (exist2 && exist2.length) {
                // best-effort update
                await tx.update(userCenterTable).set({ start_date: csvStart || undefined, end_date: csvEnd || undefined }).where(and(eq(userCenterTable.id_user, userId), eq(userCenterTable.id_center, centerId)));
                results.push({ row: idx, phase: 'associate', status: 'updated', id_user: userId, id_center: centerId });
                return;
              }
            } catch (ee) {}
            results.push({ row: idx, phase: 'associate', status: 'error', error: String((e as any)?.message || e) });
            return;
          }
        });

      } catch (e) {
        errors.push({ row: idx, phase: 'associate', error: String(e) });
      }
    };

    const processGroupsPhase = async (row: any, idx: number) => {
      try {
  const rawDni = normalizeDni(row.dni || row.DNI || ''); const padded = pad7to8(rawDni || ''); const nss = normalizeNss(row.nss || row.NSS || '');
  const moodleIdRaw = (row.moodle_id_user || row.moodleIdUser || row.MOODLE_ID_USER || '').toString().trim();
  const lookup = findUserInCaches(padded || rawDni, nss, moodleIdRaw || undefined, row.email, row.name, row.first_surname, row.second_surname);
  let user = lookup.user;
  let matched_by = lookup.matched_by;
  let candidate_count = lookup.candidate_count || 0;
  if (user) { try { markSeen(user); } catch (ee) {} }
  if (!user && padded) { try { const found = await this.userService.findByDni(padded); if (found && found.length) user = Array.isArray(found) ? found[0] : found; if (user) { try { markSeen(user); } catch (ee) {} matched_by = matched_by || 'dni_found'; candidate_count = candidate_count || 1; } } catch (e) {} }
  if (!user) {
    results.push({ row: idx, phase: 'groups', status: 'skipped', reason: 'user_not_found' });
    return;
  }

        let company = null; let center = null;
        if (row.cif) {
          company = companyByCif.get(String(row.cif).replace(/\s+/g, '').toLowerCase());
          if (company) center = await findOrCreateCenter(company, row);
        }
        const course = await findOrCreateCourse(row);
        const group = await findOrCreateGroup(row, course);
        const rawGroupName = (row.group_name || row.GROUP_NAME || '').toString().trim();
        if (!group) {
          results.push({ row: idx, phase: 'groups', status: 'skipped', reason: 'group_not_found' });
          return;
        }

  // (removed verbose group resolved log)

        try {
          const rawStart = row.group_start_date || row.groupStartDate || row.GROUP_START_DATE || undefined;
          const rawEnd = row.group_end_date || row.groupEndDate || row.GROUP_END_DATE || undefined;
          const parsedStart = parseFlexibleDate(rawStart);
          const parsedEnd = parseFlexibleDate(rawEnd);
          // fechas no parseadas: (antes se registraban como debug), ahora no hacemos logging
          // (removed verbose group updating log)
          const groupUpdatePayload: any = {};
          if (row.group_description !== undefined && row.group_description !== null && String(row.group_description).trim() !== '') {
            const cleanedDesc = sanitizeDescription(row.group_description);
            if (cleanedDesc) groupUpdatePayload.description = cleanedDesc;
          }
          if (parsedStart !== undefined && parsedStart !== null) groupUpdatePayload.start_date = parsedStart;
          if (parsedEnd !== undefined && parsedEnd !== null) groupUpdatePayload.end_date = parsedEnd;
          if (row.fundae_group_id !== undefined && row.fundae_group_id !== null && String(row.fundae_group_id).trim() !== '') groupUpdatePayload.fundae_id = String(row.fundae_group_id).trim();
          if (Object.keys(groupUpdatePayload).length > 0) {
            await this.groupService.update(group.id_group, groupUpdatePayload as any);
            // (removed verbose group update succeeded log)
          } else {
            // (removed verbose group update skipped log)
          }
        } catch (e) {
          this.logger.error(`[import] row=${idx} groups: group update failed: ${String((e as any)?.message || e)}`);
        }

        try {
          // (removed verbose add user to group log)
          await this.groupService.addUserToGroup({ id_group: group.id_group, id_user: user?.id_user, id_center: center?.id_center } as any);
          // (removed verbose addUserToGroup succeeded log)

          // Update user_group with completion percentage and time spent when provided
          try {
            const ugUpdate: any = {};
            // use shared parseCompletion helper defined above
            const completionPct = parseCompletion(row.completion_percentage ?? row.COMPLETION_PERCENTAGE ?? row.completion_percentage_raw);
            const timeSeconds = parseTimeToSeconds(row.time_spent_seconds ?? row.time_spent ?? row.TIME_SPENT ?? row.time_spent_raw);
            if (completionPct !== undefined) ugUpdate.completion_percentage = completionPct;
            if (timeSeconds !== undefined) ugUpdate.time_spent = timeSeconds;
              if (Object.keys(ugUpdate).length > 0) {
              await this.groupService.updateUserInGroup(group.id_group, user?.id_user, ugUpdate as any);
            }
          } catch (ue) { this.logger.error(`[import] row=${idx} groups: user_group update failed: ${String((ue as any)?.message || ue)}`); }

          // Also keep user_course in sync if a course is present
          if (course) {
            try {
              const ucUpdate: any = {};
              // use shared parseCompletion helper defined above
              const completionPct2 = parseCompletion(row.completion_percentage ?? row.COMPLETION_PERCENTAGE ?? row.completion_percentage_raw);
              const timeSeconds2 = parseTimeToSeconds(row.time_spent_seconds ?? row.time_spent ?? row.TIME_SPENT ?? row.time_spent_raw);
              if (completionPct2 !== undefined) ucUpdate.completion_percentage = completionPct2;
              if (timeSeconds2 !== undefined) ucUpdate.time_spent = timeSeconds2;
                if (Object.keys(ucUpdate).length > 0) {
                await this.courseService.updateUserInCourse(course.id_course, user?.id_user, ucUpdate as any);
              }
            } catch (uce) { this.logger.error(`[import] row=${idx} groups: user_course update failed: ${String((uce as any)?.message || uce)}`); }
          }
        } catch (e) {
          this.logger.error(`[import] row=${idx} groups: addUserToGroup failed: ${String((e as any)?.message || e)}`);
        }

  results.push({ row: idx, phase: 'groups', status: 'ok', id_group: group.id_group, id_user: user?.id_user, matched_by, candidate_count });
  } catch (e) { errors.push({ row: idx, phase: 'groups', error: String(e) }); try { this.appendBadRow(`${idx},groups,"group_failed","${JSON.stringify(row).replace(/"/g,'""')}"\n`); } catch (_) {} }
    };

    // After associate phase: ensure every user has at least one main center.
    // Strategy: scan user_center rows; for any user missing is_main_center=true pick the
    // association with the most recent start_date (if any) or the first association otherwise,
    // then set that row as is_main_center and clear others (within a transaction per-user).
    const ensureAllUsersHaveMainCenter = async (): Promise<number> => {
      try {
        const allUcs = await this.databaseService.db.select().from(userCenterTable);
        const byUser = new Map<string, any[]>();
        for (const u of allUcs) {
          try {
            const k = String(u.id_user);
            const arr = byUser.get(k) || [];
            arr.push(u);
            byUser.set(k, arr);
          } catch (e) { /* ignore per-row */ }
        }

        let fixedCount = 0;
        for (const [uid, arr] of byUser.entries()) {
          try {
            if (!arr || !arr.length) continue;
            const hasMain = arr.some(x => !!x.is_main_center);
            if (hasMain) continue;

            // pick candidate: prefer entries with start_date and choose the latest start_date
            let candidate: any = null;
            const withStart = arr.filter(a => a && a.start_date);
            if (withStart.length) {
              candidate = withStart.reduce((best, cur) => {
                try {
                  const btime = best && best.start_date ? new Date(best.start_date).getTime() : 0;
                  const ctime = cur && cur.start_date ? new Date(cur.start_date).getTime() : 0;
                  return ctime > btime ? cur : best;
                } catch (e) { return best; }
              }, withStart[0]);
            } else {
              candidate = arr[0];
            }
            if (!candidate) continue;

            const userId = Number(uid);
            const centerId = Number(candidate.id_center);
            // transaction per-user to avoid partial states
            try {
              await this.databaseService.db.transaction(async (tx) => {
                // clear existing flags
                try { await tx.update(userCenterTable).set({ is_main_center: false }).where(eq(userCenterTable.id_user, userId)); } catch (e) { /* best-effort */ }
                // set chosen row
                try { await tx.update(userCenterTable).set({ is_main_center: true }).where(and(eq(userCenterTable.id_user, userId), eq(userCenterTable.id_center, centerId))); } catch (e) { /* best-effort */ }
              });
              fixedCount++;
            } catch (e) {
              this.logger.error(`[import] ensure main center failed for user ${userId}: ${String((e as any)?.message || e)}`);
            }
          } catch (e) { /* skip user on error */ }
        }
        return fixedCount;
      } catch (e) {
        this.logger.error('[import] ensureAllUsersHaveMainCenter failed: ' + String((e as any)?.message || e));
        return 0;
      }
    };

    let i = 0;
    for (const r of rows) {
      i++;
      if (limitRows && i > limitRows) break;
      if (i % 1000 === 0) this.logger.log(`Procesadas ${i} filas. Errores hasta ahora: ${errors.length}`);
      try {
    if (phase === 'users') await processUserPhase(r, i);
    if (phase === 'companies') await processCompaniesCentersPhase(r, i);
    if (phase === 'courses') await processCoursesPhase(r, i);
    if (phase === 'associate') await processAssociatePhase(r, i);
    if (phase === 'groups') await processGroupsPhase(r, i);
      } catch (e) { errors.push({ row: i, error: String(e) }); }
    }

    // Post-phase: if we just ran 'associate', ensure every user has at least one main_center
    if (phase === 'associate') {
      try {
        const fixed = await ensureAllUsersHaveMainCenter();
        try { if (fixed && fixed > 0) this.logger.log(`[import] associate: ensured main_center for ${fixed} users missing it`); } catch (_) {}
      } catch (e) {
        this.logger.error('[import] post-associate ensure main center failed: ' + String((e as any)?.message || e));
      }
    }

    this.logger.log(`Import finalizado. Filas: ${i}. Errores: ${errors.length}. OK: ${results.length}`);
    return { success: errors.length === 0, results, errors };
  }

  private async parseCsvToArray(buffer: Buffer): Promise<any[]> {
    const decoded = iconv.decode(buffer, 'latin1');
    const firstLine = decoded.split(/\r?\n/)[0] || '';
    const sep = firstLine.includes(';') && !firstLine.includes(',') ? ';' : ',';
    const rows: any[] = [];
    return await new Promise((resolve) => {
      const stream = Readable.from([decoded]).pipe(csvParser({ separator: sep, skipLines: 0 }));
      stream.on('data', (data: any) => rows.push(data));
      stream.on('end', () => resolve(rows));
      stream.on('error', (err: any) => { this.logger.error('CSV parser error: ' + (err?.message ?? String(err))); resolve(rows); });
    });
  }
}
