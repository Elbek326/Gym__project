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
