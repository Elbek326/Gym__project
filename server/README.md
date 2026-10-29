# Gym Manager Pro — server

Node.js + Express + PostgreSQL. Biznes qoidalar va ruxsatlar shu yerda tekshiriladi.

## Birinchi marta sozlash

1. Baza foydalanuvchisi va bazani yaratish. Bu buyruqni loyiha papkasida bir marta ishga tushiring:
   - `postgres` paroli so'raladi;
   - `YOUR_PASSWORD` o'rniga ilova uchun yangi parol yozing.
   ```
   "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -v app_password="YOUR_PASSWORD" -f server/scripts/create-db.sql
   ```
2. `server/.env.example` faylini `server/.env` ga nusxalang. `DATABASE_URL` dagi `CHANGE_ME` o'rniga 1-qadamdagi parolni yozing.
3. Paketlarni o'rnatish, jadvallarni yaratish va birinchi adminni qo'shish:
   ```
   npm --prefix server install
   npm --prefix server run migrate
   npm --prefix server run seed
   ```

## Ishga tushirish

- `npm --prefix server run dev`: fayl o'zgarsa, server avtomatik qayta yonadi.
- http://localhost:3000/api/health manziliga kirsangiz `{"ok":true,"db":true}` chiqishi kerak.
- `npm --prefix server test`: testlarni ishga tushiradi. Baza testi faqat `.env` bo'lsa ishlaydi.

## Migratsiyalar

- Migratsiyalar `migrations/NNN_nom.sql` fayllarida turadi. Har biri faqat bir marta, raqam tartibida qo'llanadi.
- Qaysi migratsiyalar qo'llanganligi `schema_migrations` jadvalida yoziladi.
- Qo'llangan faylni o'zgartirmang. Sxemani o'zgartirish kerak bo'lsa, keyingi raqam bilan yangi fayl qo'shing.

## API (bosqich 5)

Hammasi JSON. Ma'lumot o'zgartiruvchi so'rovlar `Content-Type: application/json` bo'lishi shart.

| Yo'l | Kim |
|---|---|
| `POST /api/auth/login`, `/logout`, `/password`; `GET /api/auth/me` | hamma / kirgan |
| `GET,POST /api/members`; `GET,PUT,DELETE /api/members/:id` | xodim (GET `/:id`: a'zo o'zinikini) |
| `POST /api/members/:id/subscriptions`, `/subscriptions/extend`, `/freeze`, `/unfreeze` | xodim |
| `POST /api/members/:id/checkin`, `/payments`, `/charges`, `/debt-adjustments`, `/measurements` | xodim |
| `GET /api/members/:id/login`, `POST /api/members/:id/login/password`; `DELETE /api/measurements/:id` | xodim |
| `GET /api/shop`; `POST,PUT,DELETE /api/shop/products[/:id]`; `POST /products/:id/sales`, `/restock` | xodim |
| `GET /api/finance?month=YYYY-MM`; `POST,DELETE /api/finance/expenses`, `/income` | xodim |
| `GET /api/dashboard`, `/api/analytics?month=`, `/api/audit?q=&page=` | xodim |
| `GET /api/rankings` | kirgan (a'zo: pulsiz, faqat o'z rasmi) |
| `GET,POST /api/admin/users`, `PUT /users/:id/role`, `POST /users/:id/password`, `DELETE /users/:id` | admin |
| `GET /api/admin/backup`, `POST /api/admin/backup/restore`, `POST,DELETE /api/admin/sample` | admin |
