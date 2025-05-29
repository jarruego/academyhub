# Trabajo de Fin de Grado (TFG)

Este proyecto es el Trabajo de Fin de Grado (TFG) y consiste en una aplicación web dividida en dos partes: cliente (frontend) y servidor (backend).

## Descripción
La aplicación permite la gestión de usuarios, centros, empresas, cursos y grupos, integrando funcionalidades de autenticación y administración. Está diseñada para facilitar la gestión académica y administrativa en un entorno educativo.

Además, permite sincronizar datos de cursos, grupos y alumnos con Moodle, así como facilitar la gestión de la formación bonificada a través de FUNDAE, optimizando los procesos de integración y control de la formación.

## Estructura del Proyecto
- `client/`: Aplicación frontend desarrollada con React y Vite.
- `server/`: API backend desarrollada con NestJS y Drizzle ORM.

## Tecnologías Utilizadas
- **Frontend:** React, TypeScript, Vite
- **Backend:** NestJS, TypeScript, Drizzle ORM
- **Base de datos:** PostgreSQL
- **Docker:** Para el despliegue y desarrollo local

### Principales librerías utilizadas en producción
- **Frontend:**
  - [Ant Design (antd)](https://ant.design/): Framework de componentes UI
  - [Zod](https://zod.dev/): Validación de esquemas y formularios
  - [React Router](https://reactrouter.com/): Enrutamiento
  - [Axios](https://axios-http.com/): Cliente HTTP
- **Backend:**
  - [NestJS](https://nestjs.com/): Framework backend
  - [Drizzle ORM](https://orm.drizzle.team/): ORM para TypeScript
  - [Passport](http://www.passportjs.org/): Autenticación
  - [Class-validator](https://github.com/typestack/class-validator): Validación de DTOs

## Instalación y Ejecución

### Requisitos previos
- Node.js (v18 o superior)
- Docker y Docker Compose (opcional, recomendado para desarrollo)

### Clonar el repositorio
```bash
git clone <URL-del-repositorio>
cd TFG
```

### Instalación del cliente
```bash
cd client
npm install
npm run dev
```

### Instalación del servidor
```bash
cd server
npm install
npm run start:dev
```

### Uso con Docker
```bash
cd server
docker-compose up --build
```

## Contribuir
Las contribuciones son bienvenidas. Por favor, abre un issue o pull request para sugerencias o mejoras.

## Licencia
Este proyecto está bajo la licencia MIT. Consulta el archivo LICENSE para más información.
