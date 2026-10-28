# Farmakon V2 — F00.10: Isolated Local Supabase Validation

**27 أكتوبر 2026 — الحكم النهائي للبيئة: Blocked.** موارد GitHub Runner كافية، لكن تنزيل صور الخدمات رُفض من سجلي Supabase الرسميين بسبب حدود التنزيل/الطلبات. لم يبدأ Auth أو Storage أو Mailpit؛ لا نتائج تكامل ناجحة أو استعادة كوارث مدعاة.

## 1. البداية والنطاق
- البداية `0bc525e268a1fc330d531ccbfefc8c28decd5749`؛ المرجع [F00.9](FARMAKON-F00-DISASTER-RECOVERY-REPORT.md).
- `audit/f00-regression-2026-10-26`، [Draft PR #18](https://github.com/PhQMR7S/Farmakon/pull/18) إلى `feat/farmakon-v2-p0-privacy` ويعتمد على #17. Issue #1 مفتوحة.
- لا تغيير كود تطبيق أو dependency/lockfile أو مهاجرات أو Production/Staging أو أسعار أو دور اتصال أو Drive. لا مشروع Supabase Cloud أو registry account أو paid runner جديد.
- هذه مهمة تجهيز بيئة، وليست نسخاً/استعادة Auth أو Storage. لم يُنشأ dump أو snapshot أو backup.

## 2. Runner والموارد والتكلفة
المستودع **public** بحسب GitHub API. [توثيق GitHub](https://docs.github.com/en/actions/reference/runners/github-hosted-runners) يتيح standard hosted runners للمستودعات العامة دون رسوم دقائق. لا larger runner أو artifacts أو cache storage مضافة؛ لم تُفعل خدمة مدفوعة أو تطلب زيادة حصة. لا ادعاء بمراجعة كامل فاتورة الحساب أو سعة تزامنه العامة.

الـworkflow يستخدم ubuntu-24.04 وNode 24، مهلة **25 دقيقة لكل job**، وجولتين متسلسلتين على Runner جديد لكل جولة. بدء CLI محدود الآن بـ**480 ثانية**؛ fail-fast يلغي الجولة التالية عند فشل الأولى. هذا أقل من [حد GitHub hosted job العام](https://docs.github.com/en/actions/reference/limits) البالغ 6 ساعات.

قياسات preflight الفعلية، قبل محاولة تشغيل الخدمات:
| الجولة | CPUs | Available memory bytes | Free disk bytes |
|---|---:|---:|---:|
| ECR الأولى | 4 | 15,708,024,832 | 92,982,808,576 |
| ECR التشخيصية | 4 | 15,518,756,864 | 92,039,421,952 |
| GHCR | 4 | 15,715,520,512 | 92,982,951,936 |

Docker daemon **28.0.4** استجاب فعلياً، Ubuntu **24.04.5**. يُرفض البدء إذا كانت الذاكرة المتاحة أقل من 7 GiB أو القرص الحر أقل من 10 GiB أو المستودع غير عام. الأرقام أعلاه من runner وليست موارد جهاز المستخدم أو Staging أو قياس footprint لخدمات Supabase؛ لم تبدأ الخدمات لقياسه.

## 3. الإصدارات والتوثيق
- Supabase CLI مثبّت **2.81.3** عبر npx بإصدار صريح خارج dependencies التطبيق؛ --version وstart/status/stop/init --help راجعت محلياً، والـRunner طبع 2.81.3 فعلياً.
- إصدار CLI ليس الأحدث؛ [Release metadata](https://github.com/supabase/cli/releases/tag/v2.81.3) يصفه prerelease. اختير لتوافق template والأوامر المراجعة، ولا يُقدّم باعتباره أحدث stable.
- Node 24 يفي بمتطلب Node >=20 لمسار npm/npx بحسب [CLI docs](https://supabase.com/docs/guides/local-development/cli/getting-started).
- راجعت config template وregistry implementation وCI من tag نفسه. التسجيل الافتراضي public.ecr.aws؛ اختيار ghcr.io مدعوم ويستعمله [CI الرسمي لذلك الإصدار](https://github.com/supabase/cli/blob/v2.81.3/.github/workflows/ci.yml).
- [دليل التطوير المحلي](https://supabase.com/docs/guides/local-development) يدعم Docker network ذات host_binding_ipv4=127.0.0.1 ويمنع نشر stack للعامة. لا مشروع cloud linked أو credentials سحابية دخلت workflow.
- نجاح هذه المراجعة لا يثبت توافق كل صور الخدمات قبل تشغيلها. الإصدارات الفعلية للخدمات **غير مثبتة كتطبيق عامل** بسبب عائق تنزيل الصور؛ لا قيم مزعومة لسلسلة Auth/Storage/Mailpit.

## 4. الملفات والإعدادات
| الملف | الغرض |
|---|---|
| .github/workflows/local-supabase.yml | workflow مستقل، permissions contents:read، standard runner، جولتان serial، preflight، build، integration، always cleanup، لا upload artifacts |
| tests/local-supabase/config.toml | config محلي فقط: API/DB/Auth/Storage/Mailpit، لا Studio/Realtime/Edge/Analytics؛ confirmations=true وJWT 90s محلياً فقط |
| tests/local-supabase/run.sh | مساحة RUNNER_TEMP خاصة، CLI مثبت، شبكة loopback، بدء محدود، status في ملف خاص، trap stop --no-backup وتدقيق containers/volumes |
| tests/local-supabase/verify.mjs | suite معدة لخدمات localhost الحقيقية وNext HTTP الفعلي، لا mocks؛ تنفيذ التكامل **لم يصل إليها في CI** |
| tests/local-supabase/diagnose.mjs | تشخيص بدء محدود ومنزوع الأسرار، لا طباعة raw startup/status/application logs |
| tests/local-supabase/README.md | التشغيل، الحدود، العزل، bootstrap المراجع، والتنظيف |
| .github/workflows/quality.yml | scope job يقارن diff مع checkpoint F00.9 لتجنب إعادة regression دون تغيّر التطبيق |

لا تغيّر production TLS في lib/database.ts. اتصال Next المقترح يضيف sslmode=disable **لـPostgreSQL loopback الاصطناعية وحدها**، مع URL checks قبل إنشاء العميل. لم يبدأ Next server في محاولة تكامل مكتملة؛ npm run build نجح على الـRunner، وهو compile فقط وليس deployment.

## 5. التشغيل اليدوي والفصل عن regression
workflow لا يعمل على push أو PR synchronize. يوجد workflow_dispatch مقيد بفرع التدقيق، لكن [GitHub يشترط وجود workflow على default branch](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow) قبل إتاحة هذا الحدث؛ لم ندمجه في main لتجاوز ذلك.

المسار المستعمل فعلياً: إضافة وسم **run-f0010-local** إلى same-repository PR #18 فقط، مع تحقق event/head repository/head branch والهدف. إزالة وإعادة الوسم إجراء تشغيل يدوي صريح؛ أُزيل الوسم عند نهاية الاختبار ولا تشغيل ثقيل تلقائي متروك. لا pull_request_target أو صلاحية secrets أو write token للـjob.

حدثت إعادة غير مقصودة للفحوص القديمة: paths-ignore وحده يقارن diff الـPR كاملاً، وهذا PR يحتوي تغييرات تطبيق سابقة؛ لذا لم يمنع workflow القديم. ثم شرط مبني على event labels جاء false في حدث synchronize. صُحح التصميم إلى مقارنة من checkpoint **0bc525e**:
- على فرع التدقيق فقط، إذا كانت كل الملفات المتغيرة ضمن tests/local-supabase أو workflowيه أو تقرير F00.10، يمكن تخطي baseline/postgres/browser السابقة.
- أي تغيير app/lib/dependency/migration/اختبار سابق يعيد الفحوص العادية.
- لا تخفيض شروط اختبار الحمل أو تغيير عزل PostgreSQL أو إخفاء فشل سابق.
- أُصلح أيضاً خطأ indentation مؤقت في تعريف service postgres؛ YAML وNode syntax وbash syntax وTOML فُحصت بعد التصحيح.
- هذه آلية فصل نطاق، لا نجاح تكامل Auth/Storage. نتيجة تشغيل scope النهائي تربط في PR؛ لا تنسب skipped إلى Passed tests.

## 6. المحاولات وسبب الفشل
| المصدر/Commit | Actions | النتيجة |
|---|---|---|
| de5a2d3496d7f30ac67e9d3e73cacd09dccfa08a — ECR | [40551247490](https://github.com/PhQMR7S/Farmakon/actions/runs/40551247490) | محاولتا Runner مستقلتان فشلتا عند start؛ لا اختبار Auth/Storage |
| 356874d84fceeddb0a6be2265884f659048019ce — ECR مع تشخيص | [40552204396](https://github.com/PhQMR7S/Farmakon/actions/runs/40552204396) | الجولة الأولى فشلت؛ الثانية cancelled بـfail-fast |
| 8518fcaa11b9a8db1c2eb1a760f9634d77ba3fab — GHCR الرسمي | [40553163596](https://github.com/PhQMR7S/Farmakon/actions/runs/40553163596) | الأولى فشلت؛ الثانية cancelled |

الأدلة التشخيصية الآمنة:
- ECR: gotrue/kong/storage-api/postgres أعادت **toomanyrequests: Data limit exceeded**؛ Docker لم يجهّز الخدمات.
- GHCR: **toomanyrequests: retry-after … allowed: 44000/minute** أثناء pull/image stream؛ لا containers في التشخيص.
- نجاح preflight/build لا يعني تشغيل stack. لا تخمين أن هذه إعدادات Auth خاطئة أو أن الخطأ من بيانات المستخدم؛ السبب المرصود registry download limit فقط، والجهة الدقيقة التي تطبق الحد لم تثبت.
- لم نعد تدوير شبكة/IP أو ننشئ registry credentials أو اشتراكاً لتجاوز الحد. جُربت مرآة Supabase الرسمية الموثقة مرة بعد تشخيص ECR، ثم توقّفنا بدلاً من محاولات غير محدودة.

## 7. Auth والبريد وCallback وJWT
| الاختبار المعد | النتيجة الفعلية F00.10 |
|---|---|
| حسابا A/B عشوائيان، رفض login قبل confirmation | **Blocked — لم ينفذ** |
| رسائل تأكيد Mailpit وPKCE عبر Next callback الفعلي ورفض replay | **Blocked** |
| valid code مع next خارجي / malformed callback | **Blocked للتكامل المحلي**؛ لا استبداله باختبارات fixture السابقة |
| recovery عبر Mailpit ثم reset route والدخول بكلمة جديدة | **Blocked** |
| JWT فعلي وانتهاء طبيعي بعد TTL محلي90s ثم refresh | **Blocked**؛ لا JWT صادر أو exp مقاس في هذه الجولة |
| جهازان، logout محلي/عام، session helper ورفض refresh | **Blocked** |
| Next platform/media/export مع cookies ملغاة | **Blocked** |

الكود المعد يستعمل HTTP حقيقياً إلى 127.0.0.1 وخدمة Auth، لا stub أو route mocks؛ يمنع fetch إلى host آخر. يقرأ الرسائل محلياً في الذاكرة دون نشر body/link/OTP، ويفحص grant محلياً قبل فتحه. يستخدم ستاكاً جديداً، وكلمات مرور يولدها الاختبار؛ local CLI dev keys تبقى في status file الخاص ولا تستعمل أي cloud key.

هذه **خطة suite غير مثبتة تكاملياً**؛ يحتمل ظهور أخطاء توافق/اختبار إضافية بعد فتح تنزيل الصور، ويجب إصلاحها وإعادة الجولتين قبل الحكم Passed. البريد المحلي حتى لو نجح لاحقاً لا يثبت SMTP أو mailbox أو إعدادات Staging.

## 8. Storage والسياسات
التكوين المقصود bucket Farmakon خاص مع PDFين صغيرين. suite معدة لتطبيق **سياسات Farmakon الحقيقية**:
- synthetic owner يرفع الملفات، وA/B طالبان باشتراكين في كورسين مستقلين؛ قراءة الطالب حسب entitlement، وليست سياسة جديدة تزعم أن كل طالب uploader.
- قراءة الملف المصرح وSHA-256، منع قراءة ملف الآخر، anonymous وJWT/session ملغاة، list metadata، signed URL ثم انقضاؤه، وحذف files مع فحص count=0.
- Auth owner منفصل وsignup ثالث لاختبار valid callback مع hostile next؛ إجمالي الهويات المصممة أربع، لا حساب حقيقي.

**كل هذه الاختبارات Blocked ولم تنفذ**؛ لم يصل التشغيل إلى إنشاء bucket أو رفع PDF أو استدعاء Storage API. لا دليل جديد على ملكية Object أو RLS أو checksum فعلي أو signed expiry.

## 9. SQL والمهاجرات والتوافق
لا نسخ بيانات أو migration تلقائية من المشروعين السحابيين. الـallowlist المقترحة، في DB محلية جديدة بعد فحص URL:
1. scripts/staging/bootstrap.sql: جداول خاصة وأدوار backend بلا browser grants.
2. supabase/migrations/20261026060742_p0_rate_limits.sql: quota خاصة.
3. scripts/staging/20261026081826_p0_staging_storage.sql: bucket وسياسات entitlement/owner.
4. scripts/staging/20261026121218_p0_staging_sessions.sql: helper محدود وسياسة session restrictive.

راجعت اعتماد هذه الملفات على auth/storage/roles، وحقول UUID/not_after ومالك Storage. ملفات تاريخياً Staging-only يعاد استخدامها **بالنطاق المحلي فقط**؛ لا توحي الموافقة بتطبيقها على Production. لأنها لم تنفذ على stack عامل، توافق Auth/Storage schema المحلي **غير مثبت بعد**.

فهرس F00.7، دور الاتصال المؤقت وSQL عامل الحذف غير داخلة في allowlist. لا db push/reset cloud أو supabase link أو migration history repair أو restore. تغييرات index أو سياسة حذف/احتفاظ غير منفذة.

## 10. النتائج الآلية الإضافية والفشل السابق
الاختبارات الجديدة التي نجحت بالفعل محلياً: Node --check لverify/diagnose، bash -n، parse TOML وYAML والتحقق من موضع service postgres، وفحص ثوابت loopback وعدم artifact upload. ليست اختبارات تكامل.

إعادات regression التي شغّلها GitHub تلقائياً:
- [40551244915](https://github.com/PhQMR7S/Farmakon/actions/runs/40551244915) على de5a2d3: baseline وbrowser ناجحتان، **postgres فشلت عند safety stop للحمل**. عند25VU سجلت 290 عملية وerrorRate=0.003448275862 (حوالي0.3448%)، P95=219.85ms. لا تعديل على كود التطبيق أو حد الصفر، ولا اعتبار الجولة ناجحة. لا يثبت هذا سببه تحت الحمل ولا نصلحه ضمن هذه المهمة.
- [40552195215](https://github.com/PhQMR7S/Farmakon/actions/runs/40552195215): فشل تعريف workflow المؤقت قبل jobs بسبب indentation؛ صُحح في 33aeac0.
- [40553163871](https://github.com/PhQMR7S/Farmakon/actions/runs/40553163871): إعادة تلقائية أخرى قبل تصحيح الاعتماد على labels؛ انتهت cancelled مع تشغيل تحديث gate، ولا تُحسب نجاحاً كاملاً.
- [7b2db7b](https://github.com/PhQMR7S/Farmakon/commit/7b2db7b11ed3a2e559a75360ebfe694fb86e4db4) يصحح gate المقارنة من checkpoint، ولا يعيد محاولة stack المحجوبة. [CI scope 40553482784](https://github.com/PhQMR7S/Farmakon/actions/runs/40553482784) يخص هذا التغيير: scope ناجحة، وbaseline/postgres/browser الثلاثة skipped؛ هذا نجاح فحص النطاق فقط لا نجاح اختبارات تكامل جديدة.

نجاح CI قديم من F00.7 لا يبدل فشل الإعادة الجديدة. وفي المقابل failure registry لا يدل على فشل Auth semantics؛ لم يُختبر. تبقى موثوقية حد الحمل الصفري مسألة مفتوحة للمراجعة، دون فتح F01 أو تغيير المهمة.

## 11. قابلية إعادة الإنشاء والتنظيف
خط التنفيذ معد: fresh Runner → resource preflight → npm ci/build → temp workdir/config/network → CLI start → audited loopback bindings → reviewed SQL → synthetic tests → stop --no-backup → exact containers/volumes audit → delete private files.

إعادة الإنشاء **الناجحة غير مثبتة**: الجولتان الأوليان على Runner جديد أثبتتا تكرار عائق البدء، لا stack يعمل. الجولة الثانية في المحاولات اللاحقة أُلغيت عند فشل الأولى عمداً لتجنب إهدار التشغيل.

السجلات المكتملة للمحاولات المراجعة أثبتت:
`{"phase":"cleanup","containers":0,"volumes":0,"privateFilesRemoved":true}`
والـworkflow لديه خطوة always إضافية للتنظيف. private start/status/Next logs لم تُرفع أو تطبع كاملة. التشخيص يطبع فئات وأخطاء منقحة فقط؛ لا tokens/passwords/mail links في التقرير.

أُغلق النطاق المحلي بـstop --no-backup، واستُدعي حذف الشبكة المخصصة. النسخة الأولى من cleanup كانت تتجاهل خطأ network rm؛ لذلك لا ندعي أن رسالة containers/volumes وحدها تثبت زوال network. سيجعل patch التسليم النهائي فحص غياب الشبكة شرطاً صريحاً لمحاولة لاحقة؛ لا نجاح لتلك الإضافة في المحاولات السابقة. الـRunner VM مؤقتة هي حد التخلص الأخير إذا قتل GitHub job قبل cleanup؛ لا نعد هذا cleanup step مرصودة.

لم تنشأ هويات أو جلسات أو Object أو رسائل فعلية؛ لا تنظيف لحسابات Staging/Production. دور Staging يبقى بموعد **2 نوفمبر 2026 23:59:59 UTC**، دون تمديد أو استعمال في هذه الاختبارات.

## 12. المتطلبات والبوابات
1. إتاحة pull للصور الرسمية على Runner مصرح دون rate/data block، أو مرآة داخلية معتمدة بصور موثقة ونطاق وكلفة وصلاحيات يراجعها المالك. لا حساب/مفتاح registry يرسل في المحادثة، ولا ترقية تلقائية.
2. إعادة الجولتين على Runner جديد بعد زوال العائق؛ إثبات الصور/الخدمات/ports/SQL والتكامل والتنظيف الفعلي. حينها فقط يمكن تقييم Passed.
3. بعد مراجعة F00.10 منفصلة: إعداد **مصدر محلي اصطناعي وهدف محلي جديدين**، inventory/checksums، نسخ Auth وفق مسار مدعوم مع password-hash preservation، نقل Storage bytes، new signing credentials، إبطال session/refresh القديمة، deletion/entitlement ledger أحدث، وقياسات RTO/RPO حتى فحص العزل. **لم نبدأ هذه الاستعادة**.
4. بوابات F00.8 تبقى Blocked كما هي: confirmation/recovery برسالة فعلية مصرح بها في Staging، JWT الطبيعي هناك، وAuth configuration التفصيلية. config المحلي وMailpit ليسا دليلاً عليها؛ هنا Mailpit نفسها لم تبدأ.
5. بوابة DR كاملة والاحتفاظ/مصدر ledger/حيازة المفاتيح وجهة النسخ تبقى مفتوحة من F00.9؛ لا سياسة نافذة أو وجهة Drive/Artifacts.
6. rollback: revert ملفات local tooling وتغيير scope workflow على فرع المراجعة فقط؛ لا data rollback أو migrations أو Auth settings تتطلب استعادة. لا تعطيل guards أو عزل أو سياسة session لإجبار اختبار على النجاح.

**التوقف بعد F00.10: Blocked بسبب تنزيل الصور، مع source قابل للمراجعة وفشل وتنظيف موثقين؛ لا إعلان جاهزية البيئة أو الاستعادة، ولا F01 أو merge/main أو Production أو خدمات مدفوعة.**
