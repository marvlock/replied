# replied
the anonymous sanctuary for professional curation.

### structure
- `frontend/` next.js 15 + drizzle
- `backend/` go / gin + supabase

### setup
1. configure `.env` in both folders
2. `npm install` in frontend
3. `npm run db:push` for the schema

### run
```bash
# terminal 1
cd backend && go run main.go

# terminal 2
cd frontend && npm run dev
```
