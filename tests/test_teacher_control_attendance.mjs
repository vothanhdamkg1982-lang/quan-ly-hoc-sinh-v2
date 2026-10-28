import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../script.js', import.meta.url), 'utf8');
const slice = (from, to) => {
  const a = source.indexOf(from), b = source.indexOf(to, a + from.length);
  assert.ok(a >= 0 && b > a, `Không tìm thấy đoạn mã ${from}`);
  return source.slice(a,b);
};
let tests = 0;
const q = [{q:'1+1?',a:['1','2','3','4'],c:1},{q:'2+2?',a:['2','3','4','5'],c:2}];
function game(mode='continue_on_wrong', questions=q) {
  const delays = [];
  const st = {started:true,ended:false,level:0,correctCount:0,locked:false,
    questions,hiddenAnswers:[],selectedIndex:null,phase:'question',playMode:mode,
    wrongAttempts:[],timerEnabled:false,recordStudentId:null};
  const context = {MILLIONAIRE_STATE:st, console, setTimeout:fn=>delays.push(fn),
    getMillionaireCurrentQuestion:()=>st.questions[st.level]||null,
    millionaireRecordAnswer:()=>{},
    millionaireStopTimer:()=>{}, stopMillionaireThinking:()=>{},millionaireMCStop:()=>{},
    millionaireSound:()=>{},millionaireMCAnnounce:()=>{},refreshMillionaire:()=>{},
    millionaireStartThinking:()=>{},millionaireStartTimer:()=>{},
    millionaireShowCelebration:()=>{},millionairePrizeAtLevel:()=>10,
    millionaireWrongEndingMCText:()=>'',millionaireWinnerMCText:()=>'',
    millionaireCelebrateMilestone:(_l,fn)=>fn(),millionaireMCPresentCurrentQuestion:()=>{},
    millionaireBoostVolume:()=>0};
  vm.createContext(context);
  vm.runInContext(slice('function millionaireHandleTimeout(){','function millionaireSetPlayMode(')+
    slice('function millionaireAdvanceQuestion() {','function millionaireUseFifty()'),context);
  return {st,context,delays,flush(){const all=delays.splice(0);for(const fn of all)fn()}};
}
{
  const g=game();g.context.millionaireResolveAnswer(1);
  assert.equal(g.st.level,0);assert.equal(g.st.phase,'locked');g.flush();
  assert.equal(g.st.phase,'correct'); assert.equal(g.st.level,0);
  g.context.millionaireAdvanceQuestion();assert.equal(g.st.level,1);assert.equal(g.st.phase,'question');tests++;
}
{
  const g=game('continue_on_wrong');g.context.millionaireResolveAnswer(0);g.flush();
  assert.equal(g.st.phase,'wrong');assert.equal(g.st.level,0);
  g.context.millionaireAdvanceQuestion();assert.equal(g.st.level,1);tests++;
}
{
  const g=game('retry_until_correct');g.context.millionaireResolveAnswer(0);g.flush();
  assert.equal(g.st.phase,'wrong');assert.equal(g.st.level,0);
  g.context.millionaireAdvanceQuestion();assert.equal(g.st.level,0);assert.equal(g.st.phase,'question');tests++;
}
{
  const g=game('stop_on_wrong');g.context.millionaireResolveAnswer(0);g.flush();
  assert.equal(g.st.ended,false);g.context.millionaireAdvanceQuestion();assert.equal(g.st.ended,true);tests++;
}
{
  const g=game();g.context.millionaireHandleTimeout();assert.equal(g.st.phase,'timeout');assert.equal(g.st.level,0);
  g.context.millionaireAdvanceQuestion();assert.equal(g.st.level,1);tests++;
}
{
  const g=game('continue_on_wrong',[q[0]]);g.context.millionaireResolveAnswer(1);g.flush();
  assert.equal(g.st.ended,false);g.context.millionaireAdvanceQuestion();assert.equal(g.st.ended,true);assert.equal(g.st.phase,'winner');tests++;
}
// Thử với hàm truy xuất điểm danh thật; mô phỏng cơ sở dữ liệu chứ không gọi Supabase thật.
const students = [
  {id:'1',db_uuid:'u1',fullName:'A',class_id:'c1'},
  {id:'2',db_uuid:'u2',fullName:'B',class_id:'c1'},
  {id:'3',db_uuid:'u3',fullName:'C',class_id:'c1'},
  {id:'4',db_uuid:'u4',fullName:'D',class_id:'c1'}
];
let mockRows = [
  {student_id:'u1',status:'Có mặt'},
  {student_id:'u2',status:'Vắng'},
  {student_id:'u3',status:'Phép'},
  {student_id:'u4',status:'Muộn'}
];
let failed=false;
const state={classId:'c1',students:[],calledKeys:new Set(),winner:null,
  attendanceRequestId:0,attendanceLoading:false,attendanceSynced:false,
  attendanceDate:'',absentCount:0,selectionConfirmed:true,isSpinning:false,
  currentQuestion:null};
