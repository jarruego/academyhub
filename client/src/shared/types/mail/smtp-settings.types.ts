export interface SmtpSettingsForm {
  host: string;
  port: number;
  user: string;
  password: string;
  secure: boolean;
  from_email: string;
  from_name?: string;
}
