<p align="center">
  <img src="client/public/logo.png" alt="AcademyHub Logo" width="200"/>
</p>

# 📚 AcademyHub: Open-source web platform for training management in SMEs integrating Moodle.

AcademyHub is an open-source web platform designed to streamline training management for small and medium-sized enterprises (SMEs) that use Moodle as their learning management system. Its main goal is to simplify the administration of courses, users, and training resources, enabling companies to optimize both in-person and online training processes while ensuring compliance with regulations such as SEPE and FUNDAE.

Developed with modern technologies and a scalable architecture, AcademyHub aims to enhance competitiveness and digitalization in the training sector, offering a flexible, customizable, and easily integrable solution.

## 🎓 Academic Origin

This project originated as a Final Degree Project (Trabajo de Fin de Grado) and has evolved into an active open-source platform. The original academic repository can be found at [jarruego/TFG](https://github.com/jarruego/TFG) (archived).

## Description
This project is an open-source web application designed to address the needs of small and medium-sized training companies in Spain, especially those using Moodle. Its main goal is to simplify training management—both face-to-face and online—without requiring advanced technical knowledge or experience in Moodle administration. The platform helps SMEs comply with essential regulations such as SEPE and FUNDAE, reducing barriers and improving competitiveness in the training sector.

Built with modern technologies and a scalable architecture, the platform is released under the MIT license, allowing free use, redistribution, and customization.

## Project Structure
- `client/`: Frontend application built with React and Vite.
- `server/`: Backend API built with NestJS and Drizzle ORM.

## Technologies Used
- 💻 **Frontend:** React, TypeScript, Vite 
- ⚙️ **Backend:** NestJS, TypeScript, Drizzle ORM 
- 🗄️ **Database:** PostgreSQL 
- 🐳 **Docker:** For deployment and local development 

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

## Moodle Web Services Used

The platform integrates with Moodle using the following official web services:

| Moodle Service                                   | Description                                 |
|--------------------------------------------------|---------------------------------------------|
| core_completion_get_activities_completion_status | Student progress by activity                |
| core_course_get_courses                          | List available courses                      |
| core_enrol_get_enrolled_users                    | List enrolled users                         |
| core_group_get_course_groups                     | List groups by course                       |
| core_group_get_group_members                     | List group members                          |
| core_user_get_course_user_profiles               | User profile within a course                |
| core_user_get_users                              | General user search                         |
| core_user_get_users_by_field                     | Search users by specific fields             |

### Optional Custom Moodle Plugins

Some deployments use a custom Moodle plugin (itop_training). When enabled, AcademyHub can fetch student dedication time and show the **Tiempo usado** column in reports and PDFs.

- **Custom WS function**: `block_advanced_reports_get_userstats`
- **Stat used**: `platformdedicationtime`
- **Config flag**: `organization_settings.settings.plugins.itop_training = true`

If the flag is **false** (or missing), the platform will skip the custom API call and hide time_spent in the UI/PDFs.

### Moodle Configuration (Optional)

For enhanced user matching and data cross-referencing, AcademyHub can optionally use the following configuration in your Moodle instance:

**Optional Custom User Profile Field:**
- **Field Name**: `DNI` (Spanish National Identity Document)
- **Field Type**: Text input
- **Purpose**: When available, improves automatic user matching between the local database and Moodle
- **Location**: User profile → Custom profile fields
- **Configuration**: Should be visible and available for all users if implemented

**Note**: This custom field is completely optional. The platform's user comparison tool works without it by using other matching criteria (email, name similarity). However, when the DNI field is present, it provides more accurate user identification, which can be especially useful for Spanish training companies that need precise student tracking for regulatory compliance (SEPE/FUNDAE).

## Installation and Usage

### Prerequisites
- Node.js (v18 or higher)
- Docker and Docker Compose (optional, recommended for development)

### Clone the repository
```bash
git clone https://github.com/jarruego/academyhub.git
cd academyhub
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

### Database setup (PostgreSQL)

Before running the server or applying migrations on a new PostgreSQL instance, make sure the database has the required extensions. AcademyHub uses the `unaccent` extension to make user searches tolerant to diacritics (e.g. `CARREÑO` vs `CARRENO`).

Run the following (as a superuser / a role with permission to create extensions):

```powershell
psql "postgresql://SUPERUSER:PW@HOST:PORT/DATABASE" -c "CREATE EXTENSION IF NOT EXISTS unaccent;"
```

If you also plan to enable trigram indexes for faster LIKE '%term%' searches, enable `pg_trgm` as well:

```powershell
psql "postgresql://SUPERUSER:PW@HOST:PORT/DATABASE" -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"
```

Notes:
- Creating extensions requires sufficient privileges (usually superuser). If your CI/CD or deploy user lacks those privileges, run these commands once using a privileged account or ask your DBA to enable the extensions.
- The project includes a migration file that will attempt to create `unaccent` on new databases, but the account that runs migrations must have permission to create extensions.

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

🎉 **Contributions are welcome!** 

We encourage community participation to make AcademyHub even better. Here's how you can contribute:

### Ways to Contribute
- 🐛 **Bug Reports**: Found an issue? [Open an issue](https://github.com/jarruego/academyhub/issues)
- 💡 **Feature Requests**: Have an idea? [Suggest a feature](https://github.com/jarruego/academyhub/issues)
- 🔧 **Code Contributions**: Submit pull requests with improvements
- 📖 **Documentation**: Help improve our docs and examples
- 🌍 **Translations**: Help make AcademyHub multilingual

### Getting Started
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test your changes thoroughly
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Development Guidelines
- Follow existing code style and conventions
- Write clear commit messages
- Add tests for new features when applicable
- Update documentation as needed
- Ensure your changes don't break existing functionality

## Roadmap

### 🎯 Current Focus
- Enhanced Moodle integration capabilities
- Improved user experience and interface
- Performance optimizations
- Extended SEPE/FUNDAE compliance features

### 🔮 Future Plans
- Multi-language support
- Advanced reporting and analytics
- Mobile application
- Integration with other LMS platforms
- API improvements and documentation

## Community and Support

- 💬 **Discussions**: [GitHub Discussions](https://github.com/jarruego/academyhub/discussions)
- 🐛 **Issues**: [Report bugs or request features](https://github.com/jarruego/academyhub/issues)
- 📧 **Contact**: For direct inquiries about the project

## License
This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more information.

---

<p align="center">
  <strong>Made with ❤️ for the training industry</strong><br>
  <em>Empowering SMEs with better training management</em>
</p>
