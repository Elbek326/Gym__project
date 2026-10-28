# Artifact → web dastur: reja

Stack: Vite + vanilla JS (frontend), Node.js + Express (backend), PostgreSQL (baza).

Asosiy tamoyil: biznes qoidalar va ruxsatlar serverda. Brauzer faqat o'ziga ruxsat berilgan ma'lumotni oladi,
parol hash'i hech qachon brauzerga bormaydi.

| # | Bosqich | Natija | Holat |
|---|---|---|---|
| 0 | Tayyorgarlik: papka, git, Node.js, PostgreSQL | Repo bor, `node -v` ishlaydi | tayyor |
| 1 | Frontend'ni Vite loyihasiga bo'lish (localStorage rejimida) | `npm run dev` artifactdagidek ishlaydi | tayyor |
| 2 | `GYM` core uchun Vitest testlari | Testlar o'tadi | — |
| 3 | Express skeleti, PostgreSQL sxema, migratsiyalar | `GET /api/health`, jadvallar yaratiladi | — |
| 4 | Serverda auth (sessiya cookie, bloklash, rollar) | Hash brauzerga bormaydi | — |
| 5 | API: biznes qoidalar serverga | Barcha amallar API orqali | — |
| 6 | Frontend'ni API'ga ulash | Ikki brauzer bir vaqtda, ma'lumot yo'qolmaydi | — |
| 7 | Artifact zaxira JSON'ini PostgreSQL'ga import | Eski ma'lumot yangi tizimda | — |
| 8 | Deploy: domen, HTTPS, Docker, kundalik zaxira | Internet orqali ishlaydi | — |
| 9 | Ixtiyoriy: PWA, real-time (SSE), monitoring | — | — |

Eslatma: a'zolarning ism va telefonlari shaxsiy ma'lumot. Ishga tushirishdan oldin
"Shaxsga doir ma'lumotlar to'g'risida"gi qonun (27¹-modda, ma'lumotni O'zbekistondagi serverda saqlash) talabini tekshiring.
