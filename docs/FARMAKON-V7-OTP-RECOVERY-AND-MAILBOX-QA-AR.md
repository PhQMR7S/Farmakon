# Farmakon V7 — استعادة كلمة المرور برمز داخل المنصة وتدقيق بريد Gmail
**المراجعة بتاريخ 2026-11-01 — عدم المساس بالإنتاج**

## تشخيص صندوق البريد والارتداد
- خيار Gmail **All inboxes** يجمع رسائل جميع حسابات Google المضافة للهاتف؛ لا يدل وجود الرسالة هناك على مشكلة في المسار. تحقق من البريد المستلم الحقيقي عبر **to me** في تفاصيل الرسالة ومن اختيار الحساب المناسب في الصورة الشخصية أعلى Gmail.
- **Mail Delivery Subsystem** مع `550 5.1.1` هو إخطار بارتداد رسالة أرسلت لعنوان غير موجود أو غير صالح، وليس جزءاً من قالب OTP، ولا ملفاً مرفقاً بحماية البريد. لا يمكن إلغاء إخطار Gmail من داخل Farmakon. راجع صحة البريد المدخل.
- تحققت تجربة سابقة من إرسال OTP وتفعيل بريد جديد، لكن لا توجد أدلة اختبار شامل لنظام الاستعادة الذي بُني هنا.

## تغييرات التطبيق
- تنبيه واضح عند محاولة استخدام بريد مسجل ومؤكد سابقاً، **عندما يعيد Supabase دليلاً صريحاً** مثل `identities: []` أو خطأ `user_already_exists`. رسالة `409` في تطبيق Farmakon تقترح تسجيل الدخول أو استعادة كلمة المرور. ملحوظة: Supabase يعيد مستخدماً وهمياً عمداً لحماية الخصوصية، وقد تختلف الاستجابة تبعاً لإعدادات التأكيد؛ لا يمكن الجزم دائماً بوجود حساب.
- إنشاء مسار `/login#reset` → `/login#recover` → `/login#new-password` مع نفس ألوان وشعار وتنسيق تسجيل Farmakon، Arabic/English، حفظ وقت الإرسال والبريد المؤقت في sessionStorage **بدون حفظ رمز التحقق أو كلمة المرور**.
- `/api/auth action=forgot`: `resetPasswordForEmail` والإجابة عامة لا تكشف الحسابات المسجلة؛ تنبيه 429، وتنبيه فشل النقل الفعلي بدلاً من ادعاء وصول الرمز.
- `/api/auth action=verifyRecovery`: `verifyOtp({email,token,type:'recovery'})`، تتحقق من ارتباط المستخدم والبريد وتثبت جلسة مؤقتة آمنة بواسطة SSR cookies. رمز من 6 أرقام؛ إعادة إرسال بعد 60 ثانية بالواجهة، والصلاحية الفعلية تتحكم بها إعدادات Supabase.
- `/api/auth action=reset`: لا تغيّر كلمة المرور إلا بجلسة مصادق عليها، ثم تسجّل خروجاً محلياً وتعود شاشة الدخول، بكلمة مرور ≥10 أحرف تحتوي حروفاً وأرقاماً وتأكيد مطابق.
- الحفاظ على شاشة تسجيل الدخول والتسجيل والرمز الأصلي وعدم إدخال لوحة داشبورد تجريبية في المشروع الإنتاجي.
- أصلحنا Unicode regex في واجهة الاستعادة، واختبرنا تحميل JavaScript من دون أخطاء صياغة.

## قالب البريد المطلوب — هذه الخطوة **لم تنفّذ بعد على Supabase**
- **Staging**: https://supabase.com/dashboard/project/qfzharpouemueipsrduv/auth/templates
- اختر **Reset password** (وليس Confirm sign up)، واسم الموضوع: `Farmakon | رمز استعادة كلمة المرور`.
- انسخ **جميع** محتويات الملف `docs/email-templates/farmakon-reset-password-otp.html` إلى Body/Source ثم Save.
- يحتوي القالب على `{{ .Token }}` بدلاً من `{{ .ConfirmationURL }}`؛ ويحافظ على هوية Farmakon وشعارها مع نص مناسب لاستعادة كلمة المرور.
- أكّد `Email OTP expiration=1800` و`Email OTP length=6` على Staging (تم عرضه بالصورة السابقة).
- انتبه: مشروع Farmakon الإنتاجي حالياً لا يزال يرسل روابط Recovery القديمة؛ تحويله إلى OTP قبل إطلاق الواجهة المناظرة قد يعطل استعادة كلمة المرور.

