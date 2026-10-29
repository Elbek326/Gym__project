import I18N from './i18n.js';

/* ===== Uzbek (Latin) texts for I18N =====
   DICT: exact English text -> Uzbek.  PATS: text with names or numbers.  TPL: bold-part sentences. */
(function () {
  var D = I18N.DICT, P = I18N.PATS, TP = I18N.TPL;
  function add(o) { for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) D[k] = o[k]; }

  add({
    /* navigation and pages */
    "Dashboard": "Boshqaruv paneli", "Members": "A'zolar", "Member": "A'zo", "Shop": "Do'kon", "Finance": "Moliya", "Analytics": "Tahlil",
    "Rankings": "Reyting", "Audit Log": "Harakatlar jurnali", "User Roles": "Foydalanuvchi rollari", "My Password": "Mening parolim", "Settings": "Sozlamalar",
    "Main navigation": "Asosiy menyu", "Open menu": "Menyuni ochish", "Close menu": "Menyuni yopish",
    "Opening Bek Sport Gym": "Bek Sport Gym ochilmoqda", "Try again": "Qayta urinish", "Work in this browser only": "Faqat shu brauzerda ishlash",
    "Could not reach the shared database.": "Umumiy ma'lumotlar bazasiga ulanib bo'lmadi.",
    "Could not reach the server.": "Serverga ulanib bo'lmadi.", "Online": "Onlayn", "Data is saved on the server.": "Ma'lumotlar serverda saqlanadi.",
    "Loading": "Yuklanmoqda", "Could not load this page": "Sahifani yuklab bo'lmadi", "Internal server error": "Server xatosi", "Not found": "Topilmadi",

    /* login */
    "Sign in": "Kirish", "Sign out": "Chiqish", "Username": "Foydalanuvchi nomi", "Password": "Parol",
    "Members, check-ins, subscriptions, shop and finance for a single gym.": "Bitta sport zal uchun a'zolar, tashriflar, abonementlar, do'kon va moliya.",
    "You can view this page but not save changes.": "Sahifani ko'rishingiz mumkin, lekin o'zgarishlarni saqlab bo'lmaydi.",
    "Welcome to the Bek Sport Gym app! Ask the manager for your login and password.": "«Bek Sport Gym» ilovasiga xush kelibsiz! Login va parol uchun menejerga murojaat qiling.",
    "There is nothing you can open here yet. Ask the owner of this page to give you Contributor access.": "Hozircha bu yerda ochadigan narsangiz yo'q. Sahifa egasidan Contributor ruxsatini so'rang.",
    "Wrong username or password.": "Foydalanuvchi nomi yoki parol noto'g'ri.",
    "Please sign in first.": "Avval tizimga kiring.",

    /* sync chip */
    "View only": "Faqat ko'rish", "Save failed": "Saqlanmadi", "Saving": "Saqlanmoqda", "Shared database": "Umumiy baza", "This browser only": "Faqat shu brauzer",
    "Data is saved to the shared database of this page.": "Ma'lumotlar shu sahifaning umumiy bazasiga saqlanadi.",
    "Data is saved in this browser only. Use Backup now regularly.": "Ma'lumotlar faqat shu brauzerda saqlanadi. «Zaxira nusxa» tugmasidan muntazam foydalaning.",
    "The database is full. Delete old data or restore a smaller backup.": "Baza to'lib qoldi. Eski ma'lumotlarni o'chiring yoki kichikroq zaxirani tiklang.",
    "Your access changed. This page is now view only.": "Ruxsatingiz o'zgardi. Sahifa endi faqat ko'rish uchun.",

    /* theme buttons */
    "Light mode": "Kunduzgi rejim", "Night mode": "Tungi rejim", "Switch to light mode": "Kunduzgi rejimga o'tish", "Switch to night mode": "Tungi rejimga o'tish",

    /* settings */
    "Til / Language": "Til / Language", "Language": "Til", "Display mode": "Ko'rinish rejimi", "Appearance": "Tashqi ko'rinish",
    "Auto": "Avto", "Light": "Kunduzgi", "Night": "Tungi", "Auto: follows your device setting.": "Avto: qurilmangiz sozlamasiga ergashadi.",
    "Midnight navy and gold, refined": "Tungi zangori va tilla, nafis", "Blue, light and clean": "Ko'k, yengil va toza",
    "Green, calm and clear": "Yashil, sokin va ravshan", "Warm sand, soft": "Iliq qum rangi, mayin",
    "Only colors and shapes change; your data is not affected.": "Faqat ranglar va shakllar o'zgaradi; ma'lumotlaringizga ta'sir qilmaydi.",

    /* quick check-in */
    "Quick check-in": "Tezkor kirish", "Search a member to check in": "Kirish uchun a'zoni qidiring", "Type a name": "Ismni yozing", "No match": "Topilmadi",
    "In": "Kirish", "Check in": "Kirish", "Check-ins": "Tashriflar",

    /* statuses and plans */
    "Active": "Faol", "Frozen": "Muzlatilgan", "Expired": "Muddati tugagan", "No subscription": "Abonement yo'q", "No plan": "Tarif yo'q",
    "Any day": "Istalgan kun", "No expiry": "Muddatsiz", "session pass": "mashg'ulotlar bo'yicha", "time plan": "muddat bo'yicha",
    "Ends today": "Bugun tugaydi", "Sample": "Namuna",
    "Time-based (days)": "Muddat bo'yicha (kunlar)", "Session-based (visits)": "Mashg'ulot bo'yicha (tashriflar)",

    /* common buttons and words */
    "Cancel": "Bekor qilish", "Save": "Saqlash", "Save changes": "O'zgarishlarni saqlash", "Confirm": "Tasdiqlash", "Close": "Yopish", "Add": "Qo'shish",
    "Edit": "Tahrirlash", "Delete": "O'chirish", "Renew": "Yangilash", "Extend": "Uzaytirish", "Freeze": "Muzlatish", "Unfreeze": "Muzlatishni yechish",
    "Adjust": "Tuzatish", "Sell": "Sotish", "Restock": "Zaxirani to'ldirish", "Previous": "Oldingi", "Next": "Keyingi", "All": "Barchasi",
    "Show fewer": "Kamroq ko'rsatish", "Back to members": "A'zolarga qaytish", "Other": "Boshqa", "Yes": "Ha", "No": "Yo'q",
    "Excel": "Excel", "CSV": "CSV", "UZS": "so'm", "you": "siz", "Choose photo": "Rasm tanlash", "Remove photo": "Rasmni olib tashlash",
    "Something went wrong:": "Xatolik yuz berdi:",

    /* members list and form */
    "Search members": "A'zolarni qidirish", "Search by name or phone": "Ism yoki telefon bo'yicha qidirish", "Filter by status": "Holat bo'yicha saralash",
    "Add member": "A'zo qo'shish", "Add first member": "Birinchi a'zoni qo'shish", "Edit member": "A'zoni tahrirlash", "Delete member": "A'zoni o'chirish",
    "No members yet": "Hali a'zolar yo'q", "No members match": "Mos a'zo topilmadi", "Try a different search or filter.": "Boshqa so'rov yoki filtrni sinab ko'ring.",
    "Add your first member to get started.": "Boshlash uchun birinchi a'zoni qo'shing.",
    "Status": "Holat", "Plan": "Tarif", "Debt": "Qarz", "Phone": "Telefon", "No phone": "Telefon yo'q", "Name": "Ism", "Note": "Izoh",
    "Each phone number can belong to one member.": "Har bir telefon raqami faqat bitta a'zoga tegishli bo'lishi mumkin.",
    "Training days": "Mashg'ulot kunlari", "Leave all unchecked to allow any day.": "Hammasi belgilanmasa, istalgan kun ruxsat etiladi.",
    "Member updated": "A'zo yangilandi", "Member deleted": "A'zo o'chirildi", "Members exported": "A'zolar eksport qilindi",
    "Member not found": "A'zo topilmadi", "Member not found.": "A'zo topilmadi.", "This member may have been deleted.": "Bu a'zo o'chirilgan bo'lishi mumkin.",
    "(deleted member)": "(o'chirilgan a'zo)", "Joined": "Qo'shilgan sana", "Last visit": "Oxirgi tashrif", "Never visited": "Hech qachon kelmagan",

    /* subscriptions */
    "Subscription": "Abonement", "No subscription yet": "Hali abonement yo'q", "New subscription": "Yangi abonement", "Add subscription": "Abonement qo'shish",
    "Subscription added": "Abonement qo'shildi", "Extend subscription": "Abonementni uzaytirish", "Subscription extended": "Abonement uzaytirildi",
    "Add a plan so this member can check in.": "A'zo kira olishi uchun tarif qo'shing.", "Earlier plans": "Oldingi tariflar",
    "Type": "Turi", "Start date": "Boshlanish sanasi", "End date": "Tugash sanasi", "Valid until": "Amal qilish muddati", "Valid until (optional)": "Amal qilish muddati (ixtiyoriy)",
    "Quick length:": "Tez tanlash:", "Number of sessions": "Mashg'ulotlar soni", "Starts": "Boshlanadi", "Ends": "Tugaydi", "Used": "Ishlatilgan", "Period": "Davr",
    "Price": "Narxi", "Price (UZS)": "Narxi (so'm)", "Paid now (UZS)": "Hozir to'langan (so'm)", "Same as price": "Narxga teng",
    "Anything unpaid is added to the member’s debt.": "To'lanmagan qism a'zoning qarziga qo'shiladi.",
    "The current plan is replaced. The price is added to the debt and the paid amount is recorded as a payment.": "Joriy tarif almashtiriladi. Narx qarzga qo'shiladi, to'langan summa esa to'lov sifatida yoziladi.",
    "Add days": "Kun qo'shish", "Add sessions": "Mashg'ulot qo'shish", "No active subscription.": "Faol abonement yo'q.",
    "Enter days or sessions to add.": "Qo'shiladigan kun yoki mashg'ulotlar sonini kiriting.",
    "Days": "Kunlar", "Sessions": "Mashg'ulotlar",

    /* freeze */
    "Freeze membership": "A'zolikni muzlatish", "Membership frozen": "A'zolik muzlatildi", "Membership unfrozen": "Muzlatish yechildi",

    /* debt and money */
    "Owed by this member": "A'zoning qarzi", "Nothing owed": "Qarz yo'q", "Take payment": "To'lov qabul qilish", "Record payment": "To'lovni yozish",
    "Payment recorded": "To'lov yozildi", "Payment recorded. Debt is now 0.": "To'lov yozildi. Qarz endi 0.", "Add charge": "Hisob qo'shish", "Charge": "Hisoblangan", "Charge added": "Hisob qo'shildi",
    "A charge adds to what this member owes.": "Hisob a'zoning qarziga qo'shiladi.", "Adjust debt": "Qarzni tuzatish", "Set debt": "Qarzni belgilash", "Debt adjusted": "Qarz tuzatildi",
    "Use this to correct a mistake. The change is logged as an adjustment.": "Xatoni to'g'rilash uchun foydalaning. O'zgarish tuzatish sifatida yoziladi.",
    "New debt (UZS)": "Yangi qarz (so'm)", "Reason": "Sabab", "For": "Nima uchun", "Amount": "Summa", "Amount (UZS)": "Summa (so'm)", "Amount paid": "To'langan summa",
    "Debt after": "Keyingi qarz", "Debt owed to you": "Sizga qarzdorlik", "Payments and charges": "To'lovlar va hisoblar", "No transactions yet": "Hali operatsiyalar yo'q",
    "Membership": "A'zolik", "Memberships": "A'zoliklar", "Payment": "To'lov", "Adjustment": "Tuzatish", "Total": "Jami", "Total:": "Jami:",
    "adjustment": "tuzatish", "payment": "to'lov", "charge": "hisob", "membership": "a'zolik", "shop": "do'kon", "personal training": "shaxsiy mashg'ulot", "other": "boshqa",
    "rent": "ijara", "salary": "oylik", "repair": "ta'mir", "equipment": "jihozlar", "utilities": "kommunal xizmatlar", "marketing": "marketing", "day pass": "bir kunlik chipta", "locker rental": "shkaf ijarasi",
    "Paid with subscription": "Abonement bilan to'langan", "Debt adjusted": "Qarz tuzatildi",

    /* measurements */
    "Measurements": "O'lchamlar", "Add measurements": "O'lcham qo'shish", "Measurements saved": "O'lchamlar saqlandi", "Delete measurement": "O'lchamni o'chirish",
    "Delete this measurement entry?": "Bu o'lcham yozuvi o'chirilsinmi?", "No measurements": "O'lchamlar yo'q",
    "Record weight, body fat and girth to track progress.": "Rivojlanishni kuzatish uchun vazn, yog' foizi va aylanalarni yozing.",
    "Weight kg": "Vazn kg", "Height cm": "Bo'y sm", "Body fat %": "Yog' %", "Chest": "Ko'krak", "Waist": "Bel", "Bicep": "Biceps",
    "Weight (kg)": "Vazn (kg)", "Height (cm)": "Bo'y (sm)", "Body fat (%)": "Yog' (%)", "Chest (cm)": "Ko'krak (sm)", "Waist (cm)": "Bel (sm)", "Bicep (cm)": "Biceps (sm)",
    "Weight": "Vazn", "Height": "Bo'y", "Body fat": "Yog' foizi", "Weight trend": "Vazn dinamikasi", "Enter at least one measurement.": "Kamida bitta o'lchamni kiriting.",
    "Date": "Sana", "Day": "Kun", "Time": "Vaqt", "Visits": "Tashriflar", "No visits yet": "Hali tashriflar yo'q", "Out": "Tugagan",
    "Delete measurement entry": "O'lcham yozuvini o'chirish",

    /* dashboard */
    "Your gym is empty": "Zalingiz hali bo'sh", "Add your first member, or load sample data to see how everything looks.": "Birinchi a'zoni qo'shing yoki hammasi qanday ko'rinishini ko'rish uchun namunaviy ma'lumotlarni yuklang.",
    "Load sample data": "Namunaviy ma'lumotlarni yuklash", "Remove sample data": "Namunaviy ma'lumotlarni o'chirish", "Sample data loaded": "Namunaviy ma'lumotlar yuklandi",
    "You are looking at sample data. Remove it before you start using the real thing.": "Siz namunaviy ma'lumotlarni ko'ryapsiz. Haqiqiy ishni boshlashdan oldin ularni o'chiring.",
    "Delete every sample member, product, sale, expense and payment? Real data you added yourself is not touched.": "Barcha namunaviy a'zo, mahsulot, sotuv, xarajat va to'lovlar o'chirilsinmi? O'zingiz kiritgan haqiqiy ma'lumotlarga tegilmaydi.",
    "Check-ins today": "Bugungi tashriflar", "Revenue this month": "Shu oydagi tushum", "Expenses this month": "Shu oydagi xarajatlar",
    "Checked in today": "Bugun kelganlar", "No check-ins yet today": "Bugun hali hech kim kelmagan", "Use Quick Check-In in the sidebar or the Members page.": "Yon paneldagi Tezkor kirishdan yoki A'zolar sahifasidan foydalaning.",
    "Expiring soon": "Tez orada tugaydi", "next 7 days or 2 sessions": "keyingi 7 kun yoki 2 mashg'ulot", "Nothing is expiring": "Hech narsa tugamayapti",
    "Active plans have more than a week or two sessions left.": "Faol tariflarda bir haftadan ko'p yoki 2 tadan ko'p mashg'ulot qolgan.",
    "Check-ins, last 7 days": "Tashriflar, oxirgi 7 kun", "Check-ins per day, last 7 days": "Kunlik tashriflar, oxirgi 7 kun", "Bar chart": "Ustunli diagramma",
    "Nothing recorded this month.": "Bu oy hech narsa yozilmagan.",

    /* shop */
    "Add product": "Mahsulot qo'shish", "Edit product": "Mahsulotni tahrirlash", "Delete product": "Mahsulotni o'chirish", "Product deleted": "Mahsulot o'chirildi",
    "Product added": "Mahsulot qo'shildi", "Product updated": "Mahsulot yangilandi", "Product": "Mahsulot", "Product name": "Mahsulot nomi", "Category": "Turkum",
    "Cost": "Tannarx", "Cost (UZS)": "Tannarx (so'm)", "Stock": "Zaxira", "Quantity": "Miqdor", "Qty": "Soni",
    "The shop is empty": "Do'kon bo'sh", "Add water, protein bars or anything else you sell at the desk.": "Suv, protein batonchiklar yoki resepshnda sotadigan boshqa narsalarni qo'shing.",
    "Recent sales": "So'nggi sotuvlar", "When": "Qachon", "No sales yet": "Hali sotuvlar yo'q", "Record sale": "Sotuvni yozish", "Member (optional)": "A'zo (ixtiyoriy)",
    "Walk-in customer": "Tasodifiy xaridor", "Walk-in": "Tasodifiy xaridor", "Add stock": "Zaxira qo'shish", "Units to add": "Qo'shiladigan miqdor", "Stock updated": "Zaxira yangilandi",
    "Drinks": "Ichimliklar", "Food": "Ovqat", "Gear": "Jihozlar", "Equipment": "Jihozlar",

    /* finance */
    "Income": "Daromad", "Expense": "Xarajat", "Expenses": "Xarajatlar", "Revenue": "Tushum", "Profit": "Foyda", "Revenue minus expenses": "Tushum minus xarajatlar",
    "Where revenue came from": "Tushum qayerdan kelgan", "Where money went": "Pul qayerga ketgan", "Source": "Manba", "Month": "Oy",
    "No income this month": "Bu oy daromad yo'q", "No expenses this month": "Bu oy xarajat yo'q", "Add income": "Daromad qo'shish", "Add expense": "Xarajat qo'shish",
    "Income added": "Daromad qo'shildi", "Expense added": "Xarajat qo'shildi", "Delete expense": "Xarajatni o'chirish", "Delete income": "Daromadni o'chirish",
    "Delete this expense entry?": "Bu xarajat yozuvi o'chirilsinmi?", "Delete this income entry?": "Bu daromad yozuvi o'chirilsinmi?",
    "For money that is not a membership payment or a shop sale.": "A'zolik to'lovi yoki do'kon sotuvi bo'lmagan pul uchun.",
    "Description": "Tavsif", "Other income": "Boshqa daromad", "Shop sale": "Do'kon sotuvi", "Membership payment": "A'zolik to'lovi",
    "Delete expense entry": "Xarajat yozuvini o'chirish", "Delete income entry": "Daromad yozuvini o'chirish",
    "Rent": "Ijara", "Salary": "Oylik", "Repair": "Ta'mir", "Utilities": "Kommunal xizmatlar", "Marketing": "Marketing", "Personal training": "Shaxsiy mashg'ulot",
    "Day pass": "Bir kunlik chipta", "Locker rental": "Shkaf ijarasi",
    "Choose an expense category.": "Xarajat turkumini tanlang.",

    /* analytics and rankings */
    "Monthly report (Excel)": "Oylik hisobot (Excel)", "Members who came": "Kelgan a'zolar", "at least once": "kamida bir marta", "New members": "Yangi a'zolar",
    "Lost members": "Yo'qolgan a'zolar", "30+ days away": "30+ kun kelmagan", "Attendance, last 30 days": "Davomat, oxirgi 30 kun", "Check-ins per day, last 30 days": "Kunlik tashriflar, oxirgi 30 kun",
    "No new members this month": "Bu oy yangi a'zolar yo'q", "no visit for 30+ days": "30+ kun tashrif yo'q", "Nobody is lost": "Yo'qolgan a'zo yo'q",
    "Everyone active has visited in the last 30 days.": "Barcha faol a'zolar oxirgi 30 kunda kelgan.",
    "Score = visits × 3 + months as a member × 2 + total payments ÷ 10 000. Top 50 members.": "Ball = tashriflar × 3 + a'zolik oylari × 2 + jami to'lovlar ÷ 10 000. Eng yaxshi 50 a'zo.",
    "Months": "Oylar", "Paid": "To'langan", "Score": "Ball", "No members to rank yet": "Reytingga a'zolar hali yo'q",

    /* audit */
    "Search the log": "Jurnalni qidirish", "Search actions, people, details": "Harakat, odam, tafsilot bo'yicha qidirish", "Restore backup": "Zaxirani tiklash", "Backup now": "Zaxira nusxa",
    "Nothing logged": "Hech narsa yozilmagan", "User": "Foydalanuvchi", "Action": "Harakat", "Detail": "Tafsilot", "Backup saved": "Zaxira nusxa saqlandi",
    "Backup downloaded": "Zaxira nusxa yuklab olindi", "Replace everything": "Hammasini almashtirish", "Backup restored. Please sign in again.": "Zaxira tiklandi. Qayta kiring.", "Backup restored": "Zaxira tiklandi",
    "Report saved": "Hisobot saqlandi", "Excel file saved": "Excel fayli saqlandi", "File saved": "Fayl saqlandi",

    /* users */
    "Admins only": "Faqat adminlar uchun", "Only an admin can add users, change roles or reset passwords.": "Foydalanuvchi qo'shish, rolni o'zgartirish va parolni tiklashni faqat admin qila oladi.",
    "Add user": "Foydalanuvchi qo'shish", "User added": "Foydalanuvchi qo'shildi", "User deleted": "Foydalanuvchi o'chirildi", "Delete user": "Foydalanuvchini o'chirish",
    "Role": "Rol", "Created": "Yaratilgan", "Reset password": "Parolni tiklash", "Set password": "Parolni o'rnatish", "Password reset": "Parol tiklandi", "Role changed": "Rol o'zgartirildi",
    "At least 4 characters": "Kamida 4 ta belgi", "admin": "admin", "Admin": "Admin", "member": "a'zo", "Removed role": "Olib tashlangan rol",

    /* member accounts and the member's own view */
    "My Profile": "Mening profilim", "Member login": "A'zoning logini", "Login": "Login", "No login": "Login yo'q",
    "Optional. Lets the member sign in and see only their own profile.": "Ixtiyoriy. A'zo tizimga kirib, faqat o'z profilini ko'ra oladi.",
    "Leave empty to keep the current password.": "Joriy parolni saqlash uchun bo'sh qoldiring.",
    "You owe the gym": "Siz zalga qarzdorsiz", "Ask the gym staff to add a plan.": "Tarif qo'shish uchun zal xodimlariga murojaat qiling.",
    "This role no longer exists. Ask an admin.": "Bu rol endi mavjud emas. Adminga murojaat qiling.",
    "This account is no longer linked to a member. Ask an admin.": "Bu hisob endi a'zoga bog'liq emas. Adminga murojaat qiling.",
    "Only staff can do this.": "Buni faqat xodimlar qila oladi.", "You can only open your own profile.": "Faqat o'z profilingizni ocha olasiz.",
    "Login is required when a password is set.": "Parol kiritilsa, login ham kiritilishi shart.",
    "Password is required to create a login.": "Login yaratish uchun parol kiritilishi shart.",
    "Login is required while the member has an account.": "A'zoning hisobi bor ekan, login bo'sh bo'lishi mumkin emas.",
    "This member has no login.": "Bu a'zoning logini yo'q.",
    "MEMBER_LOGIN_CREATED": "A'ZO LOGINI YARATILDI", "MEMBER_LOGIN_CHANGED": "A'ZO LOGINI O'ZGARDI", "MEMBER_LOGIN_RESET": "A'ZO PAROLI TIKLANDI", "MEMBER_LOGIN_DELETED": "A'ZO LOGINI O'CHIRILDI",

    /* password */
    "Change your password": "Parolingizni o'zgartiring", "Current password": "Joriy parol", "New password": "Yangi parol", "Confirm new password": "Yangi parolni tasdiqlang",
    "Change password": "Parolni o'zgartirish", "Password changed": "Parol o'zgartirildi", "Current password is wrong.": "Joriy parol noto'g'ri.",
    "The new passwords do not match.": "Yangi parollar mos kelmadi.", "New password must be at least 4 characters.": "Yangi parol kamida 4 ta belgidan iborat bo'lishi kerak.",
    "Password must be at least 4 characters.": "Parol kamida 4 ta belgidan iborat bo'lishi kerak.",

    /* core error messages */
    "A product with this name already exists.": "Bunday nomli mahsulot allaqachon mavjud.", "Amount paid cannot be more than the price.": "To'langan summa narxdan oshmasligi kerak.",
    "Choose a subscription type.": "Abonement turini tanlang.", "Choose a valid role.": "To'g'ri rolni tanlang.", "Date is not valid.": "Sana noto'g'ri.",
    "End date cannot be before the start date.": "Tugash sanasi boshlanish sanasidan oldin bo'lishi mumkin emas.", "End date is not valid.": "Tugash sanasi noto'g'ri.",
    "Only an admin can do this.": "Buni faqat admin qila oladi.", "Only manual income entries can be deleted.": "Faqat qo'lda kiritilgan daromadlarni o'chirish mumkin.",
    "Phone number must contain digits.": "Telefon raqami raqamlardan iborat bo'lishi kerak.", "Product not found.": "Mahsulot topilmadi.",
    "Sample data can only be loaded into an empty gym.": "Namunaviy ma'lumotlarni faqat bo'sh zalga yuklash mumkin.",
    "Secure password hashing is not available in this browser.": "Bu brauzerda xavfsiz parol shifrlash mavjud emas.",
    "Sessions can only be added to a session-based plan.": "Mashg'ulotlarni faqat mashg'ulot bo'yicha tarifga qo'shish mumkin.", "Start date is not valid.": "Boshlanish sanasi noto'g'ri.",
    "That username is taken.": "Bu foydalanuvchi nomi band.", "The backup has no admin account.": "Zaxirada admin hisobi yo'q.", "The last admin cannot be deleted.": "Oxirgi adminni o'chirib bo'lmaydi.",
    "The last admin cannot be demoted.": "Oxirgi adminning rolini pasaytirib bo'lmaydi.", "The photo is not a valid image.": "Rasm yaroqli tasvir emas.", "The photo is too large.": "Rasm juda katta.",
    "This file is not a Bek Sport Gym backup.": "Bu fayl Bek Sport Gym zaxira nusxasi emas.", "This file is not a valid backup.": "Bu fayl yaroqli zaxira nusxa emas.",
    "This member has no active subscription.": "Bu a'zoning faol abonementi yo'q.", "This membership is already frozen.": "Bu a'zolik allaqachon muzlatilgan.",
    "This membership is not frozen.": "Bu a'zolik muzlatilmagan.", "This subscription has no end date to extend.": "Bu abonementda uzaytiriladigan tugash sanasi yo'q.",
    "This view is read-only. Changes cannot be saved.": "Bu ko'rinish faqat o'qish uchun. O'zgarishlarni saqlab bo'lmaydi.", "User not found.": "Foydalanuvchi topilmadi.",
    "Username: 3 to 30 letters, digits, dots, dashes or underscores.": "Foydalanuvchi nomi: 3 dan 30 gacha harf, raqam, nuqta, chiziqcha yoki pastki chiziq.",
    "Valid-until date cannot be before the start date.": "Amal qilish sanasi boshlanish sanasidan oldin bo'lishi mumkin emas.", "Valid-until date is not valid.": "Amal qilish sanasi noto'g'ri.",
    "You cannot delete your own account.": "O'z hisobingizni o'chira olmaysiz.", "Choose an image file.": "Rasm faylini tanlang.", "The photo could not be read.": "Rasmni o'qib bo'lmadi.",
    "The Excel library could not be loaded.": "Excel kutubxonasini yuklab bo'lmadi.", "Downloads are not available in this view.": "Bu ko'rinishda yuklab olish mavjud emas.",

    /* audit action codes */
    "LOGIN": "KIRDI", "LOGIN_FAILED": "KIRISH XATO", "LOGOUT": "CHIQDI", "PASSWORD_CHANGED": "PAROL O'ZGARDI", "PASSWORD_RESET": "PAROL TIKLANDI", "USER_ADDED": "FOYDALANUVCHI QO'SHILDI",
    "USER_DELETED": "FOYDALANUVCHI O'CHIRILDI", "ROLE_CHANGED": "ROL O'ZGARDI", "MEMBER_ADDED": "A'ZO QO'SHILDI", "MEMBER_UPDATED": "A'ZO YANGILANDI", "MEMBER_DELETED": "A'ZO O'CHIRILDI",
    "SUBSCRIPTION_ADDED": "ABONEMENT QO'SHILDI", "SUBSCRIPTION_EXTENDED": "ABONEMENT UZAYTIRILDI", "CHECK_IN": "KIRISH", "FREEZE": "MUZLATISH", "UNFREEZE": "MUZLATISH YECHILDI",
    "PAYMENT": "TO'LOV", "CHARGE": "HISOB", "DEBT_ADJUSTED": "QARZ TUZATILDI", "MEASUREMENT_ADDED": "O'LCHAM QO'SHILDI", "MEASUREMENT_DELETED": "O'LCHAM O'CHIRILDI",
    "PRODUCT_ADDED": "MAHSULOT QO'SHILDI", "PRODUCT_UPDATED": "MAHSULOT YANGILANDI", "PRODUCT_DELETED": "MAHSULOT O'CHIRILDI", "SALE": "SOTUV", "RESTOCK": "ZAXIRA",
    "EXPENSE_ADDED": "XARAJAT QO'SHILDI", "EXPENSE_DELETED": "XARAJAT O'CHIRILDI", "INCOME_ADDED": "DAROMAD QO'SHILDI", "INCOME_DELETED": "DAROMAD O'CHIRILDI",
    "SAMPLE_LOADED": "NAMUNA YUKLANDI", "SAMPLE_REMOVED": "NAMUNA O'CHIRILDI", "BACKUP": "ZAXIRA NUSXA", "RESTORE": "TIKLASH", "BACKUP_RESTORED": "ZAXIRA TIKLANDI",
    "12 sample members and demo shop, finance and visit data": "12 ta namunaviy a'zo hamda demo do'kon, moliya va tashrif ma'lumotlari",

    /* weekdays */
    "Mon": "Du", "Tue": "Se", "Wed": "Chor", "Thu": "Pay", "Fri": "Ju", "Sat": "Sha", "Sun": "Yak",
    "January": "Yanvar", "February": "Fevral", "March": "Mart", "April": "Aprel", "May": "May", "June": "Iyun", "July": "Iyul", "August": "Avgust",
    "September": "Sentyabr", "October": "Oktyabr", "November": "Noyabr", "December": "Dekabr",

    /* export files (Excel, CSV) */
    "Remaining": "Qolgan", "Summary": "Xulosa", "Daily Attendance": "Kunlik davomat", "Payments": "To'lovlar", "Bek Sport Gym: monthly report": "Bek Sport Gym: oylik hisobot",
    "Members who visited": "Kelgan a'zolar", "Membership payments": "A'zolik to'lovlari", "Shop sales": "Do'kon sotuvlari", "Total revenue": "Jami tushum", "Total expenses": "Jami xarajatlar",
    "active": "faol", "frozen": "muzlatilgan", "expired": "muddati tugagan", "any": "istalgan", "Member": "A'zo", "Joined": "Qo'shilgan sana", "Last visit": "Oxirgi tashrif",
    "New debt": "Yangi qarz", "Stock": "Zaxira"
  });

  /* ---------- helpers for patterns ---------- */
  var WD = { Mon: 1, Tue: 1, Wed: 1, Thu: 1, Fri: 1, Sat: 1, Sun: 1 };

  /* dynamic text. Order matters: the first match wins. */
  function pat(re, fn) { P.push([re, fn]); }

  /* sentences that start with a name */
  pat(/^(.+) already checked in today\.$/, function (m) { return m[1] + " bugun allaqachon kirgan."; });
  pat(/^(.+) has no sessions left\.$/, function (m) { return m[1] + "ning mashg'ulotlari qolmagan."; });
  pat(/^(.+) has no active subscription\.$/, function (m) { return m[1] + "ning faol abonementi yo'q."; });
  pat(/^(.+) is frozen\. Unfreeze the membership first\.$/, function (m) { return m[1] + " muzlatilgan. Avval muzlatishni yeching."; });
  pat(/^The subscription of (.+) expired on (\S+)\.$/, function (m) { return m[1] + " abonementi " + m[2] + " sanasida tugagan."; });
  pat(/^This phone number already belongs to (.+)\.$/, function (m) { return "Bu telefon raqami allaqachon " + m[1] + "ga tegishli."; });
  pat(/^(.+) checked in\. (\d+) sessions? left\.$/, function (m) { return m[1] + " kirdi. " + m[2] + " mashg'ulot qoldi."; });
  pat(/^(.+) checked in\. (\d+) days? left\.$/, function (m) { return m[1] + " kirdi. " + m[2] + " kun qoldi."; });
  pat(/^Today \((\w+)\) is not a training day for (.+)\. Allowed: (.+)\.$/, function (m, T) {
    return "Bugun (" + T(m[1]) + ") " + m[2] + " uchun mashg'ulot kuni emas. Ruxsat etilgan: " + m[3].split(', ').map(T).join(', ') + ".";
  });
  pat(/^Too many attempts\. Wait (\d+) seconds\.$/, function (m) { return "Juda ko'p urinish. " + m[1] + " soniya kuting."; });
  pat(/^Only (\d+) in stock\.$/, function (m) { return "Omborda faqat " + m[1] + " ta bor."; });
  pat(/^The backup contains a damaged record in (.+)\.$/, function (m) { return "Zaxirada " + m[1] + " bo'limida buzilgan yozuv bor."; });
  pat(/^Sign in failed: (.+)$/, function (m) { return "Kirib bo'lmadi: " + m[1]; });
  pat(/^Something went wrong: (.+)$/, function (m) { return "Xatolik yuz berdi: " + m[1]; });
  pat(/^The file could not be saved \((.+)\)\.?$/, function (m) { return "Faylni saqlab bo'lmadi (" + m[1] + ")."; });
  pat(/^Changes could not be saved(?: \((.+)\))?\.$/, function (m) { return "O'zgarishlarni saqlab bo'lmadi" + (m[1] ? " (" + m[1] + ")" : "") + "."; });

  /* validation: "<label> is required." */
  pat(/^(.+) is required\.$/, function (m, T) { return T(m[1]) + " kiritilishi shart."; });
  pat(/^(.+) is too long\.$/, function (m, T) { return T(m[1]) + " juda uzun."; });
  pat(/^(.+) must be a whole number\.$/, function (m, T) { return T(m[1]) + " butun son bo'lishi kerak."; });
  pat(/^(.+) must be a number\.$/, function (m, T) { return T(m[1]) + " raqam bo'lishi kerak."; });
  pat(/^(.+) must be at least (.+)\.$/, function (m, T) { return T(m[1]) + " kamida " + m[2] + " bo'lishi kerak."; });
  pat(/^(.+) must be at most (.+)\.$/, function (m, T) { return T(m[1]) + " ko'pi bilan " + m[2] + " bo'lishi mumkin."; });

  /* titles with a name */
  pat(/^Add charge for (.+)$/, function (m) { return m[1] + " uchun hisob qo'shish"; });
  pat(/^Take payment from (.+)$/, function (m) { return m[1] + "dan to'lov qabul qilish"; });
  pat(/^New subscription for (.+)$/, function (m) { return m[1] + " uchun yangi abonement"; });
  pat(/^Reset password for (.+)$/, function (m) { return m[1] + " uchun parolni tiklash"; });
  pat(/^Role for (.+)$/, function (m) { return m[1] + " roli"; });
  pat(/^Delete (.+)$/, function (m) { return m[1] + " ni o'chirish"; });
  pat(/^Edit (.+)$/, function (m) { return m[1] + " ni tahrirlash"; });
  pat(/^Sell (.+)$/, function (m) { return m[1] + " sotish"; });
  pat(/^Restock (.+)$/, function (m) { return m[1] + " zaxirasini to'ldirish"; });
  pat(/^Restock: (.+) x(\d+)$/, function (m) { return "Zaxira to'ldirish: " + m[1] + " x" + m[2]; });
  pat(/^New product: (.+) x(\d+)$/, function (m) { return "Yangi mahsulot: " + m[1] + " x" + m[2]; });
  pat(/^(.+) \+(\d+), cost (.+) to (.+)$/, function (m) { return m[1] + " +" + m[2] + ", tannarx " + m[3] + " → " + m[4]; });

  /* counts and short phrases */
  pat(/^(\d+) days? left$/, function (m) { return m[1] + " kun qoldi"; });
  pat(/^(\d+) sessions? left$/, function (m) { return m[1] + " mashg'ulot qoldi"; });
  pat(/^(\d+) of (\d+) sessions left\s*(.*)$/, function (m, T) {
    var rest = m[3];
    var out = m[2] + " tadan " + m[1] + " ta mashg'ulot qoldi";
    var e = /^\(expired (\S+)\)$/.exec(rest); if (e) return out + " (" + e[1] + " da tugagan)";
    var u = /^, until (\S+)$/.exec(rest); if (u) return out + ", " + u[1] + " gacha";
    return out;
  });
  pat(/^, until (\S+)$/, function (m) { return ", " + m[1] + " gacha"; });
  pat(/^(\d+) days$/, function (m) { return m[1] + " kun"; });
  pat(/^(\d+) day$/, function (m) { return m[1] + " kun"; });
  pat(/^(\d+) sessions?$/, function (m) { return m[1] + " mashg'ulot"; });
  pat(/^(\d+) percent used$/, function (m) { return m[1] + " foiz ishlatilgan"; });
  pat(/^(\d+) entries$/, function (m) { return m[1] + " ta yozuv"; });
  pat(/^(\d+) entry$/, function (m) { return m[1] + " ta yozuv"; });
  pat(/^(\d+) total$/, function (m) { return "jami " + m[1]; });
  pat(/^(\d+) of (\d+)$/, function (m) { return m[2] + " dan " + m[1]; });
  pat(/^(\d+) left$/, function (m) { return m[1] + " ta qoldi"; });
  pat(/^(\d+) products?$/, function (m) { return m[1] + " ta mahsulot"; });
  pat(/^Show all (\d+)$/, function (m) { return "Barchasini ko'rsatish (" + m[1] + ")"; });
  pat(/^Showing (\d+)–(\d+) of (\d+)$/, function (m) { return m[3] + " tadan " + m[1] + "–" + m[2] + " ko'rsatilmoqda"; });
  pat(/^Page (\d+) of (\d+)$/, function (m) { return m[2] + " sahifadan " + m[1] + "-sahifa"; });
  pat(/^Removed (\d+) sample records$/, function (m) { return m[1] + " ta namunaviy yozuv o'chirildi"; });
  pat(/^(\d+) sample records removed$/, function (m) { return m[1] + " ta namunaviy yozuv o'chirildi"; });
  pat(/^Sold for (.+) UZS$/, function (m) { return "Sotildi: " + m[1] + " so'm"; });
  pat(/^Member added: (.+)$/, function (m) { return "A'zo qo'shildi: " + m[1]; });
  pat(/^Unfrozen\. End date moved (\d+) days later\.$/, function (m) { return "Muzlatish yechildi. Tugash sanasi " + m[1] + " kunga surildi."; });
  pat(/^Expired (\S+)$/, function (m) { return "Muddati tugagan: " + m[1]; });
  pat(/^Last visit (\S+)$/, function (m) { return "Oxirgi tashrif: " + m[1]; });
  pat(/^Current end date: (\S+)$/, function (m) { return "Joriy tugash sanasi: " + m[1]; });
  pat(/^Now (\d+) in stock\.$/, function (m) { return "Hozir omborda " + m[1] + " ta."; });
  pat(/^Now (\d+) in total, (\d+) used$/, function (m) { return "Hozir jami " + m[1] + " ta, " + m[2] + " tasi ishlatilgan"; });
  pat(/^([\d\s.,]+) UZS each\. (\d+) in stock\.$/, function (m) { return "Dona narxi " + m[1] + " so'm. Omborda " + m[2] + " ta."; });
  pat(/^([\d\s.,\-−]+) UZS$/, function (m) { return m[1] + " so'm"; });
  pat(/^Frozen since (\S+) \((\d+) days\)\. Unfreezing adds these days to the end date\.$/, function (m) {
    return m[1] + " dan beri muzlatilgan (" + m[2] + " kun). Muzlatish yechilganda bu kunlar tugash sanasiga qo'shiladi.";
  });
  pat(/^(\S+) · (\d+)\/(\d+) used$/, function (m) { return m[1] + " · " + m[2] + "/" + m[3] + " ishlatilgan"; });
  pat(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) (\d\d\.\d\d\.\d{4})$/, function (m, T) { return T(m[1]) + " " + m[2]; });
  pat(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun): (\d+)$/, function (m, T) { return T(m[1]) + ": " + m[2]; });
  pat(/^((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)(?:, ?(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun))*)$/, function (m, T) { return m[1].split(/, ?/).map(T).join(', '); });
  pat(/^(January|February|March|April|May|June|July|August|September|October|November|December) (\d{4})$/, function (m, T) { return T(m[1]) + " " + m[2]; });
  pat(/^Role: (.+)$/, function (m, T) { return "Rol: " + T(m[1]); });
  pat(/^Username: (.*)$/, function (m) { return "Foydalanuvchi nomi: " + m[1]; });
  pat(/^Income: (.+)$/, function (m, T) { return "Daromad: " + T(m[1]); });
  pat(/^Payment: (.+)$/, function (m, T) { return "To'lov: " + T(m[1]); });
  pat(/^Shop: (.+) x(\d+)$/, function (m) { return "Do'kon: " + m[1] + " x" + m[2]; });
  pat(/^Subscription: (.+)$/, function (m, T) { return "Abonement: " + T(m[1]); });

  pat(/^(.+) \(was (.+)\)$/, function (m, T) { return T(m[1]) + " (avval: " + m[2] + ")"; });

  /* audit details */
  /* roles from before the change can still appear in old log lines, so they are matched here but no longer translated */
  pat(/^(.+) \((admin|member|owner|trainer|vip_client)\)$/, function (m, T) { return m[1] + " (" + T(m[2]) + ")"; });
  pat(/^(.+): (admin|member|owner|trainer|vip_client) to (admin|member|owner|trainer|vip_client)$/, function (m, T) { return m[1] + ": " + T(m[2]) + " → " + T(m[3]); });
  pat(/^(.+): (.+) to (.+)$/, function (m) { return m[1] + ": " + m[2] + " → " + m[3]; });
  pat(/^(.+): (\d+ (?:days|sessions)), price (.+)$/, function (m, T) { return m[1] + ": " + T(m[2]) + ", narxi " + m[3]; });
  pat(/^(.+): \+(\d+) days, \+(\d+) sessions$/, function (m) { return m[1] + ": +" + m[2] + " kun, +" + m[3] + " mashg'ulot"; });
  pat(/^(.+): (\d+) frozen days(, end date extended)?$/, function (m) { return m[1] + ": " + m[2] + " kun muzlatilgan" + (m[3] ? ", tugash sanasi uzaytirildi" : ""); });
  pat(/^(rent|salary|repair|equipment|utilities|marketing|shop stock|other|personal training|day pass|locker rental|membership|shop): (.*)$/, function (m, T) { return T(m[1]) + ": " + m[2]; });
  /* "category. note" in transaction lists */
  pat(/^(membership|personal training|shop|other|adjustment|payment|charge)\. (.+)$/, function (m, T) { return T(m[1]) + ". " + T(m[2]); });

  /* weekday abbreviation lists inside text such as "Tue: 4" handled above; chart labels like "5" stay as they are */

  /* text fragments around bold names (login note, confirm boxes use TPL below) */
  add({
    "Choose photo": "Rasm tanlash",

    /* shop stock bought and recorded as an expense */
    "Record as expense": "Xarajat sifatida yozish", "Expense amount (UZS)": "Xarajat summasi (so'm)", "Expense amount": "Xarajat summasi",
    "Unit cost × quantity. You can change it.": "Tannarx × miqdor. Uni o'zgartirishingiz mumkin.",
    "Unit cost (UZS)": "Dona tannarxi (so'm)", "Unit cost": "Dona tannarxi",
    "Optional. If you change it, it becomes the cost of this product.": "Ixtiyoriy. O'zgartirsangiz, bu mahsulotning yangi tannarxi bo'ladi.",
    "Stock updated. Expense recorded.": "Zaxira yangilandi. Xarajat yozildi.", "Product added. Expense recorded.": "Mahsulot qo'shildi. Xarajat yozildi.",
    "Shop stock": "Do'kon tovari", "shop stock": "do'kon tovari"
  });

  /* ---------- sentences with bold parts ---------- */
  TP["Delete {0}? Their photo, subscriptions, visits, measurements and login are removed. Payment history stays in the finance records."] =
    "{0} o'chirilsinmi? Uning rasmi, abonementlari, tashriflari, o'lchamlari va logini olib tashlanadi. To'lovlar tarixi moliya yozuvlarida qoladi.";
  TP["Freeze {0} from today? Check-in is blocked while frozen, and the frozen days are added to the end date when you unfreeze."] =
    "{0} bugundan boshlab muzlatilsinmi? Muzlatilgan paytda kirish yopiq bo'ladi, muzlatish yechilganda esa muzlatilgan kunlar tugash sanasiga qo'shiladi.";
  TP["Delete {0}? Past sales stay in the records."] = "{0} o'chirilsinmi? O'tgan sotuvlar yozuvlarda qoladi.";
  TP["Delete the account {0}?"] = "{0} hisobi o'chirilsinmi?";
  TP["Replace {0} with the contents of {1}? This cannot be undone. Download a backup first if you are not sure."] =
    "{0} {1} faylidagi ma'lumotlarga almashtirilsinmi? Buni qaytarib bo'lmaydi. Ishonchingiz komil bo'lmasa, avval zaxira nusxa yuklab oling.";
  TP["Current debt: {0}. A payment lowers the debt and never takes it below zero."] = "Joriy qarz: {0}. To'lov qarzni kamaytiradi, lekin noldan pastga tushirmaydi.";
  D["all current data"] = "barcha joriy ma'lumotlar";
})();
