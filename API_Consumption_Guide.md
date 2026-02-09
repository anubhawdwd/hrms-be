# 📘 HRMS Backend API – Consumption Guide

**Base URL**

```
http://localhost:4000

```

**All requests and responses use JSON unless specified.**

---

## 🔐 Authentication & Headers (Global Rules)

### Authorization Header (JWT)

Required for all protected APIs:

```
Authorization: Bearer <ACCESS_TOKEN>

```

### Company Context Header

Required for **company-scoped APIs**:

```
x-company-id: <COMPANY_ID>

```

> 🔒 `companyId` is validated against JWT internally for tenant isolation.

---

## 🟢 System Health

### GET `/health`

Check backend availability.

**Headers:** none
**Response:** `200 OK`

---

## 🔑 AUTH MODULE

### Login (Email + Password)

#### POST `/api/auth/login`

**Body**

```json
{
  "email": "user@company.com",
  "password": "password"
}

```

### Google Login

#### POST `/api/auth/google`

**Body**

```json
{ "idToken": "google-id-token" }

```

### Microsoft Login

#### POST `/api/auth/microsoft`

**Body**

```json
{ "accessToken": "microsoft-access-token" }

```

### Get Logged-in User

#### GET `/api/auth/me`

### Refresh Access Token

#### POST `/api/auth/refresh`

**Cookies:** `refreshToken` (httpOnly)

---

## 🏢 COMPANY MODULE

### Create Company

#### POST `/api/company/`

**Body:** `{ "name": "HRMS Pvt Ltd" }`

### Get All Companies

#### GET `/api/company/`

### Get Company by ID

#### GET `/api/company/{companyId}`

### Update Company

#### PATCH `/api/company/{companyId}`

---

## 👥 USER MANAGEMENT

### Create User

#### POST `/api/users/`

**Body**

```json
{
  "email": "employee@company.com",
  "authProvider": "LOCAL",
  "role": "EMPLOYEE"
}

```

### User Operations

* **GET** `/api/users/` — List all users in company.
* **PATCH** `/api/users/{userId}` — Update user details.
* **DELETE** `/api/users/{userId}` — Remove user.

---

## 🧑‍💼 EMPLOYEES

### Employee Records

* **POST** `/api/employees/` — Create employee profile.
* **GET** `/api/employees/` — List employees.
* **GET** `/api/employees/me` — Get own record.
* **GET** `/api/employees/{employeeId}` — Get specific employee.
* **DELETE** `/api/employees/{employeeId}` — Remove employee.

### Profile & Hierarchy

* **PUT** `/api/employees/me/profile` — Update own profile.
* **PUT** `/api/employees/{employeeId}/admin` — Administrative update.
* **PATCH** `/api/employees/{employeeId}/manager`
**Body:** `{ "managerId": "uuid" }`

---

## 🏗 ORGANIZATION STRUCTURE

### Departments, Teams & Designations

All follow standard CRUD patterns:

* **POST** `/api/organization/{resource}` — Create.
* **GET** `/api/organization/{resource}` — List.
* **PATCH** `/api/organization/{resource}/{id}` — Update.
* **DELETE** `/api/organization/{resource}/{id}` — Delete.

### Designation Attendance Policy

#### POST `/api/organization/designation-attendance-policy`

**Body**

```json
{
  "designationId": "uuid",
  "autoPresent": true,
  "attendanceExempt": false
}

```

#### GET `/api/organization/designation-attendance-policy`

#### GET `/api/organization/designation-attendance-policy/{designationId}`

### Office Location (Geo-fencing)

#### POST / PUT `/api/organization/office-location`

**Body**

```json
{
  "latitude": 19.076,
  "longitude": 72.8777,
  "radiusM": 200
}

```

---

## ⏱ ATTENDANCE

### Check-in / Check-out

#### POST `/api/attendance/check-in`

#### POST `/api/attendance/check-out`

**Body**

```json
{
  "employeeId": "uuid",
  "source": "MOBILE",
  "location": "OFFICE"
}

```

### Retrieval

* **GET** `/api/attendance/day?employeeId=uuid&date=YYYY-MM-DD`
* **GET** `/api/attendance/range?employeeId=uuid&from=YYYY-MM-DD&to=YYYY-MM-DD`
* **GET** `/api/attendance/violations` — Returns late/missing entries.

### Employee Attendance Override

#### POST `/api/attendance/employee-override`

**Body**

```json
{
  "employeeId": "uuid",
  "autoPresent": true,
  "attendanceExempt": false,
  "reason": "On-site duty",
  "validFrom": "ISO-DATE",
  "validTo": "ISO-DATE"
}

```

### HR Attendance Controls

* **POST** `/api/attendance/hr/attendance-day` — Force create a day record.
* **POST** `/api/attendance/hr/attendance-event` — Log manual check-in/out events.
* **PATCH** `/api/attendance/hr/attendance-day/{attendanceDayId}`
**Body:** `{ "status": "PRESENT", "totalMinutes": 480 }`

---

## 🔐 Role & Security Summary

| Role | Scope | Permission Description |
| --- | --- | --- |
| **SUPER_ADMIN** | Platform | Manage Companies, Global Settings |
| **COMPANY_ADMIN** | Company | Full control over organization & users |
| **HR** | Company | Attendance overrides & employee profiles |
| **EMPLOYEE** | Self | View own profile, Check-in/out |

---

## ✅ Frontend Integration Best Practices

* **Token Handling**: Store access token in memory; handle `401` errors by hitting `/api/auth/refresh`.
* **State Management**: Call `/auth/me` on initial app load to establish user context and role.
* **Tenant Safety**: Ensure the `x-company-id` header is consistently applied to all organization and attendance calls.

Would you like me to generate a **Zod or Typescript Interface schema** for these request bodies to help your frontend developers?