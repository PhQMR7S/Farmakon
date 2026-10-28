# Farmakon V2 — F00.9: Disaster Recovery & Retention Readiness

**27 أكتوبر 2026 — PARTIAL / DR الكامل Blocked.** اكتملت مراجعة المخزون وإضافة اختبارات سلامة حزمة اصطناعية؛ لم تُنفذ استعادة Supabase Auth/Storage حقيقية أو محلية. هذه ليست موافقة إطلاق أو سياسة احتفاظ نافذة.

## 1. نقطة البداية والوضع السابق
- HEAD المثبت قبل هذه الجولة: `cd1e261d98959d0f2866cf79ff34a105c42e0bb4`.
- الفرع `audit/f00-regression-2026-10-26`، [Draft PR #18](https://github.com/PhQMR7S/Farmakon/pull/18) إلى `feat/farmakon-v2-p0-privacy` ويعتمد على #17؛ Issue #1 تبقى مفتوحة.
- مراجع: [F00.4](FARMAKON-F00-PRIVACY-RECOVERY-REPORT.md)، [F00.7](FARMAKON-F00-PERFORMANCE-ACCESSIBILITY-REPORT.md)، [F00.8](FARMAKON-F00-AUTH-LIFECYCLE-REPORT.md).
- راجعت `tests/recovery-dr.mjs`: pg_dump/restore حقيقي داخل PostgreSQL CI، مع AES-256-GCM وPDF محلي وRLS وسجل حذف أحدث. لكن dr_auth_fixture ليس auth.users، والملف المحلي ليس Storage API. لا إعادة لهذه التجربة ولا ترقيتها إلى استعادة مزود كاملة.
- مراجعة الكود والتقارير السابقة محفوظة؛ لا تغييرات لمنطق التطبيق أو درجات أو اشتراكات أو حذف حقيقي.

## 2. الإمكانات والخطة والعوائق المثبتة
قراءات Supabase المتصلة تخص **Staging فقط** `qfzharpouemueipsrduv`: ACTIVE_HEALTHY، PostgreSQL 17.11.0.003. المنظمة المرتبطة بخطة **free / tier_free** حسب get_organization. لا مشروع أو فرع جديد اقترح للتنفيذ ولا اقتباس تكلفة غير مثبت؛ لم يستدع confirm_cost/create_project/create_branch/restore_project.

فحص بيئة التنفيذ: Node **v24.22.1** متاح؛ لا docker أو podman أو nerdctl أو supabase أو psql/pg_dump/initdb في PATH، ولا Docker/Podman socket في المواقع المعتادة المفحوصة. لذلك لا محرك حاويات متاح لتشغيل Supabase محلياً؛ تثبيت CLI وحده لا يوفر المحرك. لم أفتح محركاً بعيداً أو شبكة أو خدمة مدفوعة بديلاً.

الأداة المتصلة توفر project/organization/migrations/SQL metadata وعمليات restore مُغيرة للحالة، لكنها لا توفر في هذه الجلسة تصدير backup read-only أو نقل bytes لـAuth/Storage إلى هدف جديد معزول. لم تُستخدم Staging كوجهة استعادة، ولا Production كمصدر.

[التوثيق الرسمي للنسخ](https://supabase.com/docs/guides/platform/backups) يميز النسخ اليومية للخطط المدفوعة عن تصدير CLI المقترح لـFree؛ نسخة DB لا تحتوي بايتات Storage. لم أفترض وجود نسخة يومية قابلة للتنزيل لهذه المنظمة أو PITR أو استحقاق Restore-to-new-project. لا تكلفة سحابية جديدة في الجولة. المحاولة المباشرة لقراءة changelog.md فشلت بـUnsupported content-type؛ راجعت صفحات أدلة النسخ والاستعادة الحالية بدلاً من ادعاء قراءة changelog ناجحة.

## 3. مخزون الاستعادة
هذه خريطة schema/كود، وليست export لصفوف المستخدمين. لا dump لقاعدة Staging أو بيانات حقيقية أُنشئ.

| الأصل | ما يجب حفظه واستعادته | المسار وحدوده |
|---|---|---|
| PostgreSQL | schema farmakon، بيانات الجداول الثمانية، indexes/constraints/functions/triggers/policies/grants/extensions اللازمة | تصدير منطقي متسق بالمسار الرسمي؛ استعادة إلى هدف فارغ فقط؛ privileges تعاد بمراجعة لا بكلمات أدوار قديمة |
| members | id/email/name/created وربط UUID بهوية Auth | بيانات شخصية؛ داخل حزمة مشفرة محدودة الوصول |
| records | course/lesson/file/asset/question/exam/attempt وغيرها من kinds الحالية وJSON المرتبط | snapshot الأسئلة والدرجات وtimingVersion والـdeadline لا يعاد تفسيرها أو تصحيحها |
| activity | progress/notes/results والأحداث المربوطة user_id/kind/target | checksum وربط الهوية والتحقق من unique(user_id,kind,target) وعزل A/B |
| enrollments | email/course_id/expires/source | expires المطلق يبقى كما هو؛ لا تحويل مدة قديمة إلى اشتراك جديد من تاريخ الاستعادة |
| codes | hash/suffix/course_id/days/expires/used_by/used_at | لا plaintext codes؛ لا إعادة فتح consumed code؛ يلزم سجل أحدث للاستهلاك/السحب بعد النسخة |
| settings | إعدادات التطبيق وstorage-owner غير السرية | لا نسخ قيمة مالك قديم إلى هدف مفتوح دون مراجعة؛ لا كشف القيم |
| deletion_jobs | user_id/email/policy/state/lease/attempts/timestamps | سجل أحدث مستقل عن snapshot، ذو بيانات شخصية؛ لا إعادة تشغيل lease أو worker قديم تلقائياً |
| rate_limits | HMAC keys/count/reset_at | سياسة استعادة أو إعادة تهيئة حذرة مع بقاء deny-closed؛ لا إحياء quota قديمة أو تعطيل الحماية |
| Supabase Auth | users/identities/password hashes والعلاقات والإعدادات اللازمة | [المسار الرسمي](https://supabase.com/kb/troubleshooting/migrating-auth-users-between-projects) يسمح نقل Auth والجداول المرتبطة؛ password hashes حساسة وتحتاج نفس حماية النسخة؛ admin createUser ليس استعادة كلمة مرور |
| Auth sessions/tokens/flows | فصلها عن قرار استعادة الهوية | الهدف المقترح يفرض reauthentication؛ لا إعادة refresh/session/OTP أو recovery grants القديمة. آلية الاستبعاد/الإبطال المدعومة تحتاج تجربة مزود حقيقية |
| Storage | bytes لكل object + bucket/name/MIME/size/hash والمالك owner_id/owner والروابط من records | نقل مستقل عبر API/أداة مدعومة، checksum لكل ملف؛ INSERT metadata وحده لا يعيد الملف |
| Storage bucket | public=false، file_size_limit=52,428,800، MIME الستة الحالية | هذه القيم مثبتة read-only؛ لا تحويل public أو تغيير صلاحيات لتسهيل الاستعادة |
| RLS/grants | farmakon backend_access والدوال الضيقة وسياسات Storage | مراجعة policy source وsearch_path وREVOKE/GRANT ثم فحص سلبي بالهويات الحقيقية للهدف |
| migrations/app | source commit/lockfile، history، SQL اليدوية الخاصة بـStaging، إعدادات غير سرية | مجلد migrations وحده ليس baseline كاملاً؛ لا تفعيل scripts/staging تلقائياً في Production |
| أسرار خارج النسخة | DB role passwords، JWT signing/encryption keys، service-role/API secrets، SMTP/OAuth credentials، Vercel secrets، backup decryption key | مخزن أسرار مستقل وصلاحيات منفصلة، لا GitHub/Drive/CI artifacts؛ مراعاة Vault/encryption root إن استعمل لاحقاً؛ لا مفاتيح حقيقية قُرئت |

الـPDFان في الاختبار الجديد مجرد bytes اصطناعية؛ محتوى auth-fixture.json نص اصطناعي وليس بيانات Auth قابلة للاستعادة.

## 4. مراجعة schema والمهاجرات الحالية
قراءات metadata الجديدة أثبتت:
- الجداول activity/codes/deletion_jobs/enrollments/members/rate_limits/records/settings؛ RLS=true للجميع.
- backend_access إلى farmakon_app على الجداول الثمانية. سياسة Storage المقيدة farmakon_active_storage_session، وSELECT farmakon_authenticated_read، وINSERT farmakon_owner_upload إلى authenticated؛ لم تُعَد الاختبارات السلوكية السابقة.
- 14 index: PK لكل جدول، activity_user_target وcodes_hash_unique وenrollment_email_course وrate_limits_reset وrecords_kind/records_course. فهرس F00.7 **records_owner_kind_created غير موجود في Staging**؛ لم يطبق.
- سجل migrations الفعلي: 20261026060902 baseline، 20261026060903 rate limits، 20261026081852 storage، 20261026121339 sessions، 20261026121508 storage session guard، 20261026141923 isolated role، 20261027050713 synthetic deletion.
- اختلاف أسماء/أوقات بعض scripts في المستودع عن history الفعلية موثق؛ لا rename أو repair migration history نفذ.
- الربط بين records JSON وusers/course ليس كله FOREIGN KEY في bootstrap؛ يلزم فحص orphan references صريح بعد الاستعادة، لا الاكتفاء بنجاح SQL.
- دور Staging بقي connlimit=3، superuser/bypassrls=false، ينتهي **2 نوفمبر 2026 23:59:59 UTC**؛ لا تمديد.

## 5. التحسين المنفذ في الأدوات الاختبارية
ملفان جديدان، دون تعديل harness PostgreSQL السابق:
- `tests/recovery/backup-envelope.mjs`: غلاف AES-256-GCM، nonce عشوائي 96-bit، مفتاح 256-bit يمرر منفصلاً، AAD ثابت، خطأ عام لا يطبع محتوى النسخة. لا اتصال أو استخراج ملفات أو تنفيذ SQL.
- `tests/recovery/backup-envelope.test.mjs`: 16 اختباراً اصطناعياً تعمل بـNode built-ins دون dependencies أو credentials.

التحقق يتطلب **inventory مستقلاً موثوقاً من المستدعي**: snapshotId/schemaVersion/migration IDs والمسارات. رفض التطابق الذاتي مع manifest وحده مهم، لأن حزمة ناقصة قد تكون مشفرة بتوقيع صحيح إذا أسقط exporter ملفاً وmanifest entry معاً. hash/size لكل component، canonical Base64، منع duplicate/extra/missing files وpath traversal، وسقف الحزمة 16 MiB **للاختبار فقط**، لا حد نسخ المنصة.

هذه طبقة فحص bytes/manifest مستقلة **لم تدمج في مسار نسخ/استعادة إنتاجي أو في recovery-dr.mjs القديم**. لا تتحقق من صحة SQL أو password hashes أو مالك object أو صلاحياته أو اكتمال inventory الأصلية؛ تلك اختبارات لاحقة مستقلة. ملف اسمه auth-fixture لا يثبت Auth restore. مفتاح الاختبار في الذاكرة ويصفّر في finally؛ هذا ليس نظام custody أو استعادة مفتاح طويل الأجل أو ضمان محو كل نسخ ذاكرة JavaScript.

## 6. النتائج الجديدة
الأمر المنفذ فعلياً:
`node --test tests/recovery/backup-envelope.test.mjs`

**16 passed، 0 failed**، Node v24.22.1، زمن test runner المرصود **118.357001 ms**. هذا وقت الاختبارات الصغيرة، **ليس RTO أو أداء استعادة**.

| الفحص | النتيجة والنطاق |
|---|---|
| roundtrip/bytes/checksums لخمسة components منها PDFان | Passed — in-memory synthetic envelope |
| nonce جديد لنفس payload/key | Passed — الغلافان مختلفان |
| ciphertext معدّل/مبتور | Passed: رفض |
| مفتاح خطأ مع AAD صحيح | Passed: رفض؛ لا خلط بين wrong key وAAD مفقود |
| Object مفقود مع manifest موجود | Passed: رفض |
| Object وmanifest entry محذوفان معاً | Passed: رفض بمقارنة inventory المستقلة |
| Auth component مفقود | Passed: رفض المكوّن الاصطناعي؛ لا استعادة مزود |
| component إضافي/مسار مكرر/size أو SHA خاطئ/Base64 غير قياسي | Passed: رفض |
| schema/migration/snapshot mismatch | Passed: رفض على مستوى contract؛ لا تنفيذ migrations حقيقي جديد |
| traversal حتى مع inventory خاطئة تسمح به | Passed: رفض |
| عزل A/B بعد restore وStorage permissions | **Blocked جديداً**؛ دليل PG/RLS السابق فقط محفوظ |
| Auth passwords/login ورفض old sessions في هدف مستعاد | **Blocked** — لا Supabase محلي/هدف جديد |
| حذف بعد snapshot/اشتراك مسحوب بعد snapshot | **Blocked للمزود الكامل**؛ نموذج ledger السابق لا يثبت ذلك للمزود |
| cleanup لحاويات/حسابات/نسخ | لا شيء منها أنشئ؛ الاختبار كله في الذاكرة |

لم تُنفذ TypeScript/build/browser/load/deletion/exam/PG regression من جديد: لا ملف تطبيق أو dependency أو migration أو harness سابق تغير. الاختبارات الجديدة فقط نفذت. تحديث Git بـ[skip ci] يمنع workflow الكامل الحالي من إعادة الحمل والحذف والامتحانات تلقائياً؛ **لا CI جديد ناجح يدعى**. مراجع CI السابقة [40499903858](https://github.com/PhQMR7S/Farmakon/actions/runs/40499903858) و[40502372995](https://github.com/PhQMR7S/Farmakon/actions/runs/40502372995) تخص commits السابقة المسجلة في F00.7/F00.8، وليست دليلاً على الملفات الجديدة. SHA هذه الجولة يثبت في PR بعد الرفع.

## 7. RTO/RPO والبيئات
| البيئة | ما ثبت | RTO/RPO |
|---|---|---|
| PostgreSQL CI المعزولة السابقة | dump/restore/SQL/RLS + local Auth/objects fixtures | سابق فقط: F00.4 سجل 1629 ms ثم 1731 ms، وRPO=0 للبيانات الساكنة مع replay ledger؛ لم تُعد |
| Node F00.9 | تشفير/سلامة/اكتمال مكونات اصطناعية | لا RTO/RPO استعادة مقاسان |
| Supabase محلي | لم يشغل بسبب غياب المحرك والأدوات | Blocked / غير مقاس |
| Supabase Staging | metadata read-only فقط؛ ليس مصدر dump أو وجهة restore | غير مقاس |
| Production | لم يصل إليه كبيانات ولم يستخدم كمصدر | غير مقاس |

لا جمع بين هذه البيئات، ولا ادعاء أن نموذج Auth أو PDF محلي يثبت استعادة password hashes أو Storage bytes عبر API.

## 8. خطة الاستعادة المقترحة — لم تنفذ
1. هدف Supabase محلي جديد متوافق الإصدارات، بلا SMTP/webhooks/عامة أو اتصال Production. تأكد Docker والموارد والنسخ والصلاحيات قبل البدء؛ لا مشروع cloud جديد تلقائي.
2. هويات A/B ومالك اصطناعية جديدة، password hashes واختبارات login عبر Auth، course/enrollments/codes/attempt/notes وPDFين بملكية معلومة. لا mailbox حقيقية لازمة لهذا DR؛ التأكيد الإداري لا يغلق F00.8.
3. لقطة ثابتة أثناء وقف الكتابات الاختبارية؛ schema/roles/data/history وفق CLI المدعوم ونسخ Objects عبر API منفصل. inventory مستخرجة مستقلاً وhash لملفات metadata والبايتات. أي version/schema failure يبقي quarantine مغلقة.
4. المفتاح في قناة منفصلة؛ archive مشفر فقط، لا secret في CLI args/logs. قياس فقدان مفتاح وتلف component وmissing object **قبل** أي قرار اكتمال؛ لا رفع backup إلى git/Drive/artifacts.
5. استعادة في هدف جديد فارغ مع new runtime credentials؛ إعداد SMTP/OAuth/redirects يراجع منفصلاً. لا نسخ مفاتيح التوقيع القديمة افتراضياً. استعادة هوية المستخدم وكلمة مروره لا تتطلب قبول جلساته القديمة.
6. قبل فتح أي route: منع login/refresh ثم إبطال/استبعاد sessions/refresh/OTP/recovery flow القديمة بطريقة مزود مختبرة. تغيير JWT signing وحده **لا يثبت إبطال refresh tokens**؛ يجب فحص الاثنين.
7. اجلب أحدث deletion ledger من قناة مستقلة موثوقة وذات watermark قابل للإثبات؛ إذا مفقود/قديم/غير قابل للتحقق، لا فتح. طبق الحذف على Auth/Storage/app وصدّق counts/checksums ثم شغّل اختبارات A/B.
8. deletion ledger وحده لا يزيل اشتراكاً سحب بعد snapshot ولا يعلّم code استُهلك بعده. يلزم أحدث entitlement/code journal أو مصدر معتمد لإعادة المطابقة؛ إن تعذر، امنع الحقوق المتأثرة إلى المراجعة. expires القديمة لا تمدد؛ افحصها مقابل وقت الخادم الحالي.
9. اختبر revoked/expired access وrefresh/device pairs، عزل الملفات والسجلات، توقيت الدرجات واستمرار deadline دون إعادة تصحيح، وحساب حُذف بعد النسخة. لا تحويل Pass النموذج إلى Pass المزود.
10. افتح الهدف فقط بعد checksum والعزل والجلسات وreconciliation؛ RTO من بداية recovery حتى هذا القرار وRPO بحسب آخر كتابة مؤكدة/خسارة فعلية مع timestamps، لا من زمن فك التشفير وحده.

[دليل CLI الرسمي](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) يتطلب مراجعة history وتخصيصات auth/storage والإصدارات. [دليل self-hosted](https://supabase.com/docs/guides/self-hosting/restore-from-platform) يوضح الفصل بين DB وStorage والأسرار والإعدادات. لا نطبق أوامر عامة على Staging الحالية أو نتجاوز أخطاء schema بحذف صفوف غير مفهومة.

## 9. المخاطر المؤكدة والفجوات
- **فجوة readiness عالية الأثر:** DB snapshot وحدها لا تعيد الملفات أو إعدادات Auth، وقبول snapshot قديمة دون reconciliation يمكنه إحياء حساب/حق مسحوب. لم يقع restore حي يثبت حادثة أو استغلال في التطبيق.
- **فجوة tooling:** harness السابق يفحص manifest ثابتاً وPDF محلياً ولا يحتوي اختبار missing component مستقلاً. اختبارات F00.9 تغطي غلافاً مستقلاً؛ لا ندعي إصلاح exporter أو المزود الكامل.
- **فجوة بيانات تشغيلية:** tombstone الحالية تحفظ email plaintext وUUID، والنسخ قد تحفظ hashes وبيانات مالية؛ التشفير لا يلغي الحاجة لتقليل البيانات/مدة/صلاحيات معتمدة.
- backend RLS policy ليست row-by-row لكل طالب؛ تطبيق identity/entitlement وStorage helpers جزء من استعادة العزل، فلا يكفي RLS=true.
- لا destination أو key custody أو independent fresh ledger/journal أو SLO معتمدة للنسخ الفعلية. لا خدمة مراقبة أو جدول نسخ دائم فُعل.
- تنظيف lease بعد كارثة قرار تشغيل منفصل بعد التأكد من عدم وجود عامل نشط؛ لا إعادة replay لworker من snapshot تلقائياً.

## 10. وثيقة قرار الاحتفاظ — خيارات غير نافذة
الأرقام التالية **خيارات تشغيلية للنقاش وليست مدد احتفاظ قانونية أو اعتماداً**. تحديد البلد والجهة المسؤولة والغرض المالي/التعاقدي والمراجعة المختصة يسبق اعتماد أي مدة لازمة قانوناً. لم نغير synthetic-v1.

| الفئة | خيار A أقل بيانات | خيار B نافذة مراجعة | القرار المطلوب |
|---|---|---|---|
| ملف شخصي وملاحظات/تقدم بعد الحذف | محو عند اكتمال الطلب المصرح | مهلة استرداد مقترحة 7 أيام قبل الحذف النهائي، ثم محو | فوري أم مهلة؟ الأداة الحالية ليست سياسة عامة لمهلة |
| طلبات الاشتراك/سجلات مالية | إزالة/فصل الهوية متى انتفى الغرض المعتمد | حفظ حد أدنى مقيد لغرض مالي/نزاع لمدة تحدد بمراجعة مختصة | الحقول/الغرض/المدة/صاحب الصلاحية؛ لا نختار مدة قانونية |
| نتائج الامتحان | محو النتائج الشخصية مع الحساب | إحصاءات غير قابلة لإعادة التعرف بعد تقييم anonymization | هل توجد حاجة تعليمية/تعاقدية لحفظ نتائج فردية؟ |
| سجلات أمان تقنية | 30 يوماً مقترحة بلا tokens/answers | 90 يوماً مقترحة لتحليل إساءة مع حصر الوصول | نافذة تشغيلية واعتماد fields؛ لا تغيير log pipeline |
| tombstones | pseudonymous identifiers عند كفايتها تقنياً | UUID + رابط بريد محدود ومشفر إن لزم لمنع إحياء الهوية | plaintext email الحالية لا تغيّر آلياً؛ HMAC ما زال بيانات مستعارة لا anonymization |
| النسخ المشفرة | نافذة rolling 7 أيام مقترحة | 30 يوماً مقترحة لاستعادة متأخرة | سعة/كلفة/خسارة مقبولة/جهة حيازة المفتاح ووجهة مصرح بها |
| إعادة نفس البريد | حساب جديد بلا أي اشتراك/سجل قديم بعد سياسة إعادة ربط واضحة | منع إعادة التسجيل لمدة يحددها المالك والمراجعة المختصة | التمييز بين UUID محذوف وبريد عاد؛ حواجز tombstone الحالية تمنع الربط ولا تعدل الآن |
| restore نسخة قديمة | replay ledger/journal الأحدث قبل أي فتح | نفس الإلزام مهما كانت نافذة النسخة | لا خيار يجيز إحياء الحذف أو تمديد الاشتراكات |

يجب أن يعيش سجل الحذف اللازم لإعادة التطبيق **أطول من أقدم نسخة قابلة للاستعادة فعلياً** حتى انتهاء جميع النسخ/النسخ المكررة المعنية؛ تعتمد التفاصيل فقط بعد تحديد النسخ والاحتفاظ. فقدان المفتاح لا يعوض توثيق حذف النسخ أو معرفة نسخ إضافية. لا ضمان محو cache/ملف نُزّل على جهاز مستقل.

مطلوب من المالك: اختيار الهدف المحلي/الموارد أو الموافقة الصريحة على أي تكلفة cloud لاحقة، وجهة حفظ مشفرة خارج git/Drive حتى يصدر تصريح، حائز مفتاح مستقل وصلاحية الاسترجاع، SLO/RPO/RTO المطلوبة، خيارات الاحتفاظ أعلاه، مصدر ledger/journal مستقل، وسياسة إعادة التسجيل. لا ننشئ تلك الخدمات بهذا التقرير.

## 11. التراجع والتنظيف والحدود النهائية
- لا حساب/جلسة/ملف Storage/حاوية/قاعدة أو نسخة DB جديدة أُنشئت. لا snapshots أو backups أو مفاتيح رفعت إلى git أو CI artifacts أو Drive؛ المرفوع source tests والتقرير فقط.
- الاختبارات في الذاكرة، لا كتابة archive أو dump للقرص؛ المفاتيح المؤقتة تصفّر best-effort. ملفات source المحلية تطابق ما سيحفظ في الفرع.
- التراجع هو revert ملفات tests/recovery الجديدة والتقرير فقط؛ لا data rollback. لا تغيير migrations أو helpers أو دور Staging أو Auth أو index F00.7.
- لا Production merge/deploy أو مشروع Supabase جديد أو خدمات مدفوعة أو سياسة احتفاظ نافذة.
- بوابة DR الكاملة **Blocked**: يلزم اختبار Auth/Storage محلي فعلي ثم قرار نطاق قبول managed Supabase، ومراجعة الإصدارات/الملكية/الجلسات والسحب/الحذف.
- بوابات F00.8 الأربع تبقى **Blocked**: البريد الحقيقي، recovery بالرسالة، JWT الطبيعي وتجديده، إعدادات Auth التفصيلية. F00.7 يبقى نجاحاً محدوداً مع فجوات السعة الحية والوصولية/الخط، ولا يدعى إغلاق F00.
- توقف عند F00.9؛ Issue #1 مفتوحة وPR #18 Draft، لا مرحلة تالية قبل المراجعة.
