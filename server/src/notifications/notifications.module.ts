import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { MailModule } from '../api/mail/mail.module';
import { AuthUserRepository } from '../database/repository/auth/auth_user.repository';
import { AdminNotificationService } from './admin-notification.service';

/**
 * Módulo de avisos a administradores. Proporciona AdminNotificationService,
 * que envía correos (vía MailService/SMTP) a los auth_users con rol admin
 * cuando falla una tarea desatendida (importación SAGE, sync Moodle).
 */
@Module({
  imports: [DatabaseModule, MailModule],
  providers: [AdminNotificationService, AuthUserRepository],
  exports: [AdminNotificationService],
})
export class NotificationsModule {}
