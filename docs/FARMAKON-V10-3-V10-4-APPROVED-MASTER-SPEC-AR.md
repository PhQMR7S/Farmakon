# Farmakon — المواصفات المعتمدة للكورسات والمحاضرات والمشغّل والمكتبة دون اتصال
**الإصدار:** V10.3 + V10.4 (Approved Master Spec)
**التاريخ:** 2026-11-02
**المستودع:** `PhQMR7S/Farmakon`
**فرع المواصفات والتطوير:** `feature/farmakon-v10-3-courses-player-reader-2026-11-02` (متفرّع من V10.2؛ ليس إنتاجاً)
**حالة الاعتماد:** المستخدم وافق على جميع مميزات V10.3 وألحق بها متطلبات إلزامية للفيديو والأوفلاين والمستندات والتعليقات والـAI المستقبلي.

## القواعد الملزمة
1. الحفاظ التام على هوية تسجيل الدخول المعتمدة وتدرّجات Farmakon (navy/cyan/warm gradient)، وعلى الهيدر وشريط التنقل وتجربة اللمس لـV10.1/V10.2؛ لا إعادة تصميم للموقع أو تسجيل الدخول.
2. التصميم متوازن RTL، AR/EN، سلوك شبيه بالتطبيق الأصلي، انتقالات هادئة 150–250ms، ألوان زجاجية خفيفة مع fallback لـ`prefers-reduced-motion` / `prefers-reduced-transparency`.
3. تطوير مرحلي على فرع مراجعة. لا دمج أو نشر إلى `main` بدون موافقة بعد اختبارات الصلاحيات والاستكمال والتعليقات والتحميل والفواتير. Staging منفصل من Supabase Production؛ خطأ DATABASE_URL الذي تم كشفه يجب إصلاحه قبل أي اختبارات كتابة. لا استخدام بيانات إنتاج للاختبار.
4. لا أزرار ميتة أو ميزات تُوصف بأنها جاهزة؛ ميزات غير منفذة تظهر «قيد التطوير» أو تختفي بحسب مرحلة الإطلاق. لا مقاييس أو تقييمات أو اشتراكات وهمية.
5. جميع الملفات المدفوعة والمشتركة تُحمى بالتحقق الخادمي من هوية المستخدم واشتراك الكورس وحالة النشر، مع عدم تسريب أصل الملف أو روابط الخدمة الخاصة أو مفاتيح مخزن المحتوى.

## خريطة الطالب الأساسية
`التعلم > كورساتي > تفاصيل الكورس > الوحدات > المحاضرة > الفيديو | ملفات المحاضرة | ملاحظاتي | اختبار المحاضرة`.
إضافة تبويب مستقل `استكشف الكورسات` مع انتقال واضح بين الكورسات المتاحة وكورساتي، والترشيح والبحث والمفضلة.
عند العودة تُستعاد حالة الطالب (الكورس، الوحدة، المحاضرة، وقت الفيديو، آخر صفحة ملف، إعدادات الترجمة/السرعة، الملاحظات).

## V10.3.1 — كورساتي + الاكتشاف
- الكورسات المشترك بها فعلياً، غير المكتملة، المكتملة، قيد التفعيل، المنتهية؛ tabs/chips لا تخلط نتائج عامة مع المحتوى المدفوع.
- بطاقات مميزة: غلاف حقيقي قابل للتحديث من لوحة المالك، اسم الكورس، المادة، المرحلة، المدرّس، المدة، عدد المحاضرات المنشورة، السعر بالدينار العراقي، الوصول، التاريخ المتبقي، تقدم محاضرات موثّق.
- «كمّل محاضرتك» يفتح آخر درس منشور ومصرح به وموضع المشاهدة المحفوظ، مع حالات empty/offline/loading/error.
- البحث والفلاتر: المرحلة، المادة، نوع الكورس، سعر مجاني/مدفوع، مفضلة، ترتيب حديث/اسم/تقدّم.
- مشاركة صفحة التسويق *العامة* للكورس ممكنة إن اعتمد المالك؛ **لا مشاركة المحتوى الخاص أو روابط الوسائط**.
- لا تُعرض تقييمات مصطنعة؛ المراجعات الحقيقية يجب أن تُبنى كنظام مستقل مرتبط بحساب مؤكد مع moderation.

