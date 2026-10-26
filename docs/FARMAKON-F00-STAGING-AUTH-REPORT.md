# Farmakon F00.2 — Staging وAuth والجلسات

التاريخ: 26 تشرين الأول 2026. **الحالة: تنفيذ جزئي آمن؛ الاختبارات الحقيقية محجوبة، F00 غير مكتملة.**

## المرجع والاعتماد
- استمرار مباشر من `f3485a709f9a2a1dfe4e504c69cb4c64f927b75e` على `audit/f00-regression-2026-10-26`.
- تحققت من [Run 40333933479](https://github.com/PhQMR7S/Farmakon/actions/runs/40333933479): baseline/postgres/browser ناجحة.
- [Draft PR #18](https://github.com/PhQMR7S/Farmakon/pull/18) موجود، يستهدف `feat/farmakon-v2-p0-privacy` ويعتمد على #17. لم أغير هدفه أو أدمج أي فرع.
- إصلاح Offline Expiry واختباراته محفوظة؛ لا إعادة منصة أو حذف حساب أو تنفيذ F01/F11/F12.

## المنجز فعلياً
1. فحص branch-specific Vercel variables وStaging helpers/ACL دون طباعة قيم سرية.
2. إنشاء **ثمانية overrides للفرع الحالي، preview فقط**: DATABASE_URL، DATABASE_CA_CERT، NEXT_PUBLIC_SUPABASE_URL، NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY، FARMAKON_OWNER_EMAIL، FARMAKON_RATE_LIMIT_ENABLED، FARMAKON_RATE_LIMIT_SECRET، FARMAKON_STRICT_SESSIONS_ENABLED.
3. URL ومفتاح Auth/Storage يخصان مشروع Staging الحالي حصراً. شهادة CA من إعداد Staging السابق. سر quota جديد خاص بهذا الفرع، محفوظ sensitive. إعداد strict وquota=true في الفرع، **ليس تفعيل runtime مثبتاً**.
4. DATABASE_URL override **فارغ عمداً**: اتصال Staging السابق من نوع sensitive ولا يعيد الموصل قيمته؛ يمنع ذلك وراثة اتصال Preview الافتراضي المشترك مع Production. لم أبدل الاتصال الإنتاجي ولم أنشئ credential جديداً قبل توفر معلومات الاتصال الموثقة.
5. أبقيت automatic deployment معطلاً. فحص deployments أعاد صفر عمليات نشر للفرع. لا Preview جديدة ولا ادعاء نجاح التطبيق على DB غير متصلة.
6. إضافة حاجز fail-closed قبل إنشاء Pool أو Auth client، وفي proxy قبل أي استدعاء Auth: Preview تقبل فقط هوية Staging المثبتة في الكود، مع تطابق HTTPS Auth وDB host أو pooler tenant suffix؛ ترفض endpoints الإنتاج أو النقص أو تعطيل strict/quota أو خيارات URL التي قد تخفض TLS. خطأ ثابت دون قيم اتصال. لا يغير الحاجز سلوك Production أو الاختبارات المحلية.
7. إضافة اختبار اختياري **حقيقي عبر Supabase SDK وHTTP** في tests/live/staging-auth.mjs. ليس Mock، لكنه **لم ينفذ بهويات حقيقية**. يحتاج ثلاثة حسابات disposable موسومة من admin وPreview موثقة في staging-target.json؛ القائمة مغلقة حتى يتوفر deployment موثق. يرفض المشاريع/الحسابات/الأهداف غير المسموحة ويمنع طباعة تفاصيل الأخطاء السرية.

## المشكلة المؤكدة والإصلاح
**High / خطر خلط البيئات:** إعدادات Preview الافتراضية تسمح بوراثة DB الإنتاج، بينما override السابق خاص بفرع #14 فقط. قبل هذه الجولة كان النشر معطلاً، لذلك لا أدعي وقوع تسريب أو اتصال إنتاج تجريبي. لكن رفع التعطيل دون ضبط كل override كان سيعرّض الاختبارات للبيانات الحقيقية.

طريقة التحقق: قراءة scopes/branches لأسماء envs، ثم تجربة إعدادات مختلطة/ناقصة في الاختبار. الحماية الجديدة ترفض قبل الاتصال بالشبكة. اختبارات constructor traps على المصادر الفعلية أثبتت أن Auth client وDB adapter وproxy لا تصل إلى provider/cookies/SQL عند وجود إعداد Preview غير صالح. اختبار الرفض كُتب أولاً ثم الحاجز؛ لا يُعد ذلك إثبات استغلال لحساب مستخدم.

الملفات: lib/farmakon/preview-isolation.ts، lib/database.ts، lib/supabase/server.ts، proxy.ts، tests/preview-isolation-smoke.mjs، tests/helpers/postgres.mjs، tests/live/staging-auth.mjs، tests/live/staging-target.json، .github/workflows/quality.yml وهذا التقرير. لا migration أو تعديل بيانات طلاب أو أسعار أو سياسة اشتراك.

## إثبات العزل وحدوده
| العنصر | ما تحقق |
|---|---|
| مشروع الاختبار | Farmakon-Staging، المرجع غير السري qfzharpouemueipsrduv |
| Auth وStorage | URL staging مطابق، bucket farmakon خاص؛ لا تغيير ACL |
| PostgreSQL | helper الجلسات موجود؛ لا اتصال تطبيق جديد مثبت لأن DATABASE_URL فارغ |
| الوصول إلى auth.sessions | farmakon_app لا يملك SELECT؛ يملك execute للـboolean helper فقط |
| دور المتصفح | authenticated لا يستطيع execute للـbackend helper |
| Storage session guard | سياسة RESTRICTIVE موجودة في Staging |
| Vercel | overrides للفرع فقط وهدف preview؛ لا default/production env edits |
| Deployment Protection | SSO enabled، prod deployment URLs/all previews؛ لم تُضعف |
| Production | لم يُنشر أو يُعدل أو يُستخدم للاختبار |

هذا إثبات **منع اتصال غير معزول وإعداد نطاقات التجربة**، وليس إثبات أن Preview جديدة تعمل؛ لا نشر قبل توفير اتصال staging والتحقق منه. Preview الحالية القديمة تخص #14 ولا تحتوي تعديلات هذه الجولة.

### اتصال provider دون حساب
طلب HTTPS مباشر إلى إعدادات Auth في Staging بالمفتاح publishable أعاد 200: البريد مفعّل، تأكيد البريد مطلوب، anonymous sign-in معطل. هذا يثبت وصول endpoint وإعداداته فقط، ولا يثبت وصول رسالة أو نجاح هوية أو اتصال Preview بقاعدة البيانات.

## الهويات والبريد والجلسات الحقيقية
فحص aggregate لـStaging أظهر **مستخدمين اثنين مؤكدين**. لا ثلاث هويات تحت تحكم الاختبار، ولا بيانات دخول متاحة للموصل. لم أقرأ كلمات مرور أو tokens، ولم أستخدم حساب إنتاج أو أعدل هويات Staging الموجودة.

| الفحص | النتيجة في هذه الجولة |
|---|---|
| مالك تجريبي + A + B بمعرفات Auth مختلفة | Blocked؛ لا ثلاث هويات جاهزة |
| signup وتأكيد البريد ووصول الرسالة فعلياً | Blocked؛ لم تُرسل رسائل تجريبية |
| login/logout/recovery كاملة | Blocked للمستخدمين؛ لا ادعاء نجاح محاكاة كبديل |
| local logout من جهازين / global logout / replay | Blocked حياً؛ موجود في suite اختيارية جزئياً |
| انقضاء token وتغيير كلمة المرور وتأثيرها | Blocked حياً؛ يجب قياس سياسة Auth الفعلية |
| سحب الاشتراك والصلاحيات أثناء جلسة | Blocked حياً؛ الفحوص المعزولة السابقة ليست دليلاً حياً |
| strict session guard | منطق #17 مراجع وhelpers صالحة ACL؛ env=true على الفرع غير المنشور؛ لا runtime activation ناجحة ادعيتها |
| تصعيد الصلاحية من user_metadata | اختبار fixture ناجح سابقاً؛ الاختبار الحقيقي معدّ ولم ينفذ |
| ملفات/كورسات وعزل بيانات A/B | Blocked حياً؛ يلزم fixtures مأهولة لا مجموعات فارغة |

لوحة Supabase وصلت إلى صفحة sign-in في هذا المتصفح. استُخدم browserAuth الآمن، وأعاد submitted فقط؛ بعدها عرض الموقع **hCaptcha**. لم أعتبر submitted نجاح دخول، ولم أحل CAPTCHA أو أتجاوزها. يلزم تدخل المالك في المتصفح نفسه. لا تعطيل لتأكيد البريد أو الحماية لتجاوز هذا العائق.

## الاختبارات المنفذة فعلياً
| الاختبار | النتيجة |
|---|---|
| npm run typecheck | Passed محلياً |
| backend-smoke / auth-smoke / http-smoke / pwa-smoke | Passed محلياً؛ نقل Auth/Storage fixtures |
| npm run build | Passed محلياً |
| preview-isolation-smoke | Passed؛ حالات production/mixed/missing/disabled guards وentry-point traps |
| Playwright desktop + Android RTL | Passed محلياً **24/24**، منها Offline Expiry |
| syntax لاختبار Auth الحقيقي | Passed؛ لا يثبت دورة Auth حقيقية |
| تشغيل live suite دون الأسرار والهدف المسجل | Blocked متعمد قبل أي محاولة مستخدم؛ لا يُعد Passed |
| PostgreSQL وRLS والجلسات | فحص ACL حي read-only؛ اختبارات CI الجديدة تُراجع منفصلة قبل نسب النجاح إلى هذا الكود |

نتائج CI الجديدة وروابطها تُدرج في وصف PR #18 بعد انتهاء التشغيل، مع SHA المختبر؛ لا ينسب نجاح التشغيل السابق إلى كود هذه الجولة تلقائياً.

## التراجع والأمور المؤجلة
- لا DDL/DML بهذه الجولة، فلا schema rollback. التراجع عن الحاجز يكون على الفرع فقط؛ لا تنشر فرعاً تزيل حمايته قبل إثبات العزل.
- عند التراجع عن envs أبق DATABASE_URL فارغاً والنشر معطلاً؛ حذف override الفارغ قد يعيد وراثة الإنتاج. لا تحذف الإنتاج/المستخدمين/Storage.
- لا تنفيذ لحذف الحساب. السياسة المقترحة للمراجعة لاحقاً: إعادة تحقق حديثة، منع حذف المالك الوحيد، إبطال الجلسات أولاً، عقد احتفاظ واضح للمدفوعات/الدعم، إزالة البيانات المملوكة تدريجياً مع قابلية إعادة المحاولة، وفحص Cache/Storage واستعادة معزولة. هذه متطلبات فقط.
- تحذير Supabase الوحيد المقروء ما زال leaked-password protection disabled؛ لا ترقية مدفوعة.
- بوابات F00 السابقة الباقية: حذف الحساب لاحقاً، backup/restore كامل، سلوك الامتحان عند إغلاق المتصفح، وصولية وأداء أوسع. لم أبدأها في F00.2.

## المطلوب من المالك والخطوة التالية داخل F00.2
1. إكمال hCaptcha وتسجيل الدخول إلى Supabase في المتصفح المعروض؛ لا ترسل كلمة مرور أو OTP في المحادثة.
2. توفير اتصال **Staging فقط** من اللوحة إلى override الفرع بطريقة آمنة؛ نتحقق من host/tenant/TLS قبل أي نشر.
3. تجهيز مالك اختباري وطالبين disposable مستقلين مع بريد اختباري يمكن استقباله، مع الحفاظ على تأكيد البريد. تغيير كلمة المرور/إنشاء credentials في واجهة المتصفح يتم بيد المالك.
4. بعد ذلك فقط: نشر Preview محمية معزولة، تحديث allowlist الاختبار بالعنوان الموثق، وتنفيذ matrix الحقيقية. لا موافقة دمج أو Production مطلوبة أو مُستنتجة من هذه الخطوات.

**الحكم: F00.2 محجوبة في الجزء الحي وليست مكتملة. Issue #1 تبقى مفتوحة.**
