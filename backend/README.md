# AppConstruct Backend (Express)

## Scripts

```bash
npm run dev
npm run build
npm start
npm run db:init
```

`db:init` aplica el esquema inicial de PostgreSQL usando `DATABASE_URL`:

```bash
DATABASE_URL="postgresql://user:pass@host:5432/dbname" npm run db:init
```