## V10.3.2 — تفاصيل الكورس والاشتراك
- غلاف، وصف، نواتج تعلم، متطلبات سابقة، مدرس، وحدات، عدد المواد الفعلية، مدة مشاهدة، سعر، نوع/مدة الاشتراك، تاريخ انتهاء، شروط الوصول، محاضرات مجانية آمنة.
- شرائط محتوى: نظرة عامة | المنهج | المدرّس | المراجعات (لا يظهر التبويب الأخير ما لم يكن نظام مراجعات حقيقياً).
- رمز اشتراك، طلب اشتراك/مراجعة، حالة انتظار، فعال، منتهي؛ صلاحيات كل endpoint مُراجَعة.
- عند الانتهاء يمنع تقديم الموارد المحمية مجدداً؛ تُحفظ ملاحظات الطالب الخاصة مع وضع عرض يراعي سياسة الوصول، ولا تُحذف لمجرد انتهاء الاشتراك.

## V10.3.3 — الوحدات والمحاضرات
- hierarchy: Course > Module > Lesson > Materials (PDFs) / Questions; IDs ثابتة؛ ترتيب يحدده المالك.
- وحدات قابلة للطي/الفتح، نافذة بحث داخل الكورس، مدة كل درس، «مكتمل» و«قيد المشاهدة»، عدد المحاضرات في الوحدة، preview مجاني، locked badge، next/previous lesson.
- تقدم محفوظ خادمياً لكل مستخدم / lesson مع timestamp `seconds` **موضع تشغيل وليس إجمالي وقت دراسة**؛ اختبر التقدم والأجهزة المتزامنة، idempotent updates، الاستكمال بعد إعادة فتح الصفحة.
- علامة completion صريحة عند وصول حد تعلم معتمد أو إكمال الفيديو/اختبار بحسب إعدادات الكورس؛ لا توهم الطالب بإنجاز دون أدلة.
- وضع «كل ما تحتاجه لهذه المحاضرة»: عنوان، أهداف، فيديو، الملفات، ملاحظاتي الخاصة، أسئلة المحاضرة، روابط المصادر.

## V10.3.4 — Smart Document Reader (إلزامي)
### العرض
- PDF أولاً لملفات المحاضرات الخاصة والملازم؛ لاحقاً Office formats عبر تحويل آمن على الخادم إلى PDF/صور للعرض عند الحاجة، **لا فتح رابط Drive خام كعارض قابل للتصرف**.
- عارض داخلي Farmakon بصيغة CSS مطابقة للهوية، بدون واجهة المتصفح التي تحتوي على تنزيل أو طباعة.
- أدوات: تقليب الصفحات، thumbnails، فهرس / TOC، بحث نصي، zoom +/-، fit-width/fit-page، تدوير العرض، آخر صفحة/موضع، كامل الشاشة عند الدعم.
- لوحة annotation مستقلة لا تُغيّر النسخة الأصلية من الملف: قلم/رسم حر، تمييز (highlight) بألوان متعددة، تحديد نص، underline، sticky notes، مربعات نص، bookmark، محو annotation، تراجع/إعادة (undo/redo)، اختيار سمك القلم، دعم اللمس والقلم الإلكتروني والماوس. لا يحتاج كل أداة التشغيل في الإصدار الأول؛ يجب توثيق ما لم ينفذ.
- طبقات البيانات: `document_version_id, user_id, annotation_id, page_index, type, anchor=(text quote + normalized rects + text offsets), color, geometry, text, created_at, updated_at, revision`. عمود `page_index` 0-based داخلياً و1-based ظاهرياً. يحفظ `document_version_id` لمنع إزاحة التعليقات عند تحديث الملف.
- حفظ تلقائي بعد تغيّر التعليق بمهلة قصيرة (debounce)، تنبيه «جارٍ الحفظ/تم الحفظ/تعذر الحفظ»؛ إعادة الإرسال idempotent، queue offline، background sync عند الإمكان، وحفظ نسخة محلية + مزامنة خادمية عند عودة الإنترنت. عدم ضياع آخر تعليق عند الإغلاق السريع، مع عمليات flush عند visibilitychange/pagehide (بدون الاعتماد الحصري عليهما).
- حفظ التعليقات والملاحظات بشكل **خاص بكل طالب** ومتزامن عبر الأجهزة عندما يتصل؛ محو تعليق من جهاز يجب أن يتزامن مع الآخر بدون تكرار؛ تعامل مع revision conflict وdocument replacement.
- البحث في ملاحظاتي، الرجوع إلى الصفحة المرتبطة، metadata لا تكشف محتوى مستخدم آخر.
### حماية الملف
- يمنع زر تنزيل الأصل ومشاركته/طباعته/تعديل الأصل، ويمتنع عن كشف raw storage URL للطلاب. server access check + private storage + short-lived token/session-scoped proxy + proper cache headers.
- أي منع لنسخ/لقطات الشاشة هو best-effort فقط، وليس ضماناً؛ إذا كانت حقوق المحتوى تتطلب منع استخراج قوي، يلزم DRM/عارض أكثر تقييداً وتطبيق أصلي، مع كلفة/دعم إضافي. لا نعد بحماية مطلقة.
- محتوى الملف المحفوظ أوفلاين: استخدام ضوابط إذن منفصلة عن مشاهدة أونلاين؛ عدم فتح الملف الخام في جهاز المستخدم من تطبيق الملفات.
- ملاحظات الطالب تعامل كملكية خاصة منفصلة، وتبقى محفوظة حتى بعد انتهاء الاشتراك وفق سياسة حفظ بيانات واضحة؛ لا تُحذف معها ملاحظاته الأصلية.
- قابلية الوصول: text layer، اختيار حجم الخط عند استخدام text viewer، تباين، RTL، تدوين عبر لوحة المفاتيح، وتجنب استعمال Canvas فقط لنصوص يمكن الوصول إليها.

