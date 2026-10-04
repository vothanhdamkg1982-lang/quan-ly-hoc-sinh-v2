/**
 * BƯỚC 175.4 – CẢI TIẾN CƠ CHẾ THÍCH ỨNG VÀ PHẢN HỒI AI CÓ KIỂM DUYỆT; KẾ THỪA BƯỚC 175.3.
 * BƯỚC 175.3 – CHUẨN HÓA NGÂN HÀNG BÀI 8, BIỂU ĐỒ, ĐÁNH GIÁ THỰC HÀNH, XUẤT EXCEL, TÁCH DỮ LIỆU THỬ/CHÍNH THỨC.
 * Không thay đổi bảng Supabase, điểm, nhận xét hay trạng thái trò chơi hiện có.
 * Chỉ đọc danh sách lớp/học sinh đã được phân quyền từ APP_STATE.
 * Dữ liệu kết quả được ghi riêng trên thiết bị của giáo viên, theo ID tài khoản.
 * AI tạo sinh: tạo lời nhắc không kèm thông tin cá nhân để giáo viên duyệt thủ công.
 */
import { ADAPTIVE_BANK, ADAPTIVE_SKILLS } from './adaptive-bank.js';

export const ADAPTIVE_LESSON_ID = 'L4_BAI_8_KNTT_2026_V1753';
const SKILL_IDS = Object.keys(ADAPTIVE_SKILLS);
const STAGES = Object.freeze({pre:'Đánh giá đầu vào',practice:'Luyện tập thích ứng',post:'Đánh giá lại'});
const MAX_NOTE_LENGTH = 800;
const RUBRIC_LEVELS = ['Chưa đạt (0)', 'Có hướng dẫn (1)', 'Tự thực hiện (2)'];
const MODE_LABEL = {test:'KIỂM THỬ',official:'THỰC NGHIỆM CHÍNH THỨC'};
export function adaptiveRubricTotal(scores) {
    if (!scores || !SKILL_IDS.every(k=>[0,1,2].includes(scores[k]))) return null;
    const correct = SKILL_IDS.reduce((n,k)=>n+scores[k],0);
    return {correct,total:SKILL_IDS.length*2,pct:correct/(SKILL_IDS.length*2)*100};
}
export function adaptiveSkillComparison(pre,post) {
    return SKILL_IDS.map(k=>({skill:k,label:ADAPTIVE_SKILLS[k],pre:pre?.skills?.[k]||null,post:post?.skills?.[k]||null}));
}
export function adaptiveClassMetrics(records) {
    const paired=records.filter(r=>r?.pre?.total>0 && r?.post?.total>0);
    const avg=key=>paired.length ? paired.reduce((sum,r)=>sum+r[key].correct/r[key].total*100,0)/paired.length : null;
    const before=avg('pre'),after=avg('post');
    return {paired:paired.length,before,after,delta:paired.length?after-before:null,preCount:records.filter(r=>r?.pre).length,
        rubricPaired:records.filter(r=>adaptiveRubricTotal(r?.rubricPre?.scores)&&adaptiveRubricTotal(r?.rubricPost?.scores)).length};
}


export function adaptiveGradeFour(cls) {
    const grade = String(cls?.grade ?? '').trim();
    const name = String(cls?.name ?? '').trim();
    return grade === '4' || /(?:^|\s)(?:lớp\s*)?4(?:[a-z]|\b|\/\d)/iu.test(name);
}
export function adaptivePriorities(pre, skillIds = SKILL_IDS, rubricScores = null) {
    if (!pre?.skills) return [];
    const ratio=k=>{
        const quiz=pre.skills[k].correct/pre.skills[k].total;
        return [0,1,2].includes(rubricScores?.[k]) ? (quiz + rubricScores[k]/2)/2 : quiz;
    };
    return skillIds.filter(k => pre.skills[k]?.total >= 2 && (pre.skills[k].correct < pre.skills[k].total || [0,1].includes(rubricScores?.[k]))).sort((a,b) =>
        ratio(a) - ratio(b) || skillIds.indexOf(a)-skillIds.indexOf(b)
    ).slice(0,2);
}
// Kế hoạch có thể giải thích được, không phải kết luận AI về năng lực học sinh.
// Dữ liệu ít hơn 2 câu ở bất kỳ kỹ năng nào => chẩn đoán bổ sung; tất cả đúng => vận dụng.
export function adaptivePlan(pre, bank = ADAPTIVE_BANK, skillIds = SKILL_IDS, rubricScores = null) {
    if(!pre?.skills) return {type:'pending',skills:[],questions:[],reason:'Chưa có bài đánh giá đầu vào.'};
    const short=skillIds.filter(k=>(pre.skills[k]?.total??0)<2);
    if(short.length){
        const answered=new Set((pre.answers||[]).map(a=>a.id));
        const questions=bank.filter(q=>q.stage==='pre'&&short.includes(q.skill)&&!answered.has(q.id)).slice(0,4);
        return {type:'diagnostic',skills:short,questions,reason:'Chưa đủ 2 câu chẩn đoán ở: '+short.map(k=>ADAPTIVE_SKILLS[k]).join('; ')+'. Cần hoàn tất chẩn đoán; không suy diễn kỹ năng yếu từ dữ liệu thiếu.'};
    }
    const weak=adaptivePriorities(pre,skillIds,rubricScores);
    if(weak.length){
        const questions=bank.filter(q=>q.stage==='practice'&&weak.includes(q.skill));
        return {type:'remediation',skills:weak,questions,reason:'Ưu tiên '+weak.map(k=>ADAPTIVE_SKILLS[k]+' (trắc nghiệm '+pre.skills[k].correct+'/'+pre.skills[k].total+([0,1,2].includes(rubricScores?.[k])?', thực hành '+rubricScores[k]+'/2':'')+')').join('; ')+'. Ưu tiên kết quả trắc nghiệm và mức thực hành trước học đã được giáo viên lưu; mỗi kỹ năng 2 câu.'};
    }
    const questions=bank.filter(q=>q.stage==='practice'&&skillIds.includes(q.skill)).filter((_,i)=>i%2===0).slice(0,4);
    return {type:'application',skills:skillIds,questions,reason:'Các kỹ năng đầu vào đều đạt 2/2; giao câu hỏi củng cố đa kỹ năng và nhiệm vụ vận dụng tổng hợp trên trang chiếu.'};
}
export function adaptiveClassSkillMetrics(records,skillIds=SKILL_IDS){
    return skillIds.map(k=>{
        const pairs=records.filter(r=>r?.pre?.skills?.[k]?.total>0 && r?.post?.skills?.[k]?.total>0);
        const rubricPairs=records.filter(r=>[0,1,2].includes(r?.rubricPre?.scores?.[k])&&[0,1,2].includes(r?.rubricPost?.scores?.[k]));
        const avg=(xs,fn)=>xs.length?xs.reduce((n,r)=>n+fn(r),0)/xs.length:null;
        return {skill:k,label:ADAPTIVE_SKILLS[k],paired:pairs.length,
          pre:avg(pairs,r=>r.pre.skills[k].correct/r.pre.skills[k].total*100),
          post:avg(pairs,r=>r.post.skills[k].correct/r.post.skills[k].total*100),
          rubricPaired:rubricPairs.length,rubricPre:avg(rubricPairs,r=>r.rubricPre.scores[k]),rubricPost:avg(rubricPairs,r=>r.rubricPost.scores[k])};
    });
}
export function adaptiveResult(answers, bank = ADAPTIVE_BANK) {
    const byId = new Map(bank.map(q => [q.id,q]));
    const skills = Object.fromEntries(SKILL_IDS.map(k => [k,{correct:0,total:0}]));
    let correct = 0;
    for (const answer of answers) {
        const q=byId.get(answer.id);
        if (!q || !Number.isInteger(answer.choice) || answer.choice<0 || answer.choice>3) throw Error('Dữ liệu câu trả lời không hợp lệ');
        if (q.skill in skills) {
            skills[q.skill].total++;
            if (q.correct === answer.choice) {skills[q.skill].correct++;correct++;}
        }
    }
    return {correct,total:answers.length,skills,answers:answers.map(a=>({...a})),completedAt:new Date().toISOString()};
}
export function adaptiveBankAudit(bank = ADAPTIVE_BANK) {
    const ids = new Set();
    for(const q of bank) {
        if(ids.has(q.id) || !STAGES[q.stage] || !SKILL_IDS.includes(q.skill) || !Array.isArray(q.a) || q.a.length !== 4 ||
            !Number.isInteger(q.correct) || q.correct<0 || q.correct>3 || !q.q || !q.why) return false;
        ids.add(q.id);
    }
    return ['pre','practice','post'].every(stage => SKILL_IDS.every(skill => bank.filter(q => q.stage===stage && q.skill===skill).length>=2));
}

