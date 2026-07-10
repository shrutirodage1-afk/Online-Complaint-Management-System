# OCMC Backend (Online Complaint Management System)

Node.js + Express + MongoDB (Mongoose) REST API. Replaces the old localStorage-only
frontend logic with a real database-backed API so all data (users, complaints,
notifications) is persisted in MongoDB.

## Setup

```bash
cd backend
npm install
cp .env.example .env     # edit MONGO_URI / JWT_SECRET as needed
npm run dev               # or: npm start
```

Requires MongoDB running locally (or a MongoDB Atlas connection string in `MONGO_URI`).

Server runs on `http://localhost:5000` by default.

## Folder structure

```
backend/
  config/db.js            Mongo connection
  models/                 User, Complaint, Notification (Mongoose schemas)
  middleware/auth.js       JWT auth + role guard
  middleware/upload.js     Multer image upload (complaints + avatars)
  routes/authRoutes.js     register/login (user + admin)
  routes/complaintRoutes.js
  routes/userRoutes.js     profile + admin user management
  routes/notificationRoutes.js
  uploads/                 Uploaded images served at /uploads/<file>
  server.js                App entry point
```

## API Reference

### Auth — `/api/auth`
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/register` | - | Register a citizen user |
| POST | `/admin/register` | - | Register an admin |
| POST | `/login` | - | User login → returns JWT |
| POST | `/admin/login` | - | Admin login → returns JWT |

### Complaints — `/api/complaints`
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/` | User | Submit complaint (multipart form, field `image`) |
| GET | `/mine` | User | Get my complaints |
| GET | `/track/:complaintId` | - | Public tracking by complaint ID |
| GET | `/` | Admin | List all complaints |
| GET | `/stats` | Admin | Dashboard counts |
| GET | `/:id` | User/Admin | Get one complaint |
| PATCH | `/:id/status` | Admin | Update complaint status |

### Users — `/api/users`
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/profile` | User | Get my profile |
| PUT | `/profile` | User | Update profile / avatar (multipart, field `avatar`) |
| GET | `/` | Admin | List all users |
| DELETE | `/:id` | Admin | Delete a user |

### Notifications — `/api/notifications`
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/` | User/Admin | List notifications for my role |
| POST | `/` | Admin | Broadcast a notification |

All authenticated routes require header: `Authorization: Bearer <token>`.

## Security notes
- Passwords hashed with bcrypt.
- JWT-based auth (7 day expiry by default).
- Uploaded files validated to images only, 5MB limit.
- Update `JWT_SECRET` and `MONGO_URI` for production; restrict `CLIENT_ORIGIN`.