## V10.4.1 — Smart Glass Video Player (إلزامي)
### أدوات التحكم
- Play/Pause، شريط زمني وbuffered/progress، الوقت الحالي/الكلي/المتبقي؛ قفز ±5/±10/±15 ثواني (قابلة للاختيار) والنقر المزدوج يمين/يسار ضمن اتجاه RTL محسوب، سحب شريط الوقت، استكمال نقطة آخر مشاهدة.
- سرعات `0.5,0.75,1,1.25,1.5,1.75,2` مع حفظ التفضيل لكل طالب؛ الجودة Auto/360/480/720/1080 *فقط إذا كانت هذه الجودة متوفرة في نسخ media حقيقية*؛ يُخفى غير المتوفر وتظهر دقة التشغيل الفعلية.
- صوت: مستوى الصوت، mute/unmute، إعدادات CC AR/EN وحجم/خلفية الترجمة، PiP إذا مدعوم، ملء الشاشة، تدوير الشاشة وفق الدعم، وضع قفل عناصر التحكم، أسلوب glass bottom sheets وسلاسة انتقال iOS-style غير مطابق حرفياً لآبل.
- Preview thumbnails عند الـseek إن توفرت sprites صحيحة، فصل chapters/navigation، bookmark على timestamp، loop A-B اختياري، Next Lesson.
- إن انقطع الاتصال تظهر حالة واضحة وخيار retry دون ضياع موضع التشغيل؛ 401/403 يوضح صلاحية الطالب دون تعرّض للمحتوى.
- حفظ الاستكمال مع throttling، onPause، onEnded، وتبديل page؛ **لا تكفي `onPause` وحدها**. لا تُخزّن إحصاءات watch time من `currentTime` وحدها، بل تسجل جلسات مشاهدة موثقة إذا أريد حساب ساعات دراسة فعلية.
- جودة فيديو تعتمد على نوع المصدر: video MP4 واحد لا يتيح 360/720 بشكل حقيقي، وiframe Google Drive لا يتيح أدوات تحكم مستقلة؛ في الإنتاج اعتمد مسار إعداد rendition/HLS/DASH عند توافر ميزانية وقدرات معالجة/تخزين آمنة أو أظهر التحكم المدعوم فقط.

