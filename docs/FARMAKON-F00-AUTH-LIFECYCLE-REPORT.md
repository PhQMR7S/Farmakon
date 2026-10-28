# Farmakon V2 — F00.8: Auth Configuration, Email Recovery & JWT Lifecycle

**27 أكتوبر 2026 — الحكم: مراجعة Read-only جزئية مثبتة؛ بوابات Auth configuration/email/JWT الحية Blocked، وليست Passed.**

هذه متابعة من `27e4d9bd850c700f41f430ee4043ecd3c6b44144` على `audit/f00-regression-2026-10-26`. لا إعادة مشروع أو اختبارات ناجحة، ولا تغيير كود التطبيق أو schema أو Auth configuration أو نشر. [PR #18](https://github.com/PhQMR7S/Farmakon/pull/18) يبقى Draft إلى `feat/farmakon-v2-p0-privacy`، ويعتمد على #17؛ [Issue #1](https://github.com/PhQMR7S/Farmakon/issues/1) مفتوحة.

## 1. الحالة ومصادر الإثبات

راجعت تقارير [F00.2](FARMAKON-F00-STAGING-AUTH-REPORT.md) و[F00.3](FARMAKON-F00-EMAIL-RECOVERY-REPORT.md) و[F00.5](FARMAKON-F00-LIVE-PREVIEW-VALIDATION-REPORT.md) و[F00.7](FARMAKON-F00-PERFORMANCE-ACCESSIBILITY-REPORT.md)، وAuth route وCallback وidentity وSupabase server client وproxy وحاجز Preview واختبارات Auth/Callback وREADME الاختبارات الحية.

الأدلة الجديدة لهذه الجولة هي قراءات Supabase MCP وSQL metadata وVercel connector وحالة لوحة Supabase، لا اختبارات تسجيل دخول حية:
- مشروع `Farmakon-Staging — qfzharpouemueipsrduv`: **ACTIVE_HEALTHY**، eu-central-1، PostgreSQL **17.11.0.003**.
- Security Advisors الحالية: تحذير واحد **auth_leaked_password_protection / WARN / EXTERNAL**. لا تحذيرات أخرى في نتيجة هذه القراءة؛ ليست شهادة غياب كل الثغرات.
- SQL للهوية الموسومة إدارياً `farmakon_test_fixture=true`: **3 مستخدمين، 0 جلسات**. أعداد فقط، دون بريد/UUID/token.
- دور `farmakon_f002_preview`: login=true، superuser/createdb/createrole/bypassrls=false، connlimit=3، validuntil=**2026-11-02 23:59:59 UTC** (3 نوفمبر 02:59:59 بغداد). لم تمدد المدة.
- الجداول الثمانية في schema farmakon، activity/codes/deletion_jobs/enrollments/members/rate_limits/records/settings: RLS=true. هذا فحص metadata، لا إعادة اختبار سلوكي لـRLS.
- HEAD المقروء قبل التوثيق: `27e4d9bd850c700f41f430ee4043ecd3c6b44144`.

## 2. إعدادات Supabase Auth الفعلية مقابل كود التطبيق

**عائق الإعدادات:** أداة Supabase المتصلة توفر SQL/advisors/project metadata، ولا تعرض GET Auth management configuration. فتح لوحة Staging أعاد إلى صفحة Sign in؛ لا جلسة لوحة موثقة متاحة في المتصفح الحالي. `SUPABASE_ACCESS_TOKEN` غير متوفر في بيئة التنفيذ (فحص وجود فقط). لم أستخرج token من متصفح أو مخزن داخلي، ولم أطلب أسراراً في المحادثة. لذلك لا تُستبدل القيم المفقودة بافتراضات defaults من التوثيق.

| الإعداد المطلوب | Staging الفعلي في F00.8 | ما نعرفه من التطبيق فقط |
|---|---|---|
| Email signup enabled / disable_signup / external_email_enabled | **Blocked — غير مقروء** | route يطلب signUp؛ ليس إثبات تمكين المزود |
| Email confirmation / mailer_autoconfirm | **Blocked** | identity يرفض user بلا email_confirmed_at؛ لا يثبت أن المزود يطلب confirmation |
| password_min_length / required characters / reauthentication policy | **Blocked** | signup/reset يتحققان من 10–128 حرفاً؛ login يقبل الاعتماد القديم دون فرض حد الإنشاء |
| site_url | **Blocked** | لا نستنتجه من رابط Vercel أو request origin |
| uri_allow_list / redirect URLs | **Blocked** | التطبيق يولد callback على origin الطلب، وCallback يقصر next على / أو /reset-password |
| mailer_otp_exp / recovery lifetime | **Blocked** | لا قيمة فعلية مثبتة؛ لا اعتماد على قيمة افتراضية |
| jwt_exp | **Blocked** | لا جلسة جديدة أو iat/exp مقاسان في هذه الجولة |
| refresh_token_rotation_enabled / reuse interval | **Blocked** | استخدام SDK/SSR لا يثبت إعداد المشروع |
| session timebox / inactivity timeout / single-session policy | **Blocked** | helper الصارم يفحص وجود الجلسة وربط المستخدم وnot_after؛ ليس idle timer |
| Auth email/token/verify/MFA rate limits | **Blocked** | quota التطبيق auth وcallback: 30 طلباً/15 دقيقة؛ ليست حدود المزود المباشرة |
| SMTP enabled/provider/sender configuration | **Blocked** | لا أسرار SMTP قُرئت، ولا إرسال بريد جرى |
| MFA TOTP/phone/WebAuthn enrollment/verification settings | **Blocked** | لا إعداد أو عامل مالك تم فحصه أو تغييره |
| Leaked Password Protection | **مثبت: Disabled بتحذير advisor** | تحقق طول كلمة المرور لا يعوض هذه الميزة |

**أولوية أمنية مفتوحة:** لا يجوز اعتماد سياسة 10 أحرف كسياسة Supabase؛ العميل يستطيع مخاطبة Auth مباشرة بالمفتاح العام. يلزم قراءة سياسة المزود ثم فحص رفض كلمة ضعيفة على حساب اصطناعي مصرح، دون كشف كلمات المرور.

## 3. مقارنة Staging وProduction دون أسرار

لم تُقرأ Auth management configuration لأي من المشروعين. المقارنة التالية تقتصر على أسماء الإعدادات وحالتها ولا تدعي مساواة أو اختلاف قيم مجهولة:

| مجموعة الإعدادات | Staging | Production | الحكم |
|---|---|---|---|
| signup/confirmation/password/site_url/allowlist/OTP lifetime | غير مثبتة | غير مقروءة | مقارنة القيم Blocked |
| JWT/rotation/reuse/timebox/inactivity/single-session | غير مثبتة | غير مقروءة | مقارنة القيم Blocked |
| SMTP/Auth rate limits/MFA | غير مثبتة | غير مقروءة | مقارنة القيم Blocked |
| Leaked Password Protection | Disabled من advisor الحالي | غير مفحوصة في F00.8 | لا ننسب تحذير Staging تلقائياً للإنتاج |
| Vercel branch Auth target | Staging مثبت بقراءة NEXT_PUBLIC_SUPABASE_URL | إعداد الإنتاج لم يغير | فصل target مثبت للفرع؛ لا إثبات إعدادات Auth الإنتاجية |
| Vercel deployment | READY، target=staging | آخر production listed بقي النشر السابق | لا نشر جديد |

لا PATCH لإعدادات أي مشروع، ولا تغيير Production أو مالكه أو أسعاره أو بياناته.

## 4. التسجيل وتأكيد البريد الحقيقي

**Blocked لكل الرحلة الحية.** الحسابات البريدية المتصلة الظاهرة حسابات شخصية، ولا يوجد صندوق موصوف ومصرح كصندوق اختبار مستقل. لم أقرأ رسائل شخصية أو أستعمل بريد المالك أو alias على بريده أو عناوين طلاب أو خدمة بريد مؤقتة. هويات example.test السابقة مؤكدة إدارياً ولا تصلح لإثبات وصول البريد.

| الخطوة | F00.8 | الدليل السابق الذي لا يحل محلها |
|---|---|---|
| signup من UI Preview ثم رسالة مستلمة | Blocked | signUp fixture فقط في CI |
| فتح confirmation link وCallback ثم login | Blocked | Callback route مختبر بـexchange اصطناعي |
| رفض رابط مستهلك أو منتهٍ | Blocked حياً | رفض provider fixture ليس رفض مزود حقيقي |
| منع redirect إلى نطاق خارجي | مراجعة الكود السابق؛ Passed fixture سابقاً | next ذو allowlist ثابت؛ allowlist المزود غير مقروءة |
| منع تصعيد المالك من user_metadata | الكود لا يفوض منها؛ اختبار حي سابق F00.2 | لم يعد الاختبار في F00.8 |
| تنظيف هوية F00.8 | لا حساب جديد أنشئ | لا إجراء حذف مطلوب |

المتطلب: صندوق مستقل مخصص للاختبار مع تصريح الاستقبال والاستخدام، ووصوله الآمن إلى عامل الاختبار، وإثبات أن SMTP الحالي يسمح بتسليم الرسائل إليه. وفق [توثيق SMTP](https://supabase.com/docs/guides/auth/auth-smtp)، مزود Supabase الافتراضي يقيّد الإرسال بعناوين فريق المشروع وبحد منخفض؛ **لم نثبت أن Staging يستعمله**. لا نضيف صلاحيات مشروع لصندوق بريد لمجرد تجاوز هذا القيد.

## 5. استعادة كلمة المرور

| الاختبار | النتيجة |
|---|---|
| إرسال recovery واستلامه وفتح رابط صحيح | Blocked — صندوق الاختبار وSMTP/redirect configuration غير متاحين |
| تغيير الكلمة والدخول بالجديدة | Blocked — لا استبدال بـadmin reset |
| رفض replay وانتهاء الرابط بالوقت | Blocked — لا تغيير مدة الروابط أو ساعة الخادم |
| أثر recovery على جلسة الجهاز الثاني | Blocked — اختبار تغيير كلمة F00.2 ليس رحلة recovery |
| عدم كشف وجود البريد | مراجعة route: forgot يعيد الرسالة العامة ويتجاهل provider error العادي؛ Passed fixture سابقاً، لا قياس timing/enumeration حي جديد |

وجود رد HTTP ناجح لطلب forgot لا يثبت الإرسال أو التسليم. لا رسائل recovery أرسلت في هذه الجولة، ولا كلمة مرور حساب حقيقي أو اصطناعي أعيدت تهيئتها.

## 6. JWT الطبيعي والتجديد والجهازان

**Blocked مستقلاً عن عائق البريد:** لا اعتمادات fixture محفوظة مصرح بها أو جلسة حية متاحة حالياً؛ فحص وجود `FARMAKON_LIVE_ACCOUNTS_JSON` و`FARMAKON_LIVE_VERCEL_SHARE` و`FARMAKON_LIVE_VERCEL_OIDC` أعاد absent، ولا جلسات للهويات السابقة. لم أعد فتح أدوات provisioning المغلقة أو أنشئ worker أو أسراراً دائمة أو أعيد كلمات مرور fixtures للحصول على نجاح شكلي.

المراجعة تثبت أن identity يستدعي getUser للتحقق من الرمز المحدد قبل استخدام session_id، ويربط sub بالمستخدم ثم يستدعي helper ضيقاً؛ proxy/SSR قد يجددان الجلسة. هذه **قراءة كود** وليست إثبات تجديد حي.

خطة الاختبار المحددة عند إتاحة المتطلبات:
1. اعتمادات هوية Staging اصطناعية موسومة إدارياً، وPreview معزولة محمية تحتوي الكود المراد اعتماده، ومنحة قصيرة النطاق عند الحاجة؛ جلستان مستقلتان A1/A2 دون حساب حقيقي.
2. تسجيل iat/exp ومدة العمر رقمياً فقط، مع تحقق المزود من التوقيع؛ لا طباعة access/refresh token أو cookies. لا تعديل الساعة.
3. الاحتفاظ بنسخة access token الأصلية في الذاكرة مع تعطيل refresh في عميل الفحص فقط، وانتظار exp الطبيعي؛ فحص رفضها لدى المزود.
4. فحص Platform/Media/Export بالجلسة المنتهية **دون refresh صالح**؛ ثم فحص cookie jar مستقلة ذات refresh صالح وإثبات التجديد والاستمرار. نجاح SDK بعد exp قد يعني refresh مشروعاً، وليس قبول JWT منتهٍ.
5. اختبار local/global signout ورفض replay وتجديد الجلسة الملغاة، ومصير A2، بتسجيل status/هوية مرحلة ثابتة فقط.
6. لا نفترض أن refresh token له مدة انتهاء ثابتة: [توثيق الجلسات](https://supabase.com/docs/guides/auth/sessions) يشرح rotation واستثناءات reuse/parent token وإنفاذ سياسات انتهاء الجلسة وقت التجديد. يلزم قراءة القيم الفعلية قبل تصميم رفض reuse؛ إعادة التوكن الأب مباشرة قد تُقبل وفق التصميم.
7. لا تقليل TTL في هذه الجولة. أي تقليل لاحق يحتاج snapshot لقيمة الأصل، التأكد من عدم وجود جلسات اختبار أخرى، نافذة محدودة، ثم read-back لاستعادة القيمة؛ ممنوع تغيير Production.
8. إبطال جلستي الاختبار وتنظيف الهوية المنشأة لهذه الجولة والتحقق بأعداد مستقلة، دون المساس بالهويات السابقة.

**not_after ≠ JWT exp.** نتيجة F00.2 الحية لإبطال not_after محفوظة كدليل revocation فقط، ولا تُرقى إلى Passed لانتهاء JWT الطبيعي.

## 7. Security Advisors وMFA

نتيجة Staging الحالية: **Leaked Password Protection Disabled** فقط في الاستجابة المراجعة. [الإصلاح الرسمي](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) و[سياسة كلمات المرور](https://supabase.com/docs/guides/auth/password-security) يوضحان أن الميزة متاحة على Pro فأعلى. لم نقرأ خطة الفوترة الفعلية، لذلك لا نجزم أن المشروع Free أو أن الترقية لازمة لهذا الحساب تحديداً؛ يلزم التحقق من الاستحقاق الحالي أولاً. لم تُفعّل ترقية أو خدمة فحص خارجية.

تخفيفات دون اشتراك إضافي: كلمات طويلة وفريدة ومدير كلمات مرور، ضبط سياسة المزود بعد التحقق، رسائل عامة وquota ومراقبة إساءة محدودة دون أسرار، وتقييم TOTP مع recovery مدروس. **ليست هذه بديلاً مكافئاً لفحص الكلمات المسرّبة.**

MFA المالك اقتراح فقط: مراجعة [MFA](https://supabase.com/docs/guides/auth/auth-mfa)، ثم تصميم تسجيل عامل واسترداد وصول واختبار aal2 على الخادم/RLS قبل أي إلزام. تمييز MFA حساب إدارة Supabase عن MFA مستخدم Farmakon ضروري. لا عامل سجل أو فرض على حساب المالك، ولا نفترض دعماً مفعلاً من توفر SDK.

## 8. Preview والعزل

قراءات Vercel الجديدة:
- latest branch deployment: `dpl_JEiJdRkFBC7cX3piBS6ADWCCDedy`، READY، target=staging، commit `a02718e8696ffbbcbb35bbb56a378980773afec3`، [Preview](https://farmakon-8xxbagwvh-phqmr7s.vercel.app).
- هذه نسخة F00.6، **ليست HEAD F00.7 أو تقرير F00.8**. لم ننشرها من جديد ولم ننسب إليها قياسات/إصلاحات F00.7.
- SSO enabled، deploymentType=`prod_deployment_urls_and_all_previews`؛ الحماية لم تُعطل ولم تُنشأ منحة جديدة.
- تسعة overrides للفرع المحدد، target=preview. قراءة انتقائية للقيم غير السرية: Auth URL يطابق Staging؛ strict sessions=true، rate limit=true، synthetic deletion=false.
- DATABASE_URL وrate-limit secret بقيا sensitive؛ لم نستخرجهما. وجود metadata أو تعليق الاتصال ليس إثباتاً حياً جديداً لقاعدة البيانات.
- آخر production listed: `dpl_BNWbrbCXEvRK9BxEqJd4Tkmorctg` / `7258c50062f4bb08cdf9686a727953313ad30260`. لا تغيير Production.
- حاجز العزل في الكود يثبت pin للمشروع والـDB tenant والتحقق قبل الاتصال مع strict/quota. الدليل التشغيلي الحي السابق يبقى F00.2/F00.5؛ لم نشغّل health أو Auth حي جديداً في F00.8.

## 9. الاختبارات والتغييرات وCI

**لا خلل جديد مؤكد أُثبت في هذه الجولة؛ لا runtime patch أو migration أو dependencies أو tests تغيّرت.** عدم إثبات خلل لا يعني خلو النظام من الثغرات، والإعدادات المحجوبة تبقى خطراً غير محسوم.

| التحقق | حالة F00.8 |
|---|---|
| TypeScript/Build/Auth/Callback/session guard | لم تُعد؛ لا تعديل كود يستلزم الإعادة |
| PostgreSQL/RLS/browser E2E | لم تُعد؛ قراءات RLS metadata منفصلة أعلاه |
| الحسابات/الحذف/الامتحانات/حمل الأداء | لم تُعد |
| Preview live Auth والبريد وJWT | Blocked بالمتطلبات المحددة، لا Mock جديد قُدم كبديل |
| GitHub HEAD/PR/Issue وVercel/Supabase read-only | نُفذت فعلياً كما فُصل |
| CI جديد على التقرير | تحديث توثيقي بـ[skip ci] لتجنب تكرار الحمل والحذف والامتحانات الناجحة تلقائياً |

مراجع النجاح السابق:
- كود التطبيق ومصدر أداء F00.7: [93d3a8786d74dc01b97e09bcd97889a3a8b6182b](https://github.com/PhQMR7S/Farmakon/commit/93d3a8786d74dc01b97e09bcd97889a3a8b6182b)، [CI 40499903858](https://github.com/PhQMR7S/Farmakon/actions/runs/40499903858)، baseline/postgres/browser نجاح، 44 E2E وفق تقرير F00.7.
- [CI 40502372995](https://github.com/PhQMR7S/Farmakon/actions/runs/40502372995) على `c9f7cacf03d14f8e3b3f06bd30f97436ab75eb82`: **completed/success**، تحققنا من metadata الحالية؛ لا ننسبه إلى رأس التوثيق اللاحق.
- رأس ما قبل F00.8 `27e4d9b` تصحيح توثيقي لإصدار Node فقط؛ لا ادعاء CI جديد ناجح عليه.
- SHA تقرير F00.8 يثبت في وصف PR بعد رفعه؛ لا نجاح اختبارات جديد مصطنع لهذا الرأس.

## 10. التنظيف والتراجع

لا حسابات/جلسات/ملفات/رسائل/روابط تأكيد أو recovery/منح Vercel/عمال/أسرار أو بيانات اختبار جديدة أُنشئت. ثلاث هويات F00.2 السابقة بقيت بلا جلسات في القراءة؛ لم تُحذف أو تُعد تهيئتها. لا إعداد Auth تغير، ولا TTL يحتاج استعادة، ولا دور مُدد. لا سياسة حذف/احتفاظ اعتمدت، ولا فهرس F00.7 طُبق على Staging/Production.

التراجع عن هذه الجولة هو revert لملف التوثيق فقط على فرع التدقيق. لا تغيير خدمة مطلوب؛ لا تحذف overrides فتعود Preview لوراثة Production، ولا تخفّض guard لتجاوز عائق.

## 11. المتطلبات الدقيقة وقرارات المالك

| البوابة | المطلوب لإكمالها |
|---|---|
| مراجعة Auth configuration والمقارنة | جلسة لوحة مصرح بها أو قناة آمنة لقراءة Management API؛ export انتقائي للإعدادات غير السرية فقط، دون JWT signing secret/SMTP password/API tokens. يلزم قراءة Production بصورة منفصلة للمقارنة فقط |
| البريد وRecovery | صندوق اختبار مستقل مصرح قابل للاستقبال ومسار SMTP يسمح إليه؛ صلاحية وصول آمنة للصندوق، لا بيانات اعتماد في المحادثة أو git. مراجعة Site URL/allowlist/TTL أولاً |
| JWT الطبيعي | اعتمادات fixture موسومة مصرح بها عبر مخزن أسرار، معرفة TTL/rotation/session settings، ونافذة اختبار تستوعب الانتهاء الطبيعي مع جلستين مستقلتين |
| Preview حديثة | نشر Preview غير إنتاجي للكود المحدد بعد إعادة إثبات العزل التشغيلي، مع الاحتفاظ بالحماية ومنحة اختبار محدودة عند الحاجة؛ لا نشر تلقائي في هذه الجولة |
| Leaked Password Protection | التحقق من الاستحقاق الحالي؛ إن كان يتطلب دفعاً يبقى قراراً صريحاً للمالك ولا ينفذ هنا |
| MFA المالك | اعتماد تصميم enrollment/recovery/aal2 منفصل قبل التطبيق؛ لم يفرض |
| صلاحية دور Staging | تنتهي بالموعد المثبت؛ لا تمديد آلي أو موافقة مستنتجة |

بوابات F00 المتبقية: Auth configuration الفعلية والمقارنة، confirmation/recovery/link replay/expiry، JWT الطبيعي والتجديد، استحقاق وفحص leaked-password protection، اعتماد الاحتفاظ والحذف، DR كامل لـAuth/Storage، والسعة الحية والوصولية الأوسع وفجوة الخط الخارجي المسجلة في F00.7. نجاح اختبارات F00.6 للامتحان محفوظ ولا تعاد بوابتها المفتوحة القديمة من نص F00.5.

**التسليم: تقرير مراجعة جزئية مع Blocked موثقة، وليس إغلاق F00.8 وظيفياً أو اعتماد جاهزية الإنتاج. توقف هنا؛ لا F00.9 أو F01، ولا merge/main أو Production أو دفع أو Drive.**
