# Gym Manager Pro — loyiha konteksti

Artifact: https://claude.ai/artifact/5EP4DT8NH5DwSG1JTrLjtm (oxirgi versiya: v9)
Maqsad: artifactni Node.js + Express + PostgreSQL web dasturga o'tkazish. Reja: [docs/PLAN.md](docs/PLAN.md)

## Sessiya: 2026-10-19 — 2026-10-27

### Artifactda qilingan ishlar (v7 → v9, `legacy/gym-artifact.html`)
- **v7, bug tuzatishlar:**
  - o'lchamlarda o'nlik vergul ("82,5" endi 825 bo'lmaydi);
  - boshqa qurilmada o'chirilgan foydalanuvchi tizimdan chiqariladi;
  - saqlash xatosida cheksiz qayta urinish to'xtatildi;
  - o'chirilgan mahsulotni tahrirlash endi xato beradi;
  - quick check-in ro'yxati har bir render'da yangilanadi.
- **v8:** ≡ tugmasi sidebar'ni har qanday kenglikda yashiradi va ko'rsatadi. Tanlov `PREFS.side` da saqlanadi.
- **v9:** Light/Night pill-switch (`.theme-sw`, `role="switch"`) va topbar'da EN/UZ pereklyuchateli. Sarlavha bir qatorda turadi, joy yetmasa ellipsis bilan kesiladi.

### Web dasturga o'tish
- **Bosqich 0 tayyor:**
  - Node v24, Git 2.56, PostgreSQL 16 (port 5432) o'rnatilgan;
  - git repo yaratildi (`main`).
- **Tuzilma:**
  - `legacy/`: asl HTML;
  - `client/`: frontend (bosqich 1);
  - `server/`: backend (bosqich 3);
  - `docs/`: reja.

### Ma'lum, tuzatilmagan muammolar (artifactda)
- Kunlik shard'lar (`visits`/`txns`/`sales`/`audit`) butunlay `set` bilan yoziladi: ikki qurilma bir vaqtda yozsa, yozuv yo'qolishi mumkin. PostgreSQL'ga o'tganda o'z-o'zidan hal bo'ladi.
- Kelajakdagi `start_date` bilan check-in qilish mumkin: biznes qarori kerak.
- Moliya ro'yxatlari 100 ta yozuv bilan cheklangan, sahifalash yo'q.
- CSV/Excel eksportida formula injection (`=`, `+` bilan boshlanuvchi ism).
- Hozir butun baza (parol hash'lari ham) har bir brauzerga yuklanadi. Shuning uchun web versiyada ruxsatlar serverda bo'lishi shart.

### Muhit eslatmalari
- Tarmoqda ba'zi xorijiy saytlar ochilmaydi: git-scm.com, winget manbasi, postgresql.org sertifikat tekshiruvi. `npm install` muammo bersa: VPN yoki DNS `8.8.8.8`.
- PostgreSQL `postgres` paroli faqat foydalanuvchida. U `server/.env` ga yoziladi va commit qilinmaydi.
- Git remote hali yo'q, GitHub repo yaratilmagan.

## Sessiya: 2026-10-28

- `~/.claude/_domain.md` yangi stack'ka moslab yangilandi.
- GitHub: private repo `Elbek326/Gym__project`, `origin/main` ulandi.
- **Bosqich 1 tayyor** (`d788dec`, `f65a24f`, `4b65787`): `client/` — Vite 8 + vanilla JS ES modullar.
  - `src/core/gym.js` (DOM'siz, `export default GYM`), `i18n/`, `ui/`, `pages/`, `app.js`, `actions.js`, `state.js`, `prefs.js`, `persist.js`.
  - Faqat localStorage (`gympro.v1`); `window.claude` olib tashlandi; yuklab olish Blob + `<a download>` orqali.
  - SheetJS 0.20.3 (cdn.sheetjs.com tarball), faqat eksportda lazy yuklanadi. Asosiy bundle 140 kB.
  - Ishga tushirish: `npm --prefix client run dev` yoki `.claude/launch.json` dagi "client".
- Eslatma: `i18n/uz.js` da shared-database matnlari qoldi (ishlatilmaydi). Member roli bilan kirish va forma tahrirlari alohida sinalmagan.

### Sessiya oxiridagi holat (2026-10-28)
- **Bosqich 2 jarayonda:** agent `client/src/core/__tests__/` da Vitest testlarini yozayotgan edi; `client/package.json` ga vitest qo'shilgan. Sessiya yopilganda bu o'zgarishlar hali commit qilinmagan edi.
- **Push:** GitHub'dagi `main` hali `6740518` da; `d788dec..6b26bf1` (4 commit) push qilinmagan — foydalanuvchining `git push` urinishi o'tmagan.

### Keyingi sessiya shu bilan boshlanadi
1. `git status`: agar testlar commit qilingan bo'lsa (`Bosqich 2: ...`), `npm --prefix client test` bilan tekshirish; aks holda `__tests__/` ni ko'rib chiqib, testlarni tugatish.
2. Test topgan buglar ro'yxatini ko'rib chiqish (`it.fails`/`it.todo` bilan belgilangan).
3. `git push` muammosini hal qilish (terminal xatosini ko'rish).
4. Bosqich 3: Express skeleti va PostgreSQL sxemasi.

## Sessiya: 2026-10-28 (davomi)

- **Bosqich 2 tayyor** (`4a3cf76`): `client/src/core/__tests__/`, 11 fayl, 186 test (Node, DOM'siz). `npm --prefix client test`.
- **Bug tuzatildi** (`fa75b39`): `extendSubscription` rad etilganda obunani o'zgartirmaydi (all-or-nothing).
- **Bosqich 3 tayyor** (`8fa15db`): `server/` — Express 5 + helmet + pg.
  - `GET /api/health`.
  - `migrations/001_init.sql`: 10 jadval; bir kunda bitta check-in va bitta faol obuna baza darajasida kafolatlangan.
  - Skriptlar: `migrate`, `seed` (admin/admin123), `create-db.sql`.
  - Lokal baza: `gym`, foydalanuvchi `gym_app`, parol faqat `server/.env` da.
- **Bosqich 4 tayyor** (`e4f57dc`): `/api/auth/login|logout|me|password`.
  - `migrations/002_sessions.sql`: token httpOnly cookie'da (`gym_sid`), bazada faqat SHA-256 hash.
  - Bloklash: 5 xatodan keyin 30 soniya (IP + username).
  - CSRF: yozuvchi so'rovlar faqat JSON.
  - `requireUser`/`requireAdmin`/`requireStaff` tayyor.
  - 13 server testi.
- Server core'ni `../client/src/core/gym.js` dan import qiladi. Keyinroq umumiy `shared/` papkaga ko'chirish mumkin.
- Push: GitHub `main` = `e4f57dc`.
- Push eslatmasi: cmd'da avval `cd /d "C:\Users\Rustamov Elbek\Desktop\Gym_project_code"` qilish kerak, aks holda `git push` boshqa papkada ishlaydi.

### Keyingi sessiya: bosqich 5
- Biznes qoidalarni API'ga ko'chirish: a'zolar, obuna, check-in, to'lov, do'kon, moliya, audit, foydalanuvchilar, zaxira.
- Core qoidalari serverda ishlaydi. Har bir yozish tranzaksiyada, ruxsatlar middleware'da.
- A'zo faqat o'z profilini oladi.
- Test bazasi: hozir testlar asosiy `gym` bazasida vaqtinchalik `zt...` foydalanuvchilar bilan ishlaydi. Bosqich 5 da alohida `gym_test` bazasini o'ylab ko'rish kerak.

## Sessiya: 2026-10-29

- **Login sahifasi va nom** (`94f1535`, artifact v10, `7dae501`):
  - ilova nomi endi "Bek Sport Gym";
  - login sahifasida xush kelibsiz matni, admin/admin123 ko'rsatmasi olib tashlandi;
  - til tugmalari EN|UZ.
  - `legacy/` endi jonli artifact (v10) bilan bir xil saqlanadi.
- `gym_test` baza yaratildi. **5.1** (`c9441b8`): testlar faqat `gym_test` da ishlaydi; nom boshqacha bo'lsa ishga tushmaydi.
- **5.2** (`d7c67a1`): `server/src/core.js`.
  - Core butun bazani xotirada ushlaydi, chaqiruvlar navbat bilan.
  - O'zgarishlar bitta tranzaksiyada saqlanadi; xatoda xotira qayta yuklanadi.
  - Core'ga `setSessionUser()` qo'shildi.
  - Trade-off: bitta server jarayoni (bitta zal uchun yetarli).
- **5.3–5.6** (`2a839e0`, `13e218d`, `6aa4ce9`, `ceb7e70`): to'liq API (jadvali `server/README.md` da).
  - a'zolar, obuna, check-in, pul, o'lchamlar;
  - do'kon, moliya;
  - dashboard, tahlil, reyting, audit;
  - admin: foydalanuvchilar, zaxira/tiklash, namuna.
  - 52 server testi.
  - Topilgan va tuzatilgan: namunaviy sotuvlarda `by` yo'q edi. Endi majburiy ustunlarga standart qiymat yoziladi (eski zaxiralar uchun ham).
- **Bosqich 5 tayyor.**

### Sessiya oxiridagi holat
- **Bosqich 6 jarayonda** (frontend'ni API'ga ulash). Agent 6a ni boshlagan; commit qilinmagan o'zgarishlar:
  - `client/src/api.js` (yangi), `client/src/persist.js` (o'chirilgan, stage qilingan);
  - `client/src/state.js`, `client/vite.config.js`, `.claude/launch.json`;
  - `server/src/api/members.js`, `server/test/members.api.test.js` (ehtimol `?all=1` yoki `/names`).
- **Push:** `f8bfea6` dan keyingi barcha commit'lar push qilinmagan. GitHub'ga tarmoqdan ulanib bo'lmayotgan edi.

### Keyingi sessiya shu bilan boshlanadi
1. `git status` va `git log`: agent 6a/6b/6c ni commit qilganmi? Qilmagan bo'lsa, o'zgarishlarni ko'rib chiqib, bosqich 6 ni davom ettirish.
2. Ikkala serverni ishga tushirib (`.claude/launch.json`: "server" va "client"), ilovani brauzerda tekshirish.
3. `git push` (avval `cd /d "C:\Users\Rustamov Elbek\Desktop\Gym_project_code"`).
4. Keyin bosqich 7: artifact zaxirasini PostgreSQL'ga import.

### Keyingi sessiya (eski ro'yxat, 1-2 bandlar bajarildi)
1. (Ixtiyoriy) GitHub repo yaratib push qilish.
2. **Bosqich 1:** `legacy/gym-artifact.html` ni `client/` dagi Vite loyihasiga bo'lish:
   - `core/gym.js`, `i18n/`, `ui/`, `pages/`, `styles/`;
   - `localStorage` rejimi;
   - `window.claude` chaqiruvlarini olib tashlash;
   - SheetJS'ni yangi versiyaga almashtirish.
