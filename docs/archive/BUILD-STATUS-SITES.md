# Farmakon — implementation and launch boundary

Private owner workspace, Arabic RTL PWA. No paid service, billing account, external gateway, custom domain, or automatic upgrade was enabled.

## Product structure
- Courses → units (lesson module field) → ordered lessons.
- Per-course access, duration, price in IQD; drafts/publication.
- Direct uploaded video player, speed, saved progress and notes.
- Resources: summaries, lecture notes, models, handouts.
- Questions: four options, answer, explanation, mandatory source.
- Timed exams, server grading, saved/resumable active attempts.
- Manual subscriptions by student email; one-time hashed codes with atomic redemption.
- Payment requests and admin verification; acceptance grants enrollment. No funds are collected by the app.
- Support tickets/replies, announcements, administrative audit and JSON reporting.
- PWA manifest/icons; offline fallback and user-requested device downloads.

## Data
D1: records (course/lesson/file/question/exam/attempt/order/ticket/asset/audit/announcement), members, enrollments, hashed codes, activity, settings.
R2: uploaded file bytes. APIs enforce authentication and course entitlement before returning media. No schema changes at runtime.

## Authentication / release
Site remains owner-private. On the first authenticated owner visit, the private setup creates the permanent owner identity. Never change platform sharing before this completes. Public student sign-up with independent credentials is NOT implemented. Current authentication uses platform ChatGPT identity. A supported public authentication path, privacy/account deletion flow, and audience policy must be implemented/reviewed before release to students.

## Limits / unfinished production capabilities
- No real course content, student roster, recipient payment account, or licensed question data was supplied.
- Upload cap 80MB/file, 1GB total preparatory library; these are application caps, not a hosting price guarantee. Large video multipart uploads, transcoding, adaptive quality streaming, streaming CDN/DRM are not implemented.
- Direct external HTTPS video links must be actual media URLs; Google Drive sharing pages and YouTube pages are not media URLs. External links can be shared; subscription gating does not secure a third-party public URL.
- Device download expiry <=48h (also capped by entitlement when applicable); no DRM, no guaranteed background transfer, no cross-device synchronization. User can extract bytes/change local device time. Browser storage can be deleted. Intended as convenience, not a security boundary.
- Gateways (ZainCash/Qi/bank cards/etc.) NOT connected. No payment credential/account has been invented.
- No claim of permanent free hosting for 750 students or 400GB, no 750-user load test.
- Owner-private deployment is for preparation, not a completed public student launch.
- Browser/WebMCP validation unavailable without the permitted control-browser skill. Typecheck, production build, migration and bounded backend tests recorded separately.

## Next production gates
Confirm public authentication; ownership and account deletion; real content and payment recipient; hosting quota/cost ceilings; streaming/upload architecture; independent authorization/rate-limit review; phone/offline QA and concurrent-user load test; backup/restore; terms/refund policy. Keep paid services disabled unless user explicitly changes the zero-spend constraint.

## Verification performed
- TypeScript noEmit check passed.
- Vinext production build passed.
- Generated schema-only migration inspected and executed against local D1.
- In-process route integration test using real route code with SQLite-backed D1 adapter: passed authentication, owner-only admin, course/lesson/question/exam creation, upload and entitlement read, hiding answer keys, one-time code redemption/reuse rejection, progress/notes persistence, exam resume and grading, duplicate order rejection, payment approval, unpublished course access rejection and cross-origin write rejection.
- These tests use isolated test identities and in-memory data, not production student accounts. Live browser, installation, offline replay, device compatibility, actual R2 streaming and load tests remain unverified.