const esc = value => String(value ?? '').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const pct = r => r && r.total>0 ? `${Math.round(r.correct/r.total*100)}%` : '—';
const stamp = s => s ? new Date(s).toLocaleString('vi-VN') : '—';
const dbEmpty = () => ({version:3,lessonId:ADAPTIVE_LESSON_ID,approvedAt:null,students:{},officialStudents:{}});
const safeCSV = s => {let str=String(s??'');if(/^[=+\-@\t\r]/.test(str))str="'"+str;return '"'+str.replaceAll('"','""')+'"';};

export function createAdaptiveLearningModule({context}) {
    if (typeof context !== 'function') throw Error('Thiếu bộ cấp dữ liệu học sinh');
    const state={classId:'',studentId:'',mode:'test',run:null,choice:null,prompt:'',promptSkill:SKILL_IDS[0],aiPurpose:'feedback',aiDraft:'',notice:'',noticeError:false,loadedUser:'',db:dbEmpty()};
    const ctx=()=>context()||{};
    function storeKey() {
        const id=ctx().userId;
        return id ? `qlhs_adaptive_l4_bai8_v1753_${String(id)}` : null;
    }
    function load() {
        const key=storeKey();
        if(state.loadedUser===key)return;
        state.loadedUser=key;state.classId='';state.studentId='';state.mode='test';state.run=null;state.choice=null;state.aiDraft='';state.prompt='';
        state.db=dbEmpty();
        if(!key) return;
        try {
            const saved=JSON.parse(localStorage.getItem(key)||'null');
            if(saved && saved.version===3 && saved.lessonId===ADAPTIVE_LESSON_ID && saved.students && typeof saved.students==='object' && !Array.isArray(saved.students)){state.db=saved;if(!state.db.officialStudents||Array.isArray(state.db.officialStudents))state.db.officialStudents={};}
        } catch (_) {state.notice='Không đọc được bản lưu trên trình duyệt. Hãy kiểm tra bộ nhớ và sao lưu.';state.noticeError=true;}
    }
    function save() {
        const key=storeKey();if(!key){note('Không xác định được tài khoản đăng nhập.',true);return false;}
        try {localStorage.setItem(key,JSON.stringify(state.db));return true;}
        catch (_) {note('Không lưu được kết quả trên thiết bị. Kiểm tra bộ nhớ trình duyệt rồi thực hiện lại.',true);return false;}
    }
    function note(s,bad=false){state.notice=s;state.noticeError=bad;}
    function classes() {return (ctx().classes||[]).filter(adaptiveGradeFour);}
    function students() {return (ctx().students||[]).filter(s => String(s.class_id)===String(state.classId) && !!s.db_uuid);}
    function currentStudent(){return students().find(s=>String(s.db_uuid)===String(state.studentId))||null;}
    function records(){return state.mode==='official'?state.db.officialStudents:state.db.students;}
    function record(){return records()[state.studentId]||{};}
    function setRecord(id,value){records()[id]=value;}
    function delRecord(id){delete records()[id];}
    function scorePair(r){return r.pre?.total&&r.post?.total?((r.post.correct/r.post.total-r.pre.correct/r.pre.total)*100):null;}
    function chartMarkup(before,after,label) {
        if(before===null||after===null)return '<p class="adaptive-hint">Chưa đủ dữ liệu trước và sau để tạo biểu đồ.</p>';
        const w=x=>Math.max(0,Math.min(100,x));
        return `<div class="adaptive-bars" role="img" aria-label="${esc(label)}: đầu vào ${before.toFixed(1)} phần trăm; sau học ${after.toFixed(1)} phần trăm">
          <div class="adaptive-bar-row"><span>Đầu vào</span><div class="adaptive-bar-track"><span class="adaptive-bar-pre" style="width:${w(before)}%"></span></div><b>${before.toFixed(1)}%</b></div>
          <div class="adaptive-bar-row"><span>Sau học</span><div class="adaptive-bar-track"><span class="adaptive-bar-post" style="width:${w(after)}%"></span></div><b>${after.toFixed(1)}%</b></div>
          <p class="adaptive-hint">Chênh lệch: ${(after-before)>=0?'+':''}${(after-before).toFixed(1)} điểm phần trăm. Biểu đồ mô tả, không thay thế đánh giá thực hành.</p></div>`;
    }

    function canStart(stage) {
        if(!ctx().canEdit || !state.db.approvedAt || !currentStudent() || state.run || !adaptiveBankAudit())return false;
        const r=record();
        return stage==='pre' ? !r.pre : stage==='practice' ? !!r.pre&&!r.practice : !!r.pre&&!!r.practice&&!r.post&&r.practicePlan?.type!=='diagnostic';
    }
    function ensureSelection() {
        if(!classes().some(c=>String(c.id)===String(state.classId)))state.classId=String(classes()[0]?.id||'');
        if(!currentStudent())state.studentId=String(students()[0]?.db_uuid||'');
    }
    function summaryClass(){
        const members=students(), all=records(),rs=members.map(s=>all[s.db_uuid]||{}),m=adaptiveClassMetrics(rs),skillMetrics=adaptiveClassSkillMetrics(rs);
        return `<div class="adaptive-grid">
          <div class="adaptive-card"><h3>Tiến độ lớp · ${MODE_LABEL[state.mode]}</h3><p><b>${members.length}</b> học sinh trong phạm vi lớp đã chọn.</p>
            <p>Đã làm đầu vào: <b>${m.preCount}</b> · Có đủ trước–sau: <b>${m.paired}</b> · Đủ đánh giá thực hành: <b>${m.rubricPaired}</b></p>
            <p>Chênh lệch trung bình trên các hồ sơ đủ hai lần đánh giá: <b>${m.delta===null?'—':m.delta.toFixed(1)+' điểm phần trăm'}</b></p>
            ${chartMarkup(m.before,m.after,'Kết quả trắc nghiệm trung bình của lớp')}</div>
          <div class="adaptive-card"><h3>Lưu ý về dữ liệu</h3>
            <p class="adaptive-hint">${state.mode==='test'?'Dữ liệu KIỂM THỬ: gồm mọi kết quả cũ của bước 175.1, không tính vào báo cáo thực nghiệm.':'Dữ liệu CHÍNH THỨC: chỉ ghi vào nhóm riêng khi thầy chọn chế độ này. Chỉ nhập kết quả do học sinh thực hiện thực tế.'}</p>
            <p class="adaptive-hint">Chỉ lưu trên trình duyệt theo tài khoản, không ghi điểm hay nhận xét lên Supabase. AI chỉ hỗ trợ giáo viên chuẩn bị nội dung; việc đánh giá thực hành do giáo viên xác nhận.</p></div></div>
          <div class="adaptive-card" style="margin-top:14px"><h3>Tổng hợp theo từng kỹ năng · chỉ tính hồ sơ đủ hai lần</h3><div class="adaptive-table-wrap"><table><thead><tr><th>Kỹ năng</th><th>Số hồ sơ</th><th>Đầu vào</th><th>Sau học</th><th>Chênh lệch</th><th>Thực hành trước / sau (0–2)</th></tr></thead><tbody>
          ${skillMetrics.map(x=>`<tr><td>${esc(x.label)}</td><td>${x.paired}</td><td>${x.pre===null?'—':x.pre.toFixed(1)+'%'}</td><td>${x.post===null?'—':x.post.toFixed(1)+'%'}</td><td>${x.pre===null?'—':(x.post-x.pre).toFixed(1)+' điểm %'}</td><td>${x.rubricPaired?x.rubricPre.toFixed(1)+' / '+x.rubricPost.toFixed(1)+' ('+x.rubricPaired+' hồ sơ)':'—'}</td></tr>`).join('')}
          </tbody></table></div><p class="adaptive-hint">Mỗi kỹ năng chỉ có hai câu trắc nghiệm. Chênh lệch là mô tả, cần đối chiếu với sản phẩm thực hành trước khi kết luận.</p></div>`;
    }
    function stageMarkup(stage,r) {
        const res=r[stage];
        let text=res ? `${res.correct}/${res.total} (${pct(res)}) · ${esc(stamp(res.completedAt))}` : 'Chưa thực hiện';
        const enabled=canStart(stage);
        return `<div class="adaptive-step"><strong>${esc(STAGES[stage])}</strong><span>${text}</span><br><button data-adaptive="start" data-stage="${stage}" ${enabled?'':'disabled'} class="${enabled?'adaptive-primary':''}">${stage==='practice'?'Làm bài luyện tập':'Bắt đầu'}</button></div>`;
    }
    function rubricMarkup(r,stage) {
        const entry=stage==='pre'?r.rubricPre:r.rubricPost;
        const total=adaptiveRubricTotal(entry?.scores);
        return `<fieldset class="adaptive-rubric"><legend>Thực hành ${stage==='pre'?'trước học':'sau học'}</legend>
          <p class="adaptive-hint">Nhiệm vụ: mở tệp trình chiếu đã chuẩn bị, chọn phần văn bản, đổi phông và cỡ chữ, định dạng kiểu chữ đậm/nghiêng/gạch chân, đổi màu chữ và tạo dấu đầu dòng cho danh sách; lưu tệp. Dùng hai bộ yêu cầu tương đương trước–sau.</p>
          ${SKILL_IDS.map(k=>`<label>${esc(ADAPTIVE_SKILLS[k])}
            <select data-rubric-stage="${stage}" data-rubric-skill="${k}" ${ctx().canEdit?'':'disabled'}>
              <option value="">— Chưa chấm —</option>${RUBRIC_LEVELS.map((v,i)=>`<option value="${i}" ${entry?.scores?.[k]===i?'selected':''}>${esc(v)}</option>`).join('')}
            </select></label>`).join('')}
          <p class="adaptive-hint">${total?'Đã chấm: '+total.correct+'/'+total.total+' ('+Math.round(total.pct)+'%).':'Chưa có đủ năm tiêu chí để tính điểm.'}</p>
          <button data-adaptive="save-rubric" data-stage="${stage}" ${ctx().canEdit?'':'disabled'}>Lưu đánh giá thực hành ${stage==='pre'?'trước':'sau'}</button>
        </fieldset>`;
    }
    function studentMarkup() {
        const s=currentStudent();if(!s)return '<div class="adaptive-card"><p>Chọn lớp có học sinh để bắt đầu.</p></div>';
        const r=record(),plan=r.pre?adaptivePlan(r.pre,ADAPTIVE_BANK,SKILL_IDS,r.rubricPre?.scores):null;
        const historical=!!r.practice&&!r.practicePlan;const visiblePlan=historical?null:(r.practicePlan||plan);
        const skills=adaptiveSkillComparison(r.pre,r.post);
        const a=r.pre?.total?r.pre.correct/r.pre.total*100:null;
        const b=r.post?.total?r.post.correct/r.post.total*100:null;
        const rubricA=adaptiveRubricTotal(r.rubricPre?.scores),rubricB=adaptiveRubricTotal(r.rubricPost?.scores);
        return `<div class="adaptive-grid"><div class="adaptive-card"><h3>Lộ trình: ${esc(s.fullName||s.id||'Học sinh')} · ${MODE_LABEL[state.mode]}</h3>
            ${stageMarkup('pre',r)}${stageMarkup('practice',r)}${stageMarkup('post',r)}
            ${historical?'<p class="adaptive-hint">Lượt luyện tập trước nâng cấp 175.4 không lưu lý do chọn câu hỏi; không suy diễn kế hoạch cũ.</p>':''}
            ${visiblePlan?`<div class="adaptive-plan"><strong>Kế hoạch ${visiblePlan.type==='remediation'?'luyện tập kỹ năng còn thiếu':visiblePlan.type==='application'?'vận dụng tổng hợp':visiblePlan.type==='diagnostic'?'chẩn đoán bổ sung':'chưa xác định'}</strong><p>${esc(visiblePlan.reason)}</p><p>Giao: ${r.practicePlan?.questionIds?.length??plan.questions.length} câu.${visiblePlan.type==='application'?' Bổ sung nhiệm vụ thực hành trình bày trang chiếu có định dạng chữ và dấu đầu dòng.':''}</p></div>`:''}
          </div><div class="adaptive-card"><h3>Hồ sơ tiến bộ</h3>
            <p>Trắc nghiệm · Đầu vào: <b>${pct(r.pre)}</b> · Sau học: <b>${pct(r.post)}</b></p>
            ${chartMarkup(a,b,'Kết quả trắc nghiệm của học sinh')}
            <p>Thực hành · Trước: <b>${rubricA?rubricA.correct+'/'+(SKILL_IDS.length*2):'—'}</b> · Sau: <b>${rubricB?rubricB.correct+'/'+(SKILL_IDS.length*2):'—'}</b>${rubricA&&rubricB?' · Chênh lệch: <b>'+((rubricB.pct-rubricA.pct)>=0?'+':'')+(rubricB.pct-rubricA.pct).toFixed(1)+' điểm %</b>':''}</p>
            <label for="adaptiveComment">Nhận xét từ sản phẩm thực hành (giáo viên xác nhận)</label>
            <textarea id="adaptiveComment" rows="4" maxlength="${MAX_NOTE_LENGTH}" ${ctx().canEdit?'':'disabled'} placeholder="Chỉ ghi nhận xét cần thiết; tránh thông tin nhạy cảm.">${esc(r.teacherComment||'')}</textarea>
            <button data-adaptive="save-comment" ${ctx().canEdit?'':'disabled'}>Lưu nhận xét</button>
            ${Object.entries(r.approvedFeedback||{}).length?`<div class="adaptive-feedback"><strong>Phản hồi đã được giáo viên duyệt</strong>${Object.entries(r.approvedFeedback).filter(([k])=>SKILL_IDS.includes(k)).map(([k,v])=>`<p><b>${esc(ADAPTIVE_SKILLS[k])}:</b> ${esc(v.text||'')} <small>(${esc(stamp(v.approvedAt))})</small></p>`).join('')}</div>`:''}
            <button data-adaptive="reset-student" class="adaptive-danger" ${ctx().canEdit?'':'disabled'}>Xóa dữ liệu ${MODE_LABEL[state.mode]} của học sinh này</button>
          </div></div>
          <div class="adaptive-card" style="margin-top:14px"><h3>Phân tích theo kỹ năng</h3><div class="adaptive-table-wrap"><table><thead><tr><th>Kỹ năng</th><th>Đầu vào</th><th>Sau học</th><th>Nhận định dữ liệu</th></tr></thead><tbody>
          ${skills.map(x=>`<tr><td>${esc(x.label)}</td><td>${x.pre?.total?x.pre.correct+'/'+x.pre.total:'—'}</td><td>${x.post?.total?x.post.correct+'/'+x.post.total:'—'}</td><td>${x.pre?.total&&x.post?.total?(x.post.correct/x.post.total>x.pre.correct/x.pre.total?'Tỷ lệ đúng tăng':x.post.correct/x.post.total<x.pre.correct/x.pre.total?'Tỷ lệ đúng giảm':'Chưa thay đổi'):'Chưa đủ dữ liệu'}</td></tr>`).join('')}
          </tbody></table></div><p class="adaptive-hint">Mỗi kỹ năng có hai câu ở mỗi lần đánh giá; chỉ dùng để gợi ý luyện tập, kết luận về kỹ năng thực hành phải dựa trên sản phẩm do giáo viên chấm.</p></div>
          <div class="adaptive-card" style="margin-top:14px"><h3>Phiếu đánh giá thực hành (giáo viên chấm)</h3>
            <p class="adaptive-hint">Mỗi tiêu chí: 0 = chưa làm được; 1 = làm được khi có hướng dẫn; 2 = tự thực hiện chính xác. Chỉ bấm Lưu khi đã quan sát sản phẩm thật.</p>
            <div class="adaptive-grid">${rubricMarkup(r,'pre')}${rubricMarkup(r,'post')}</div></div>`;
    }
    function bankPreviewMarkup() {
        // Chỉ người có quyền biên tập mới được xem đáp án trước khi học sinh làm bài.
        if (!ctx().canEdit) return '';
        const stageNames = [
            ['pre', 'I. Đánh giá đầu vào'],
            ['practice', 'II. Luyện tập thích ứng'],
            ['post', 'III. Đánh giá lại']
        ];
        return `<section class="adaptive-card adaptive-bank-review" id="adaptiveBankPreview" style="margin-top:14px" aria-label="Xem trước ngân hàng 30 câu hỏi">
          <h3>Kiểm duyệt ngân hàng câu hỏi · ${ADAPTIVE_BANK.length} câu</h3>
          <p class="adaptive-hint">Mở từng nhóm để đọc câu hỏi, bốn phương án A–D, đáp án đúng, lời giải thích và kỹ năng liên quan. Nội dung biên soạn theo Bài 8, SGK Tin học lớp 4, trang 34–38; giáo viên kiểm duyệt lần cuối trước khi áp dụng.</p>
          ${stageNames.map(([stage,title],index)=>{
              const questions=ADAPTIVE_BANK.filter(q=>q.stage===stage);
              return `<details class="adaptive-bank-stage" ${index===0?'open':''}>
                <summary>${esc(title)} · ${questions.length} câu <span class="adaptive-hint">(nhấn để ${index===0?'thu gọn / ':' '}mở rộng)</span></summary>
                <div class="adaptive-bank-items">${questions.map((q,i)=>`<article class="adaptive-bank-question">
                  <p class="adaptive-hint">Mã ${esc(q.id)} · Kỹ năng: ${esc(ADAPTIVE_SKILLS[q.skill]||q.skill)}</p>
                  <p><strong>Câu ${i+1}. ${esc(q.q)}</strong></p>
                  <ol type="A" class="adaptive-bank-options">${q.a.map((choice,j)=>`<li class="${j===q.correct?'adaptive-bank-correct':''}">${esc(choice)}${j===q.correct?' ✓':''}</li>`).join('')}</ol>
                  <p class="adaptive-bank-answer"><strong>Đáp án: ${'ABCD'[q.correct]}</strong> · ${esc(q.why)}</p>
                </article>`).join('')}</div>
              </details>`;
          }).join('')}
          <p class="adaptive-warning">Chỉ nhấn xác nhận sau khi đã kiểm tra 30 câu, đáp án, độ khó giữa hai lần đánh giá và phân phối chương trình tại trường.</p>
          <p>${state.db.approvedAt?`<span class="adaptive-success">Đã xác nhận kiểm duyệt: ${esc(stamp(state.db.approvedAt))}</span>`:'Chưa xác nhận kiểm duyệt nội dung.'}</p>
          <button data-adaptive="approve">${state.db.approvedAt?'Xác nhận kiểm duyệt lại':'Xác nhận đã kiểm duyệt ngân hàng'}</button>
        </section>`;
    }
    function teacherMarkup() {
        const members=students(),approved=!!state.db.approvedAt,all=records();
        return `<div class="adaptive-grid"><div class="adaptive-card"><h3>Ngân hàng Bài 8 · Tin học lớp 4</h3>
           <p>Bài: Định dạng văn bản trên trang chiếu. Năm kỹ năng, 10 câu đầu vào, 10 câu trong ngân hàng luyện tập (mỗi lượt giao 2–4 câu, tùy dữ liệu), 10 câu đánh giá lại.</p>
           <p class="adaptive-warning">Cần đối chiếu câu hỏi, đáp án và phân phối chương trình với tài liệu đang dạy trước khi thực nghiệm.</p>
           <p>${approved?`<span class="adaptive-success">Đã xác nhận kiểm duyệt: ${esc(stamp(state.db.approvedAt))}</span>`:'Chưa xác nhận kiểm duyệt nội dung.'}</p>
           ${ctx().canEdit?'<a class="adaptive-bank-link" href="#adaptiveBankPreview">Xem đầy đủ 30 câu hỏi và đáp án ↓</a>':'<p class="adaptive-hint">Tài khoản chỉ xem không được truy cập đáp án hoặc xác nhận kiểm duyệt.</p>'}</div>
           <div class="adaptive-card"><h3>Dữ liệu thực nghiệm của Bài 8</h3>
           <p class="adaptive-hint">Chỉ xuất mã học sinh (dạng văn bản), kết quả thuộc chế độ ${MODE_LABEL[state.mode]} và lớp đang chọn; không xuất họ tên.</p>
           <div class="adaptive-actions"><button data-adaptive="csv" ${!ctx().canEdit||!members.length?'disabled':''}>Xuất CSV</button>
           <button data-adaptive="xlsx" ${!ctx().canEdit||!members.length?'disabled':''}>Xuất Excel .xlsx</button>
           <button data-adaptive="backup" ${!ctx().canEdit||!members.length?'disabled':''}>Sao lưu JSON cả hai chế độ</button>
           <button data-adaptive="backup-legacy" ${!ctx().canEdit?'disabled':''}>Sao lưu kết quả bản 175.2.2</button>
           <button data-adaptive="print" ${!members.length?'disabled':''}>In / Lưu PDF minh chứng</button></div>
           <p class="adaptive-hint">Sao lưu sau mỗi buổi. Bản 175.3 lưu riêng với 175.2.2; dùng nút sao lưu dữ liệu cũ nếu cần. Không xóa bộ nhớ trình duyệt trước khi sao lưu.</p></div></div>
           ${bankPreviewMarkup()}
           <div class="adaptive-card" style="margin-top:14px"><h3>Tổng hợp theo học sinh</h3><div class="adaptive-table-wrap"><table><thead><tr><th>Mã học sinh</th><th>Đầu vào</th><th>Luyện tập</th><th>Sau học</th><th>Chênh lệch (điểm %)</th><th>Thực hành trước</th><th>Thực hành sau</th><th>Thời điểm</th></tr></thead><tbody>
           ${members.map(s=>{const r=all[s.db_uuid]||{};return `<tr><td>${esc(s.id||'—')}</td><td>${esc(pct(r.pre))}</td><td>${esc(pct(r.practice))}</td><td>${esc(pct(r.post))}</td><td>${r.pre&&r.post?esc(((r.post.correct/r.post.total-r.pre.correct/r.pre.total)*100).toFixed(1)):'—'}</td><td>${adaptiveRubricTotal(r.rubricPre?.scores)?adaptiveRubricTotal(r.rubricPre?.scores).correct+'/'+(SKILL_IDS.length*2):'—'}</td><td>${adaptiveRubricTotal(r.rubricPost?.scores)?adaptiveRubricTotal(r.rubricPost?.scores).correct+'/'+(SKILL_IDS.length*2):'—'}</td><td>${esc(stamp(r.post?.completedAt||r.pre?.completedAt))}</td></tr>`}).join('')||'<tr><td colspan="8">Chưa có học sinh lớp này.</td></tr>'}
           </tbody></table></div></div>`;
    }
    function aiMarkup() {
        const r=record();
        return `<div class="adaptive-card" style="margin-top:14px"><h3>Trợ lý học liệu AI · giáo viên kiểm duyệt</h3>
          <p class="adaptive-hint">Bước 1: tạo lời nhắc không kèm họ tên/mã học sinh, dùng công cụ AI được phép. Bước 2: kiểm tra theo SGK, chỉnh nội dung và dán phản hồi vào ô bên dưới. Bước 3: giáo viên duyệt và lưu cho học sinh đã chọn. Không gửi dữ liệu học sinh đến API.</p>
          <div class="adaptive-grid"><label>Kỹ năng cần hỗ trợ
            <select id="adaptiveSkill">${SKILL_IDS.map(k=>`<option value="${k}" ${k===state.promptSkill?'selected':''}>${esc(ADAPTIVE_SKILLS[k])}</option>`).join('')}</select></label>
          <label>Mục đích lời nhắc<select id="adaptivePurpose"><option value="feedback" ${state.aiPurpose==='feedback'?'selected':''}>Phản hồi và hướng dẫn sửa lỗi</option><option value="practice" ${state.aiPurpose==='practice'?'selected':''}>Bài luyện thực hành phân hóa</option><option value="analysis" ${state.aiPurpose==='analysis'?'selected':''}>Phân tích lỗi thường gặp</option></select></label></div>
          <div class="adaptive-actions"><button data-adaptive="prompt" ${ctx().canEdit?'':'disabled'}>Tạo lời nhắc AI</button><button data-adaptive="copy" ${state.prompt?'':'disabled'}>Sao chép lời nhắc</button></div>
          <textarea id="adaptivePrompt" readonly rows="6" placeholder="Lời nhắc AI không có thông tin cá nhân xuất hiện tại đây">${esc(state.prompt)}</textarea>
          <label for="adaptiveApprovedFeedback">Bản phản hồi đã kiểm tra và chỉnh sửa (chỉ lưu trên thiết bị)</label>
          <textarea id="adaptiveApprovedFeedback" rows="5" maxlength="1200" ${!ctx().canEdit||!r.pre?'disabled':''} placeholder="Giáo viên dán nội dung từ AI hoặc tự viết; kiểm tra thuật ngữ, thao tác và tính phù hợp với SGK trước khi duyệt.">${esc(state.aiDraft)}</textarea>
          <button data-adaptive="approve-feedback" ${!ctx().canEdit||!r.pre?'disabled':''}>Giáo viên duyệt và lưu phản hồi</button>
          <p class="adaptive-hint">Phản hồi duyệt được lưu theo học sinh, kỹ năng và chế độ đang chọn; không đưa vào điểm số, không xuất nội dung phản hồi vào báo cáo lớp. Không sử dụng dữ liệu cá nhân trong lời nhắc.</p></div>`;
    }
    function quizMarkup() {
        const run=state.run; if(!run)return '';
        const q=run.questions[run.index],answered=state.choice!==null;
        return `<div class="adaptive-card adaptive-quiz" style="margin-top:14px"><div class="adaptive-actions" style="justify-content:space-between"><h3>${esc(STAGES[run.stage])} · Câu ${run.index+1}/${run.questions.length}</h3><button data-adaptive="cancel">Hủy lượt chưa hoàn thành</button></div>
            <p class="adaptive-hint">${esc(ADAPTIVE_SKILLS[q.skill])}</p><h3>${esc(q.q)}</h3>
            ${q.a.map((v,i)=>`<button class="adaptive-choice ${answered?(i===q.correct?'correct':i===state.choice?'wrong':''):''}" data-adaptive="answer" data-choice="${i}" ${answered?'disabled':''}>${'ABCD'[i]}. ${esc(v)}</button>`).join('')}
            ${answered?`<div class="adaptive-feedback"><b>${state.choice===q.correct?'Đúng!':'Chưa đúng. Hãy xem giải thích.'}</b><p>${esc(q.why)}</p></div><button data-adaptive="next" class="adaptive-primary">${run.index+1===run.questions.length?'Hoàn thành':'Câu tiếp theo'}</button>`:''}
            </div>`;
    }
    function view() {
        load();ensureSelection();const cs=classes();
        return `<div class="adaptive-page"><div class="adaptive-header"><div><small>SÁNG KIẾN 2026–2027 • BƯỚC 175.4</small><h2>Học tập thích ứng có hỗ trợ AI</h2><p>Bài 8 · Tin học lớp 4 · 5 kỹ năng theo SGK trang 34–38 · dữ liệu tách biệt khỏi điểm và nhận xét chính thức.</p></div><span>${navigator.onLine?'Đang có mạng':'Đã mất kết nối'}</span></div>
          ${state.notice?`<p role="status" class="${state.noticeError?'adaptive-error':'adaptive-success'}">${esc(state.notice)}</p>`:''}
          <div class="adaptive-card" style="margin-top:14px"><div class="adaptive-grid" style="margin-top:0"><div>
            <label for="adaptiveClass">Lớp (trong phạm vi phân quyền)</label>
            <select id="adaptiveClass" ${state.run?'disabled':''}>${cs.map(c=>`<option value="${esc(c.id)}" ${String(c.id)===state.classId?'selected':''}>${esc(c.name)}</option>`).join('')}</select>
          </div><div><label for="adaptiveStudent">Học sinh</label>
            <select id="adaptiveStudent" ${state.run?'disabled':''}>${students().map(s=>`<option value="${esc(s.db_uuid)}" ${String(s.db_uuid)===state.studentId?'selected':''}>${esc(s.fullName||s.id||'Học sinh')} (${esc(s.id||'—')})</option>`).join('')}</select>
          </div></div>${cs.length?'':'<p class="adaptive-warning">Không có lớp 4 trong phạm vi truy cập. Kiểm tra thông tin khối/lớp trước khi thử nghiệm.</p>'}</div>
          ${!state.run?`<div class="adaptive-mode-bar"><label for="adaptiveMode">Chế độ ghi kết quả</label>
            <select id="adaptiveMode" ${ctx().canEdit?'':'disabled'}><option value="test" ${state.mode==='test'?'selected':''}>Kiểm thử (không đưa vào báo cáo)</option><option value="official" ${state.mode==='official'?'selected':''}>Thực nghiệm chính thức</option></select>
            <strong>${MODE_LABEL[state.mode]}</strong><p class="adaptive-hint">Dữ liệu bước 175.1 được giữ trong chế độ kiểm thử. Chuyển chế độ không sao chép kết quả cũ.</p></div>`:''}
          ${state.run?quizMarkup():`${summaryClass()}${studentMarkup()}${teacherMarkup()}${aiMarkup()}`}
          <p class="adaptive-hint" style="margin-top:14px">Để sử dụng bài mẫu trong nghiên cứu, phải kiểm duyệt nội dung theo SGK, phân phối chương trình và hướng dẫn đánh giá hiện hành. Chỉ có thể luyện tập trên trang đã tải; việc đăng nhập ứng dụng và tải thư viện từ CDN có thể cần Internet.</p>
          </div>`;
    }
    function update() {const root=document.getElementById('adaptiveModuleRoot');if(root)root.innerHTML=view();}
    function render(){return '<div id="adaptiveModuleRoot">'+view()+'</div>';}
    function init(){
        const root=document.getElementById('adaptiveModuleRoot');if(!root||root.dataset.initialized)return;
        root.dataset.initialized='true';
        root.addEventListener('change',e=>{
            if(state.run)return;
            if(e.target.id==='adaptiveMode'){state.mode=e.target.value==='official'?'official':'test';state.aiDraft='';state.prompt='';note('Đã chuyển sang chế độ '+MODE_LABEL[state.mode]+'.');update();}
            if(e.target.id==='adaptiveClass'){state.classId=e.target.value;state.studentId='';note('');update();}
            if(e.target.id==='adaptiveStudent'){state.studentId=e.target.value;state.aiDraft='';state.prompt='';note('');update();}
            if(e.target.id==='adaptiveSkill'){state.promptSkill=e.target.value;state.prompt='';state.aiDraft='';update();}
            if(e.target.id==='adaptivePurpose'){state.aiPurpose=e.target.value;state.prompt='';update();}
        });
        root.addEventListener('click',async e=>{
            const btn=e.target.closest('button[data-adaptive]');if(!btn||btn.disabled)return;
            const action=btn.dataset.adaptive;
            if(action==='answer'){
                if(!state.run||state.choice!==null)return;
                const choice=Number(btn.dataset.choice);
                if(Number.isInteger(choice)&&choice>=0&&choice<4){state.choice=choice;update();}
                return;
            }
            if(action==='next'){
                if(!state.run||state.choice===null)return;
                const q=state.run.questions[state.run.index];
                state.run.answers.push({id:q.id,choice:state.choice});
                state.run.index++;state.choice=null;
                if(state.run.index===state.run.questions.length){
                    const r=adaptiveResult(state.run.answers);const stage=state.run.stage;
                    const sid=state.run.studentId;
                    const prev=records()[sid];
                    setRecord(sid,{...(prev||{}),[stage]:r,...(stage==='practice'?{practicePlan:state.run.plan}: {})});
                    if(!save())setRecord(sid,prev||{});
                    else note('Đã lưu '+STAGES[stage].toLowerCase()+': '+r.correct+'/'+r.total+' câu đúng.');
                    state.run=null;
                }
                update();return;
            }
            if(action==='cancel'){if(state.run && confirm('Hủy lượt chưa hoàn thành? Các câu đã trả lời sẽ không được lưu.')){state.run=null;state.choice=null;note('Đã hủy lượt chưa hoàn thành.');update();}return;}
            if(!ctx().canEdit){note('Tài khoản chỉ xem không thể thay đổi dữ liệu thử nghiệm.',true);update();return;}
            if(action==='approve'){
                if(!adaptiveBankAudit()){note('Ngân hàng câu hỏi chưa đạt kiểm tra cấu trúc.',true);update();return;}
                if(confirm('Tôi đã đối chiếu nội dung, đáp án và yêu cầu cần đạt theo tài liệu đang giảng dạy. Xác nhận?')){
                    const old=state.db.approvedAt;state.db.approvedAt=new Date().toISOString();
                    if(!save())state.db.approvedAt=old;else note('Đã ghi nhận xác nhận kiểm duyệt ngân hàng trên thiết bị này.');update();
                }return;
            }
            if(action==='start'){
                const stage=btn.dataset.stage;if(!STAGES[stage]||!canStart(stage))return;
                const plan=stage==='practice'?adaptivePlan(record().pre,ADAPTIVE_BANK,SKILL_IDS,record().rubricPre?.scores):null;
                const qs=plan?plan.questions:ADAPTIVE_BANK.filter(q=>q.stage===stage);
                if(!qs.length){note('Không có câu hỏi phù hợp.',true);update();return;}
                state.run={stage,studentId:state.studentId,questions:qs,index:0,answers:[],plan:plan?{type:plan.type,skills:plan.skills,reason:plan.reason,questionIds:qs.map(q=>q.id)}:null};state.choice=null;note('');update();return;
            }
            if(action==='save-comment'){
                if(!currentStudent())return;
                const noteText=root.querySelector('#adaptiveComment')?.value?.trim().slice(0,MAX_NOTE_LENGTH)||'';
                const prev=records()[state.studentId];
                setRecord(state.studentId,{...(prev||{}),teacherComment:noteText});
                if(!save())setRecord(state.studentId,prev||{});else note('Đã lưu nhận xét thực hành trên thiết bị.');update();return;
            }
            if(action==='reset-student'){
                if(!currentStudent())return;
                if(confirm('Xóa TOÀN BỘ kết quả trong chế độ đang chọn của học sinh này? Chế độ còn lại không bị ảnh hưởng. Nên sao lưu cả hai chế độ trước.')){
                    const old=records()[state.studentId];delRecord(state.studentId);
                    if(!save())setRecord(state.studentId,old||{});else note('Đã xóa dữ liệu '+MODE_LABEL[state.mode]+' của học sinh đã chọn.');update();
                }return;
            }
            if(action==='save-rubric'){
                if(!currentStudent())return;
                const stage=btn.dataset.stage;
                if(!['pre','post'].includes(stage))return;
                const els=[...root.querySelectorAll(`select[data-rubric-stage="${stage}"]`)];
                const scores={};
                for(const el of els){const v=el.value;if(!['0','1','2'].includes(v)){note('Hãy chấm đủ cả năm tiêu chí hoặc để trống và chấm sau.',true);update();return;}scores[el.dataset.rubricSkill]=Number(v);}
                if(!adaptiveRubricTotal(scores)){note('Thiếu tiêu chí đánh giá thực hành.',true);update();return;}
                const old=records()[state.studentId],key=stage==='pre'?'rubricPre':'rubricPost';
                setRecord(state.studentId,{...(old||{}),[key]:{scores,completedAt:new Date().toISOString()}});
                if(!save())setRecord(state.studentId,old||{});else note('Đã lưu đánh giá thực hành '+(stage==='pre'?'trước':'sau')+' học.');update();return;
            }
            if(action==='backup-legacy'){
                const key=ctx().userId?`qlhs_adaptive_l4_v1_${String(ctx().userId)}`:null;
                const raw=key?localStorage.getItem(key):null;
                if(!raw){note('Không có dữ liệu phiên bản cũ trên trình duyệt này.',true);update();return;}
                download('du_lieu_kiem_thu_buoc_175_2_2.json',raw,'application/json;charset=utf-8');
                note('Đã xuất bản sao dữ liệu thử 175.2.2; dữ liệu mới lưu riêng.');update();return;
            }
            if(action==='csv'||action==='backup'||action==='xlsx') {exportClass(action);return;}
            if(action==='print'){window.print();return;}
            if(action==='approve-feedback'){
                if(!currentStudent()||!record().pre)return;
                const body=root.querySelector('#adaptiveApprovedFeedback')?.value?.trim()||'';
                if(body.length<20||body.length>1200){note('Phản hồi cần từ 20 đến 1200 ký tự. Vui lòng đọc và chỉnh sửa trước khi duyệt.',true);update();return;}
                if(!confirm('Xác nhận đã đối chiếu phản hồi với SGK, kiểm tra nội dung và không có dữ liệu nhạy cảm?'))return;
                const old=record(),feedback={...(old.approvedFeedback||{}),[state.promptSkill]:{text:body,approvedAt:new Date().toISOString(),reviewedByTeacher:true}};
                setRecord(state.studentId,{...old,approvedFeedback:feedback});
                if(!save()){setRecord(state.studentId,old);}else{state.aiDraft='';note('Đã lưu phản hồi được giáo viên kiểm duyệt (không ghi điểm).');}update();return;
            }
            if(action==='prompt') {state.prompt=buildPrompt();note('Đã tạo lời nhắc không chứa dữ liệu cá nhân.');update();return;}
            if(action==='copy'){
                try{await navigator.clipboard.writeText(state.prompt);note('Đã sao chép lời nhắc AI.');}
                catch(_){note('Trình duyệt không cho sao chép tự động. Hãy chọn và sao chép văn bản trong ô lời nhắc.',true);}
                update();return;
            }
        });
    }
    function buildPrompt(){
        const label=ADAPTIVE_SKILLS[state.promptSkill]||ADAPTIVE_SKILLS[SKILL_IDS[0]];
        const goal={feedback:'Viết 3 phản hồi ngắn khi học sinh làm sai, mỗi phản hồi có gợi ý thao tác từng bước để học sinh tự sửa, không cung cấp ngay đáp án.',practice:'Thiết kế 2 bài thực hành phân hóa và tiêu chí quan sát theo thang 0–2; ưu tiên luyện kỹ năng chưa thành thạo.',analysis:'Liệt kê 3 lỗi phổ biến, nguyên nhân có thể có và cách giáo viên kiểm tra nguyên nhân bằng một thao tác thực tế.'}[state.aiPurpose]||'Viết phản hồi gợi ý sửa lỗi.';
        return `Bạn là trợ lý hỗ trợ giáo viên Tin học lớp 4. Chỉ dựa trên Bài 8 “Định dạng văn bản trên trang chiếu”, SGK Kết nối tri thức với cuộc sống, trang 34–38. Kỹ năng: "${label}". Phạm vi: chọn văn bản; Home > Font (phông, cỡ, kiểu B/I/U, màu chữ); Home > Paragraph > Bullets hoặc None; mở/lưu tệp trình chiếu. ${goal} Câu chữ phù hợp học sinh tiểu học, đúng thao tác trong SGK; nội dung đề xuất là BẢN NHÁP cần giáo viên duyệt, không tự kết luận năng lực, không tự chấm điểm. Không yêu cầu hoặc suy đoán họ tên, mã số, thông tin riêng của học sinh. Nếu nội dung chưa được SGK xác nhận hãy đánh dấu để giáo viên kiểm tra.`;
    }
    function download(name,text,type){const url=URL.createObjectURL(new Blob([text],{type}));const link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
    function exportClass(kind){
        const members=students();if(!ctx().canEdit||!members.length){note('Không có quyền hoặc lớp chưa có học sinh.',true);update();return;}
        const rows=members.map(s=>({ma:String(s.id||''),r:records()[s.db_uuid]||{},uuid:s.db_uuid}));
        const today=new Date().toISOString().slice(0,10);
        const classTag=String(classes().find(c=>String(c.id)===state.classId)?.name||'lop4').replace(/[^a-z0-9]/gi,'_');
        const base=`${classTag}_${state.mode}_${today}`;
        const header=['ma_hoc_sinh','dau_vao_dung','dau_vao_tong','luyen_tap_dung','luyen_tap_tong','sau_hoc_dung','sau_hoc_tong','chenh_lech_diem_phan_tram','ky_nang_uu_tien','thuc_hanh_truoc_10','thuc_hanh_sau_10','nhan_xet_thuc_hanh','ngay_hoan_thanh','che_do'];
        const data=rows.map(({ma,r})=>[ma,r.pre?.correct??'',r.pre?.total??'',r.practice?.correct??'',r.practice?.total??'',r.post?.correct??'',r.post?.total??'',scorePair(r)===null?'':scorePair(r).toFixed(1),r.pre?adaptivePriorities(r.pre,SKILL_IDS,r.rubricPre?.scores).map(k=>ADAPTIVE_SKILLS[k]).join('; '):'',adaptiveRubricTotal(r.rubricPre?.scores)?.correct??'',adaptiveRubricTotal(r.rubricPost?.scores)?.correct??'',r.teacherComment||'',r.post?.completedAt||'',MODE_LABEL[state.mode]]);
        if(kind==='csv'){
            // CSV is for interoperable import; Excel direct opening can coerce student codes to numbers: prefer XLSX.
            download(`thuc_nghiem_${base}.csv`,'\ufeff'+[header,...data].map(row=>row.map(safeCSV).join(',')).join('\r\n'),'text/csv;charset=utf-8');
        }else if(kind==='xlsx'){
            if(!globalThis.XLSX?.utils?.aoa_to_sheet){note('Thư viện Excel chưa được tải. Hãy kết nối Internet, tải lại trang; vẫn có thể xuất CSV/JSON ngoại tuyến.',true);update();return;}
            const wb=XLSX.utils.book_new();
            // Two transparent helper columns compute percentages for *paired* records only.
            // AVERAGE over these scalar cells is more portable than array IFERROR inside
            // SUMPRODUCT (some Excel installations returned a spurious 0.0).
            const ws=XLSX.utils.aoa_to_sheet([[...header,'dau_vao_ghep_pct','sau_hoc_ghep_pct'],...data]);
            // Explicit text cells: Excel must NOT convert a student code into 2.51E+09 or lose leading zeroes.
            for(let i=0;i<rows.length;i++){const address='A'+(i+2);ws[address]={t:'s',v:rows[i].ma,z:'@'};}
            // Delta is calculated by a formula when opening Excel; blank until both assessments exist.
            for(let i=0;i<rows.length;i++){
                const n=i+2,r=rows[i].r,paired=r.pre?.total>0&&r.post?.total>0;
                const p1=paired?Math.round(r.pre.correct/r.pre.total*1000)/10:null;
                const p2=paired?Math.round(r.post.correct/r.post.total*1000)/10:null;
                const difference=paired?Math.round((p2-p1)*10)/10:null;
                ws['H'+n]={t:'n',f:`IF(COUNT(B${n},C${n},F${n},G${n})<4,"",IFERROR(IF(AND(C${n}>0,G${n}>0),ROUND((F${n}/G${n}-B${n}/C${n})*100,1),""),""))`,z:'0.0',...(paired?{v:difference}:{})};
                ws['O'+n]={t:'n',f:`IF(COUNT(B${n},C${n},F${n},G${n})<4,"",IFERROR(IF(AND(C${n}>0,G${n}>0),ROUND(B${n}/C${n}*100,1),""),""))`,z:'0.0',...(paired?{v:p1}:{})};
                ws['P'+n]={t:'n',f:`IF(COUNT(B${n},C${n},F${n},G${n})<4,"",IFERROR(IF(AND(C${n}>0,G${n}>0),ROUND(F${n}/G${n}*100,1),""),""))`,z:'0.0',...(paired?{v:p2}:{})};
            }
            ws['Q1']={t:'s',v:'chien_luoc_thich_ung'};ws['R1']={t:'s',v:'giai_thich_giao_bai'};ws['S1']={t:'s',v:'so_phan_hoi_da_duyet'};
            for(let i=0;i<rows.length;i++){const n=i+2,r=rows[i].r,plan=r.practice&&!r.practicePlan?{type:'legacy',reason:'Lượt cũ chưa lưu lý do giao bài; không suy diễn lại.'}:r.practicePlan|| (r.pre?adaptivePlan(r.pre,ADAPTIVE_BANK,SKILL_IDS,r.rubricPre?.scores):null);ws['Q'+n]={t:'s',v:plan?.type||''};ws['R'+n]={t:'s',v:plan?.reason||''};ws['S'+n]={t:'n',v:Object.values(r.approvedFeedback||{}).filter(x=>x?.reviewedByTeacher===true).length};}
            ws['!cols']=[{wch:19},{wch:16},{wch:16},{wch:18},{wch:17},{wch:17},{wch:16},{wch:24},{wch:52},{wch:21},{wch:21},{wch:53},{wch:27},{wch:26},{wch:20},{wch:20},{wch:23},{wch:78},{wch:26}];
            ws['!autofilter']={ref:`A1:S${Math.max(2,rows.length+1)}`};ws['!ref']=`A1:S${Math.max(2,rows.length+1)}`;
            XLSX.utils.book_append_sheet(wb,ws,'Ket_qua');
            const summary=[['TỔNG HỢP THỰC NGHIỆM · '+MODE_LABEL[state.mode]],['Lớp',classes().find(c=>String(c.id)===state.classId)?.name||''],['Số học sinh',members.length],['Học sinh đã làm đầu vào',null],['Học sinh có đủ đầu vào–sau học',null],['Điểm trung bình đầu vào (%)',null],['Điểm trung bình sau học (%)',null],['Chênh lệch trung bình (điểm %)',null],['Hồ sơ có đánh giá thực hành trước–sau',null],[],['LƯU Ý','Chỉ tổng hợp hồ sơ có đủ hai lần đánh giá. Kết quả kiểm thử không đưa vào thực nghiệm chính thức.'],['Mã học sinh được xuất dưới dạng văn bản. Điểm thực hành dựa trên sản phẩm thật do giáo viên chấm.']];
            const sh=XLSX.utils.aoa_to_sheet(summary);
            const max=rows.length+1;
            const metrics=adaptiveClassMetrics(rows.map(x=>x.r));
            const oneDecimal=value=>Math.round(value*10)/10;
            const before=metrics.paired?oneDecimal(rows.reduce((sum,x)=>x.r.pre?.total>0&&x.r.post?.total>0?sum+oneDecimal(x.r.pre.correct/x.r.pre.total*100):sum,0)/metrics.paired):null;
            const after=metrics.paired?oneDecimal(rows.reduce((sum,x)=>x.r.pre?.total>0&&x.r.post?.total>0?sum+oneDecimal(x.r.post.correct/x.r.post.total*100):sum,0)/metrics.paired):null;
            sh.B4={t:'n',f:`COUNTIF(Ket_qua!C2:C${max},">0")`,v:metrics.preCount};
            sh.B5={t:'n',f:`COUNT(Ket_qua!O2:O${max})`,v:metrics.paired};
            sh.B6={t:'n',f:`IFERROR(ROUND(AVERAGE(Ket_qua!O2:O${max}),1),"")`,z:'0.0',...(before!==null?{v:before}:{})};
            sh.B7={t:'n',f:`IFERROR(ROUND(AVERAGE(Ket_qua!P2:P${max}),1),"")`,z:'0.0',...(after!==null?{v:after}:{})};
            sh.B8={t:'n',f:'IF(COUNT(B6:B7)<2,"",ROUND(B7-B6,1))',z:'0.0',...(before!==null&&after!==null?{v:oneDecimal(after-before)}:{})};
            sh.B9={t:'n',f:`COUNTIFS(Ket_qua!J2:J${max},">=0",Ket_qua!J2:J${max},"<>",Ket_qua!K2:K${max},">=0",Ket_qua!K2:K${max},"<>")`,v:metrics.rubricPaired};
            const sm=adaptiveClassSkillMetrics(rows.map(x=>x.r));
            sh.A14={t:'s',v:'KỸ NĂNG (chỉ tính hồ sơ đủ trước–sau)'};
            ['Kỹ năng','Số hồ sơ','Đầu vào (%)','Sau học (%)','Chênh lệch (điểm %)','Thực hành trước (0–2)','Thực hành sau (0–2)','Số hồ sơ thực hành'].forEach((v,i)=>{sh[String.fromCharCode(65+i)+'15']={t:'s',v};});
            for(let i=0;i<sm.length;i++){const n=16+i,x=sm[i],vals=[x.label,x.paired,x.pre===null?'':Math.round(x.pre*10)/10,x.post===null?'':Math.round(x.post*10)/10,x.pre===null?'':Math.round((x.post-x.pre)*10)/10,x.rubricPre===null?'':Math.round(x.rubricPre*10)/10,x.rubricPost===null?'':Math.round(x.rubricPost*10)/10,x.rubricPaired];vals.forEach((v,j)=>{sh[String.fromCharCode(65+j)+n]={t:typeof v==='number'?'n':'s',v};});}
            sh['!cols']=[{wch:53},{wch:30},{wch:22},{wch:22},{wch:29},{wch:26},{wch:25},{wch:26}];sh['!ref']='A1:H20';
            XLSX.utils.book_append_sheet(wb,sh,'Tong_hop');
            const skillHead=['ma_hoc_sinh','ky_nang','truoc_dung','truoc_tong','sau_dung','sau_tong','chenh_lech_diem_phan_tram','che_do','thuc_hanh_truoc_2','thuc_hanh_sau_2'];
            const sr=[skillHead];
            for(const {ma,r} of rows)for(const item of adaptiveSkillComparison(r.pre,r.post)) {
                sr.push([ma,item.label,item.pre?.correct??'',item.pre?.total??'',item.post?.correct??'',item.post?.total??'','',MODE_LABEL[state.mode],r.rubricPre?.scores?.[item.skill]??'',r.rubricPost?.scores?.[item.skill]??'']);
            }
            const sk=XLSX.utils.aoa_to_sheet(sr);
            for(let i=1;i<sr.length;i++){
                const n=i+1;
                sk['A'+n]={t:'s',v:sr[i][0],z:'@'};
                sk['G'+n]={t:'n',f:`IF(COUNT(C${n},D${n},E${n},F${n})<4,"",IFERROR(IF(AND(D${n}>0,F${n}>0),ROUND((E${n}/F${n}-C${n}/D${n})*100,1),""),""))`,z:'0.0'};
            }
            sk['!cols']=[{wch:19},{wch:45},{wch:17},{wch:17},{wch:17},{wch:17},{wch:25},{wch:27},{wch:23},{wch:23}];
            sk['!autofilter']={ref:`A1:J${Math.max(2,sr.length)}`};
            XLSX.utils.book_append_sheet(wb,sk,'Ky_nang');
            XLSX.writeFile(wb,`bao_cao_${base}.xlsx`);
        }else{
            // Full backup of selected class; keep test and official separately, without names or UUIDs.
            const all=members.map(s=>({ma_hoc_sinh:String(s.id||''),test:state.db.students[s.db_uuid]||null,official:state.db.officialStudents[s.db_uuid]||null}));
            download(`sao_luu_hai_che_do_${classTag}_${today}.json`,JSON.stringify({schema:'adaptive-class-backup-v2',lessonId:ADAPTIVE_LESSON_ID,approvedAt:state.db.approvedAt,exportedAt:new Date().toISOString(),students:all},null,2),'application/json');
        }
        note('Đã tạo tệp xuất '+MODE_LABEL[state.mode]+'. Hãy lưu tệp ở nơi an toàn; không chia sẻ dữ liệu học sinh công khai.');update();
    }
    return {render,init};
}
