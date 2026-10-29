# Farmakon P0.5 — نتائج تنفيذ Atomic Database Mirroring
29 أكتوبر 2026، بغداد. متابعة P0.4 على PR #19 من e6f8371e.

**PASS لنطاق المهمة فقط: 34 فحصًا فعليًا على PostgreSQL 17.11. SSI/F00: FAILED/OPEN.**

- كود التنفيذ والاختبارات: [7bdf4217936188a5a5b27d946470528d70a35659](https://github.com/PhQMR7S/Farmakon/commit/7bdf4217936188a5a5b27d946470528d70a35659).
- [Actions 40844076703 — SUCCESS](https://github.com/PhQMR7S/Farmakon/actions/runs/40844076703)، job 123347196140.
- [الأدلة المستخرجة من سجل التشغيل](evidence/P0.5-ATOMIC-MIRROR.json).
- [Triggers والصلاحيات](../tests/fixtures/atomic-mirror-p05.sql)؛ [اختبارات Python/psql](../tests/atomic-mirror-p05.py)؛ [workflow مستقلة](../.github/workflows/atomic-mirror-p05.yml).

## ما نُفذ وأُثبت
AFTER ROW triggers تعمل ALWAYS على records للمحاولات وactivity لأحداث exam. النقل ينسخ JSON الأصلي والهوية والحقول دون إعادة تصحيح أو تغيير النتيجة. لا backfill ولا cutover ولا تعديل قارئ أو runtime. المصدر القديم يظل مصدر الحقيقة.

اتصالات الكاتب تستخدم LOGIN مستقلًا محدودًا، لا SET ROLE داخل اتصال superuser. SQL الكاتب يبقى INSERT/UPSERT القديم نفسه في server.ts، مع تغيير تأهيل schema للعزل فقط؛ لا كتابة ظل في الكاتب ولا marker يلزمه قراءته. اختبارات UPDATE وDELETE تنفذ SQL المصدر مباشرة. هذا إثبات لحد قاعدة البيانات؛ لم تُشغّل handlers HTTP أو Auth مزود حقيقي.

| الفحص | النتيجة |
|---|---|
| INSERT وUPSERT UPDATE وDELETE للكاتب القديم | PASS |
| المحاولات المكررة تبقى بمعرفاتها؛ JSON ونتيجة done وsnapshot محفوظة | PASS |
| تغيير المالك والمفتاح وkind دخولًا وخروجًا | PASS |
| أحداث exam تنعكس؛ progress يبقى في المصدر ولا يتسرب لظل exam | PASS |
| منع قراءة/INSERT/UPDATE/DELETE مباشر للظل بالحساب المحدود | PASS |
| منع TRUNCATE وتعطيل/إسقاط trigger واستبدال function وreplication bypass وتولي دور المالك | PASS |
| فشل INSERT أو UPDATE في ظل المحاولة يلغي الكتابات السابقة في transaction | PASS |
| فشل DELETE بقيد FK في الظل يعيد المصدر والظل والكتابات السابقة | PASS |
| فشل ظل الحدث يعيد تحديث المحاولة والحدث معًا | PASS |
| مطابقة المصدر والظل بعد العمليات؛ تنظيف schema والأدوار | PASS |

فشل المزامنة حُقن بقيود CHECK وFK في الظل فقط. مقارنة snapshots قبل وبعد الفشل شملت الجداول الأربعة؛ الأخطاء المتوقعة تحققت عبر SQLSTATE 23514/23503، ورفض الصلاحيات عبر 42501. فشل عبارة داخل transaction يسبب خروج psql وإغلاق اتصالها دون COMMIT؛ PostgreSQL يرجع المعاملة، ثم اتصال مستقل يقارن الحالة. النتائج لا تثبت معالجة outcome مجهول لـCOMMIT.

دوال SECURITY DEFINER بمالك NOLOGIN محدود مختلف عن مالك الجداول، وصلاحيات DML للظل فقط، وsearch_path=pg_catalog مع تأهيل كل جدول. لا EXECUTE عام ولا عضوية للكاتب في أدوار الملكية. لا حماية من superuser أو مسؤول يغير grants/schema؛ هذا خارج حدود الحساب المحدود المختبر. المخطط fixture معزول، وليس سياسات صلاحيات Production.

## الفحوص الموجودة
[Quality 40844083754](https://github.com/PhQMR7S/Farmakon/actions/runs/40844083754): scope PASS، وبوابة الحمل القديمة FAIL عمدًا، وbaseline/postgres/browser SKIPPED. أُضيفت ملفات P0.4/P0.5 المحددة إلى قائمة تغييرات الاختبار المعزولة حتى لا تتكرر الأجنحة السابقة دون تعديل runtime. لم تُخفَ بوابة SSI ولم يتغير SERIALIZABLE أو retries أو معيار الأخطاء.

قُرئ سجل job الناجح: PostgreSQL 17.11؛ إزالة schema والأدوار أثبتها الاختبار، وإزالة container والشبكة ظاهرة بخطوة Stop containers الناجحة. لم تُشغّل الخدمات محليًا لعدم توفر PostgreSQL/Docker في مساحة العمل؛ التنفيذ الفعلي كان على runner GitHub المعزول. لا تثبيت npm ولا تغيير dependencies.

## العائق المتبقي والخطوة التالية
أُغلق تجاوز الكاتب غير المشارك ضمن fixture ذات الصلاحيات المحدودة. لا عائق متبقٍ لتنفيذ هذه المهمة. لم تُثبت بعد سلامة handlers الفعلية مع المرآة أو تنافس الحذف/الكتابة أو فشل COMMIT الشبكي؛ ولا تتحول هذه النتيجة إلى نجاح SSI أو جاهزية نقل.

**الخطوة التنفيذية التالية فقط:** تركيب هذه المرآة في harness PostgreSQL لمسارات الامتحان الفعلية واختبار start/save/submit والتسوية عبر GET مع تحقق تطابق المصدر والظل والتراجع عند فشل المرآة، دون migration/cutover أو حمل جديد.

لا Production/Staging أو بيانات طلاب أو Google Drive أو دمج/نشر أو خدمات مدفوعة. تحديث حفظ الأدلة فقط لا يمثل تشغيلًا جديدًا؛ مصدر التنفيذ المختبر مثبت أعلاه.
