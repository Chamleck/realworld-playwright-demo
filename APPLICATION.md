# Application Details

> ![RealWorld Example App](logo.png)

> ### NextJS + tRPC + Prisma codebase containing real world examples (CRUD, auth, advanced patterns, etc.) that adheres to the [RealWorld](https://github.com/gothinkster/realworld) spec and API.

### [Demo](https://demo.realworld.io/)&nbsp;&nbsp;&nbsp;&nbsp;[RealWorld](https://github.com/gothinkster/realworld)

This codebase was created to demonstrate a fully fledged fullstack application built with **NextJS + tRPC + Prisma** including CRUD operations, authentication, routing, pagination, and more.

We've gone to great lengths to adhere to the **NextJS + tRPC + Prisma** community styleguides & best practices.

For more information on how to this works with other frontends/backends, head over to the [RealWorld](https://github.com/gothinkster/realworld) repo.

## How it works

This project uses NextJS and its pages router to serve a React frontend. The backend utilizes tRPC, which usually does not expose a usable REST API, which is required by the RealWorld specs, therefor [trpc-openai](https://github.com/prosepilot/trpc-openapi) is used to create a REST API and also generate a Swagger UI.

The database is managed by Prisma; for simplicity's sake it uses a sqlite database, but it can be easily changed to any other database supported by Prisma.


## Project Structure

- `prisma` - The Prisma schema and sqlite database
- `public` - Static assets
- `src` - The NextJS application
  - `components` - React components used in the pages
  - `pages` - NextJS pages & api route setup
  - `server` - Setup for the database and tRPC router
  - `styles` - Official RealWorld css styles
- `tests` - UI Tests

## Technology Stack

### Frontend
- **Next.js 14** - React framework with pages router
- **React 18** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling (via globals.css)

### Backend
- **tRPC** - End-to-end typesafe APIs
- **tRPC OpenAPI** - REST API generation
- **Prisma** - Database ORM
- **SQLite** - Database using local file

### Authentication
- **JWT** - JSON Web Tokens for authentication
- **bcryptjs** - Password hashing

### Development Tools
- **ESLint** - Code linting
- **Prettier** - Code formatting

## API Endpoints

The application exposes both tRPC and REST API endpoints:

### tRPC Routes
- `authentication` - Login, register, logout
- `articles` - CRUD operations for articles
- `comments` - Article comments
- `favorites` - Article favoriting
- `profile` - User profiles
- `tags` - Article tags

### REST API
Generated via tRPC OpenAPI, available at `/api/openapi.json` with Swagger UI.

## Database Schema

The application uses Prisma with the following main entities:
- **User** - User accounts and profiles
- **Article** - Blog articles with tags
- **Comment** - Article comments
- **Tag** - Article tags
- **Favorite** - User article favorites
- **Follow** - User following relationships

## Environment Variables

Minimal environment variables are set upon install based on `.env.example`, and contain:

```bash
DATABASE_URL="file:./database.sqlite"
JWT_SECRET="some-super-secret-string"
```

## Application Scripts

The project includes several npm scripts for development, testing, and maintenance:

### Core Development Scripts
- `npm run dev` - Start the development server on port 3000
- `npm run build` - Create production build
- `npm run start` - Start production server
- `npm run lint` - Run ESLint for code quality checks

### Database Management
- `npm run initialize` - Set up environment and database files
- `npm run initialize:env` - Setup `.env` based on `.env.example` if not done before
- `npm run initialize:database` - Set up test database from base SQLite file
- `npm run initialize:revert` - Remove generated environment and database files
- `npm run initialize:fresh` - Clean reset of environment and database files

### Testing Scripts
- `npm run test:run` - Run end-to-end tests with your chosen framework
- `npm run test:initialize:database` - Set up test database from base SQLite file

### Post-Install Automation
- `npm run postinstall` - Automatically runs after `npm install` to:
  - Initialize environment and database
  - Generate Prisma client
  - Ensure latest database schema

The project is designed for minimal setup - running `npm install` will automatically configure the environment and database, making it ready for development and testing immediately.


## RealWorld Specification

This application implements the [RealWorld](https://github.com/gothinkster/realworld) specification, which defines a standard for building full-stack applications. The spec includes:

- User authentication (JWT)
- CRUD operations for articles
- User profiles
- Article favoriting
- Comments
- Tags
- Pagination
- Real-time updates

## Contributing

This is a test automation focused project based on the RealWorld specification. For contributions to the RealWorld project itself, please visit the [RealWorld repository](https://github.com/gothinkster/realworld).
