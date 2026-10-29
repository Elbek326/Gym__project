# Gym Manager Pro — frontend (client)

Vite + vanilla JS (ES modullar). Ma'lumotlar serverda (PostgreSQL); brauzerda baza nusxasi yo'q, faqat
sozlamalar (`gym_prefs`). Dev rejimida `/api` so'rovlari Vite orqali `http://localhost:3000` ga yo'naltiriladi:
serverni ham ishga tushiring (`npm --prefix server run dev`).

## Ishga tushirish

```bash
cd client
npm install        # bir marta
npm run dev        # http://localhost:5173
npm run build      # production build -> client/dist
npm run preview    # build natijasini tekshirish
```

Birinchi kirish: foydalanuvchi `admin`, parol `admin123` (kirgach "Mening parolim" bo'limida o'zgartiring).

## Tuzilma

- `src/core/gym.js` — biznes qoidalar (DOM'siz; keyin serverda ham ishlatiladi)
- `src/i18n/` — tarjima mexanizmi (`i18n.js`) va o'zbekcha lug'at (`uz.js`)
- `src/pages/` — sahifalar, `src/ui/` — umumiy UI yordamchilar
- `src/actions.js` — tugma amallari, `src/app.js` — routing, mavzu, login, boot
- `src/styles/themes.css` — generatsiya qilingan (`gen_themes.py`), qo'lda tahrirlanmaydi

## Excel eksport

`xlsx` (SheetJS) npm orqali emas, rasmiy `cdn.sheetjs.com` tarball'idan o'rnatilgan (0.20.3), chunki npm'dagi
`xlsx` 0.18.5 da ma'lum zaifliklar bor. Kutubxona faqat eksport bosilganda yuklanadi (alohida chunk).