## قائمة الاختبار E2E قبل اعتماد الإنتاج
1. في رابط المعاينة **المعزول عن قاعدة الإنتاج** على فرع `feature/farmakon-otp-staging-validation-2026-11-01`، حاول تسجيل بريد مسجل ومؤكد وشاهد إنذار `EMAIL_ALREADY_REGISTERED` بدلاً من شاشة رمز لن يصل.
2. استعادة كلمة المرور ببريد مسجل في Staging مع قالب Recovery الجديد: وصول الرسالة إلى المستلم الصحيح، الاسم والشعار والرمز.
3. إدخال رمز صحيح: ظهور شاشة كلمة المرور الجديدة. أدخل كلمة مرور 10 أحرف وحروفاً وأرقاماً وتأكيداً مطابقاً.
4. حفظ كلمة المرور، التأكد من تسجيل الخروج، ثم الدخول بكلمة المرور الجديدة وفشل القديمة.
5. الرمز الخاطئ والمنتهي والمكرر يجب رفضه. إعادة الإرسال مع تبريد 60 ثانية وحدود Supabase؛ اختبر الإرسال على بريد تملكه لتجنب ارتداد 550.
6. اختبار وضع الهاتف 320/390/768 والعربية والإنجليزية والوضعين الداكن والفاتح، ولوحة المفاتيح وعدم خروج القوائم.
7. اختبار البريد غير المسجل: يجب إظهار رسالة محايدة لا تكشف هوية مستخدمي Farmakon.
8. أضف طبقات منع إساءة الاستخدام (Captcha/معدل طلبات) قبل فتح التسجيل العام بسبب احتمال استنتاج عضوية العناوين من حالات التسجيل الصريحة.

## حالة العمل
- القالب والـbackend وواجهة الطالب/استعادة كلمة المرور محفوظة في Draft PR #20، مع نسخة اختبار Staging بفرع منفصل.
- بناء Vercel وفحص TypeScript سيتم توثيقهما من حالة READY.
- لا يوجد حتى الآن اختبار E2E لاستعادة كلمة المرور، ولا تطبيق لقالب Recovery على Supabase Staging، ولا تغيير في الإنتاج.
- إتمام تجربة التسجيل سابقاً لا يساوي اكتمال اختبار مسار استعادة كلمة المرور.

## مراجع
https://support.google.com/mail/answer/6078445
https://support.google.com/mail/answer/3726730
https://supabase.com/docs/guides/auth/auth-email-templates
https://supabase.com/docs/reference/javascript/auth-verifyotp
https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail


## QA إضافي — مشكلة عدم الوصول وعدم الكتابة (رسالة المستخدم 2026-11-01 17:57 UTC)

### التشخيص المثبت
- فحص `auth_logs` من Supabase **Farmakon-Staging** ضمن 17:40–18:10 UTC أظهر طلب `user_recovery_requested` ناجح الاستجابة عند **17:52:34 UTC**.
- البريد المقدم في هذا الطلب **يطابق حرفياً** عنوان البريد الذي ظهر في لقطة Gmail مع ارتداد **`550 5.1.1 Address not found`**.
- هذا يعني أن النظام يحاول توجيه الطلب إلى العنوان الذي كُتب، لكن Gmail يرفض التسليم لأن صندوق المستلم غير موجود. يظهر تقرير الارتداد في صندوق Gmail **المرسِل** (Farmakon)، وليس رسالة OTP الأصلية، ولا دليل على أن Supabase اختار المرسِل بدلاً من المستلم.
- لا يمكن للمنصة ضمان وجود عنوان بريد معين أو اعتراض رسائل ارتداد Gmail عن طريق Supabase Auth وحده. لذلك نطلب من المستخدم تصحيح البريد وإجراء الاختبار بعنوان فعّال ومسجل في Staging.

