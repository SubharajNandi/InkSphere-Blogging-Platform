# InkSphere

A full-stack blogging platform: users register, write posts, and comment
on each other's work. Vanilla HTML/CSS/JS frontend, Express + MongoDB
backend.

## Project structure

```
inksphere-blog/
├── backend/
│   ├── config/db.js              MongoDB connection
│   ├── controllers/              Request handlers (auth, post, comment, user)
│   ├── middleware/                auth, admin, error, upload
│   ├── models/                    User, Post, Comment (Mongoose schemas)
│   ├── routes/                    Express routers, mounted under /api
│   ├── uploads/                   Cover images & avatars land here
│   ├── server.js                  App entry point
│   └── .env                       Local secrets (not committed)
│
├── frontend/
│   ├── pages/                     9 HTML pages
│   ├── css/                       6 stylesheets
│   ├── js/                        7 scripts (api.js is the backend bridge)
│   └── assets/                    images / avatars / icons
│
├── package.json
└── .gitignore
```

## Prerequisites

- Node.js 18+
- MongoDB running locally on `mongodb://localhost:27017` (or update
  `MONGO_URI` in `backend/.env` to point elsewhere, e.g. Atlas)

## Setup

```bash
npm install
```

Then check `backend/.env` — the defaults work for local MongoDB, but you
should at minimum replace `JWT_SECRET` with your own random string before
deploying anywhere real:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/inksphere
JWT_SECRET=replace_this_with_a_long_random_string
JWT_EXPIRES_IN=7d
CLIENT_ORIGIN=http://localhost:5000
NODE_ENV=development
```

## Running it

```bash
npm start        # node backend/server.js
# or, with auto-restart on file changes:
npm run dev       # nodemon backend/server.js
```

The server does two jobs at once:
- Serves the API at `http://localhost:5000/api/...`
- Serves the frontend statically, so the whole app is reachable at
  `http://localhost:5000/` (redirects to `/pages/index.html`)

Because both run from the same origin, the frontend's default API base
URL of `/api` just works — no CORS configuration needed for local dev.

## API reference

All routes are prefixed with `/api`. Endpoints marked 🔒 require a
`Authorization: Bearer <token>` header (the token returned by
register/login).

### Auth — `/api/auth`
| Method | Path        | Body                       | Notes |
|--------|-------------|-----------------------------|-------|
| POST   | `/register` | `{ name, email, password }` | Returns `{ token, user }` |
| POST   | `/login`    | `{ email, password }`       | Returns `{ token, user }` |
| POST   | `/logout`   | —                            | Stateless JWT; just acknowledges |
| GET    | `/me` 🔒    | —                            | Returns `{ user }` |

### Posts — `/api/posts`
| Method | Path             | Body / Query                                   | Notes |
|--------|-------------------|--------------------------------------------------|-------|
| GET    | `/`               | `?page&limit&search&tag&author&sort&status`      | Public; defaults to published only |
| GET    | `/:id`            | —                                                  | Public |
| GET    | `/slug/:slug`     | —                                                  | Public |
| POST   | `/` 🔒            | `{ title, content, tags, coverImage, status }`    | |
| PUT    | `/:id` 🔒         | any of the above fields                            | Owner or admin only |
| DELETE | `/:id` 🔒         | —                                                  | Owner or admin only |
| GET    | `/me/all` 🔒      | `?sort`                                            | Your own posts, any status |
| POST   | `/:id/like` 🔒    | —                                                  | Toggles like |
| POST   | `/upload` 🔒      | multipart `cover` field                            | Returns `{ url }` |

### Comments — `/api/comments`
| Method | Path                  | Body                  | Notes |
|--------|------------------------|-------------------------|-------|
| GET    | `/post/:postId`        | —                       | Public |
| POST   | `/post/:postId` 🔒     | `{ content }`           | |
| PUT    | `/:commentId` 🔒       | `{ content }`           | Owner only |
| DELETE | `/:commentId` 🔒       | —                       | Comment owner, post owner, or admin |

### Users — `/api/users`
| Method | Path               | Body                                    | Notes |
|--------|---------------------|--------------------------------------------|-------|
| GET    | `/:idOrUsername`    | —                                          | Public; personalized `isFollowing` if logged in |
| PUT    | `/me` 🔒            | `{ name, bio, avatarUrl }`                 | |
| PUT    | `/me/password` 🔒   | `{ currentPassword, newPassword }`         | |
| POST   | `/me/avatar` 🔒     | multipart `avatar` field                   | Returns `{ url }` |
| DELETE | `/me` 🔒            | —                                          | Deletes account + their posts/comments |
| POST   | `/:id/follow` 🔒    | —                                          | |
| DELETE | `/:id/follow` 🔒    | —                                          | |

## Security notes

- Passwords are hashed with bcrypt; the raw password is never stored or
  returned by the API.
- JWTs are signed with `JWT_SECRET` from `.env` and expire after
  `JWT_EXPIRES_IN` (7 days by default).
- `backend/.env` is git-ignored — never commit real secrets. Rotate
  `JWT_SECRET` before any production deploy.
- Uploaded files are validated by extension and capped at 5MB
  (`backend/middleware/uploadMiddleware.js`).
- `cors()` is locked to `CLIENT_ORIGIN` rather than left open — update
  that value if you deploy the frontend on a different domain.

## What's not included

- Image storage is local disk (`backend/uploads/`), fine for development
  but not for most production deployments — swap in S3/Cloudinary by
  changing the multer storage engine in `uploadMiddleware.js`.
- No email verification / password reset flow yet (`forgotPassword` /
  `resetPassword` exist as stubs on the frontend's `api.js` but have no
  matching backend route).
- No rate limiting on auth endpoints — worth adding (e.g. `express-rate-limit`)
  before any public deployment.

© 2026 InkSphere. All rights reserved\
By SUBHARAJ NANDI
