# نشر التطبيق على GitHub Pages

كل حاجة متجهّزة: الريبو المحلي، وملف الـ workflow اللي بيبني وينشر أوتوماتيك.
باقي ٣ خطوات بتتعمل مرة واحدة بس.

## 1) اعمل ريبو جديد على GitHub

روح **https://github.com/new** واعمل ريبو فاضي:
- الاسم: أي اسم (مثلاً `elkheta-curriculum`)
- **متعملش** initialize بأي README أو .gitignore — سيبه فاضي تمامًا
- Public أو Private الاتنين شغّالين مع Pages

## 2) اربط الريبو وارفع الكود

من داخل مجلد المشروع، شغّل الأوامر دي (غيّر `USERNAME` و`REPO` باللي عندك):

```bash
git remote add origin https://github.com/USERNAME/REPO.git
git push -u origin main
```

## 3) فعّل GitHub Pages

في الريبو على GitHub:
1. **Settings** → **Pages**
2. تحت **Build and deployment** → **Source**: اختار **GitHub Actions**
3. خلاص كده

أول push بيشغّل الـ workflow أوتوماتيك (تقدر تتابعه من تاب **Actions**).
بعد دقيقتين التطبيق هيبقى شغّال على:

```
https://USERNAME.github.io/REPO/
```

## بعد كده

أي `git push` جديد على `main` بيعيد البناء والنشر لوحده — متعملش حاجة.

---

## ملاحظات مهمة

- **مفتاح Supabase في الكود آمن للنشر** — ده `anon key` عام محمي بالـ RLS.
  المفتاح السري (`service_role`) مش في الكود أصلًا.
- **مسار الـ Pages بيتظبط لوحده** من اسم الريبو، فمش محتاج تعدّل أي حاجة
  مهما سمّيت الريبو.
- ملفات الـ SQL (`supabase_*.sql`) ودالة الـ edge موجودة في الريبو للتوثيق —
  بتتشغّل على Supabase مش على Pages.
```
