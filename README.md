<<<<<<< HEAD
# Odoo-iitgn-backend-frontend-temp-repo
=======
# OrbitOne Auth Backend (MERN - Express + MongoDB)

Implements authentication flows for OrbitOne: signup, login with role-based redirect, forgot password, password reset. Designed to pair with a split-screen UI and minimal forgot password page.

## Tech Stack
- Node.js / Express
- MongoDB / Mongoose
- JSON Web Tokens (JWT)
- bcrypt for password hashing
- Joi for validation
- Nodemailer (stubbed if SMTP not configured)
- Jest + Supertest + mongodb-memory-server for tests

## Environment Variables
Copy `.env.example` to `.env` and fill values:
```
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/orbitone_auth
JWT_SECRET=your_long_random_secret
EMAIL_FROM="OrbitOne <no-reply@orbitone.example>"
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
APP_BASE_URL=http://localhost:3000
```

## Install & Run
```powershell
npm install
npm run dev
```

## API Endpoints
### POST /auth/signup
Request JSON:
```json
{ "name":"Alice", "email":"alice@example.com", "password":"Password123", "role":"Admin" }
```
Response:
```json
{ "success": true, "animation":"success", "user": {"_id":"...","email":"alice@example.com","role":"Admin"}, "token":"<jwt>", "redirectPath":"/admin/dashboard" }
```

### POST /auth/login
Request JSON:
```json
{ "email":"alice@example.com", "password":"Password123", "rememberMe": true }
```
Response adds `redirectPath` based on role.

### POST /auth/forgot-password
Request JSON:
```json
{ "email": "alice@example.com" }
```
Always returns success if validation passes.

### GET /auth/reset/:token
Validates token. Response: `{ "success": true, "animation": "token_valid", "valid": true }`.

### POST /auth/reset/:token
Request JSON:
```json
{ "password": "NewStrongPass1" }
```
Response: `{ "success": true, "animation": "password_reset" }`.

## JWT
Payload includes:
```json
{ "sub": "<userId>", "role": "Admin", "iat": 1731020000, "exp": 1733612000 }
```
Expiration: 1d default, 30d when `rememberMe=true`.

## Role Redirect Mapping
| Role | Path |
|------|------|
| Admin | /admin/dashboard |
| Project Manager | /pm/dashboard |
| Team Member | /team/dashboard |
| Finance | /finance/dashboard |
| Vendor | /vendor/dashboard |

## Password Reset Flow
1. User submits email to `/auth/forgot-password`.
2. Backend creates hashed token (1h expiry) and emails link `${APP_BASE_URL}/reset/<token>` (logged to console if SMTP missing).
3. Frontend verifies token via `GET /auth/reset/:token`.
4. Frontend posts new password to `POST /auth/reset/:token`.

## Tests
Run:
```powershell
npm test
```
Uses in-memory MongoDB; first run may download binaries.

## Error Response Shape
```json
{ "success": false, "message": "Invalid credentials" }
```

## Future Improvements
- Refresh tokens & logout
- Rate limiting on auth endpoints
- Email templates & localization
- Password strength meter API hints

---
}
>>>>>>> ea835d5 (Initial commit (ignored node_modules and .env))
