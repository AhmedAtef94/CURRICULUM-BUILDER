# Elkheta Curriculum Plan — React

React + Vite + Bootstrap 4 rewrite of the curriculum builder, on the same Supabase backend
(same database, RLS policies, and `create-user` Edge Function as the original single-file app).

## التشغيل (Run)

```bash
cd elkheta-react
npm install
npm run dev
```

يفتح على http://localhost:5173

## البناء للنشر (Build)

```bash
npm run build      # ينتج مجلد dist/
npm run preview    # معاينة نسخة الإنتاج محليًا
```

## الإعداد (Config)

مفاتيح Supabase موجودة في `src/supabaseClient.js` (نفس مفتاح الـ publishable العام — آمن في الواجهة،
الحماية الحقيقية في الـ RLS).

## البنية (Structure)

```
src/
  main.jsx              نقطة الدخول (تحمّل Bootstrap 4 + الثيم الدارك)
  App.jsx               إدارة الجلسة (session) → Login أو Dashboard
  supabaseClient.js     عميل Supabase
  styles.css            الثيم الدارك (فوق Bootstrap 4)
  lib/                  constants / validation / helpers
  components/
    Login.jsx           دخول/إنشاء حساب/نسيت كلمة المرور + Validation
    Sidebar.jsx         القائمة الجانبية + أقسام + بطاقة اليوزر
    Dashboard.jsx       تحميل البيانات + التنقّل بين الأقسام
    SubjectsGrid.jsx    كروت المواد + بحث/فلاتر
    SubjectModal.jsx    إضافة/تعديل مادة (اسم/سنة/ترم/لون)
    SubjectContent.jsx  المحاضرات → المواضيع → الفصول → الأسئلة (CRUD)
    QuestionModal.jsx   محرر السؤال + رفع الصور
    TeamsUsers.jsx      إدارة اليوزرز (إنشاء/حذف/أدوار/تخصيص مواد)
```

## ملاحظات
- **حذف يوزر** يحتاج نسخة الـ Edge Function اللي فيها فرع `action === "delete"` — لازم Re-deploy.
- الصور (`new-logo.png`, `favicon.png`) موجودة في `public/`.
