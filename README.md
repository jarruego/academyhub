# 📚 AcademyHub: Open-source web platform for training management in SMEs integrating Moodle

AcademyHub is an open-source web platform designed to streamline training management for small and medium-sized enterprises (SMEs) that use Moodle as their learning management system. Its main goal is to simplify the administration of courses, users, and training resources, enabling companies to optimize both in-person and online training processes while ensuring compliance with regulations such as SEPE and FUNDAE.

Developed with modern technologies and a scalable architecture, AcademyHub aims to enhance competitiveness and digitalization in the training sector, offering a flexible, customizable, and easily integrable solution.

# Final Degree Project (TFG)

This project is my Final Degree Project (Trabajo de Fin de Grado). Developed by Jose Alberto Arruego.

## Description
This project is an open-source web application designed to address the needs of small and medium-sized training companies in Spain, especially those using Moodle. Its main goal is to simplify training management—both face-to-face and online—without requiring advanced technical knowledge or experience in Moodle administration. The platform helps SMEs comply with essential regulations such as SEPE and FUNDAE, reducing barriers and improving competitiveness in the training sector.

Built with modern technologies and a scalable architecture, the platform is released under the MIT license, allowing free use, redistribution, and customization.

## Project Structure
- `client/`: Frontend application built with React and Vite.
- `server/`: Backend API built with NestJS and Drizzle ORM.

## Technologies Used
- **Frontend:** React, TypeScript, Vite 💻
- **Backend:** NestJS, TypeScript, Drizzle ORM 🛠️
- **Database:** PostgreSQL 🗄️
- **Docker:** For deployment and local development 🐳

### Main Production Libraries
- **Frontend:**
  - [Ant Design (antd)](https://ant.design/): UI component framework
  - [Zod](https://zod.dev/): Schema and form validation
  - [React Router](https://reactrouter.com/): Routing
  - [Axios](https://axios-http.com/): HTTP client
  - [React Hook Form](https://react-hook-form.com/): Form management
  - [TanStack React Query](https://tanstack.com/query/latest): Data fetching and caching
  - [Day.js](https://day.js.org/): Date handling
  - [xlsx](https://github.com/SheetJS/sheetjs): Spreadsheet import/export
- **Backend:**
  - [NestJS](https://nestjs.com/): Backend framework
  - [Drizzle ORM](https://orm.drizzle.team/): ORM for TypeScript
  - [Passport](http://www.passportjs.org/): Authentication
  - [Class-validator](https://github.com/typestack/class-validator): DTO validation
  - [@nestjs/swagger](https://docs.nestjs.com/openapi/introduction): API documentation
  - [@nestjs/throttler](https://docs.nestjs.com/security/rate-limiting): Rate limiting
  - [dotenv](https://github.com/motdotla/dotenv): Environment variable management
  - [pg](https://node-postgres.com/): PostgreSQL driver
  - [xmlbuilder2](https://oozcitak.github.io/xmlbuilder2/): XML construction

## Installation and Usage

### Prerequisites
- Node.js (v18 or higher)
- Docker and Docker Compose (optional, recommended for development)

### Clone the repository
```bash
git clone <repository-url>
cd TFG
```

### Client installation
```bash
cd client
npm install
npm run dev
```

### Server installation
```bash
cd server
npm install
npm run start:dev
```

### Using Docker
```bash
cd server
docker-compose up --build
```

## Required Environment Variables
To run the server, you must define certain environment variables in a `.env` file inside the `server/` folder. Example of required variables:

- `DATABASE_URL`: PostgreSQL database connection URL.
- `JWT_SECRET`: Secret key for JWT token generation and validation.
- `MOODLE_TOKEN`: Access token for the Moodle API.
- `MOODLE_URL`: Moodle API endpoint URL.

You can find an example in the `.env` file included in the project. Make sure to fill in these values before starting the server.

## Seed Data Scripts

There are two seed scripts available to populate the database with sample data if desired:

- `server/seed-all.ts`: Populates all main tables (users, companies, centers, courses, groups, and their relationships) with realistic sample data.
- `server/seed-auth-users.ts`: Populates only authentication users for quick testing of login and roles.

### How to use the seed scripts

1. Make sure your database is running and your `.env` file is properly configured in the `server/` folder.
2. Install dependencies in the `server/` folder if you haven't already:
   ```bash
   cd server
   npm install
   ```
3. Run the desired seed script with Node.js:
   ```bash
   # To populate all main tables with sample data
   npx ts-node seed-all.ts

   # To populate only authentication users
   npx ts-node seed-auth-users.ts
   ```

> **Note:** Running these scripts will erase existing data in the affected tables and insert new sample data.

## Contributing
Contributions are welcome starting in 2026, after the TFG has been submitted. Please open an issue or pull request for suggestions or improvements after that date.

## License
This project is licensed under the MIT License. See the LICENSE file for more information.