## مراجعة 6 أكتوبر — النسخة الثانية
- أضيف شعار المالك الأصلي إلى واجهة التطبيق وبيانات تثبيت PWA.
- تواصل الاشتراك: https://t.me/phcourse3 والدعم: https://t.me/ID29i. لم تُرسل رسائل لأي حساب.
- اعتماد طلب الدفع يصدر كودًا أحادي الاستخدام بدل إنشاء اشتراك مباشر؛ الكود لا يعرض إلا عند الإصدار. منع إعادة اعتماد الطلب بشرط ذري داخل قاعدة البيانات. الإصدار اليدوي يطلب إقرار تحقق الدفع. الأكواد لحاملها وليست مقيدة ببريد مستلم.
- تصنيف الأسئلة والملفات حسب المرحلة والمادة والسنة؛ فلتر وزاري/تدريبي. PDF على Drive لا يتحول تلقائيًا إلى اختبار.
- روابط ملفات Drive تطبع إلى مشغل preview على نطاق موثوق فقط، مع رابط فتح خارجي. لا يوجد تتبع وقت أو تنزيل محلي أو حماية DRM لفيديو Drive. صلاحيات الملف مستقلة عن اشتراك المنصة والرابط قابل للمشاركة.
- صفحة حساب الطالب ومسح التنزيلات؛ ينتظر تسجيل الخروج تنظيف التخزين المحلي.
- تحقق TypeScript واختبارات API باستخدام SQLite معزولة ناجحة. عرض المتصفح وتشغيل فيديو حقيقي وقياس 750 مستخدمًا لم تتحقق بعد.

## ما يمنع الإطلاق العام
الدخول الحالي ما زال SIWC الخاص بمنصة Sites، والموقع خاص بالمالك. لم يتم ربط مصادقة بريد وكلمة مرور؛ مهارة Sites تتطلب التأكد من مسار مصادقة مدعوم قبل تركيب موفر خارجي. لا يمكن الادعاء أن تسجيل الطلاب المستقل مكتمل. لا توجد كلمة مرور مدير افتراضية.
لا توجد نسخة Farmakon على GitHub حتى الآن؛ الموصل المتاح لا يقدم إنشاء مستودع جديد. المستودعات الحالية مشاريع أخرى ولم تُستبدل. GitHub Pages غير مناسب لاستضافة هذه المنصة التجارية.
حد الرفع الحالي 80MB و1GB إجمالي احترازي داخل المنصة؛ رفع الفيديو إلى Drive يتم في Drive ثم إضافة رابطه. لا يوجد رفع مباشر إلى حساب Drive أو OAuth Drive في هذا الإصدار.
لم يتم شراء خدمات أو تفعيل خطط مدفوعة؛ لا يمكن ضمان تشغيل كامل للمحتوى والفيديو على نطاق الإنتاج مجانًا أو خلو مطلق من الأخطاء.


## مراجعة الأيقونة والمظهر — النسخة الثالثة
- تحويل تقني للشعار الأصلي إلى PNG بقياسات 192 و512، وApple Touch Icon بقياس 180، وfavicon بقياس 32؛ أسماء ملفات جديدة لتجنب بقاء الأيقونة السابقة في التخزين المؤقت. استبدلت أيضًا ملفات PNG القديمة.
- manifest وApple web app metadata وviewport/safe area موحدة. الإصدار الثالث من service worker ينظف shell القديم فقط ويحفظ تنزيلات الطالب. قد يحتاج اختصار قديم إعادة الإضافة يدويًا؛ لا يمكن تغيير أيقونته من داخل المحادثة.
- هوية كحلية وسماوية، سطح قراءة واضح وتنقل زجاجي، أيقونات SVG حقيقية من Lucide، أشكال هندسية، شريط تنقل سفلي للهاتف.
- مظهر تلقائي/فاتح/داكن وتفضيل تقليل الشفافية محفوظان محليًا، ودعم التباين والحركة المخفضة.
- إرشادات تثبيت Android/iPhone، إشعار فقد الاتصال، ومنع فتح تنزيل انتهت صلاحيته بعد بقاء صفحة offline مفتوحة.
- اختبارات الخادم ناجحة؛ لا تزال معاينة جهاز Android/iPhone فعلي وإطلاق الحسابات المستقلة واختبار الأحمال غير منجزة. المظهر مستوحى من توجه Liquid Glass وليس تطبيق iOS أصليًا.
