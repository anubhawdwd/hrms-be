# HRMS LAN Pilot Deployment Guide (DEV-02)

> **Deployment Profile:**  
> • **Environment:** Internal LAN (100 Employees, 2–3 month pilot)  
> • **Protocol:** HTTP Only (No HTTPS / TLS — HTTPS deferred)  
> • **Architecture:** PostgreSQL + Node.js (Express/Socket.IO) + Nginx / Vite Frontend  

---

## 1. Prerequisites
Ensure the following packages are installed on the host server (e.g. Ubuntu 22.04 / Debian):
* Node.js `>= 20.x` & npm `>= 10.x`
* PostgreSQL `>= 15.x` & `postgresql-client` (for `pg_dump`)
* Nginx (for reverse proxy & static hosting)
* PM2 (for persistent Node process management): `npm install -g pm2`

---

## 2. Step 1 — Generate Cryptographically Secure JWT Secrets
Generate two 256-bit high-entropy secrets on your terminal:

```bash
openssl rand -base64 32
openssl rand -base64 32
```

---

## 3. Step 2 — Backend Configuration (`hrms-be/.env`)
Create or edit `/path/to/hrms-be/.env`. Replace `192.168.1.185` with your server's actual static LAN IP:

```ini
# Environment Mode
NODE_ENV=production

# ⚠️ CRITICAL: Must be false for HTTP-only LAN deployment.
# If set to true over plain HTTP, browsers will reject refresh cookies, causing unexpected logouts.
COOKIE_SECURE=false

# LAN Server IP & Dynamic CORS
LAN_SERVER_IP=192.168.1.185
FRONTEND_URL=http://192.168.1.185:5173,http://192.168.1.185

# Server Port & Binding
API_PORT=4000
API_HOST=0.0.0.0

# Database Connection
DATABASE_URL=postgresql://hrms_user:your_secure_password@localhost:5432/hrms_prod

# High-Entropy JWT Secrets (from Step 1)
JWT_ACCESS_SECRET=YOUR_GENERATED_SECRET_1
JWT_REFRESH_SECRET=YOUR_GENERATED_SECRET_2
```

---

## 4. Step 3 — Database Migration
Run the production migration command:

```bash
cd /path/to/hrms-be
npm install --production=false
npx prisma migrate deploy
```

> ⚠️ **CAUTION:** NEVER run `npx prisma migrate dev` on a production database. `migrate dev` can detect schema drift and prompt to reset/wipe existing tenant data. Always use `npx prisma migrate deploy`.

---

## 5. Step 4 — Frontend Build (`hrms-fe`)
Configure the frontend to point to the backend API and build production assets:

```bash
cd /path/to/hrms-fe
echo "VITE_API_BASE_URL=http://192.168.1.185:4000" > .env.production
npm install
npm run build
```

---

## 6. Step 5 — Nginx Configuration
Create an Nginx configuration `/etc/nginx/sites-available/hrms.conf`:

```nginx
server {
    listen 80;
    server_name 192.168.1.185;

    # Frontend Static Assets
    location / {
        root /path/to/hrms-fe/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Backend REST API
    location /api/ {
        proxy_pass http://127.0.0.1:4000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket (Socket.IO)
    location /socket.io/ {
        proxy_pass http://127.0.0.1:4000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400;
    }
}
```

Enable and reload Nginx:
```bash
sudo ln -sf /etc/nginx/sites-available/hrms.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 7. Step 6 — Start Backend Process (PM2)
Start and persist the backend application:

```bash
cd /path/to/hrms-be
pm2 start ./src/server.ts --name "hrms-be" --interpreter "tsx"
pm2 save
pm2 startup
```

---

## 8. Step 7 — Pre-Flight LAN Verification Checklist
Before opening access to the 100 pilot employees, execute this verification from a **second machine / mobile device on the office LAN** (NOT localhost):

- [ ] Open `http://<SERVER_IP>` in browser on secondary laptop/phone.
- [ ] Log in with employee / admin credentials.
- [ ] Open Browser DevTools -> **Application / Storage** -> **Cookies**:
  - Verify `hrms_refresh_token` is present.
  - Verify `Secure` column is **UNCHECKED / False** (required for plain HTTP).
  - Verify `SameSite` is **Lax** (not None).
- [ ] Hard refresh the browser (`Cmd+Shift+R` / `Ctrl+F5`) -> verify session stays active without prompting for login.
- [ ] Test attendance Check-In / Check-Out and leave application.
- [ ] Verify real-time notification bell and toast updates live.

---

## 9. Step 8 — Automated Daily Database Backup
Ensure database snapshots are captured daily and retained for 30 days.

1. Create a logs directory:
   ```bash
   mkdir -p /path/to/hrms-be/logs
   ```

2. Test the backup script:
   ```bash
   /path/to/hrms-be/scripts/backup-db.sh
   ```

3. Configure a daily cron job at 2:00 AM:
   ```bash
   crontab -e
   ```
   Add the following entry:
   ```cron
   0 2 * * * /path/to/hrms-be/scripts/backup-db.sh >> /path/to/hrms-be/logs/backup.log 2>&1
   ```

4. Backups will automatically be saved to `/path/to/hrms-be/backups/` as compressed `.sql.gz` archives with automatic 30-day rotation.