const imgState={...state,calledKeys:new Set(),attendanceRequestId:0};
const ctx={
  APP_STATE:{students,classes:[{id:'c1',name:'3A'}]},
  CALL_ANSWER_STATE:state,IMAGE_CALLER_STATE:imgState,
  DEFAULT_AVATAR:'',console,
  getImageCallerClasses:()=>[{id:'c1',name:'3A'}],
  filterGameClassesByAccess:x=>x,
  supabase:{from:()=>({select:()=>({eq:()=>({eq:async()=>failed?{error: new Error('Offline')}:{data:mockRows,error:null}})})})},
  document:{getElementById:()=>null,querySelector:()=>null},
  callAnswerUpdateSummary:()=>{},callAnswerRenderCallerStage:()=>{},callAnswerPrepareStudentImages:()=>{},
  renderImageCallerStudentList:()=>{},updateImageCallerStats:()=>{},imageCallerSetActionState:()=>{},
  imageCallerPrepareStudentImages:()=>{},imageCallerRestoreWinnerDisplay:()=>{},showToast:()=>{}
};
vm.createContext(ctx);
vm.runInContext(slice('function getImageCallerStudents(classId) {','const IMAGE_CALLER_ABSENT_STATUSES ='),ctx);
vm.runInContext(slice('const IMAGE_CALLER_ABSENT_STATUSES =','async function imageCallerSyncAttendanceForClass('),ctx);
vm.runInContext(slice('async function callAnswerSyncAttendanceForClass(', 'async function callAnswerConfirmQuestionSelection()'),ctx);
vm.runInContext(slice('async function imageCallerSyncAttendanceForClass(', 'function imageCallerReloadAttendance()'),ctx);
{
 const ok=await ctx.callAnswerSyncAttendanceForClass('c1');assert.equal(ok,true);
 assert.deepEqual([...state.students.map(s=>s.db_uuid)],['u1','u4']);assert.equal(state.absentCount,2);tests++;
}
{
 const ok=await ctx.imageCallerSyncAttendanceForClass('c1');assert.equal(ok,true);
 assert.deepEqual([...imgState.students.map(s=>s.db_uuid)],['u1','u4']);assert.equal(imgState.absentCount,2);tests++;
}
{
 failed=true;
 const ok=await ctx.callAnswerSyncAttendanceForClass('c1');assert.equal(ok,false);
 assert.equal(state.attendanceSynced,false);assert.equal(state.students.length,0);tests++;
}
{
 failed=true;
 const ok=await ctx.imageCallerSyncAttendanceForClass('c1');assert.equal(ok,false);
 assert.equal(imgState.attendanceSynced,false);tests++;
}

// Kiểm tra nút Tiếp theo thực sự được kết xuất và công khai trong module ES.
{
 const st={started:true,ended:false,level:0,locked:true,phase:'correct',
   questions:q,selectedIndex:1,hiddenAnswers:[],wrongAttempts:[],playMode:'continue_on_wrong',
   lifelines:{fifty:true,audience:true,switch:true},mcEnabled:false,soundEnabled:false,
   results:[],recordStudentId:'',message:'Chính xác!',timerEnabled:false};
 const c={MILLIONAIRE_STATE:st,MILLIONAIRE_PRIZES:Array(15).fill('10'),
   restoreMillionaireStateFromStorage:()=>{},getMillionaireCurrentQuestion:()=>q[0],
   escapeHtml:x=>String(x),millionaireStageClass:()=>'',renderMillionaireLadder:()=>'',
   renderMillionaireAudience:()=>'',millionaireFormatTimer:()=>''};
 vm.createContext(c);
 vm.runInContext(slice('function renderMillionaire() {','function refreshMillionaire()'),c);
 const html=c.renderMillionaire();
 assert.match(html,/onclick="millionaireAdvanceQuestion\(\)"/);
 assert.match(html,/Tiếp theo → Câu 2/);
 assert.match(html,/class="millionaire-answer[\s\S]*?disabled/);
 assert.match(source,/window\.millionaireAdvanceQuestion\s*=\s*millionaireAdvanceQuestion/);
 const css=fs.readFileSync(new URL('../style.css',import.meta.url),'utf8');
 assert.match(css,/#app \.millionaire-stage \.millionaire-question/);
 assert.match(css,/#app \.millionaire-stage \.millionaire-answer/);
 tests++;
}

console.log(`PASS ${tests} bài kiểm thử: chờ nút Tiếp theo, các luật chơi, hết giờ, lọc Vắng/Phép, khóa gọi khi mất dữ liệu.`);
