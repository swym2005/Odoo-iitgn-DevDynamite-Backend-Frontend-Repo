# OrbitOne Backend (Multi-Module: Auth, Projects, Tasks, Timesheets, Finance, Analytics, AI, Notifications)

> Unified Express + MongoDB backend powering role-based dashboards (Admin, Project Manager, Team Member, Finance, Vendor) with authentication, project/task management, timesheet tracking, expenses, billing, sales & purchase workflows, notifications, profile, search, AI helpers, and analytics.

## Table of Contents
1. Overview
2. Tech Stack
3. Features
4. Folder Structure
5. Environment Variables
6. Installation & Scripts
7. Core API Overview (Highlights)
8. Recent Changes (Changelog)
9. Testing
10. Troubleshooting & Common Pitfalls
11. Roadmap / Next Steps

## 1. Overview
OrbitOne expands from a pure auth service into a modular operations platform:
- Authentication & Role Redirects
- Project & Task lifecycle (Kanban, comments, attachments)
- Cross-role task assignment (any active user)
- Automatic team membership synchronization on assignment
- User-centric and project-centric timesheets (dual views unified)
- Expenses submission & PM approval/rejection
- Finance: Billing Records, Sales Orders → Invoices, Vendor Bills, Purchase Orders
- Linked Documents & file uploads (multer) for tasks/projects
- Notifications engine (in-app) & password reset flows
- AI & Analytics placeholder endpoints (extensible)
- Profile management & search utilities

## 2. Tech Stack
- Node.js / Express (ES Modules)
- MongoDB / Mongoose
- JSON Web Tokens (JWT)
- bcryptjs (password hashing)
- Joi (validation layer in validators/)
- Multer (file uploads under `uploads/`)
- Nodemailer (email delivery; console fallback when SMTP unset)
- Jest + Supertest + mongodb-memory-server (isolated tests)

## 3. Features
| Domain | Highlights |
|--------|-----------|
| Auth | Signup, Login (rememberMe token extension), Forgot/Reset password, role-based redirects |
| Projects | CRUD, manager assignment (Admin can pick any user), dynamic team membership |
| Tasks | CRUD, comments, attachments, Kanban reorder, self-assign for team members |
| Assignment | `/pm/users` endpoint exposes all active users for task assignee dropdown |
| Timesheets | User-centric `/timesheets` + PM project-specific `/pm/projects/:id/timesheets`; charts & summary endpoints |
| Finance | Sales Orders listing & conversion to Invoice, billing snapshot, expenses workflow, vendor & purchase docs (models present) |
| Expenses | Submit, approve, reject per project |
| Notifications | Model & controller for user in-app alerts |
| AI / Analytics | Placeholder service endpoints for future ML/BI integration |
| Profiles | User profile & settings update endpoints |
| Search | Cross-domain search utilities |
| Uploads | Organized by domain: `uploads/ai`, `uploads/bills`, `uploads/profile`, `uploads/receipts` |

## 4. Folder Structure (Excerpt)
```
server/
	src/
		app.js                # Express app bootstrap
		config/db.js          # Mongo connection logic
		controllers/          # Route handlers per domain
		middleware/           # Auth, error handlers
		models/               # Mongoose schemas (Project, Task, Timesheet, Expense, etc.)
		routes/               # Route modules (auth, pm, timesheet, finance, etc.)
		services/             # Business logic abstractions
		validators/           # Joi validation schemas
		utils/                # Helpers (crypto, jwt, roles)
		tests/                # Jest test specs & setup
	uploads/                # File upload targets
```

## 5. Environment Variables
Create `.env` (or copy from an example if present):
```
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/orbitone_core
JWT_SECRET=replace_with_long_random_value
EMAIL_FROM="OrbitOne <no-reply@orbitone.local>"
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
APP_BASE_URL=http://localhost:3000
```
Notes:
- If SMTP vars are blank, password reset emails are logged to console.
- Adjust `APP_BASE_URL` to match frontend host for correct reset links.

## 6. Installation & Scripts
```powershell
npm install            # install dependencies
npm run dev            # start in watch mode (default PORT)
npm run dev:5050       # dev server on port 5050
npm run dev:5051       # dev server on port 5051
npm start              # production mode (no watch)
npm run seed           # seed baseline data
npm run seed:reset     # reset (purge + reseed) development data
npm test               # run Jest test suite
```

## 7. Core API Overview (Highlights)
Authentication:
- `POST /auth/signup` – Create user; returns JWT + redirectPath
- `POST /auth/login` – Auth; supports `rememberMe` (30d token) else 1d
- `POST /auth/forgot-password` – Initiates password reset token (1h expiry)
- `GET /auth/reset/:token` – Validate token
- `POST /auth/reset/:token` – Set new password

