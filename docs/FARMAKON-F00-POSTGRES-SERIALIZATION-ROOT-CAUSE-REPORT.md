# Farmakon V2 — F00.10.3: PostgreSQL serialization root-cause analysis

التاريخ: 28 أكتوبر 2026، بتوقيت بغداد. أوقات GitHub logs الأصلية UTC.
الفرع: `audit/f00-regression-2026-10-26`؛ [Draft PR #18](https://github.com/PhQMR7S/Farmakon/pull/18) يعتمد على #17. Issue #1 تبقى مفتوحة.

## الحكم

**Passed للتشخيص والاختبارات الحالية، وFailed لمعيار إغلاق مشكلة الموثوقية؛ يبقى الخطر مفتوحاً.**
أُثبتت تعارضات SSI ناتجة عن مشاركة صفحات فعلية بين طلبات تخص طلاباً مختلفين. لم يُثبت إصلاح صغير آمن يزيل نفاد retries السابق، ولم يتغير كود التطبيق. الجولة الجديدة نجحت بصفر أخطاء HTTP نهائية، لكنها احتاجت119 retry في مستويات الحمل الأربعة؛ لا يصح نسب نجاحها إلى إصلاح غير موجود.
**Blocked** مستقل: Registry وSupabase Auth/Storage/Mailpit والتعافي الكامل؛ لم تُعد محاولات تنزيلها.

## 1. الحالة السابقة

[تقرير F00.10.2](FARMAKON-F00-EXAM-CONCURRENCY-RELIABILITY-REPORT.md)، commit `0aa972e762b678d1efe9319763cfe7f632a58526`.
[40559085030](https://github.com/PhQMR7S/Farmakon/actions/runs/40559085030): عند25VU فشل submitExam واحد من50، بإجمالي299 HTTP200 وHTTP503 واحد من300؛ SQLSTATE40001. baseline و44 Browser E2E نجحت؛ بوابة الحمل فشلت.
[40559709299](https://github.com/PhQMR7S/Farmakon/actions/runs/40559709299): نجحت اختبارات التزامن الإضافية والخصوصية وRLS. لم يُنفّذ إصلاح runtime في تلك المرحلة. نجاحها لا يمحو فشل الحمل.

## 2. تتبع آمن داخل الاختبارات فقط

[pg-trace.mjs](../tests/helpers/pg-trace.mjs) يتتبع Request ID اصطناعياً، PID، رقم محاولة المعاملة، مرحلة SQL ثابتة، مدتها، COMMIT/ROLLBACK/release وSQLSTATE. لا يسجل نص SQL أو bind values أو exception messages أو نتائج الاستعلامات أو إجابات أو tokens أو كلمات مرور.
فحص محلي بمؤشر بيانات خاص اختباري أثبت عدم دخوله JSON، مع حفظ عدّ40001 وrelease وحدّ الأحداث.

[testDatabase](../tests/helpers/postgres.mjs) يحقن wrapper في نسخة adapter المترجمة للاختبار فقط. لا hook أو flag في lib/database.ts أو runtime. ما زال يرفض قاعدة غير loopback أو غير `farmakon_v2_test` أو schema موجودة، ولا يستخدم DATABASE_URL. SSL المحلي الاختباري لا يغيّر TLS التطبيق.

في الحمل حُفظت أول900 event تفصيلية، والعدادات وattempt metadata لكل الطلبات، ونافذة140 event للطلب الفاشل إن وجد. سقط17188 event من عينة العرض بسبب الحد؛ لا ندّعي trace كاملاً لكل SQL في الحمل. لم يوجد طلب HTTP فاشل في الجولة الجديدة، لذا failedRequestTraces فارغة. الأقفال الكاملة جُمعت في التجارب الثنائية المخصصة عبر pg_locks، وليست لقطة من كل طلب25VU.
SQLSTATE22012 الواحد في نهاية benchmark هو **اختبار division-by-zero متعمد** لفحص rollback/Pool؛ ليس خطأ حمل.

## 3. تجربة السبب الجذري

الملف: [serialization-root-cause.mjs](../tests/serialization-root-cause.mjs).
معاملتان حقيقيتان SERIALIZABLE فقط: BEGIN لكلتيهما، قراءة كل طالب، لقطة SIReadLock، كتابتان منفصلتان، ثم COMMIT بترتيب مضبوط. لا Supabase ولا HTTP load في تجربة المكوّنات. المتوقع أن تظهر40001 في الحالات المسببة؛ نجاح workflow يعني اكتمال التجربة وفحوصها، لا غياب التعارض.

العينة الصغيرة:8 طلاب،24 محاولة،24 سجل تقدم. العينة الأكبر:1200 طالب،3600 محاولة و3600 سجل تقدم، مع عضويات واشتراكات اصطناعية. هذه **أحجام بيانات**، بينما التزامن في تجربة المكونات يبقى معاملتين.
قارنت قراءة المحاولات النشطة، lookup لمعرف محاولة، catalogue course/announcement، activity، entitlement وUPSERT العضو، مع كتابة attempt بـUPSERT أو UPDATE، أو إضافة activity.

### أثر مثبت

في [40683570052](https://github.com/PhQMR7S/Farmakon/actions/runs/40683570052)، job122800139969، أخذت قراءة المحاولات النشطة لطالبين مختلفين عند1200طالب:
- SIReadLock على heap page0 من farmakon.records لكليهما.
- SIReadLock على page1 من records_owner_kind_created لكليهما.
- نجح COMMIT للمعاملة الأولى؛ رُفض COMMIT الثانية بـ40001، ثم ROLLBACK وrelease.

هذا يتعارض رغم اختلاف الصفوف المقصودة؛ لا يلزم أن يكون الطالب أو الامتحان المشترك كيان الكتابة نفسه. حدود Predicate Locks أوسع من مساواة userId المنطقية.

| Request اصطناعي | PID | محاولة | تسلسل مثبت |
|---|---:|---:|---|
| r1200-active-attempt-read-upsert-0-0 |92|1|BEGIN → active-attempt-read0.274ms → record-upsert0.235ms → COMMIT12.501ms → release |
| r1200-active-attempt-read-upsert-0-1 |93|1|BEGIN → active-attempt-read0.447ms → record-upsert0.247ms → COMMIT40001 خلال0.354ms → ROLLBACK0.191ms → release |

هذه أرقام المكوّن الاختباري المحدد، وليست زمن استجابة Production. البيانات والأقفال والخطط في [الدليل الكامل](evidence/F00.10.3-COMPONENT-TRACE.json).

### المقارنات السببية وحدودها

- أول تشغيل:52 حالة ثنائية،28 abort متوقعاً. العينة الصغيرة تستخدم Seq Scan في قراءات متعددة؛ ظهرت أقفال relation واسعة. عند1200طالب أصبح lookup بالمفتاح الأساسي Index Scan ولم تظهر فيه تعارضات في الحالات المختبرة؛ بقيت تعارضات active-attempt index/page.
- في المسار الذي نما من8 إلى1200، أصبحت activity Seq Scan قبل إعادة ANALYZE. الإحصاءات السابقة أثّرت في الخطة.
- تشغيل ثانٍ [40684015706](https://github.com/PhQMR7S/Farmakon/actions/runs/40684015706)، job122801657017، بدأ بقاعدة جديدة و1200طالب مباشرة، لإزالة أثر تاريخ العينة الصغيرة. اكتمل32 case مع5 abort متوقعة.
- activity في هذه القاعدة الجديدة كانت Bitmap Heap Scan؛ وبعد ANALYZE أصبحت Index Scan على activity_user_target. **التعارض بقي2/2 للطالبين المتجاورين بعد ANALYZE**. لذلك الإحصاءات وحدها ليست إصلاحاً.
- بعد ANALYZE، استخدام مفاتيح متباعدة بمقدار600 طالب أعطى0/2 تعارض في activity و0/2 في active-attempt ضمن تلك العينات. هذا يدعم أثر مشاركة الصفحات، ولا يبرر اختيار معرفات الطلاب لإخفاء المشكلة.
- UPDATE المباشر بدلاً من UPSERT لم يلغ التعارض، بل أنتج حالات إضافية في العينة الصغيرة. لم يُطبّق هذا التغيير على التطبيق.
- كانت بعض نتائج التكرار مختلفة بعد انتقال نسخ الصفوف بسبب التحديث. التنسيق يضبط ترتيب SQL؛ لا يجمّد توزيع الصفوف الفيزيائي أو يجعل كل40001 حتمياً.
- catalogue وmembers وentitlements لم تُظهر تعارضاً في الحالات الأكبر المحددة، لكن ذلك لا ينفي مساهمتها في read sets أخرى. شرط UPSERT العضو الذي يتجنب تحديث الاسم/البريد غير المتغير موجود أصلاً.

**المثبت:** آلية SSI/page-level false-positive conflicts، بما فيها COMMIT وactivity، بين معاملات لا تستهدف صفوف الطالب نفسه.
**غير المثبت:** زوج المعاملات والحواف الدقيقة الذي استنفد المحاولات الخمس في الحمل التاريخي، أو تدخل صغير ثبت أنه يزيل ذلك الفشل. لا يجوز وصف كل40001 بأنه خلل بيانات أو ضمان إصلاحه بمجرد إضافة index.
مرجع [PostgreSQL17 للعزل وPredicate Locks](https://www.postgresql.org/docs/17/transaction-iso.html)، و[إعادة تنفيذ المعاملة كاملة](https://www.postgresql.org/docs/17/mvcc-serialization-failure-handling.html).

## 4. التغييرات والإصلاح

لم يتغير lib/database.ts أو app/api/platform/route.ts أو app/lib/server.ts أو schema runtime. لا migration جديدة، ولا زيادة retries، ولا تخفيض العزل أو Zero Errors، ولا قفل عام أو cache للطلاب.
التغييرات محصورة في أدوات الاختبار وworkflow ونطاقها وتقارير الأدلة:
- tracer محدود واختبار مكوّنات small/large.
- حقن tracer في adapter الاختباري فقط.
- تسجيل retries والطلبات التي احتاجتها وHTTP statuses في benchmark.
- workflow يدوية محصورة بـrepo/branch/PR#18، contents:read، timeout10دقائق، PostgreSQL17 loopback، بلا secrets/artifacts وخدمات مدفوعة.
- بقيت اختبارات500/503 المتوقعة للنفاد/انقطاع النقل منفصلة عن أخطاء الحمل.
- لا نسمّي ANALYZE أو UPDATE «إصلاحاً» بعد أن فشلا في إزالة المكوّن المتعارض.

التوصية المحددة: تجربة تصميم معزولة تُفصل فيها صفوف progress عن exam result events، وتُقارن قراءة المحاولات عبر صف/مفتاح typed ضيق مع records العامة، بنفس الحواجز وقياسات الأقفال. يجب إثبات تقليل الحواف المتعارضة مع حفظ unique-result وF00.6 وبيانات legacy قبل تحويلها إلى migration. لم تُنفّذ إعادة هيكلة تخمينية في هذه المهمة.

## 5. سلامة الامتحانات والاختبارات الحالية

[40684517712](https://github.com/PhQMR7S/Farmakon/actions/runs/40684517712)، job122803334989، commit dd8fcc6، على PostgreSQL17.11 وNode24.21.0 وUbuntu runner x64 بأربع CPUs:
- PostgreSQL integration/Backend route smoke **Passed**.
- ثلاث جولات تزامن موسعة **Passed**: جهازان للطالب نفسه، طالبان مختلفان، حفظ patchين، البدء أثناء حفظ/إنهاء محاولة، تحديث العضو، وتسوية محاولة منتهية بالتزامن. pool بعد كل جولة total2/idle2/waiting0؛ لا فقد إجابة مؤكدة أو ازدواج active غير مقصود أو activity/result أو قبول وصول طالب إلى محاولة الآخر.
- Save مقابل Submit، الاشتراك المنتهي/المسحوب، snapshot/deadline والحد الدقيق للوقت/legacy grace، والتسليم المتكرر اجتازت backend PostgreSQL checks.
- COMMIT conflict الحقيقي رجع بـ40001 وتراجع؛ adapter أعاد التنفيذ ونجح في المحاولة الثانية.
- fault injection من PostgreSQL في كل محاولة أعاد503 بعد خمس محاولات بالضبط، بلا كتابة جزئية وبلا Pool leak. هذه نتيجة سلبية متوقعة، وليست خطأ حمل.
- privacy/deletion وRLS بأدوار PostgreSQL حقيقية **Passed**؛ provider Auth/Storage transport والclaims fixtures، وليست خدمات Supabase حية.
- trace التشخيص عدّ31 حالة40001، منها فحوص العطل المقصود؛ لا تساوي31 طلباً فاشلاً. كل الطلبات الإيجابية نجحت.

فقد الاتصال قبل تأكيد الحفظ ما زال مغطى بدليل Browser E2E السابق ذي API fixture، لا بتجربة شبكة PostgreSQL جديدة هنا. اختبارات الحفظ الحالية تثبت الإجابات التي أكد الخادم حفظها، ولا تدعي حفظ إجابة لم تصل إليه.
TypeScript نجح محلياً، وفحوص syntax/YAML/diff وخصوصية tracer نجحت.
لم يتغير التطبيق، لذلك لم نكرر Build/44 Browser E2E/Auth/PWA السابقة: حالتها السابقة Passed كما في40559085030؛ **ليست Passed جديدة على dd8fcc6**.

## 6. الحمل المحدود الحالي — ليس بعد إصلاح

نُفّذت جولة واحدة فقط1/5/10/25VU بعد نجاح التشخيص. fixture benchmark السابقة750طالباً و1500محاولة قديمة؛ لا تخلط بينها وبين fixture1200طالب لتجارب الخطط.
كل مستوى جولتان من السيناريو الموجود؛ لا زيادة مستخدمين أو thresholds.

| VU | العمليات | HTTP الفعلي | P50 ms | P95 ms | retries إضافية | طلبات احتاجت retry | أخطاء نهائية |
|---:|---:|---|---:|---:|---:|---:|---:|
|1|12|200 ×12|3.42|6.45|0|0|0|
|5|60|200 ×60|6.61|82.49|10|6|0|
|10|120|200 ×120|10.45|100.59|25|13|0|
|25|300|200 ×300|24.28|260.57|84|42|0|

الإجمالي492 استجابة200،119 retry ضمن مستويات الحمل، ولا SQLSTATE نهائي أو HTTP503. بعض الطلبات احتاجت خمس محاولات، أي استهلكت الحد كله ونجحت في الخامسة؛ لا توجد سعة retries إضافية مخفية.
الـbenchmark كاملاً، شاملاً المقارنة والـunindexed diagnostic خارج مستويات الحمل، سجّل135 حالة40001 أُعيدت، و135 retry، و136 ROLLBACK (الأخير division-by-zero المقصود). acquire625 وrelease625؛ لا تسريب اتصال مرصود.
peak RSS283.6MiB؛ app pool peak3/waiting22. `stopped:false`؛ لم تُفعّل حدود الخطأ/p955000ms/RSS768MiB. لو فشل مستوى لتوقف التصعيد حسب الشروط القائمة. لم تُكرر الجولة للبحث عن نتيجة أجمل.

لا نسبة تحسن سببية قبل/بعد: runtime نفسه نجح الآن وفشل سابقاً؛ instrumentation قد تغير التوقيت. لا دلالة على ضمان Zero Errors مستقبلاً أو جاهزية1000 مستخدم متزامن. [الأدلة والعدادات الكاملة](evidence/F00.10.3-RESULTS.json).

## 7. CI وCommits وScope Gate

| Run | النتيجة الحقيقية |
|---|---|
|[40683570052](https://github.com/PhQMR7S/Farmakon/actions/runs/40683570052)|Passed تجربة المكونات8→1200؛ aborts المقصودة ليست فشل workflow|
|[40684015706](https://github.com/PhQMR7S/Farmakon/actions/runs/40684015706)|Passed قاعدة جديدة1200، ANALYZE ومفاتيح متباعدة|
|[40684517712](https://github.com/PhQMR7S/Farmakon/actions/runs/40684517712)|Passed integration والتشخيص وprivacy/RLS والحمل والتنظيف؛ خطوة component منفصلة Skipped وفق label|
|[40684465262](https://github.com/PhQMR7S/Farmakon/actions/runs/40684465262)|Passed scope فقط؛ baseline/postgres/browser Skipped، ليست نجاحاً جديداً لها|

Scope Gate يحتفظ بـcheckpoint a8c2c37 وقائمة ملفات اختبار/توثيق صريحة على فرع التدقيق فقط. أضيفت أدوات التتبع وbenchmark إلى النطاق لإبقاء التجارب يدوية وتجنب حمل تلقائي عند كل push. أي تعديل runtime/dependency/migration يخرج من الإعفاء. لا يمحو هذا فشل40559085030.
Workflows الخاصة بـRegistry وSupabase جاءت Skipped على أحداث labels غير المعنية؛ لا تنزيل أو اختبار Supabase جديد. commit التقرير النهائي موسوم skip ci ولا يحمل نتيجة اختبار جديدة.

Commits:
- [1765189](https://github.com/PhQMR7S/Farmakon/commit/1765189092e344eff59e7ee8e974481a1d68944c): أدوات التتبع وتجربة المكونات.
- [3845a2b](https://github.com/PhQMR7S/Farmakon/commit/3845a2bd4346be027d722f7d799965e1c67fa22b): تجربة الإحصاءات والمفاتيح المتباعدة على قاعدة جديدة.
- [dd8fcc6](https://github.com/PhQMR7S/Farmakon/commit/dd8fcc6e04863a015ed9caf159fa28fc9223a9da): ربط طلبات benchmark بالمحاولات وPIDs وتشغيل التحقق المحدود.

## 8. التوسع، التراجع والتنظيف

1200طالب مسجل في fixture لا يعني1200 مستخدم متزامن. نمو البيانات قد يحسن اختيار الفهارس، لكنه لا يلغي مشاركة صفحات index/heap أو حاجة SERIALIZABLE إلى retry. حسابات المدربين والمالك، الأكواد السنوية/الدائمة والاشتراكات المتعددة أهداف تخطيطية؛ لم تتغير هذه السياسات أو الميزات هنا.
يلزم تقييم تصميم الجداول، توزيع الحمل الفعلي وأزمنة المعاملة قبل تقدير سعة آلاف الطلاب؛ لا قياس حي على Vercel/Supabase.

التراجع: revert لملفات الاختبار/workflow الجديدة وتغييرات helper/benchmark؛ لا migration أو بيانات تطبيق تحتاج عكساً. استُخدم فهرسF00.7 داخل PostgreSQL الموقتة عبر helper السابق فقط، ولم يطبق على Staging/Production.
رُصد غياب schema farmakon بعد الاختبارات، وإغلاق Pools ونجاح Stop containers في التشغيلات. أزيلت علامتا التشغيل اليدوي بعد الانتهاء. لا قواعد بيانات أو نسخ احتياطية أو Docker layers أو tokens أو mail/OTP في Artifacts أو Git/Drive؛ الملفات المرفوعة أرقام وخطط وأقفال وtraces اصطناعية فقط.

## 9. المفتوح والقرار النهائي

- **Passed:** إثبات آلية تنازع الصفحات، أدوات التتبع، الفحوص الحالية وسلامة الامتحانات ضمن العينات وجولة حمل واحدة بصفر أخطاء نهائية.
- **Failed لإغلاق المشكلة:** لم يثبت تدخل runtime يعالج نفاد retries السابق؛ يظل Reliability Risk مفتوحاً. لا نسمّي نتيجة العينة إصلاحاً.
- **Blocked مستقل:** Registry/Auth/Storage المحلي وDR الكامل؛ بوابات F00.8 الحية غير المثبتة تبقى كما هي.
- يبقى التعامل الحالي:40001/40P01 يعيدان المعاملة كاملة بحد خمس؛ عند نفادها rollback ورسالة503 «الخدمة مشغولة مؤقتاً؛ أعد المحاولة.» لا نجاح وهمي، ولا تمديد deadline أو اعتماد إجابة لم يؤكد الخادم حفظها.

PR#18 يبقى Draft للمراجعة، Issue#1 مفتوحة. لا main merge، لا Production deploy أو بيانات حقيقية أو Staging/Auth/Storage settings/role extension أو خدمات مدفوعة أو Drive أو أسعار/اشتراكات/سياسة حذف واحتفاظ. **توقف F00.10.3 هنا؛ لا F00.11 أو ميزات تعليمية لاحقة.**
