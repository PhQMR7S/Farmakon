import assert from 'node:assert/strict';
// Uses real authenticated HTTP requests, only after the caller verifies the three
// provider-admin-marked disposable accounts and the reviewed Staging target.
export async function verifyEntitlements({owner,a,b,accounts,call,upload}){
 const tag='F00.2 SYNTHETIC '+Date.now();
 async function post(s,body,status=200,path='/api/platform'){
  const r=await call(s,path,body);assert.equal(r.status,status,'Live fixture API status');return r.json();
 }
 const courseData={title:tag,description:'Disposable access-control fixture; not educational material',stage:'QA',category:'QA',price:0,days:1,status:'published',color:'teal'};
 const course=await post(owner,{action:'save',kind:'course',data:courseData});
 await post(a,{action:'save',kind:'announcement',data:{title:tag,description:'Student must not publish',status:'draft'}},403);
 const asset=await upload(owner,course.id);
 const lesson=await post(owner,{action:'save',kind:'lesson',data:{title:tag+' lesson',courseId:course.id,module:'QA',order:1,minutes:1,url:asset.url,assetId:asset.id,description:'PROTECTED_SYNTHETIC_CONTENT',free:false,status:'published',download:true}});
 const question=await post(owner,{action:'save',kind:'question',data:{title:tag+' question',courseId:course.id,topic:'QA',options:['one','two','three','four'],correct:1,explanation:'Synthetic answer explanation',source:'QA fixture',status:'published',free:false}});
 const exam=await post(owner,{action:'save',kind:'exam',data:{title:tag+' exam',courseId:course.id,minutes:20,questionIds:[question.id],free:false,status:'published'}});
 const media='/api/media?id='+encodeURIComponent(asset.id);
 await post(owner,{action:'enroll',email:accounts.a.email,courseId:course.id,days:1});
 assert.equal((await call(a,media)).status,200,'Enrolled A reads actual Storage object through application');
 assert.equal((await call(b,media)).status,403,'Unenrolled B cannot read Storage object');
 await post(b,{action:'startExam',id:exam.id},403);
 await post(a,{action:'progress',id:lesson.id,data:{seconds:15,completed:false,note:'A_PRIVATE_'+tag}});
 const attempt=await post(a,{action:'startExam',id:exam.id});assert.equal(attempt.questions[0].correct,undefined);assert.equal(attempt.questions[0].explanation,undefined);
 await post(a,{action:'saveExam',id:attempt.id,answers:{[question.id]:1}});
 await post(owner,{action:'enroll',email:accounts.b.email,courseId:course.id,days:1});
 await post(b,{action:'progress',id:lesson.id,data:{seconds:30,completed:false,note:'B_PRIVATE_'+tag}});
 await post(b,{action:'submitExam',id:attempt.id,answers:{}},404);
 const stateA=await(await call(a)).text(),stateB=await(await call(b)).text();
 assert.ok(stateA.includes('A_PRIVATE_'+tag)&&!stateA.includes('B_PRIVATE_'+tag));
 assert.ok(stateB.includes('B_PRIVATE_'+tag)&&!stateB.includes('A_PRIVATE_'+tag));
 const exportA=await post(a,{},200,'/api/account/export'),exportB=await post(b,{},200,'/api/account/export');
 assert.ok(JSON.stringify(exportA).includes('A_PRIVATE_'+tag)&&!JSON.stringify(exportA).includes('B_PRIVATE_'+tag));
 assert.ok(JSON.stringify(exportB).includes('B_PRIVATE_'+tag)&&!JSON.stringify(exportB).includes('A_PRIVATE_'+tag));
 const owned=await(await call(owner)).json();const enrollment=owned.enrollments.find(e=>e.email===accounts.a.email&&e.course_id===course.id);assert.ok(enrollment);
 await post(owner,{action:'revoke',id:enrollment.id});
 assert.equal((await call(a,media)).status,403);assert.equal((await call(b,media)).status,200,'Revoking A does not revoke B');
 await post(a,{action:'startExam',id:exam.id},403);await post(a,{action:'saveExam',id:attempt.id,answers:{}},403);await post(a,{action:'submitExam',id:attempt.id,answers:{}},403);
 await post(a,{action:'progress',id:lesson.id,data:{seconds:99,completed:true,note:'must fail'}},403);await post(a,{action:'answer',id:question.id,selected:1},403);
 const revoked=await(await call(a)).json();assert.ok(!revoked.attempts.some(v=>v.id===attempt.id));const locked=revoked.lesson.find(v=>v.id===lesson.id);assert.equal(locked.locked,true);assert.equal(locked.url,undefined);
 await post(owner,{action:'archive',id:course.id});
 console.log('PASS live: owner CRUD/upload, actual private Storage transfer, populated A/B note/export isolation, answer secrecy, cross-user attempt denial, immediate revoke across media/progress/questions/exams; B remains independent. Synthetic course archived.');
 return {media,lessonId:lesson.id,examId:exam.id,attemptId:attempt.id,courseId:course.id};
}