Project Management (PM/Admin scope):
- `GET /pm/projects` / `POST /pm/projects`
- `GET /pm/projects/:projectId` / `PATCH /pm/projects/:projectId` / `DELETE`
- `GET /pm/projects/:projectId/tasks` / `POST` / `PATCH /pm/projects/:projectId/tasks/:taskId`
- `GET /pm/users` – All active users for assignment (recent addition)
- Kanban: `GET /pm/projects/:projectId/kanban`, `POST /pm/projects/:projectId/kanban/reorder`

Task Extensions:
- Comments: `POST /pm/projects/:projectId/tasks/:taskId/comments` (patch/delete variants)
- Attachments: `POST /pm/projects/:projectId/tasks/:taskId/attachments` & upload route
- Auto-add assignee to `project.teamMembers` if not present (transparent)

Team Member Views:
- `GET /team/projects` – Returns accessible projects (membership or assigned tasks)
- Task self-assignment: `PATCH /team/projects/:projectId/tasks/:taskId/assign-self`

Timesheets:
- User-centric: `GET /timesheets`, `POST /timesheets`, `DELETE /timesheets/:id`
- Analytics: `/timesheets/summary`, `/timesheets/charts`, `/timesheets/overview`
- Project-centric (PM): `GET /pm/projects/:projectId/timesheets`, charts `/pm/projects/:projectId/timesheets/chart`
	- Recent change: UI unified to prefer user-centric endpoint for consistency.

Expenses & Finance:
- Project Expenses: `GET /pm/projects/:projectId/expenses`, `POST`, approve/reject endpoints
- Billing: `GET /pm/projects/:projectId/billing`, invoice create `POST /pm/projects/:projectId/billing/invoice`
- Sales Orders: `GET /pm/projects/:projectId/sales-orders` (PM/Admin) → convert: `POST /pm/sales-orders/:id/convert-invoice`

Misc:
- Linked Docs: `GET/POST /pm/projects/:projectId/linked-docs`
- Analytics (placeholder): `GET /pm/analytics`
- Notifications / Profile / Search / AI – Controllers & services scaffolded (see `controllers/` & `services/`).

### Standard Response Shapes
Success:
```json
{ "success": true, "<dataField>": { /* domain data */ } }
```
Error:
```json
{ "success": false, "message": "Explanation" }
```

## 8. Recent Changes (Changelog)
| Date (UTC) | Change |
|-----------|--------|
| 2025-11-09 | Added `/pm/users` endpoint for cross-role task assignment |
| 2025-11-09 | Auto-add task assignee to project teamMembers (tasksPost/taskPatch logic) |
| 2025-11-09 | Unified timesheets UI to use user-centric `/timesheets` endpoint |
| 2025-11-09 | Added diagnostic logging for project membership & timesheet mapping (debug phase) |
| 2025-11-09 | README overhaul to reflect multi-module scope |

## 9. Testing
Run full suite:
```powershell
npm test
```
Notes:
- Uses `mongodb-memory-server` (downloads binary on first run).
- To isolate a single test: `npx jest path/to/file.test.js --runInBand` (adjust on Windows PowerShell).

## 10. Troubleshooting & Common Pitfalls
| Issue | Cause | Fix |
|-------|-------|-----|
| Timesheet not visible after logging | Using project-centric endpoint in UI or missing project membership | Ensure UI calls `/timesheets`; reassign task to add user to `teamMembers` |
| Task assignee dropdown only shows PM | Old frontend cache / not calling `/pm/users` | Hard refresh; confirm network request to `/pm/users` |
| Password reset email not sent | SMTP not configured | Check console log for fallback link |
| 403 on project access | User not manager/member/admin | Add user to team via assignment or patch project |
| Seed data outdated | Logic evolved (assignee auto-add) | Run `npm run seed:reset` |

## 11. Roadmap / Next Steps
- Refresh tokens & explicit logout endpoint
- Rate limiting & security hardening (helmet, express-rate-limit)
- Enhanced analytics (burndown, velocity, utilization)
- AI service integration (task summarization, timesheet anomaly detection)
- File versioning & S3/Blob storage abstraction
- WebSocket or SSE notifications channel
- Extended test coverage across finance & analytics modules

---
Made with ⚙️ Express & MongoDB. Contributions welcome – open issues or propose improvements.


## Video Link:
- https://drive.google.com/drive/folders/1M67g9_0goY73eF2uZWEYY518Hcm8l1Sm
