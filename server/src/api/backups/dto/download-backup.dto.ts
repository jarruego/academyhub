import { IsString, Matches } from 'class-validator';

export class DownloadBackupDTO {
  /** Key completa dentro del bucket, p. ej. db/db-2026-07-15.dump.gpg */
  @IsString()
  @Matches(/^db\/[A-Za-z0-9._-]+\.dump\.gpg$/)
  key: string;
}
