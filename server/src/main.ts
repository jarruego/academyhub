import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as path from 'path';
import * as express from 'express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import "dotenv/config";

const REQUIRED_ENV_VARS = ['JWT_SECRET', 'APP_MASTER_KEY', 'DATABASE_URL', 'MOODLE_URL'];

function validateEnv() {
  const missing = REQUIRED_ENV_VARS.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    throw new Error(`Variables de entorno requeridas no definidas: ${missing.join(', ')}`);
  }
}

async function bootstrap() {
  validateEnv();

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Necesario para que req.ip sea la IP real del cliente detrás del proxy de Render
  app.set('trust proxy', 1);

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ limit: '1mb', extended: true }));

  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:4173',
    'https://app.mecohisa.com',
  ];

  app.enableCors({
    origin: (origin, callback) => {
      // Permitir peticiones sin origen (server-to-server, curl, Postman)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origen no permitido — ${origin}`));
      }
    },
    credentials: true,
    exposedHeaders: ['Content-Disposition', 'Content-Type'],
  });
  // Serve static files from `public` so requests to /uploads/* map to server/public/uploads/*
  app.useStaticAssets(path.join(process.cwd(), 'public'));
// Configura el uso de pipes globales en la aplicación, específicamente un ValidationPipe.
// El ValidationPipe se utiliza para validar y transformar los datos de entrada.
// La opción 'whitelist: true' elimina las propiedades que no están en el DTO (Data Transfer Object).
// La opción 'transform: true' convierte los datos de entrada a los tipos esperados.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('AcademyHub API - Gestión de formación para pymes con integración Moodle')
      .setDescription('API RESTful para la plataforma AcademyHub, orientada a la gestión integral de cursos, usuarios, centros y empresas en pequeñas y medianas empresas (pymes) que utilizan Moodle. Facilita la administración de la formación presencial y online, cumpliendo normativas SEPE y FUNDAE, y promoviendo la digitalización del sector formativo.\n\nRESTful API for the AcademyHub platform, focused on the comprehensive management of courses, users, centers, and companies in small and medium-sized enterprises (SMEs) using Moodle. It streamlines the administration of both in-person and online training, ensures compliance with SEPE and FUNDAE regulations, and promotes digitalization in the training sector.')
      .build();
    const documentFactory = () => SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('documentation', app, documentFactory);
  }

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
