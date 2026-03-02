import { Injectable } from '@nestjs/common';
import axios from 'axios';

export interface SendMoodleMessageOptions {
  toUserId: number;
  text: string;
  textFormat?: number;
  token?: string;
}

@Injectable()
export class MoodleMessageService {
  private readonly MOODLE_URL = process.env.MOODLE_URL;
  private readonly MOODLE_TOKEN = process.env.MOODLE_TOKEN;

  async sendMessage(options: SendMoodleMessageOptions): Promise<void> {
    const moodleUrl = this.MOODLE_URL;
    const defaultToken = this.MOODLE_TOKEN;

    if (!moodleUrl) {
      throw new Error('MOODLE_URL not configured');
    }

    const token = options.token || defaultToken;
    if (!token) {
      throw new Error('No Moodle token available');
    }

    const endpoint = `${moodleUrl}/webservice/rest/server.php`;
    
    const params = new URLSearchParams({
      wstoken: token,
      wsfunction: 'core_message_send_instant_messages',
      moodlewsrestformat: 'json',
    });

    // El parámetro messages es un array
    params.append('messages[0][touserid]', String(options.toUserId));
    params.append('messages[0][text]', options.text);
    // textformat: 0 = Moodle (auto-format), 1 = HTML, 2 = Plain text
    params.append('messages[0][textformat]', String(options.textFormat ?? 0));

    const response = await axios.post(endpoint, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (response.data?.exception) {
      throw new Error(`Moodle API error: ${response.data.message || 'Unknown error'}`);
    }

    // La respuesta debería ser un array con los IDs de los mensajes enviados
    if (!Array.isArray(response.data) || response.data.length === 0) {
      throw new Error('Failed to send Moodle message');
    }
  }
}
