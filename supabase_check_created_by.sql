-- =====================================================================
-- تشخيص: ليه "بواسطة فلان" مش ظاهرة؟
-- شغّل ده في SQL Editor وابعتلي النتيجة.
-- =====================================================================

-- 1) هل الأعمدة اتضافت أصلًا؟  (المفروض 8 صفوف)
select table_name, column_name
  from information_schema.columns
 where table_schema = 'public'
   and column_name in ('created_by', 'created_by_name')
 order by table_name, column_name;

-- 2) هل الـ triggers موجودة؟  (المفروض 4 صفوف)
select event_object_table as table_name, trigger_name
  from information_schema.triggers
 where trigger_name like '%created_by%'
 order by event_object_table;

-- 3) فيه كام صف متسجّل له اسم؟
--    الصفوف القديمة (اللي اتضافت قبل التشغيل) هتبقى فاضية — وده طبيعي.
select 'lectures'  as tbl, count(*) as total, count(nullif(created_by_name, '')) as with_name from lectures
union all
select 'topics',    count(*), count(nullif(created_by_name, '')) from topics
union all
select 'chapters',  count(*), count(nullif(created_by_name, '')) from chapters
union all
select 'questions', count(*), count(nullif(created_by_name, '')) from questions;
