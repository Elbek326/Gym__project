# Deploy: Render (ilova) + Neon (baza)

Bitta Render "Web Service" ham web sahifani (`client/dist`), ham API'ni beradi. Baza esa Neon'da.

## 1. Neon: baza

1. https://neon.tech: GitHub bilan kiring, **Create project**.
   - Postgres 16.
   - Region: Yevropa (masalan Frankfurt).
2. **Connection string** ni nusxalang: `postgresql://...neon.tech/...?sslmode=require`.
   - Bu sir, hech kimga bermang va repoga yozmang.

## 2. Render: Web Service

New → Web Service → GitHub'dagi `Gym__project` (private bo'lsa ham bo'ladi).

| Maydon | Qiymat |
|---|---|
| Root Directory | *(bo'sh)* |
| Runtime | Node |
| Build Command | `npm run build` |
| Start Command | `npm start` |
| Instance Type | Free |

Environment Variables:

| KEY | VALUE |
|---|---|
| `DATABASE_URL` | Neon connection string |
| `NODE_ENV` | `production` |

`PORT` ni yozmang: Render o'zi beradi. Node versiyasi `.nvmrc` dan olinadi.

## 3. Birinchi ishga tushish

Server har ishga tushganda migratsiyalarni qo'llaydi. Baza bo'sh bo'lsa, birinchi adminni **tasodifiy parol** bilan yaratadi:

- Render → Logs bo'limida `First admin created. Username: admin Password: ...` qatorini toping.
- Shu parol bilan kiring va darhol **Mening parolim** bo'limida almashtiring.
- Parol log'da faqat bir marta ko'rinadi.

Tekshiruv: `https://<nom>.onrender.com/api/health` → `{"ok":true,"db":true}`.

## Bepul tarif cheklovlari

- Render free: 15 daqiqa so'rov bo'lmasa uxlaydi, birinchi ochilish 30–60 soniya. Ma'lumot yo'qolmaydi, chunki u Neon'da turadi.
- Render'ning o'z bepul Postgres'i 30 kunda o'chiriladi, shuning uchun u ishlatilmaydi.
- Ikkala xizmat ham xorijda: zal rasman ishlay boshlaganda mahalliy VPS'ga ko'chish rejalashtiriladi (shaxsiy ma'lumotlar qonuni).