## V10.4.2 — My Offline Library (إلزامي عند إصدار ميزة التنزيل)
### مبدأ
- زر «تنزيل للمشاهدة دون اتصال» داخل Farmakon؛ ليس زر download إلى Files/Downloads، وليس رابط ملف مباشر.
- تنزيل إلى storage خاص بأصل الموقع / تطبيقه عبر IndexedDB/OPFS/Cache API أو backend أصلي في تطبيق مخصص لاحقاً؛ يتم التخزين فعلياً على الجهاز لكي يعمل بدون إنترنت.
- تنزيل مقاطع/أجزاء مع hash/checksum، حالة pending/downloading/paused/failed/completed/expired، progress bytes, speed, ETA تقريبية، اختيار الجودة، pause/resume/retry/delete، queue وتنزيل درس واحد أو أكثر ضمن حدود مساحة وحصة المستخدم.
- `navigator.storage.estimate()` قبل الحفظ، `navigator.storage.persist()` عند الدعم، QuotaExceededError، اكتشاف انقطاع الشبكة والنفاد، وفحص سلامة المقاطع وإمكان استئناف ما نُزّل.
- offline manifest يحمل IDs + versions + selected rendition + license window; يُعرض تاريخ صلاحية الوصول للمحتوى داخل المنصة. لا يكفي وضع `x-offline-until` في metadata المحلية لضمان عدم تجاوز مستخدم يغيّر الساعة.
- حماية المحتوى: encrypted segments بآلية صحيحة والمفتاح/الترخيص بطرق مدعومة منصةً وجهازاً؛ لا يجوز الاعتماد على تشفير سطحي بمفتاح ثابت داخل JavaScript. Widevine/FairPlay أو EME persistent-license إن دعمتها المنصة/المتصفح فعلياً؛ دعم `persistent-license` اختياري وفق W3C. لا وعد بـDRM مجاني أو متاح على كل هاتف.
- لا حاجة لتسجيل الدخول أثناء كل مشاهدة offline إذا سبق ترخيصها بمدة محدودة، لكن تُطلب مصادقة online لإصدار/تجديد الترخيص. عند العودة online تتحقق من صلاحية الاشتراك وتمنع تجديد غير المصرح.
- عند تسجيل خروج: تمسح مفاتيح العرض والحالة الحساسة حسب سياسة واضحة؛ تحافظ على metadata فقط إن كانت غير حساسة. يتم ربط المحتوى بالطالب والجهاز/تثبيت PWA، ولا يجوز لحساب جديد على نفس الجهاز مشاهدة تنزيلات السابق.
- تنبيهات واضحة لاختيار جودة أقل لتوفير مساحة، والحذف اليدوي أو auto-cleanup بحسب سياسة يوافق عليها المستخدم.
- في المتصفحات (خصوصاً iOS) العمل في الخلفية/كميات التخزين/الاستمرارية ليست مضمونة. يتم تحميل المحتوى عندما تبقى واجهة التنزيل مفتوحة إذا غاب دعم background. قد يمسح النظام cache / storage؛ مواصلة العرض تحتاج إعادة تنزيل.
- هدف القبول: (A) Android Chrome PWA، (B) iPhone Safari/Home Screen PWA، (C) desktop. يجب توثيق فرق السلوك/الميزة لكل نظام. أي نظام لا يجتاز اختبار offline+privacy+license يُظهر عدم دعم واضح بدلاً من زر وهمي.
- **حد تقني غير قابل للتجاوز:** المتصفح لا يضمن منع نسخ المحتوى أو تصوير الشاشة 100%، وتخزين PWA هو على الجهاز حتى لو لم يظهر في Downloads. أقصى الوعد هو «مشاهدة من داخل Farmakon مع تقليل الاستخراج وتقييد الوصول».

## V10.4.3 — Offline Notes + PDF annotations
- اختيار ملفات المحاضرات المسموح بتنزيلها إلى مساحة التطبيق المغلقة، منفصلاً عن التنزيل عبر نظام الملفات.
- أي تعليقات يكتبها الطالب بدون شبكة تحفظ محلياً في queue ومراجعة conflict عند المزامنة. تمنع مشاركة ملفات أصل الكورس، لكن ملاحظات الطالب نفسها لا تمسح بسبب انتهاء اشتراك.
- عند فقدان مساحة تخزين محلية: تظهر حالة «غير متزامنة» وتحذير واضح قبل حذف local data؛ النسخ الخادمي هو المصدر المستدام للملاحظات بمجرد نجاح المزامنة.

## AI-ready — المرحلة المستقبلية (لا تفعّل زراً غير عامل)
- لكل محتوى مصرح به ingestion background: PDF text extraction، indexing by page/documentVersion, OCR للصفحات المصورة مع مراجعة جودة، metadata course/module/lesson، timestamp للترجمة حين يتوفر نص مصرح.
- RAG with per-user authorization **before retrieval**: لا يمكن للطالب الوصول إلى chunks لغير كورس مشترك به؛ منع تسريب الملفات أو مفاتيحها أو ملاحظات الآخرين.
- أدوات المستقبل: شرح عراقي/عربي/English مبسط، تلخيص موثق، MCQ مع تفسير، حالات سريرية، بطاقات، خرائط ذهنية، أسئلة وأجوبة، ربط الاستشهاد بالصفحة أو الدقيقة. إذا المصدر غير كافٍ يعرض «المصدر لا يدعم الإجابة»؛ ويشير إلى الطابع التعليمي للمحتوى الطبي.
- user-authored annotations: خاصة بشكل افتراضي، لا تدخل فهرس AI مشترك أو التدريب؛ يمكن للطالب الموافقة صراحةً على استخدامها لتحسين **مساعده الخاص فقط**.
- تقنية AI تبدأ لاحقاً بعد توفير backend/model budget وضوابط الخصوصية، لا تدّعي التكلفة الصفرية حتى لو استُخدمت باقات مجانية.

