# Database Setup

This package provides database management scripts for both Docker-based and local PostgreSQL setups.

## Quick Start

### Option 1: Docker (Fast Setup)

```bash
# Start database
pnpm run db:start:docker

# Push schema
pnpm run db:push

# Stop database
pnpm run db:stop:docker
```

### Option 2: Local (Persistent Setup)

```bash
# Install PostgreSQL (see Prerequisites below)

# Initialize database (create user and database)
pnpm run db:init:local

# Start database
pnpm run db:start:local

# Push schema
pnpm run db:push

# Stop database
pnpm run db:stop:local
```

## Database Configuration

The database connection uses the following environment variables from `apps/server/.env`:

- `DATABASE_URL`: PostgreSQL connection string

Example `.env` configuration:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/folio_note
```

## Docker Setup (Recommended for Development)

Docker setup provides an isolated PostgreSQL instance with persistent data storage.

### Start Docker Database

```bash
# From project root
pnpm run db:start:docker

# Or from packages/db directory
cd packages/db
pnpm run db:start:docker
```

### Stop Docker Database

```bash
pnpm run db:stop:docker
```

### Database Details

- **Container Name**: `folio-note-postgres`
- **Database**: `folio_note`
- **User**: `postgres`
- **Password**: `password`
- **Port**: `5432`
- **Data Volume**: Persistent volume for data storage

## Local Setup (Recommended for Production)

Local setup uses system-installed PostgreSQL for better performance and data persistence.

### Prerequisites

#### macOS (with Homebrew)

```bash
# Install Homebrew (if not already installed)
# Visit: https://brew.sh/

/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install PostgreSQL
brew install postgresql@16

# Start PostgreSQL service
brew services start postgresql@16

# Create database (optional, script will handle this)
createdb folio_note
```

#### Linux (Ubuntu/Debian)

```bash
# Update package list
sudo apt update

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database (optional, script will handle this)
sudo -u postgres createdb folio_note
```

#### Linux (CentOS/RHEL/Fedora)

```bash
# Install PostgreSQL
sudo dnf install postgresql-server postgresql-contrib

# Initialize database
sudo postgresql-setup initdb

# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database (optional, script will handle this)
sudo -u postgres createdb folio_note
```

### Start Local Database

```bash
# From project root
pnpm run db:start:local

# Or from packages/db directory
cd packages/db
pnpm run db:start:local
```

### Stop Local Database

```bash
pnpm run db:stop:local
```

### Initialize Local Database

Before using the local PostgreSQL setup, you need to initialize the database user and database:

```bash
pnpm run db:init:local
```

This script will:

- Create the `postgres` user with password `password`
- Create the `folio_note` database
- Grant proper permissions
- Test the connection

## Database Operations

### Push Schema Changes

```bash
pnpm run db:push
```

### Generate Migrations

```bash
pnpm run db:generate
```

### Run Migrations

```bash
pnpm run db:migrate
```

### Open Database Studio

```bash
pnpm run db:studio
```

## Troubleshooting

### Connection Issues

1. **Check if database is running**:

   ```bash
   # Docker
   docker ps | grep postgres

   # Local
   pg_isready -h localhost -p 5432
   ```

2. **Check environment variables**:
   - Ensure `apps/server/.env` exists and contains correct `DATABASE_URL`
   - Verify the URL format: `postgresql://user:password@host:port/database`

3. **Database not created**:
   - Docker: The database is automatically created when the container starts
   - Local: The startup script will create the database if it doesn't exist

### Permission Issues (Local Setup)

If you encounter permission issues on macOS:

```bash
# Reset PostgreSQL permissions
rm -rf /usr/local/var/postgres
initdb /usr/local/var/postgres
brew services restart postgresql@16
```

On Linux:

```bash
# Switch to postgres user
sudo -u postgres psql
# Then create database and user as needed
```