### إصلاح Android OTP
- أُزيل حقل الإدخال شبه المخفي `opacity:.01` الذي كان يغطي ست خانات مرسومة، لأنه لا يعمل بشكل موثوق في لوحة المفاتيح التي ظهرت في لقطة أندرويد.
- أصبحت كل خانة من الخانات الست **حقل نص حقيقياً مرئياً** باستخدام `inputmode=numeric`، وأول خانة تدعم `autocomplete=one-time-code`.
- الحقول تنقل التركيز تلقائياً، وتدعم حذف آخر رقم، ولصق ستة أرقام وتوزيعها، والتعبئة التلقائية والأرقام العربية/الفارسية، مع إبقاء قيم الرموز ضمن الجلسة وعدم تخزينها في قاعدة البيانات.
- شملت التغييرات شاشة تأكيد التسجيل وشاشة استعادة كلمة المرور، مع نفس ألوان وتباعد وعناصر التصميم الأصلية.
- تم جعل البريد المدخل ظاهراً **كاملاً** في شاشة Recovery ليكتشف الطالب خطأ العنوان؛ ومن الممكن تغييره قبل الإرسال مجدداً.
- أُصلحت إعادة تعيين الخانات الفعلية عند إرسالات الرمز الجديدة لمنع ظهور رموز قديمة.

### الاختبارات المنجزة
- `new Function` لصياغة JavaScript: ناجح.
- البحث عن `id` مكرر في DOM: صفر.
- عدد حقول الإدخال الستية الفعلية: **12** موزعة على واجهتي التسجيل والاستعادة.
- Playwright/Chromium على شاشة موبايل 390×844 باستخدام نفس منطق حقول الإدخال: **نجح** إدخال 123456 متسلسلاً، إدخال أرقام عربية ١٢٣٤٥٦، حذف Backspace، وتعبئة كود 6 أرقام دفعة واحدة، ولا يوجد overflow في fixture.
- بناء Vercel والـTypeScript تحقّق على فرع Staging المخصص بعد تحديث الواجهة.
- **حدود QA:** الاختبار المحاكي ليس تأكيداً من جهاز أندرويد المستخدم بعينه. ولم يتم اختبار إرسال رمز Recovery كاملاً إلى بريد فعلي صالح بعد تحديث واجهة الإدخال؛ مطلوب اختبار قبول الرمز وكلمة المرور الجديدة على Staging.

### المراجعة والتشغيل
- فرع Staging `feature/farmakon-otp-staging-validation-2026-11-01` مستقل عن الإنتاج (preview env متصلة بمشروع Staging، وتعطيل DB الإنتاج).
- فرع Review `feature/farmakon-auth-v5-real-platform-2026-11-01` حُدث بنفس واجهة الإدخال؛ PR #20 ما يزال Draft.
- **لا تغيير لقالب الإرسال في Supabase الإنتاجي ولا دمج إلى الموقع الأصلي.**


## 2026-11-01 18:16 UTC — conclusively verified missing recovery code for correct address
- Connected Gmail profile `M88` matches **mahmoudpharmacy88@gmail.com**.
- `Gmail.search_emails` for Farmakon messages since 2026-11-01 on that connected account yielded **zero matching emails**.
- Read-only `SELECT` against `auth.users` in **Farmakon-Staging** for the correct address and typo found **exactly one** registered and confirmed account, belonging to **mahmuoudpharmacy88@gmail.com**. The **correct** Gmail address is **not registered in Staging**, and consequently a password recovery request does not send any code to it.
- Staging `auth_logs` between 18:12:04 and 18:15:55 UTC shows `/recover` 200 responses with no `user_recovery_requested` event, consistent with account-not-found requests that respond generically to avoid account enumeration. Do **not** label a 200 response as proof of SMTP delivery.
- Prior `550 5.1.1` bounces occurred when sending to the typo address. This is separate from the latest correct address request.
- Root cause: **misregistration in test Auth DB, not sender-domain rerouting, missing recipient Gmail account, or a faulty HTML template**.
- UX mitigation: both "Forgot password" and recovery-code page now explain that recovery is only for pre-existing accounts; provide **"New here? Create an account"** which prepopulates the same email in the original registration flow.
- User should open the isolated staging preview, **register the valid Gmail address first** and verify signup OTP. Only after a confirmed signup, request Recovery OTP and test password update. Do not overwrite the mistyped confirmed account or alter production data without a deliberate account migration decision.
- Keep generic recovery success; never offer public direct user-existence lookup. The presence of a signup route is preferable to revealing the account roster.