## نماذج البيانات الموصى بها (مخطط مقترح، لم يُطبق)
- `courses`, `course_modules`, `lessons`, `lesson_assets`, `asset_versions`, `media_variants`, `user_enrollments`, `user_lesson_progress`.
- `document_annotations` PK `(user_id,annotation_id)`, FK `(document_version_id,lesson_asset_id)`, `revision`, `deleted_at` tombstones, timestamps, anchor geometry JSONB.
- `user_document_positions` PK `(user_id,document_version_id)`, last_page, scroll_ratio, zoom (if preferred), updated_at.
- `user_bookmarks`, `user_player_prefs`, `offline_licenses`, `offline_assets` (metadata only — binary stored locally).
- Privileges: RLS by `user_id` and course permission, server authorization for signed media access, least privilege roles, audit of entitlement decisions and expiry. No public Supabase storage policies for paid materials.
- Existing Farmakon currently stores generic `records` and `activity`; do NOT migrate destructively. Define additive migration + backfill + rollback, compatibility adapter, and test before any cutover.

## الواقعية التقنية والحدود المعتمدة
- Offline PWA: browser storage can be evicted even when user never manually deleted a download (WebKit/MDN). Ask persistent permission, show remaining storage, and record available device behavior; no 100% retention.
- Content security: hiding browser download buttons, `controlsList=nodownload`, `disableContextMenu`, or iframe Drive does not constitute DRM. Protected offline content should not be served raw as shareable links.
- PDF annotation: keep original file immutable; render private user-specific overlay. The original PDF must never be overwritten when user draws.
- HDR/adaptive quality: only show options truly encoded. If video source currently Drive iframe, this must be replaced/ingested through authorized media pipeline before custom quality/offline can be claimed.

## تسلسل التنفيذ والاعتماد
1. **V10.3.1** My Courses + Explore — design preview, filters, enrolled/available distinction, favorites, test responsive.
2. **V10.3.2** Course Detail + Modules — entitlement UX, course outline, status badges, next/previous.
3. **V10.3.3** Lecture Workspace + Smart Document Reader read-only + per-page resume — safe internal PDF.
4. **V10.3.4** Ink/highlight/text/notes + autosave and cross-device sync, offline annotations queue where feasible.
5. **V10.4.1** Smart Glass Player, actual supported controls and pref persistence, QA on direct media/stream types.
6. **V10.4.2** Offline Library with downloads internal-only + queue/storage/expiry/access test (Android first; iOS only after separate acceptance).
7. **V10.4.3** End-to-end integrated Media+Reader+Permissions tests, staging real DB and consented test account, device matrix.
8. AI ingestion framework only after paid/licensed content storage and entitlement isolation; AI runtime to follow as separately tested version.
9. All feature PRs stacked on V10.2 branch and remain draft until owner approves previews and passes security/QA. Release V10.1→V10.2→V10.3→V10.4 sequentially once each passes gates.

## اختبارات قبول غير قابلة للتنازل
- Paid/free/expired/unsubscribed/admin, second user on same device, account switch, new device, JWT expiry, revoked entitlement.
- Streaming video: 360/720 only if encoded; seek 5/10/15s, playback speeds, reload/resume, offline->online, subtitled captions, fullscreen, PiP with support feature detection, touch and RTL gestures.
- Protected offline: no direct Download links, offline playback after closing app, pause/resume partial download, network loss, quota exceeded, manually clear storage, license expire, local clock change behavior documented, change user must deny.
- PDF reader: open and annotate >1 page, keyboard + stylus + touch; persist after app close/reload/login/new device, no mix between students, original unchanged, offline edits and conflict resolution, page anchor stable after reupload/version.
- UI: 320/360/390/430/768/1366 px, iOS Safari/PWA and Android Chrome/PWA, reduced motion, dark/light/RTL/LTR, no control overlays covering navigation or content.
- Performance: lazy-load PDF pages, virtualize long modules and file lists, don't download full multi-GB files into memory, errors/retry and nonblocking load.
- Production main untouched unless explicitly authorized after tests, PR review, staging setup and real test report.

## مصادر عامة للتحقق الفني
- web.dev Storage for the web: https://web.dev/articles/storage-for-the-web
- MDN Storage quotas & eviction: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
- WebKit Storage Policy: https://webkit.org/blog/14403/updates-to-storage-policy/
- Mozilla PDF.js: https://mozilla.github.io/pdf.js/getting_started/
- W3C EME: https://www.w3.org/TR/encrypted-media/
