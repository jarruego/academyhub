import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import axios from 'axios';

export interface MailrelaySmsCredentials {
  accountUrl: string; // subdominio de la cuenta, sin protocolo (ej. "mecohisa1.ipzmarketing.com")
  apiKey: string;
}

export interface MailrelaySendSmsResult {
  id: number;
  subscriber_id?: number;
  phone: string;
  created_at?: string;
}

export type MailrelaySmsStatus = 'not_processed' | 'processed' | 'ignored' | 'delivered' | 'failed' | 'expired';

export interface MailrelaySentMessage {
  id: number;
  subscriber_id?: number;
  phone?: string;
  country?: string;
  status: MailrelaySmsStatus;
  created_at?: string;
  processed_at?: string;
  delivered_at?: string;
  used_credits?: number;
  parts_count?: number;
}

/**
 * Cliente fino sobre la API transaccional de SMS de Mailrelay
 * (https://apidocs.mailrelay.com/). Base URL: https://{account}/api/v1,
 * autenticación con header X-AUTH-TOKEN. Sin SDK oficial en npm, se llama
 * directo con axios (mismo patrón que MoodleService para sus WS).
 */
@Injectable()
export class MailrelaySmsClient {
  private readonly logger = new Logger(MailrelaySmsClient.name);

  private baseUrl(accountUrl: string): string {
    const host = accountUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    return `https://${host}/api/v1`;
  }

  private headers(apiKey: string) {
    return { 'X-AUTH-TOKEN': apiKey };
  }

  /** POST /sms/send — envía a uno o más destinatarios (aquí siempre se llama con un único número). */
  async sendSms(
    creds: MailrelaySmsCredentials,
    payload: { to: string[]; sender_name: string; message: string },
  ): Promise<MailrelaySendSmsResult[]> {
    try {
      const response = await axios.post<MailrelaySendSmsResult[]>(
        `${this.baseUrl(creds.accountUrl)}/sms/send`,
        payload,
        { headers: this.headers(creds.apiKey) },
      );
      return response.data;
    } catch (err) {
      throw this.wrapError(err, 'Error enviando SMS con Mailrelay');
    }
  }

  /** GET /sms/sent_messages/{id} — estado de entrega de un envío concreto. */
  async getSentMessage(creds: MailrelaySmsCredentials, mailrelayId: number): Promise<MailrelaySentMessage> {
    try {
      const response = await axios.get<MailrelaySentMessage>(
        `${this.baseUrl(creds.accountUrl)}/sms/sent_messages/${mailrelayId}`,
        { headers: this.headers(creds.apiKey) },
      );
      return response.data;
    } catch (err) {
      throw this.wrapError(err, 'Error consultando el estado del SMS en Mailrelay');
    }
  }

  /**
   * No existe un endpoint dedicado de "test de conexión" en la API de
   * Mailrelay: se usa una consulta autenticada ligera (1 registro) como ping.
   * 200 = credenciales válidas, 401 = api_key/cuenta inválida.
   */
  async ping(creds: MailrelaySmsCredentials): Promise<void> {
    try {
      await axios.get(`${this.baseUrl(creds.accountUrl)}/sms/sent_messages`, {
        headers: this.headers(creds.apiKey),
        params: { per_page: 1 },
      });
    } catch (err) {
      throw this.wrapError(err, 'No se pudo conectar con Mailrelay');
    }
  }

  private wrapError(err: unknown, fallbackMessage: string): Error {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      const data = err.response?.data;
      this.logger.error({ status, data, message: err.message }, fallbackMessage);
      const detail = typeof data === 'string' ? data : data ? JSON.stringify(data) : err.message;
      return new InternalServerErrorException(`${fallbackMessage}${status ? ` (HTTP ${status})` : ''}: ${detail}`);
    }
    this.logger.error(String(err), fallbackMessage);
    return new InternalServerErrorException(fallbackMessage);
  }
}
