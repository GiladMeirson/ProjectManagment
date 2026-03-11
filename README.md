# Project Management Server — API Reference

A Node.js / Express REST API backed by **Microsoft SQL Server** (via stored procedures).  
All request and response bodies are **JSON**. CORS is enabled for all origins.

---

## Table of Contents

- [Getting Started](#getting-started)
- [Base URL](#base-url)
- [Projects Endpoints](#projects-endpoints)
  - [GET /projects](#get-projects)
  - [POST /create/project](#post-createproject)
  - [POST /projects/update](#post-projectsupdate)
  - [POST /projects/getCommentsByProjectId](#post-projectsgetcommentsbyprojectid)
  - [POST /projects/addComment](#post-projectsaddcomment)
  - [POST /projects/updateComment](#post-projectsupdatecomment)
- [Users Endpoints](#users-endpoints)
  - [POST /users/signup](#post-userssignup)
  - [POST /users/signin](#post-userssignin)
  - [GET /users/names](#get-usersnames)
  - [POST /users/update](#post-usersupdate)
- [Test Endpoint](#test-endpoint)
- [Error Responses](#error-responses)

---

## Getting Started

```bash
npm install
npm start          # runs node server.js
```

Create a `.env` file in the project root and set your database connection variables (used by `repositories/sqlConfig.js`).

---

## Base URL

```
http://localhost:3000
```

---

## Projects Endpoints

### GET /projects

Returns all non-deleted projects, each including the most recent comment.

**Request:** No body required.

**Response `200`:**

```json
[
  {
    "ProjectId": 1,
    "ProjectNumber": "PROJ-001",
    "ProjectName": "My Project",
    "Priority": "High",
    "AssignedTo": "John Doe",
    "Status": "In Progress",
    "Chachi": false,
    "ChachiIsExecuted": false,
    "Bezeq": true,
    "BezeqIsExecuted": false,
    "Hot": false,
    "HotIsExecuted": false,
    "LastUpdated": 1709900000000,
    "IsDeleted": false,
    "LastCommentId": 5,
    "LastCommentText": "Waiting for approval",
    "LastCommentUserName": "Jane",
    "LastCommentUserRole": "Admin",
    "LastCommentCreatedAt": 1709900000000
  }
]
```

> `LastUpdated` and `LastCommentCreatedAt` are Unix timestamps in **milliseconds**.  
> Comment fields (`LastCommentId`, etc.) will be `null` when no comments exist.

---

### POST /create/project

Creates a new project and optionally attaches an initial comment.

**Request Body:**

| Field              | Type    | Required | Constraints                        |
| ------------------ | ------- | -------- | ---------------------------------- |
| `ProjectNumber`    | string  | ✅       | max 50 chars                       |
| `ProjectName`      | string  | ✅       | max 255 chars                      |
| `Priority`         | string  | ✅       | max 100 chars                      |
| `AssignedTo`       | string  | ✅       | max 100 chars                      |
| `Status`           | string  | ✅       | max 255 chars                      |
| `Chachi`           | boolean | ✅       | `true`/`false` or `1`/`0`          |
| `ChachiIsExecuted` | boolean | ✅       | `true`/`false` or `1`/`0`          |
| `Bezeq`            | boolean | ✅       | `true`/`false` or `1`/`0`          |
| `BezeqIsExecuted`  | boolean | ✅       | `true`/`false` or `1`/`0`          |
| `Hot`              | boolean | ✅       | `true`/`false` or `1`/`0`          |
| `HotIsExecuted`    | boolean | ✅       | `true`/`false` or `1`/`0`          |
| `InitialComment`   | string  | ❌       | optional; creates a first comment  |
| `UserId`           | integer | ❌       | positive integer; used for comment |
| `UserName`         | string  | ❌       | max 150 chars; used for comment    |
| `UserRole`         | string  | ❌       | max 100 chars; used for comment    |

**Example Request Body:**

```json
{
  "ProjectNumber": "PROJ-001",
  "ProjectName": "New Website",
  "Priority": "High",
  "AssignedTo": "John Doe",
  "Status": "Open",
  "Chachi": false,
  "ChachiIsExecuted": false,
  "Bezeq": true,
  "BezeqIsExecuted": false,
  "Hot": false,
  "HotIsExecuted": false,
  "InitialComment": "Project kicked off",
  "UserId": 3,
  "UserName": "Jane",
  "UserRole": "Admin"
}
```

**Response `200`:**

```json
{ "NewProjectId": 42 }
```

---

### POST /projects/update

Updates all fields of an existing project.

**Request Body:**

| Field              | Type    | Required | Notes                              |
| ------------------ | ------- | -------- | ---------------------------------- |
| `ProjectId`        | integer | ✅       | positive integer                   |
| `ProjectNumber`    | string  | ✅       |                                    |
| `ProjectName`      | string  | ✅       |                                    |
| `Priority`         | string  | ✅       |                                    |
| `AssignedTo`       | string  | ✅       |                                    |
| `Status`           | string  | ✅       |                                    |
| `Chachi`           | boolean | ✅       |                                    |
| `ChachiIsExecuted` | boolean | ✅       |                                    |
| `Bezeq`            | boolean | ✅       |                                    |
| `BezeqIsExecuted`  | boolean | ✅       |                                    |
| `Hot`              | boolean | ✅       |                                    |
| `HotIsExecuted`    | boolean | ✅       |                                    |
| `LastUpdated`      | integer | ✅       | Unix timestamp in ms               |
| `IsDeleted`        | boolean | ✅       | `false` = active, `true` = deleted |

**Example Request Body:**

```json
{
  "ProjectId": 42,
  "ProjectNumber": "PROJ-001",
  "ProjectName": "Updated Website",
  "Priority": "Medium",
  "AssignedTo": "Jane Doe",
  "Status": "In Progress",
  "Chachi": false,
  "ChachiIsExecuted": false,
  "Bezeq": true,
  "BezeqIsExecuted": true,
  "Hot": false,
  "HotIsExecuted": false,
  "LastUpdated": 1709900000000,
  "IsDeleted": false
}
```

**Response `200`:**

```json
{ "RowsUpdated": 1 }
```

**Response `404`:** Project not found or no changes were made.

---

### POST /projects/getCommentsByProjectId

Returns all comments for a given project.

**Request Body:**

| Field       | Type    | Required |
| ----------- | ------- | -------- |
| `projectId` | integer | ✅       |

**Example Request Body:**

```json
{ "projectId": 42 }
```

**Response `200`:**

```json
[
  {
    "CommentId": 5,
    "ProjectId": 42,
    "ProjectNumber": "PROJ-001",
    "CommentText": "Waiting for approval",
    "UserId": 3,
    "UserName": "Jane",
    "UserRole": "Admin",
    "CreatedAt": 1709900000000,
    "IsDeleted": false
  }
]
```

---

### POST /projects/addComment

Adds a new comment to a project. The user's name and role are resolved automatically from the database using `UserId`.

**Request Body:**

| Field         | Type    | Required | Constraints      |
| ------------- | ------- | -------- | ---------------- |
| `ProjectId`   | integer | ✅       | positive integer |
| `CommentText` | string  | ✅       | non-empty string |
| `UserId`      | integer | ✅       | positive integer |

**Example Request Body:**

```json
{
  "ProjectId": 42,
  "CommentText": "Phase 1 completed.",
  "UserId": 3
}
```

**Response `201`:**

```json
{
  "CommentId": 6,
  "ProjectId": 42,
  "ProjectNumber": "PROJ-001",
  "CommentText": "Phase 1 completed.",
  "UserId": 3,
  "UserName": "Jane",
  "UserRole": "Admin",
  "CreatedAt": 1709900000000,
  "IsDeleted": false
}
```

**Response `404`:** Project or user not found.

---

### POST /projects/updateComment

Updates or soft-deletes an existing comment.

**Request Body:**

| Field         | Type    | Required | Notes                             |
| ------------- | ------- | -------- | --------------------------------- |
| `CommentId`   | integer | ✅       | positive integer                  |
| `ProjectId`   | integer | ✅       |                                   |
| `CommentText` | string  | ✅       |                                   |
| `UserId`      | integer | ✅       |                                   |
| `IsDeleted`   | boolean | ✅       | `true` to soft-delete the comment |

**Example Request Body:**

```json
{
  "CommentId": 6,
  "ProjectId": 42,
  "CommentText": "Phase 1 completed and reviewed.",
  "UserId": 3,
  "IsDeleted": false
}
```

**Response `200`:**

```json
{ "RowsUpdated": 1 }
```

**Response `404`:** Comment not found or no changes were made.

---

## Users Endpoints

### POST /users/signup

Registers a new user. Returns an error if the email is already taken.

**Request Body:**

| Field         | Type   | Required | Notes          |
| ------------- | ------ | -------- | -------------- |
| `email`       | string | ✅       | must be unique |
| `password`    | string | ✅       |                |
| `userName`    | string | ✅       | max 100 chars  |
| `permissions` | string | ✅       |                |
| `Role`        | string | ✅       | max 50 chars   |

**Example Request Body:**

```json
{
  "email": "jane@example.com",
  "password": "secret123",
  "userName": "Jane",
  "permissions": "read,write",
  "Role": "Admin"
}
```

**Response `201` — Success:**

```json
{
  "message": "User created successfully!",
  "user": {
    "UserId": 7,
    "Message": "SUCCESS"
  }
}
```

**Response `201` — Email already exists:**

```json
{
  "message": "User created successfully!",
  "user": {
    "UserId": -1,
    "Message": "EMAIL_ALREADY_EXISTS"
  }
}
```

> Always check `user.Message` to determine whether registration actually succeeded.

---

### POST /users/signin

Authenticates a user and updates `LastLogin` on success.

**Request Body:**

| Field      | Type   | Required |
| ---------- | ------ | -------- |
| `email`    | string | ✅       |
| `password` | string | ✅       |

**Example Request Body:**

```json
{
  "email": "jane@example.com",
  "password": "secret123"
}
```

**Response `200` — Success:**

```json
{
  "message": "Sign in successful!",
  "user": {
    "UserId": 7,
    "UserName": "Jane",
    "Email": "jane@example.com",
    "Role": "Admin",
    "Permissions": "read,write",
    "Message": "SUCCESS"
  }
}
```

**Response `401` — Invalid credentials:**

```json
{ "message": "Invalid email or password." }
```

---

### GET /users/names

Returns a flat array of all registered user names.

**Request:** No body required.

**Response `200`:**

```json
["Jane", "John", "Bob"]
```

---

### POST /users/update

Updates an existing user's details.

**Request Body:**

| Field         | Type    | Required | Notes         |
| ------------- | ------- | -------- | ------------- |
| `userId`      | integer | ✅       |               |
| `email`       | string  | ✅       |               |
| `password`    | string  | ✅       |               |
| `userName`    | string  | ✅       | max 200 chars |
| `permissions` | integer | ✅       |               |
| `Role`        | string  | ✅       | max 50 chars  |

**Example Request Body:**

```json
{
  "userId": 7,
  "email": "jane@example.com",
  "password": "newSecret456",
  "userName": "Jane Doe",
  "permissions": 3,
  "Role": "Manager"
}
```

**Response `200`:**

```json
{
  "message": "User updated successfully!",
  "result": { "RowsUpdated": 1 }
}
```

**Response `404`:** User not found.

---

## Test Endpoint

### GET /testing/test

Health-check endpoint to verify the server is running.

**Request:** No body required.

**Response `200`:**

```json
{
  "message": "Test endpoint working!",
  "status": "success",
  "requestedAt": "2026-03-08T10:00:00.000Z",
  "requestInfo": {
    "method": "GET",
    "url": "/testing/test",
    "headers": { "...": "..." }
  }
}
```

---

## Error Responses

All endpoints return errors in a consistent JSON format:

| Status | Meaning                      | Example body                                               |
| ------ | ---------------------------- | ---------------------------------------------------------- |
| `400`  | Validation / missing fields  | `{ "message": "Missing required fields: Status" }`         |
| `401`  | Unauthorized (sign-in only)  | `{ "message": "Invalid email or password." }`              |
| `404`  | Record not found / no change | `{ "message": "Project not found or no changes made" }`    |
| `500`  | Internal server error        | `{ "message": "Internal server error. in insertProject" }` |
