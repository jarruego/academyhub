import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { DATABASE_PROVIDER } from "src/database/database.module";
import { DatabaseService } from "src/database/database.service";
import { users, user_center } from "src/database/schema";
import { and, eq } from "drizzle-orm";
import {
  AutoFixableField,
  detectUserIssues,
  normalizeValidValue,
  SanitizableField,
  suggestFix,
  UserIssue,
} from "./user-sanitization.util";

export interface UserWithIssues {
  id_user: number;
  name: string;
  first_surname: string | null;
  second_surname: string | null;
  /** true si está dado de baja en su centro principal (main center con end_date). */
  baja: boolean;
  issues: UserIssue[];
}

@Injectable()
export class UserSanitizationService {
  constructor(
    @Inject(DATABASE_PROVIDER) private readonly databaseService: DatabaseService,
  ) {}

  private get db() {
    return this.databaseService.db;
  }

  /** Usuarios con al menos un campo presente-pero-inválido. */
  async getIssues(): Promise<UserWithIssues[]> {
    const rows = await this.db
      .select({
        id_user: users.id_user,
        name: users.name,
        first_surname: users.first_surname,
        second_surname: users.second_surname,
        email: users.email,
        phone: users.phone,
        dni: users.dni,
        nss: users.nss,
        // Baja = el centro principal tiene fecha de baja (end_date no nulo).
        main_center_end_date: user_center.end_date,
      })
      .from(users)
      .leftJoin(
        user_center,
        and(eq(user_center.id_user, users.id_user), eq(user_center.is_main_center, true)),
      );

    const result: UserWithIssues[] = [];
    for (const row of rows) {
      const issues = detectUserIssues(row);
      if (issues.length > 0) {
        result.push({
          id_user: row.id_user,
          name: row.name,
          first_surname: row.first_surname,
          second_surname: row.second_surname,
          baja: row.main_center_end_date != null,
          issues,
        });
      }
    }
    return result;
  }

  /**
   * Corrige un campo auto-corregible de un usuario. El valor saneado se calcula
   * SIEMPRE en el servidor (no se confía en el cliente) y se vuelve a validar
   * antes de guardar. Devuelve el nuevo valor.
   */
  async fix(id: number, field: AutoFixableField): Promise<{ id_user: number; field: AutoFixableField; value: string }> {
    const [user] = await this.db
      .select({ id_user: users.id_user, email: users.email, phone: users.phone, nss: users.nss })
      .from(users)
      .where(eq(users.id_user, id));

    if (!user) throw new NotFoundException("Usuario no encontrado");

    const current = (user as Record<AutoFixableField, string | null>)[field];
    const suggestion = current ? suggestFix(field, current) : null;
    if (!suggestion) {
      throw new BadRequestException("Este valor no se puede corregir automáticamente; edita la ficha manualmente.");
    }

    try {
      await this.db.update(users).set({ [field]: suggestion }).where(eq(users.id_user, id));
    } catch (e: any) {
      // 23505 = unique_violation (dni/nss son únicos): el valor saneado choca con otro usuario.
      if (e?.code === "23505" || e?.cause?.code === "23505") {
        throw new BadRequestException(
          `El valor corregido (${suggestion}) ya pertenece a otro usuario. Resuélvelo manualmente (posible duplicado).`,
        );
      }
      throw e;
    }

    return { id_user: id, field, value: suggestion };
  }

  /**
   * Corrige a mano cualquier campo (incluido `dni`) con un valor introducido por
   * el usuario. El valor se valida/normaliza en el servidor: no se guarda nada
   * que no supere la validación del campo (si no, el error reaparecería).
   */
  async manualFix(
    id: number,
    field: SanitizableField,
    rawValue: string,
  ): Promise<{ id_user: number; field: SanitizableField; value: string }> {
    const value = normalizeValidValue(field, rawValue);
    if (!value) {
      throw new BadRequestException("El valor introducido no es válido para este campo.");
    }

    const [user] = await this.db
      .select({ id_user: users.id_user })
      .from(users)
      .where(eq(users.id_user, id));
    if (!user) throw new NotFoundException("Usuario no encontrado");

    try {
      await this.db.update(users).set({ [field]: value }).where(eq(users.id_user, id));
    } catch (e: any) {
      if (e?.code === "23505" || e?.cause?.code === "23505") {
        throw new BadRequestException(
          `El valor (${value}) ya pertenece a otro usuario. Resuélvelo manualmente (posible duplicado).`,
        );
      }
      throw e;
    }

    return { id_user: id, field, value };
  }

  /**
   * Corrige en bloque TODOS los valores auto-corregibles de un campo. Cada valor
   * se recalcula en el servidor. Las colisiones de unicidad (dni/nss) no abortan
   * el proceso: se saltan y se devuelven en `failed` para resolverlas a mano.
   */
  async fixAll(field: AutoFixableField): Promise<{
    fixed: number;
    failed: { id_user: number; value: string; suggestion: string }[];
  }> {
    const rows = await this.db
      .select({ id_user: users.id_user, email: users.email, phone: users.phone, nss: users.nss })
      .from(users);

    let fixed = 0;
    const failed: { id_user: number; value: string; suggestion: string }[] = [];

    for (const row of rows) {
      const current = (row as Record<AutoFixableField, string | null>)[field];
      const suggestion = current ? suggestFix(field, current) : null;
      if (!suggestion) continue;

      try {
        await this.db.update(users).set({ [field]: suggestion }).where(eq(users.id_user, row.id_user));
        fixed++;
      } catch (e: any) {
        if (e?.code === "23505" || e?.cause?.code === "23505") {
          failed.push({ id_user: row.id_user, value: current as string, suggestion });
        } else {
          throw e;
        }
      }
    }

    return { fixed, failed };
  }
}
