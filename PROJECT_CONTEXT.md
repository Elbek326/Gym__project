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

### Keyingi sessiya (eski ro'yxat, 1-2 bandlar bajarildi)
1. (Ixtiyoriy) GitHub repo yaratib push qilish.
2. **Bosqich 1:** `legacy/gym-artifact.html` ni `client/` dagi Vite loyihasiga bo'lish:
   - `core/gym.js`, `i18n/`, `ui/`, `pages/`, `styles/`;
   - `localStorage` rejimi;
   - `window.claude` chaqiruvlarini olib tashlash;
   - SheetJS'ni yangi versiyaga almashtirish.
