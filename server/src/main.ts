import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import "dotenv/config";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();
// Configura el uso de pipes globales en la aplicación, específicamente un ValidationPipe.
// El ValidationPipe se utiliza para validar y transformar los datos de entrada.
// La opción 'whitelist: true' elimina las propiedades que no están en el DTO (Data Transfer Object).
// La opción 'transform: true' convierte los datos de entrada a los tipos esperados.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const config = new DocumentBuilder()
    .setTitle('Cats example')
    .setDescription('The cats API description')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('documentation', app, documentFactory);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
