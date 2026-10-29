import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../script.js',import.meta.url),'utf8');
const slice=(start,end)=>{
  const a=source.indexOf(start),b=source.indexOf(end,a);
  assert(a>=0&&b>a,`${start} missing`);
  return source.slice(a,b);
};
const functions=slice('function resizeImage(', '\nfunction getStudentFormHTML(') + '\n' +
  slice('async function addStudentToSupabase(', '\nasync function updateStudentInSupabase(');

const sample = {fullName:'Học sinh mới',dob:'2017-01-02',gender:'Nữ',class:'3A',grade:'3',address:'',phone:'',email:'',fatherName:'',motherName:'',parentPhone:'',enrollmentDate:'2026-09-05',status:'Đang học',note:'',competence:'Đạt',quality:'Tốt'};
function harness({photo=true,scoreError='',studentError='',permission=true}={}) {
  const inserts=[],scores=[],toasts=[]; let students=[];
  class ImageMock {
    set src(value){ if(value==='data:broken'){this.onerror?.();return;}this.width=1500;this.height=1000;this.onload?.(); }
  }
  class FileReaderMock {
    readAsDataURL(file){ if(file.broken){ this.onerror?.();return; }this.result=file.content;this.onload?.(); }
  }
  const supabase = {
    from(table) {
      if (table === 'app3_students') return {
        insert(rows) {
          inserts.push(...rows);
          return {
            select() {
              return {
                single: async () => studentError
                  ? {data: null, error: {message: studentError}}
                  : {data: {...rows[0], id: 'uuid-123'}, error: null}
              };
            }
          };
        }
      };
      if (table === 'app3_scores') return {
        upsert: async row => { scores.push(row); return {error: scoreError ? {message: scoreError} : null}; }
      };
      throw Error('Unexpected table ' + table);
    }
  };
  const ctx={
    APP_STATE:{classes:[{name:'3A',id:'uuid-class'}],students,studentSubject:'Tin học',subjectCatalog:[{name:'Tin học'}],scores:{}},
    SUBJECTS:['Tin học'], DEFAULT_AVATAR:'default-svg',
    getSubjectId:()=> 'sub-id', updateClassCounts:()=>{},requireEditPermission:()=>permission,
    showToast:(...a)=>toasts.push(a),showModal:()=>Promise.resolve(false),captureStudentViewState:()=>{},getStudentFormHTML:()=>'',
    console:{warn:()=>{}}, Image:ImageMock,FileReader:FileReaderMock,
    document:{createElement(type){assert.equal(type,'canvas');return {getContext:()=>({drawImage(){}}),toDataURL:()=>'data:image/jpeg;base64,c21hbGw='};}},
    supabase
  };
  vm.createContext(ctx);
  vm.runInContext(functions,ctx);
  return {ctx,inserts,scores,toasts};
}
const file={type:'image/png',content:'data:image/png;base64,dGVzdA=='};
{
  const h=harness(); const st=await h.ctx.addStudentToSupabase({...sample},file);
  assert.equal(h.inserts.length,1);
  assert.equal(h.inserts[0].avatar_url,'data:image/jpeg;base64,c21hbGw=');
  assert.equal(st.avatar,h.inserts[0].avatar_url);
  assert.equal(h.scores.length,1);
  assert.equal(h.ctx.APP_STATE.students.length,1);
}
{
  const h=harness(); const st=await h.ctx.addStudentToSupabase({...sample,competence:'',quality:''},null);
  assert.equal(h.inserts[0].avatar_url,null);
  assert.equal(st.avatar,'default-svg');
  assert.equal(h.scores.length,0);
}
{
  const h=harness(); await assert.rejects(()=>h.ctx.addStudentToSupabase(sample,{type:'image/png',content:'data:broken'}),/Không đọc được ảnh/);
  assert.equal(h.inserts.length,0,'Không tạo học sinh nếu ảnh lỗi');
}
{
  const h=harness(); await assert.rejects(()=>h.ctx.addStudentToSupabase(sample,{type:'text/plain',content:'text'}),/không phải ảnh/);
  assert.equal(h.inserts.length,0);
}
{
  const h=harness({scoreError:'RLS denied'});const st=await h.ctx.addStudentToSupabase(sample,file);
  assert.equal(h.ctx.APP_STATE.students.length,1);
  assert.equal(st._scoreSaveWarning,'RLS denied');
  assert.equal(h.inserts.length,1);
}
{
  const h=harness({studentError:'permission denied'});
  await assert.rejects(()=>h.ctx.addStudentToSupabase(sample,file),err => err.message === 'permission denied');
  assert.equal(h.ctx.APP_STATE.students.length,0);
}
{
  const h=harness({permission:false});
  assert.equal(await h.ctx.addStudentToSupabase(sample,file),null);
  assert.equal(h.inserts.length,0);
}
{
  const h=harness();const st=await h.ctx.addStudentToSupabase(sample,file,true);
  assert.equal(h.inserts[0].avatar_url,null);assert.equal(st.avatar,'default-svg');
}
{
  const h=harness();const st=await h.ctx.addStudentToSupabase({...sample,competence:'',quality:''},file);
  assert.equal(st._scoreSaveWarning,'');assert.equal(h.scores.length,0);
}
{
  const h=harness({scoreError:'RLS denied'});
  let renders=0;
  h.ctx.showModal=()=>Promise.resolve(true);
  h.ctx.getStudentFormData=()=>sample;
  h.ctx.captureStudentViewState=()=>{};
  h.ctx.getStudentFormHTML=()=>'';
  h.ctx.renderPage=()=>{renders++};
  h.ctx.document.getElementById=(id)=>id==='sfAvatarInput'?{files:[file]}:(id==='sfAvatarPreview'?{dataset:{avatarCleared:'false'}}:null);
  h.ctx.openAddStudent();
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(h.inserts.length,1,'Chỉ tạo một hồ sơ khi lưu đánh giá báo lỗi');
  assert.equal(renders,1);
  assert(h.toasts.some(v=>String(v[0]).includes('Đã thêm học sinh') && String(v[0]).includes('không thêm trùng')));
}
console.log('PASS 10 bài kiểm thử thêm học sinh (có ảnh, không ảnh, xóa ảnh, ảnh lỗi, RLS, lỗi DB, quyền, tránh thêm trùng).');
