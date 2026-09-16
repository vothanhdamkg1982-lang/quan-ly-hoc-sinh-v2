/**
 * ============================================================
 * HỆ THỐNG QUẢN LÝ HỌC SINH TIỂU HỌC - JavaScript ES6
 * HỖ TRỢ NHIỀU MÔN HỌC (TIN HỌC & CÔNG NGHỆ)
 * ============================================================
 * Trường Tiểu học-Trung học Cơ sở & Trung học phổ thông Lại Sơn_Phân hiệu trường Tiểu học Trần Quốc Toản - Đặc khu Kiên Hải - An Giang
 * Giáo viên: Võ Thanh Đậm
 * Khối: 3, 4, 5
 * ============================================================
 * Chuyển đổi từ localStorage sang Supabase
 * - Database: app3_* tables
 * - Storage: app3-files bucket
 * - Auth: Supabase Auth
 * ============================================================
 */
import { supabase } from './supabase.js?v=1514936131';


// ============================================================
// WHEEL MODULE - CLEAN VERSION
// ============================================================

const WHEEL_STATE = {
    selectedClassId: null,
    selectedClassName: '',
    participants: [],
    remainingStudents: [],
    selectedStudents: [],
    currentWinner: null,
    preventDuplicates: true,
    isSpinning: false,
    presentationMode: false,
    wheelCanvas: null,
    ctx: null,
    rotation: 0,
    audioEnabled: true,
    winnerId: null
};

// ============================================================
// BƯỚC 151.34 - LƯU / KHÔI PHỤC TRẠNG THÁI TRÒ CHƠI QUA localStorage
// ============================================================
const GAME_STATE_STORAGE_KEYS = {
    wheel: 'qlhs_wheel_state_v1',
    millionaire: 'qlhs_millionaire_state_v1',
    // BƯỚC 151.49.3F.19: lịch sử câu đã đưa vào các ván chơi trên thiết bị này.
    millionaireQuestionHistory: 'qlhs_millionaire_question_history_v1'
};

let wheelStateHydratedFromStorage = false;
let millionaireStateHydratedFromStorage = false;

function saveWheelStateToStorage() {
    try {
        const snapshot = {
            selectedClassId: WHEEL_STATE.selectedClassId || null,
            selectedClassName: WHEEL_STATE.selectedClassName || '',
            preventDuplicates: !!WHEEL_STATE.preventDuplicates,
            presentationMode: !!WHEEL_STATE.presentationMode,
            rotation: Number(WHEEL_STATE.rotation) || 0,
            winnerId: WHEEL_STATE.winnerId || null,
            participants: (WHEEL_STATE.participants || []).map(s => ({
                id: s.id,
                called: !!s.called,
                enabled: s.enabled !== false
            }))
        };

        localStorage.setItem(GAME_STATE_STORAGE_KEYS.wheel, JSON.stringify(snapshot));
    } catch (err) {
        console.warn('[151.34] Không lưu được trạng thái Vòng quay:', err);
    }
}

function clearWheelStateStorage() {
    try {
        localStorage.removeItem(GAME_STATE_STORAGE_KEYS.wheel);
    } catch (err) {}
}

function restoreWheelStateFromStorage() {
    if (wheelStateHydratedFromStorage) return;
    wheelStateHydratedFromStorage = true;

    try {
        const raw = localStorage.getItem(GAME_STATE_STORAGE_KEYS.wheel);
        if (!raw) return;

        const saved = JSON.parse(raw);
        if (!saved || typeof saved !== 'object') return;

        WHEEL_STATE.selectedClassId = saved.selectedClassId || null;
        WHEEL_STATE.selectedClassName = saved.selectedClassName || '';
        WHEEL_STATE.preventDuplicates = saved.preventDuplicates !== false;
        WHEEL_STATE.presentationMode = !!saved.presentationMode;
        WHEEL_STATE.rotation = Number(saved.rotation) || 0;
        WHEEL_STATE.winnerId = saved.winnerId || null;

        const savedParticipants = Array.isArray(saved.participants) ? saved.participants : [];
        if (WHEEL_STATE.selectedClassId && savedParticipants.length) {
            const classObj = (APP_STATE.allClasses?.length ? APP_STATE.allClasses : APP_STATE.classes || [])
                .find(c => String(c.id) === String(WHEEL_STATE.selectedClassId));

            let students = (APP_STATE.students || []).filter(
                s => String(s.class_id) === String(WHEEL_STATE.selectedClassId)
            );

            if (!students.length && classObj) {
                students = (APP_STATE.students || []).filter(
                    s => s.class === classObj.name || s.class_code === classObj.name
                );
            }

            const savedMap = new Map(savedParticipants.map(item => [String(item.id), item]));

            WHEEL_STATE.participants = students
                .map(student => {
                    const old = savedMap.get(String(student.id));
                    if (!old) return null;
                    return {
                        ...student,
                        called: !!old.called,
                        enabled: old.enabled !== false
                    };
                })
                .filter(Boolean)
                .sort((a, b) => String(a.fullName || '').localeCompare(String(b.fullName || ''), 'vi'));

            WHEEL_STATE.remainingStudents = WHEEL_STATE.participants
                .filter(s => s.enabled !== false && !s.called);

            WHEEL_STATE.selectedStudents = WHEEL_STATE.participants
                .filter(s => s.called);

            WHEEL_STATE.currentWinner =
                WHEEL_STATE.participants.find(s => String(s.id) === String(WHEEL_STATE.winnerId)) || null;
        }
    } catch (err) {
        console.warn('[151.34] Không khôi phục được trạng thái Vòng quay:', err);
    }
}

function sanitizeMillionaireStateForStorage() {
    return {
        started: !!MILLIONAIRE_STATE.started,
        ended: !!MILLIONAIRE_STATE.ended,
        level: Number(MILLIONAIRE_STATE.level) || 0,
        locked: !!MILLIONAIRE_STATE.locked,
        questions: Array.isArray(MILLIONAIRE_STATE.questions)
            ? MILLIONAIRE_STATE.questions.map(q => ({
                q: q.q,
                a: Array.isArray(q.a) ? [...q.a] : [],
                c: Number(q.c),
                difficulty: q.difficulty || '',
                grade: q.grade || '',
                subject: q.subject || '',
                topic: q.topic || ''
            }))
            : [],
        usedSwitchIndexes: Array.isArray(MILLIONAIRE_STATE.usedSwitchIndexes)
            ? [...MILLIONAIRE_STATE.usedSwitchIndexes]
            : [],
        lifelines: { ...MILLIONAIRE_STATE.lifelines },
        hiddenAnswers: Array.isArray(MILLIONAIRE_STATE.hiddenAnswers)
            ? [...MILLIONAIRE_STATE.hiddenAnswers]
            : [],
        selectedIndex: MILLIONAIRE_STATE.selectedIndex ?? null,
        audienceResult: Array.isArray(MILLIONAIRE_STATE.audienceResult)
            ? [...MILLIONAIRE_STATE.audienceResult]
            : null,
        phase: MILLIONAIRE_STATE.phase || 'idle',
        soundEnabled: MILLIONAIRE_STATE.soundEnabled !== false,
        mcEnabled: MILLIONAIRE_STATE.mcEnabled !== false,
        selectedGrade: MILLIONAIRE_STATE.selectedGrade || 'all',
        selectedSubject: MILLIONAIRE_STATE.selectedSubject || 'all',
        selectedTopic: MILLIONAIRE_STATE.selectedTopic || 'all',
        questionSource: MILLIONAIRE_STATE.questionSource || 'custom',
        bankInfo: MILLIONAIRE_STATE.bankInfo ? { ...MILLIONAIRE_STATE.bankInfo } : null,
        playMode: MILLIONAIRE_STATE.playMode || 'stop_on_wrong',
        wrongAttempts: Array.isArray(MILLIONAIRE_STATE.wrongAttempts) ? [...MILLIONAIRE_STATE.wrongAttempts] : [],
        timerEnabled: !!MILLIONAIRE_STATE.timerEnabled, timerSoundEnabled: MILLIONAIRE_STATE.timerSoundEnabled !== false,
        timerSeconds: millionaireTimerTotalSeconds(), timerRemaining: Math.max(0, Number(MILLIONAIRE_STATE.timerRemaining ?? millionaireTimerTotalSeconds())),
        message: MILLIONAIRE_STATE.message || ''
    };
}

function saveMillionaireStateToStorage() {
    try {
        localStorage.setItem(
            GAME_STATE_STORAGE_KEYS.millionaire,
            JSON.stringify(sanitizeMillionaireStateForStorage())
        );
    } catch (err) {
        console.warn('[151.34] Không lưu được trạng thái Ai là triệu phú:', err);
    }
}

function clearMillionaireStateStorage() {
    try {
        localStorage.removeItem(GAME_STATE_STORAGE_KEYS.millionaire);
    } catch (err) {}
}

function restoreMillionaireStateFromStorage() {
    if (millionaireStateHydratedFromStorage) return;
    millionaireStateHydratedFromStorage = true;

    try {
        const raw = localStorage.getItem(GAME_STATE_STORAGE_KEYS.millionaire);
        if (!raw) return;

        const saved = JSON.parse(raw);
        if (!saved || typeof saved !== 'object') return;

        MILLIONAIRE_STATE.started = !!saved.started;
        MILLIONAIRE_STATE.ended = !!saved.ended;
        MILLIONAIRE_STATE.level = Math.max(0, Number(saved.level) || 0);
        MILLIONAIRE_STATE.locked = !!saved.locked;
        MILLIONAIRE_STATE.questions = Array.isArray(saved.questions)
            ? saved.questions.map(q => ({ ...q, a: Array.isArray(q.a) ? [...q.a] : [] }))
            : [];
        MILLIONAIRE_STATE.level = Math.min(MILLIONAIRE_STATE.level, Math.max(0, MILLIONAIRE_STATE.questions.length));
        MILLIONAIRE_STATE.usedSwitchIndexes = Array.isArray(saved.usedSwitchIndexes)
            ? [...saved.usedSwitchIndexes]
            : [];
        MILLIONAIRE_STATE.lifelines = {
            fifty: saved.lifelines?.fifty !== false,
            audience: saved.lifelines?.audience !== false,
            switch: saved.lifelines?.switch !== false
        };
        MILLIONAIRE_STATE.hiddenAnswers = Array.isArray(saved.hiddenAnswers)
            ? [...saved.hiddenAnswers]
            : [];
        MILLIONAIRE_STATE.selectedIndex = saved.selectedIndex ?? null;
        MILLIONAIRE_STATE.audienceResult = Array.isArray(saved.audienceResult)
            ? [...saved.audienceResult]
            : null;
        MILLIONAIRE_STATE.phase = saved.phase || 'idle';
        MILLIONAIRE_STATE.soundEnabled = saved.soundEnabled !== false;
        MILLIONAIRE_STATE.mcEnabled = saved.mcEnabled !== false;
        MILLIONAIRE_STATE.selectedGrade = saved.selectedGrade || 'all';
        MILLIONAIRE_STATE.selectedSubject = saved.selectedSubject || 'all';
        MILLIONAIRE_STATE.selectedTopic = saved.selectedTopic || 'all';
        MILLIONAIRE_STATE.questionSource = ['custom','default'].includes(saved.questionSource) ? saved.questionSource : 'custom';
        MILLIONAIRE_STATE.bankInfo = saved.bankInfo || null;
        MILLIONAIRE_STATE.playMode = ['stop_on_wrong','continue_on_wrong','retry_until_correct'].includes(saved.playMode) ? saved.playMode : 'stop_on_wrong';
        MILLIONAIRE_STATE.wrongAttempts = Array.isArray(saved.wrongAttempts) ? [...saved.wrongAttempts] : [];
        MILLIONAIRE_STATE.timerEnabled=!!saved.timerEnabled; MILLIONAIRE_STATE.timerSoundEnabled=saved.timerSoundEnabled!==false; MILLIONAIRE_STATE.timerSeconds=Math.max(1,Math.min(3599,Number(saved.timerSeconds)||30)); MILLIONAIRE_STATE.timerRemaining=Math.max(0,Number(saved.timerRemaining??MILLIONAIRE_STATE.timerSeconds)); MILLIONAIRE_STATE.timerIntervalId=null;
        MILLIONAIRE_STATE.message = saved.message || 'Chọn bộ câu hỏi rồi nhấn “Bắt đầu”.';
    } catch (err) {
        console.warn('[151.34] Không khôi phục được trạng thái Ai là triệu phú:', err);
    }
}


// ============================================================
// RENDER WHEEL UI
// ============================================================

function renderWheel() {
    restoreWheelStateFromStorage();
    return `
        <div class="wheel-page wheel-page-modern">
            <div class="wheel-toolbar-modern">
                <div class="wheel-class-box">
                    <div class="wheel-tool-icon"><i class="fas fa-users"></i></div>
                    <label for="wheelClassSelect">Chọn lớp:</label>
                    <select id="wheelClassSelect" onchange="onWheelClassChange()">
                        <option value="">-- Chọn lớp --</option>
                        ${(hasAssignedScope() ? getAccessibleClassesForSubject('') : APP_STATE.classes).map(c => `
                            <option value="${c.id}" data-name="${c.name}">${c.name} - Khối ${c.grade}</option>
                        `).join('')}
                    </select>
                </div>

                <div class="wheel-stat-box stat-total"><i class="fas fa-user"></i><span>Tổng:<strong id="wheelStudentCount">0</strong></span></div>
                <div class="wheel-stat-box stat-called"><i class="fas fa-check-circle"></i><span>Đã gọi:<strong id="wheelCalledCount">0</strong></span></div>
                <div class="wheel-stat-box stat-left"><i class="far fa-clock"></i><span>Còn lại:<strong id="wheelRemainingCount">0</strong></span></div>

                <div class="wheel-toolbar-actions">
                    <label class="wheel-no-duplicate">
                        <input type="checkbox" id="wheelPreventDuplicates" checked onchange="setWheelPreventDuplicates(this.checked)"> Không trùng
                    </label>
                    <button class="btn btn-secondary btn-sm wheel-icon-btn" onclick="resetWheel()" title="Đặt lại lượt quay"><i class="fas fa-undo"></i></button>
                    <button class="btn btn-danger btn-sm" onclick="endWheelSession()" title="Kết thúc vòng quay và trở về trạng thái ban đầu"><i class="fas fa-stop"></i> Kết thúc</button>
                    <button class="btn btn-secondary btn-sm" onclick="togglePresentationMode()"><i class="fas fa-expand"></i> Trình chiếu</button>
                    <button class="btn btn-primary btn-sm btn-home-mode" onclick="goHome()" title="Về trang chủ"><i class="fas fa-home"></i> Trang chủ</button>
                </div>
            </div>

            <div class="wheel-container ${WHEEL_STATE.presentationMode ? 'presentation-mode' : ''}">
                <section class="wheel-stage wheel-stage-modern">
                    <div class="wheel-title-block">
                        <h2><i class="fas fa-star"></i> VÒNG QUAY MAY MẮN <i class="fas fa-star"></i></h2>
                        <span>Học vui · Học tốt · Cùng tiến bộ</span>
                    </div>
                    <div class="wheel-wrapper">
                        <div id="wheelFallback" class="wheel-mobile-fallback" aria-hidden="true"><span>🎯</span></div>
                        <canvas id="wheelCanvas"></canvas>
                        <div class="wheel-pointer">▼</div>
                    </div>
                    <div class="wheel-controls-center">
                        <button class="btn btn-primary btn-lg" id="spinBtn" onclick="spinWheel()"><i class="fas fa-play"></i> QUAY</button>
                    </div>
                    <div class="wheel-tip"><i class="fas fa-trophy"></i><div><strong>Nhấn nút QUAY để chọn ngẫu nhiên một học sinh trong lớp!</strong><span>Chúc các em luôn học tập tốt và đạt nhiều thành tích!</span></div></div>
                </section>

                <aside class="wheel-sidebar wheel-sidebar-modern">
                    <div class="wheel-panel wheel-result-panel">
                        <div class="wheel-panel-title"><span><i class="fas fa-trophy"></i> Kết quả quay</span></div>
                        <div class="wheel-result" id="wheelResult" style="display:none;">
                            <div class="result-header">🎉 CHÚC MỪNG!</div>
                            <div class="result-avatar"><img id="winnerAvatar" src="${DEFAULT_AVATAR}" alt="Avatar"></div>
                            <div class="result-name" id="winnerName">Nguyễn Văn A</div>
                            <div class="result-class" id="winnerClass">Lớp 3A</div>
                            <div class="result-actions">
                                <button class="btn btn-primary" onclick="spinWheel()"><i class="fas fa-play"></i> Quay tiếp</button>
                                <button class="btn btn-secondary" onclick="resetWheel()"><i class="fas fa-undo"></i> Đặt lại</button>
                            </div>
                        </div>
                        <div class="wheel-result-empty"><i class="fas fa-gift"></i><strong>Chưa có học sinh được chọn</strong><span>Hãy nhấn nút QUAY để bắt đầu!</span></div>
                    </div>

                    <div class="wheel-panel wheel-students-panel">
                        <div class="wheel-panel-title"><span><i class="fas fa-users"></i> Danh sách học sinh tham gia</span></div>
                        <div class="student-list-scroll" id="wheelStudentList"><p class="text-muted">Vui lòng chọn lớp</p></div>
                    </div>
                </aside>
            </div>
        </div>
    `;
}

function resizeWheelCanvas() {
    const canvas = document.getElementById('wheelCanvas');
    if (!canvas) return false;

    const wrapper = canvas.closest('.wheel-wrapper');
    if (!wrapper) return false;

    // iOS/Safari đôi khi trả clientWidth = 0 ngay sau khi render.
    // Lấy kích thước thực tế và giới hạn theo chiều rộng màn hình.
    const rect = wrapper.getBoundingClientRect();
    const viewportWidth = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
    let cssSize = Math.round(rect.width || wrapper.clientWidth || 0);
    if (!cssSize || cssSize < 40) {
        cssSize = Math.min(500, Math.max(260, viewportWidth - 48));
    }
    cssSize = Math.min(cssSize, 500);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pixelSize = Math.max(260, Math.round(cssSize * dpr));

    canvas.style.width = cssSize + 'px';
    canvas.style.height = cssSize + 'px';

    if (canvas.width !== pixelSize || canvas.height !== pixelSize) {
        canvas.width = pixelSize;
        canvas.height = pixelSize;
    }

    WHEEL_STATE.wheelCanvas = canvas;
    WHEEL_STATE.ctx = canvas.getContext('2d');
    return !!WHEEL_STATE.ctx;
}

function restoreWheelUIFromState() {
    const classSelect = document.getElementById('wheelClassSelect');
    if (classSelect && WHEEL_STATE.selectedClassId) {
        classSelect.value = String(WHEEL_STATE.selectedClassId);
    }

    const preventBox = document.getElementById('wheelPreventDuplicates');
    if (preventBox) preventBox.checked = !!WHEEL_STATE.preventDuplicates;

    syncWheelRemainingStudents();
    updateWheelStats();
    renderStudentList();

    const resultDiv = document.getElementById('wheelResult');
    const resultPanel = document.querySelector('.wheel-result-panel');
    if (resultPanel) resultPanel.classList.toggle('has-winner', !!WHEEL_STATE.currentWinner);
    if (resultDiv) {
        if (WHEEL_STATE.currentWinner) {
            resultDiv.style.display = 'block';

            const winner = WHEEL_STATE.currentWinner;
            const nameEl = document.getElementById('winnerName');
            const classEl = document.getElementById('winnerClass');
            if (nameEl) nameEl.textContent = winner.fullName || '';
            if (classEl) classEl.textContent = `Lớp ${winner.class || winner.class_code || WHEEL_STATE.selectedClassName || 'Chưa phân lớp'}`;

            const avatarImg = document.getElementById('winnerAvatar');
            if (avatarImg) {
                const avatarUrl = winner.avatar || winner.avatar_url || DEFAULT_AVATAR;
                avatarImg.src = (typeof avatarUrl === 'string' && avatarUrl) ? avatarUrl : DEFAULT_AVATAR;
                avatarImg.onerror = function() { this.src = DEFAULT_AVATAR; };
            }
        } else {
            resultDiv.style.display = 'none';
        }
    }

    drawWheel();
}

function initWheel() {
    if (!resizeWheelCanvas()) return;

    // Chỉ tải lớp lần đầu. Nếu đã có participants thì khôi phục nguyên trạng
    // called/enabled/currentWinner/rotation thay vì gọi loadWheelStudents() làm reset.
    if (WHEEL_STATE.selectedClassId) {
        if (Array.isArray(WHEEL_STATE.participants) && WHEEL_STATE.participants.length > 0) {
            restoreWheelUIFromState();
        } else {
            loadWheelStudents(WHEEL_STATE.selectedClassId);
        }
    } else {
        drawWheel();
        updateWheelStats();
        renderStudentList();
    }

    // Vẽ lại sau khi layout mobile/Safari ổn định.
    requestAnimationFrame(() => {
        resizeWheelCanvas();
        drawWheel();
    });
    setTimeout(() => {
        resizeWheelCanvas();
        drawWheel();
    }, 180);
}

function onWheelClassChange() {
    const select = document.getElementById('wheelClassSelect');
    const classId = select.value;
    const option = select.options[select.selectedIndex];
    const className = option ? option.dataset.name : '';
    
    if (!classId) {
        WHEEL_STATE.selectedClassId = null;
        WHEEL_STATE.selectedClassName = '';
        WHEEL_STATE.participants = [];
        WHEEL_STATE.remainingStudents = [];
        WHEEL_STATE.selectedStudents = [];
        WHEEL_STATE.currentWinner = null;
        WHEEL_STATE.winnerId = null;
        document.getElementById('wheelResult').style.display = 'none';
        document.querySelector('.wheel-result-panel')?.classList.remove('has-winner');
        updateWheelStats();
        renderStudentList();
        drawWheel();
        return;
    }
    
    WHEEL_STATE.selectedClassId = classId;
    WHEEL_STATE.selectedClassName = className;
    WHEEL_STATE.selectedStudents = [];
    WHEEL_STATE.currentWinner = null;
    WHEEL_STATE.winnerId = null;
    document.getElementById('wheelResult').style.display = 'none';
        document.querySelector('.wheel-result-panel')?.classList.remove('has-winner');
    
    loadWheelStudents(classId);
}

function loadWheelStudents(classId) {
    const classObj = (APP_STATE.allClasses?.length ? APP_STATE.allClasses : APP_STATE.classes).find(c => c.id === classId);
    if (!classObj) {
        showToast('Không tìm thấy lớp!', 'error');
        return;
    }
    
    let students = APP_STATE.students.filter(s => s.class_id === classId);
    
    if (students.length === 0) {
        students = APP_STATE.students.filter(s => s.class === classObj.name || s.class_code === classObj.name);
    }
    
    if (students.length === 0) {
        WHEEL_STATE.participants = [];
        WHEEL_STATE.remainingStudents = [];
        WHEEL_STATE.selectedStudents = [];
        WHEEL_STATE.currentWinner = null;
        WHEEL_STATE.winnerId = null;
        document.getElementById('wheelResult').style.display = 'none';
        document.querySelector('.wheel-result-panel')?.classList.remove('has-winner');
        showToast('Lớp này chưa có học sinh.', 'warning');
        updateWheelStats();
        renderStudentList();
        drawWheel();
        return;
    }
    
    // Loại bỏ trùng và sắp xếp
    const uniqueStudents = [];
    const seenIds = new Set();
    students.forEach(s => {
        if (!seenIds.has(s.id)) {
            seenIds.add(s.id);
            uniqueStudents.push(s);
        }
    });
    uniqueStudents.sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'));
    
    WHEEL_STATE.participants = uniqueStudents.map(s => ({
        ...s,
        called: false,
        enabled: true
    }));
    
    WHEEL_STATE.remainingStudents = WHEEL_STATE.participants.filter(s => s.enabled !== false && !s.called);
    WHEEL_STATE.selectedStudents = [];
    WHEEL_STATE.currentWinner = null;
    WHEEL_STATE.winnerId = null;
    document.getElementById('wheelResult').style.display = 'none';
        document.querySelector('.wheel-result-panel')?.classList.remove('has-winner');
    
    updateWheelStats();
    renderStudentList();
    drawWheel();
    
    showToast(`Đã tải ${WHEEL_STATE.participants.length} học sinh từ lớp ${WHEEL_STATE.selectedClassName}`, 'success', 1500);
}

function getEnabledWheelParticipants() {
    return WHEEL_STATE.participants.filter(s => s.enabled !== false);
}

function syncWheelRemainingStudents() {
    const enabled = getEnabledWheelParticipants();
    WHEEL_STATE.remainingStudents = enabled.filter(s => !s.called);
    return WHEEL_STATE.remainingStudents;
}

function setWheelPreventDuplicates(checked) {
    WHEEL_STATE.preventDuplicates = !!checked;
    syncWheelRemainingStudents();
    updateWheelStats();
    drawWheel();
}

function toggleWheelParticipant(studentId, checked) {
    if (WHEEL_STATE.isSpinning) return;
    const participant = WHEEL_STATE.participants.find(s => String(s.id) === String(studentId));
    if (!participant) return;

    participant.enabled = !!checked;
    // Nếu bỏ học sinh khỏi danh sách tham gia, không tính em đó là "còn lại".
    syncWheelRemainingStudents();
    updateWheelStats();
    renderStudentList();
    drawWheel();
}

function renderStudentList() {
    const container = document.getElementById('wheelStudentList');
    if (!container) return;

    const students = WHEEL_STATE.participants;
    if (students.length === 0) {
        container.innerHTML = '<p class="text-muted">Chưa có học sinh trong lớp này.</p>';
        return;
    }

    const html = students.map((s) => {
        const isCalled = !!s.called;
        const isEnabled = s.enabled !== false;
        const cls = `${isCalled ? 'called' : ''} ${!isEnabled ? 'wheel-student-disabled' : ''}`.trim();
        const sid = String(s.id || '').replace(/'/g, "\\'");
        return `<label class="student-item ${cls}" style="cursor:pointer;">
            <input type="checkbox" class="wheel-student-check" ${isEnabled ? 'checked' : ''}
                   onchange="toggleWheelParticipant('${sid}', this.checked)"
                   ${WHEEL_STATE.isSpinning ? 'disabled' : ''}>
            <span class="student-name">${escapeHtml(s.fullName || '')}</span>
            ${isCalled ? '<span class="badge badge-success">Đã gọi</span>' : ''}
        </label>`;
    }).join('');

    container.innerHTML = html;
}

function updateWheelStats() {
    const enabled = getEnabledWheelParticipants();
    const remaining = syncWheelRemainingStudents();
    const called = enabled.filter(s => s.called).length;

    const countEl = document.getElementById('wheelStudentCount');
    const calledEl = document.getElementById('wheelCalledCount');
    const remainingEl = document.getElementById('wheelRemainingCount');

    if (countEl) countEl.textContent = enabled.length;
    if (calledEl) calledEl.textContent = called;
    if (remainingEl) remainingEl.textContent = WHEEL_STATE.preventDuplicates ? remaining.length : enabled.length;
    saveWheelStateToStorage();
}

function getWheelStudents() {
    const enabled = getEnabledWheelParticipants();
    if (!WHEEL_STATE.preventDuplicates) return enabled;
    return syncWheelRemainingStudents();
}

// ============================================================
// DRAW WHEEL
// ============================================================

function updateWheelFallback(students) {
    const fallback = document.getElementById('wheelFallback');
    if (!fallback) return;

    const list = Array.isArray(students) ? students : [];
    const count = list.length;
    const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
        '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
        '#F8C471', '#82E0AA', '#F1948A', '#85929E', '#73C6B6',
        '#E59866', '#AF7AC5', '#5DADE2', '#58D68D', '#F4D03F'
    ];

    if (!count) {
        fallback.dataset.signature = '';
        fallback.innerHTML = '<span class="wheel-fallback-empty">🎯</span>';
        return;
    }

    const signature = list.map(s => s.id || s.student_code || s.fullName || s.name || '').join('|');
    if (fallback.dataset.signature === signature) return;
    fallback.dataset.signature = signature;

    const step = 360 / count;
    const stops = [];
    for (let i = 0; i < count; i++) {
        const a = i * step;
        const b = (i + 1) * step;
        const c = colors[i % colors.length];
        stops.push(`${c} ${a}deg ${b}deg`);
    }
    fallback.style.setProperty('background', `conic-gradient(${stops.join(',')})`, 'important');

    const isMobile = window.matchMedia?.('(max-width: 760px)').matches;
    const denseMobile = isMobile && count > 16;
    const labels = list.map((student, i) => {
        const full = String(student?.fullName || student?.name || student?.student_name || `HS ${i + 1}`).trim();
        const parts = full.split(/\s+/).filter(Boolean);
        const shortName = denseMobile
            ? (parts[parts.length - 1] || full)
            : (parts.length > 2 ? parts.slice(-2).join(' ') : full);
        const angle = i * step + step / 2 - 90;
        return `<span class="wheel-fallback-label${denseMobile ? ' is-dense' : ''}" style="--label-angle:${angle}deg" title="${escapeHtml(full)}">${escapeHtml(shortName)}</span>`;
    }).join('');

    fallback.classList.remove('wheel-compact-labels');
    fallback.classList.toggle('wheel-dense-labels', denseMobile);
    fallback.innerHTML = labels + '<span class="wheel-fallback-center">🎯</span>';
}

function drawWheel() {
    const liveCanvas = document.getElementById('wheelCanvas');
    if (!liveCanvas) return;

    // Nếu canvas vừa được thay bởi renderPage hoặc Safari thay đổi kích thước,
    // luôn nối lại context với phần tử đang hiện trên màn hình.
    if (WHEEL_STATE.wheelCanvas !== liveCanvas || !WHEEL_STATE.ctx || liveCanvas.width < 40 || liveCanvas.height < 40) {
        if (!resizeWheelCanvas()) return;
    }

    const canvas = WHEEL_STATE.wheelCanvas;
    const ctx = WHEEL_STATE.ctx;
    if (!canvas || !ctx) return;
    
    const canvas2 = WHEEL_STATE.wheelCanvas;
    const ctx2 = WHEEL_STATE.ctx;
    if (!canvas2 || !ctx2) return;
    
    const students = getWheelStudents();
    const count = students.length;
    updateWheelFallback(students);
    
    if (count === 0) {
        ctx2.clearRect(0, 0, canvas2.width, canvas2.height);
        ctx2.fillStyle = '#94a3b8';
        ctx2.font = '24px Arial, sans-serif';
        ctx2.textAlign = 'center';
        ctx2.textBaseline = 'middle';
        ctx2.fillText('Không có học sinh', canvas2.width/2, canvas2.height/2);
        return;
    }
    
    const centerX = canvas2.width / 2;
    const centerY = canvas2.height / 2;
    const radius = Math.min(canvas2.width, canvas2.height) / 2 - 20;
    
    ctx2.clearRect(0, 0, canvas2.width, canvas2.height);
    
    const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
        '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
        '#F8C471', '#82E0AA', '#F1948A', '#85929E', '#73C6B6',
        '#E59866', '#AF7AC5', '#5DADE2', '#58D68D', '#F4D03F'
    ];
    
    const segmentAngle = (2 * Math.PI) / count;
    const rotation = WHEEL_STATE.rotation;

    // Fallback hiển thị riêng cho iOS/Safari: nếu canvas không paint được,
    // bánh xe CSS vẫn luôn nhìn thấy và xoay theo đúng góc.
    const fallback = document.getElementById('wheelFallback');
    if (fallback) {
        fallback.style.transform = `rotate(${rotation}rad)`;
    }
    
    for (let i = 0; i < count; i++) {
        const startAngle = i * segmentAngle + rotation;
        const endAngle = startAngle + segmentAngle;
        
        ctx2.beginPath();
        ctx2.moveTo(centerX, centerY);
        ctx2.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx2.closePath();
        
        ctx2.fillStyle = colors[i % colors.length];
        ctx2.fill();
        ctx2.strokeStyle = '#ffffff';
        ctx2.lineWidth = 2;
        ctx2.stroke();
        
        ctx2.save();
        ctx2.translate(centerX, centerY);
        ctx2.rotate(startAngle + segmentAngle / 2);
        ctx2.textAlign = 'center';
        ctx2.textBaseline = 'middle';
        ctx2.fillStyle = '#ffffff';
        ctx2.font = 'bold 14px Arial, sans-serif';
        ctx2.shadowColor = 'rgba(0,0,0,0.3)';
        ctx2.shadowBlur = 4;
        
        const isMobileWheel = window.matchMedia?.('(max-width: 760px)').matches;
        const name = String(students[i]?.fullName || students[i]?.name || students[i]?.student_name || `HS ${i + 1}`).trim();
        const nameParts = name.split(/\s+/).filter(Boolean);
        let displayName = name;

        if (isMobileWheel && count > 16) {
            displayName = nameParts[nameParts.length - 1] || name;
        } else if (isMobileWheel && nameParts.length > 2) {
            displayName = nameParts.slice(-2).join(' ');
        } else if (name.length > 15) {
            displayName = name.substring(0, 13) + '…';
        }

        const dprNow = Math.min(window.devicePixelRatio || 1, 2);
        const fontCss = isMobileWheel
            ? (count > 28 ? 7 : (count > 20 ? 8 : (count > 14 ? 9 : 11)))
            : 14;
        ctx2.font = `800 ${Math.max(10, Math.round(fontCss * dprNow))}px Arial, sans-serif`;
        const textRadius = radius * (isMobileWheel ? 0.73 : 0.65);
        ctx2.fillText(displayName, textRadius, 0);
        ctx2.restore();
    }
    
    ctx2.beginPath();
    ctx2.arc(centerX, centerY, 40, 0, 2 * Math.PI);
    ctx2.fillStyle = '#ffffff';
    ctx2.fill();
    ctx2.strokeStyle = '#2563eb';
    ctx2.lineWidth = 3;
    ctx2.stroke();
    
    ctx2.fillStyle = '#2563eb';
    ctx2.font = 'bold 20px Arial';
    ctx2.textAlign = 'center';
    ctx2.textBaseline = 'middle';
    ctx2.fillText('🎯', centerX, centerY);
}

// ============================================================
// SPIN WHEEL
// ============================================================

function spinWheel() {
    if (WHEEL_STATE.isSpinning) return;
    
    const students = getWheelStudents();
    const enabledParticipants = getEnabledWheelParticipants();

    if (enabledParticipants.length === 0) {
        showToast('Vui lòng chọn ít nhất 1 học sinh tham gia vòng quay.', 'warning');
        return;
    }

    if (WHEEL_STATE.preventDuplicates && students.length === 0) {
    showToast('🎉 Đã gọi hết học sinh đang tham gia!', 'success');
    document.getElementById('wheelResult').style.display = 'block';
    document.getElementById('winnerName').textContent = '🎉 HOÀN THÀNH!';
    document.getElementById('winnerClass').textContent = 'Đã gọi tất cả học sinh';
    document.getElementById('winnerAvatar').src = DEFAULT_AVATAR;

    // Hiển thị nút về trang chủ
    const actionsDiv = document.querySelector('.result-actions');
    if (actionsDiv) {
        // Xóa các nút cũ để tránh trùng
        actionsDiv.innerHTML = '';
        const backBtn = document.createElement('button');
        backBtn.className = 'btn btn-info';
        backBtn.innerHTML = '<i class="fas fa-home"></i> Về trang chủ';
        backBtn.onclick = function() {
            renderPage('dashboard');
            if (WHEEL_STATE.presentationMode) {
                togglePresentationMode();
            }
        };
        actionsDiv.appendChild(backBtn);

        const resetBtn = document.createElement('button');
        resetBtn.className = 'btn btn-secondary';
        resetBtn.innerHTML = '<i class="fas fa-undo"></i> Quay lại lớp này';
        resetBtn.onclick = function() {
            resetWheel();
        };
        actionsDiv.appendChild(resetBtn);
    }
    return;
}
    
    WHEEL_STATE.isSpinning = true;
    const spinBtn = document.getElementById('spinBtn');
    if (spinBtn) {
        spinBtn.disabled = true;
        spinBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang quay...';
    }
    
    // Chọn ngẫu nhiên một học sinh
    const winnerIndex = Math.floor(Math.random() * students.length);
    const winner = students[winnerIndex];
    
    WHEEL_STATE.winnerId = winner.id;
    WHEEL_STATE.currentWinner = winner;

    // BƯỚC 151.11.2: tải trước đúng ảnh người trúng trong lúc vòng quay đang chạy.
    // Không tải ảnh cả lớp, nên vẫn giữ nguyên ưu điểm lazy-load của BƯỚC 151.5.
    // Vòng quay kéo dài khoảng 4-5 giây, đủ thời gian để ảnh sẵn sàng trước khi hiện kết quả.
    ensureStudentAvatar(winner)
        .catch(err => console.warn('[WHEEL AVATAR PREFETCH] Không tải trước được ảnh người trúng:', err));
    
    const segmentAngle = (2 * Math.PI) / students.length;
    const currentRotation = WHEEL_STATE.rotation;
    
    // Góc trung tâm của segment winnerIndex (tính từ vị trí 0 radian)
    const segmentCenter = winnerIndex * segmentAngle + segmentAngle / 2;
    
    // Góc cần để segmentCenter hướng lên trên (12 giờ tương ứng -PI/2)
    // Công thức: rotation_final + segmentCenter ≡ -PI/2 (mod 2π)
    // => rotation_final = -PI/2 - segmentCenter + n*2π
    let n = 0;
    let finalRotation;
    do {
        finalRotation = -Math.PI/2 - segmentCenter + n * 2 * Math.PI;
        n++;
    } while (finalRotation <= currentRotation + 2 * Math.PI * 3); // quay ít nhất 3 vòng
    
    const targetAngle = finalRotation - currentRotation;
    const duration = 4000 + Math.random() * 1000;
    const startedAt = Date.now();
    let animationFrameId = null;
    let safetyTimerId = null;
    let finished = false;

    if (WHEEL_STATE.audioEnabled) {
        playSpinSound();
    }

    const finishSpin = () => {
        if (finished) return;
        finished = true;
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        if (safetyTimerId) clearTimeout(safetyTimerId);

        WHEEL_STATE.rotation = finalRotation;
        try { drawWheel(); } catch (err) { console.warn('Wheel final draw:', err); }
        stopSpinSound();

        const savedWinner = WHEEL_STATE.participants.find(s => s.id === WHEEL_STATE.winnerId);
        try {
            showWinner(savedWinner || WHEEL_STATE.currentWinner);
        } finally {
            WHEEL_STATE.isSpinning = false;
            if (spinBtn) {
                spinBtn.disabled = false;
                spinBtn.innerHTML = '<i class="fas fa-play"></i> QUAY';
            }
        }
    };

    function animateWheel() {
        if (finished) return;
        const elapsed = Math.max(0, Date.now() - startedAt);
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        WHEEL_STATE.rotation = currentRotation + targetAngle * eased;

        try {
            drawWheel();
        } catch (err) {
            // Không để một lỗi paint canvas trên Safari làm vòng quay treo vô hạn.
            console.warn('Wheel draw skipped:', err);
        }

        if (progress >= 1) {
            finishSpin();
            return;
        }
        animationFrameId = requestAnimationFrame(animateWheel);
    }

    // Bảo hiểm: dù requestAnimationFrame của iOS bị treo/throttle,
    // vòng quay vẫn chắc chắn kết thúc và trả kết quả.
    safetyTimerId = setTimeout(finishSpin, Math.ceil(duration + 1200));
    animationFrameId = requestAnimationFrame(animateWheel);
}

function showWinner(winner) {
    if (!winner) {
        console.error('❌ Winner is null!');
        return;
    }
    
    
    if (WHEEL_STATE.preventDuplicates) {
        const participant = WHEEL_STATE.participants.find(s => s.id === winner.id);
        if (participant) {
            participant.called = true;
        }
        winner.called = true;
        
        if (!WHEEL_STATE.selectedStudents.find(s => s.id === winner.id)) {
            WHEEL_STATE.selectedStudents.push(winner);
        }
        WHEEL_STATE.remainingStudents = WHEEL_STATE.participants.filter(s => s.enabled !== false && !s.called);
    }
    
    WHEEL_STATE.currentWinner = winner;
    WHEEL_STATE.winnerId = winner.id;
    saveWheelStateToStorage();

    // BƯỚC 151.5: vòng quay không cần tải ảnh cả lớp. Chỉ tải ảnh người trúng.
    ensureStudentAvatar(winner)
        .then(() => updateWinnerAvatar(winner))
        .catch(err => console.warn('[LAZY AVATAR] Không tải được ảnh người trúng:', err));
    
    // Cập nhật UI
    const resultDiv = document.getElementById('wheelResult');
    const resultPanel = document.querySelector('.wheel-result-panel');
    if (resultPanel) resultPanel.classList.add('has-winner');
    if (resultDiv) {
        resultDiv.style.display = 'block';
    }
    
    const nameEl = document.getElementById('winnerName');
    if (nameEl) {
        nameEl.textContent = winner.fullName;
    }
    
    const classEl = document.getElementById('winnerClass');
    if (classEl) {
        classEl.textContent = `Lớp ${winner.class || winner.class_code || 'Chưa phân lớp'}`;
    }
    
    // ===== XỬ LÝ ẢNH =====
    const avatarImg = document.getElementById('winnerAvatar');
    if (avatarImg) {
        let avatarUrl = winner.avatar || winner.avatar_url || DEFAULT_AVATAR;
        if (typeof avatarUrl === 'object') {
            avatarUrl = DEFAULT_AVATAR;
        }
        // Nếu URL không hợp lệ, dùng mặc định
        if (!avatarUrl || (!avatarUrl.startsWith('data:image') && !avatarUrl.startsWith('http://') && !avatarUrl.startsWith('https://'))) {
            avatarUrl = DEFAULT_AVATAR;
        }
        avatarImg.src = avatarUrl;
        avatarImg.onerror = function() {
            console.warn('⚠️ Lỗi tải ảnh, dùng avatar mặc định');
            this.src = DEFAULT_AVATAR;
        };
        // Đảm bảo ảnh hiển thị (thêm inline style để ghi đè CSS)
        avatarImg.style.display = 'block';
        avatarImg.style.width = '100%';
        avatarImg.style.height = '100%';
        avatarImg.style.objectFit = 'cover';
        avatarImg.style.borderRadius = '50%';
    }
    
    if (WHEEL_STATE.audioEnabled) {
        playCelebrationSound();
    }
    
    updateWheelStats();
    renderStudentList();
    createConfetti();

    // Mobile: đưa ảnh + tên người trúng vào vùng nhìn thấy ngay sau khi quay.
    if (window.matchMedia?.('(max-width: 700px)').matches) {
        setTimeout(() => {
            const panel = document.querySelector('.wheel-result-panel.has-winner');
            if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 180);
    }
    // Sau khi cập nhật giao diện, gọi hàm updateWinnerAvatar
updateWinnerAvatar(winner);

// Nếu đã gọi hết học sinh, hiển thị nút quay lại Dashboard
if (WHEEL_STATE.preventDuplicates && syncWheelRemainingStudents().length === 0 && getEnabledWheelParticipants().length > 0) {
    const actionsDiv = document.querySelector('.result-actions');
    if (actionsDiv && !actionsDiv.querySelector('.btn-back-dashboard')) {
        const backBtn = document.createElement('button');
        backBtn.className = 'btn btn-info btn-back-dashboard';
        backBtn.innerHTML = '<i class="fas fa-home"></i> Về trang chủ';
        backBtn.onclick = function() {
            renderPage('dashboard');
            // Nếu đang ở chế độ trình chiếu, thoát khỏi trình chiếu
            if (WHEEL_STATE.presentationMode) {
                togglePresentationMode();
            }
        };
        actionsDiv.appendChild(backBtn);
    }
}
    showToast(`🎉 Chúc mừng ${winner.fullName}!`, 'success', 3000);
}

function endWheelSession() {
    if (WHEEL_STATE.isSpinning) {
        showToast('Vòng quay đang chạy. Vui lòng chờ kết quả.', 'warning', 1800);
        return;
    }

    const hasState =
        !!WHEEL_STATE.selectedClassId ||
        (WHEEL_STATE.participants?.length || 0) > 0 ||
        (WHEEL_STATE.selectedStudents?.length || 0) > 0 ||
        !!WHEEL_STATE.currentWinner;

    if (hasState && !confirm('Kết thúc phiên Vòng quay hiện tại và trở về trạng thái ban đầu?')) {
        return;
    }

    WHEEL_STATE.selectedClassId = null;
    WHEEL_STATE.selectedClassName = '';
    WHEEL_STATE.participants = [];
    WHEEL_STATE.remainingStudents = [];
    WHEEL_STATE.selectedStudents = [];
    WHEEL_STATE.currentWinner = null;
    WHEEL_STATE.preventDuplicates = true;
    WHEEL_STATE.isSpinning = false;
    WHEEL_STATE.rotation = 0;
    WHEEL_STATE.winnerId = null;

    const classSelect = document.getElementById('wheelClassSelect');
    if (classSelect) classSelect.value = '';

    const preventBox = document.getElementById('wheelPreventDuplicates');
    if (preventBox) preventBox.checked = true;

    const resultDiv = document.getElementById('wheelResult');
    if (resultDiv) resultDiv.style.display = 'none';
    document.querySelector('.wheel-result-panel')?.classList.remove('has-winner');

    updateWheelStats();
    renderStudentList();
    drawWheel();
    clearWheelStateStorage();
    saveWheelStateToStorage();
    showToast('Đã kết thúc Vòng quay và trở về trạng thái ban đầu.', 'success', 1800);
}

function resetWheel() {
    if (WHEEL_STATE.isSpinning) return;
    
    const classId = WHEEL_STATE.selectedClassId;
    if (!classId) {
        showToast('Vui lòng chọn lớp trước.', 'warning');
        return;
    }
    
    WHEEL_STATE.selectedStudents = [];
    WHEEL_STATE.currentWinner = null;
    WHEEL_STATE.winnerId = null;
    WHEEL_STATE.participants.forEach(s => s.called = false);
    WHEEL_STATE.remainingStudents = WHEEL_STATE.participants.filter(s => s.enabled !== false);
    
    const resultDiv = document.getElementById('wheelResult');
    if (resultDiv) resultDiv.style.display = 'none';
    document.querySelector('.wheel-result-panel')?.classList.remove('has-winner');
    
    updateWheelStats();
    renderStudentList();
    drawWheel();
    
    showToast('Đã đặt lại lượt quay!', 'success', 1500);
}

// ============================================================
// PRESENTATION MODE
// ============================================================

function goHome() {
    // 1. Tắt chế độ trình chiếu nếu đang mở
    if (typeof WHEEL_STATE !== 'undefined' && WHEEL_STATE.presentationMode) {
        togglePresentationMode();
    }
    // 2. Chuyển về Dashboard / Trang chủ
    if (typeof switchPage === 'function') {
        switchPage('dashboard'); // Nếu ứng dụng của thầy dùng hàm chuyển trang switchPage
    } else {
        window.location.reload(); // Hoặc tải lại trang về Dashboard
    }
}

function togglePresentationMode() {
    WHEEL_STATE.presentationMode = !WHEEL_STATE.presentationMode;
    const container = document.querySelector('.wheel-container');
    if (container) {
        container.classList.toggle('presentation-mode');

        // Tự động thêm/cập nhật duy nhất Nút Thoát ở góc trên bên phải
        let topBar = container.querySelector('.presentation-top-bar');
        if (WHEEL_STATE.presentationMode) {
            if (!topBar) {
                topBar = document.createElement('div');
                topBar.className = 'presentation-top-bar';
                topBar.innerHTML = `
                    <button type="button" class="btn btn-secondary btn-sm" onclick="togglePresentationMode()">
                        <i class="fas fa-compress"></i> Thoát
                    </button>
                `;
                container.appendChild(topBar);
            }
        }
    }

    // Cập nhật nút bấm gốc ở giao diện điều khiển
    const btn = document.querySelector('[onclick="togglePresentationMode()"]');
    if (btn) {
        btn.innerHTML = WHEEL_STATE.presentationMode ?
            '<i class="fas fa-compress"></i> Thoát' :
            '<i class="fas fa-expand"></i> Trình chiếu';
    }

    // Resize canvas
    setTimeout(() => {
        resizeWheelCanvas();
        if (WHEEL_STATE.currentWinner) {
            const resultDiv = document.getElementById('wheelResult');
            if (resultDiv) resultDiv.style.display = 'block';
            updateWinnerAvatar(WHEEL_STATE.currentWinner);
        }
    }, 100);
}

// Hàm phụ trợ cập nhật ảnh
function updateWinnerAvatar(winner) {
    if (!winner) return;
    const avatarImg = document.getElementById('winnerAvatar');
    if (!avatarImg) return;

    let avatarUrl = winner.avatar || winner.avatar_url;
    if (typeof avatarUrl === 'object' || !avatarUrl) {
        avatarUrl = DEFAULT_AVATAR;
    }
    if (!avatarUrl.startsWith('data:image') && !avatarUrl.startsWith('http://') && !avatarUrl.startsWith('https://')) {
        avatarUrl = DEFAULT_AVATAR;
    }

    avatarImg.src = avatarUrl;
    avatarImg.style.display = 'block';
    avatarImg.style.visibility = 'visible';
    avatarImg.style.opacity = '1';
    avatarImg.style.width = '100%';
    avatarImg.style.height = '100%';
    avatarImg.style.objectFit = 'cover';
    avatarImg.style.borderRadius = '50%';

    avatarImg.onerror = function() {
        this.src = DEFAULT_AVATAR;
    };
}

function toggleSound() {
    WHEEL_STATE.audioEnabled = !WHEEL_STATE.audioEnabled;
    const btn = document.querySelector('[onclick="toggleSound()"]');
    if (btn) {
        btn.innerHTML = WHEEL_STATE.audioEnabled ? 
            '<i class="fas fa-volume-up"></i> Âm thanh' : 
            '<i class="fas fa-volume-mute"></i> Âm thanh';
    }
    showToast(WHEEL_STATE.audioEnabled ? 'Đã bật âm thanh' : 'Đã tắt âm thanh', 'info', 1000);
}

// ============================================================
// SOUND EFFECTS
// ============================================================

// ============================================================
// AUDIO CONFIG & INITIALIZATION (LOCALSTORAGE & HTML AUDIO)
// ============================================================

const AUDIO_STORAGE_KEY = 'wheelAudioConfig';
const spinAudioPlayer = new Audio();
const winnerAudioPlayer = new Audio();

function getAudioConfig() {
    try {
        const stored = localStorage.getItem(AUDIO_STORAGE_KEY);
        const defaultConfig = { 
            spinUrl: 'assets/audio/spin.mp3', 
            winnerUrl: 'assets/audio/winner.mp3', 
            enabled: true 
        };
        return stored ? { ...defaultConfig, ...JSON.parse(stored) } : defaultConfig;
    } catch (e) {
        return { 
            spinUrl: 'assets/audio/spin.mp3', 
            winnerUrl: 'assets/audio/winner.mp3', 
            enabled: true 
        };
    }
}

function saveAudioConfig(config) {
    localStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(config));
}

function playSpinSound() {
    const config = getAudioConfig();
    if (!WHEEL_STATE.audioEnabled) return;

    if (config.spinUrl && config.spinUrl.trim() !== '') {
        spinAudioPlayer.src = config.spinUrl.trim();
        spinAudioPlayer.play().catch(err => {
            console.warn('⚠️ Không thể phát âm thanh quay từ URL:', err);
            playSpinSoundFallback();
        });
    } else {
        playSpinSoundFallback();
    }
}
function stopSpinSound() {
    if (spinAudioPlayer) {
        spinAudioPlayer.pause();
        spinAudioPlayer.currentTime = 0; // Tua lại về đầu file
    }
}

function playCelebrationSound() {
    stopSpinSound(); // 🛑 Dừng ngay nhạc quay tại đây
    
    const config = getAudioConfig();
    if (!WHEEL_STATE.audioEnabled) return;

    if (config.winnerUrl && config.winnerUrl.trim() !== '') {
        winnerAudioPlayer.src = config.winnerUrl.trim();
        winnerAudioPlayer.play().catch(err => {
            console.warn('⚠️ Không thể phát âm thanh chiến thắng từ URL:', err);
            playCelebrationSoundFallback();
        });
    } else {
        playCelebrationSoundFallback();
    }
}

function playSpinSoundFallback() {
    try {
        const ctx = getAudioContext();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        oscillator.frequency.setValueAtTime(440, ctx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.5);
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.5);
    } catch (e) {}
}

function playCelebrationSoundFallback() {
    try {
        const ctx = getAudioContext();
        const notes = [523, 659, 784, 1047];
        notes.forEach((freq, i) => {
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);
            oscillator.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1);
            oscillator.type = 'sine';
            gainNode.gain.setValueAtTime(0.08, ctx.currentTime + i * 0.1);
            gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.2);
            oscillator.start(ctx.currentTime + i * 0.1);
            oscillator.stop(ctx.currentTime + i * 0.1 + 0.2);
        });
    } catch (e) {}
}

window.testAudioUrl = function(type) {
    const inputId = type === 'spin' ? 'spinAudioUrlInput' : 'winnerAudioUrlInput';
    const input = document.getElementById(inputId);
    if (!input || !input.value.trim()) {
        showToast('Vui lòng nhập đường dẫn URL âm thanh!', 'warning');
        return;
    }
    const testAudio = new Audio(input.value.trim());
    testAudio.play().then(() => {
        showToast('Đang nghe thử âm thanh...', 'success');
    }).catch(err => {
        showToast('⚠️ Không thể phát âm thanh. Hãy kiểm tra URL.', 'error');
    });
};

window.saveAudioSettings = function() {
    const spinInput = document.getElementById('spinAudioUrlInput');
    const winnerInput = document.getElementById('winnerAudioUrlInput');
    const config = getAudioConfig();
    config.spinUrl = spinInput ? spinInput.value.trim() : '';
    config.winnerUrl = winnerInput ? winnerInput.value.trim() : '';
    saveAudioConfig(config);
    showToast('Đã lưu cấu hình âm thanh thành công!', 'success');
};
// CONFETTI EFFECT
// ============================================================

function createConfetti() {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#F7DC6F'];
    const container = document.getElementById('wheelResult');
    if (!container) return;
    
    for (let i = 0; i < 30; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti-piece';
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.top = '-10px';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.width = (6 + Math.random() * 8) + 'px';
        confetti.style.height = (6 + Math.random() * 8) + 'px';
        confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
        confetti.style.position = 'absolute';
        confetti.style.animation = `confettiFall ${2 + Math.random() * 2}s linear forwards`;
        confetti.style.animationDelay = Math.random() * 0.5 + 's';
        confetti.style.pointerEvents = 'none';
        container.appendChild(confetti);
        setTimeout(() => confetti.remove(), 4000);
    }
}

// ============================================================
// CSS ANIMATIONS
// ============================================================

const wheelConfettiStyle = document.createElement('style');
wheelConfettiStyle.textContent = `
    @keyframes confettiFall {
        0% { transform: translateY(-10px) rotate(0deg); opacity: 1; }
        100% { transform: translateY(400px) rotate(720deg); opacity: 0; }
    }
`;
document.head.appendChild(wheelConfettiStyle);

// ============================================================
// EXPOSE TO WINDOW
// ============================================================

window.renderWheel = renderWheel;
window.toggleWheelParticipant = toggleWheelParticipant;
window.setWheelPreventDuplicates = setWheelPreventDuplicates;
window.initWheel = initWheel;
window.onWheelClassChange = onWheelClassChange;
window.loadWheelStudents = loadWheelStudents;
window.renderStudentList = renderStudentList;
window.updateWheelStats = updateWheelStats;
window.getWheelStudents = getWheelStudents;
window.drawWheel = drawWheel;
window.spinWheel = spinWheel;
window.showWinner = showWinner;
window.resetWheel = resetWheel;
window.togglePresentationMode = togglePresentationMode;
window.toggleSound = toggleSound;
window.createConfetti = createConfetti;
window.playSpinSound = playSpinSound;
window.playCelebrationSound = playCelebrationSound;

// ============================================================
// 0. AVATAR MẶC ĐỊNH (BASE64)
// ============================================================
const DEFAULT_AVATAR = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMTAwIDEwMCI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiNlNWU3ZWIiIHJ4PSI1MCUiLz48Y2lyY2xlIGN4PSI1MCIgY3k9IjM4IiByPSIyNCIgZmlsbD0iIzhjOTU5YyIvPjxjaXJjbGUgY3g9IjUwIiBjeT0iNzUiIHI9IjI4IiBmaWxsPSIjOGM5NTljIi8+PC9zdmc+';

// ============================================================
// 1. STATE & DỮ LIỆU MẪU
// ============================================================
const APP_STATE = {
    currentPage: 'dashboard',
    students: [],
    classes: [],
    allClasses: [],
    scores: {},
    attendance: [],
    rewards: [],
    disciplines: [],
    learningComments: [],
    files: [],
    settings: {
        schoolName: 'Trường Tiểu học-Trung học Cơ sở & Trung học phổ thông Lại Sơn_Phân hiệu trường Tiểu học Trần Quốc Toản',
        schoolYear: '2026-2027',
        theme: 'light',
        logo: '',
        teacherName: 'Võ Thanh Đậm'
    },
    selectedStudents: [],
currentStudentId: null,
darkMode: false,
currentSubject: 'Tin học',
studentSubject: 'Tin học',
statSubject: '',
statClass: '',
searchSubject: '',
classMap: {},
subjectCatalog: [],
allSubjectCatalog: [],
currentUserRole: 'teacher',
currentUserActive: true,
currentUserId: null,
currentUserEmail: '',
currentUserDisplayName: '',
currentUserAccessScope: 'all',
currentUserAssignments: [],
userAccessLoaded: false
};

const SUBJECT_CONFIG = [
    { id: 'tieng_viet', name: 'Tiếng Việt' },
    { id: 'toan', name: 'Toán' },
    { id: 'dao_duc', name: 'Đạo đức' },
    { id: 'tu_nhien_xa_hoi', name: 'Tự nhiên và Xã hội' },
    { id: 'khoa_hoc', name: 'Khoa học' },
    { id: 'lich_su_dia_li', name: 'Lịch sử và Địa lí' },
    { id: 'ngoai_ngu_1', name: 'Ngoại ngữ 1' },
    { id: 'am_nhac', name: 'Âm nhạc' },
    { id: 'mi_thuat', name: 'Mĩ thuật' },
    { id: 'giao_duc_the_chat', name: 'Giáo dục thể chất' },
    { id: 'tin_hoc', name: 'Tin học' },
    { id: 'cong_nghe', name: 'Công nghệ' },
    { id: 'hoat_dong_trai_nghiem', name: 'Hoạt động trải nghiệm' }
];

const SUBJECTS = SUBJECT_CONFIG.map(subject => subject.name);

// ============================================================
// PHÂN QUYỀN TOÀN CỤC - BƯỚC 118
// Chỉ nạp trạng thái quyền và cung cấp helper dùng chung.
// Chưa áp dụng khóa CRUD hàng loạt ở bước này.
// ============================================================
function isAdmin() {
    return APP_STATE.currentUserActive !== false && APP_STATE.currentUserRole === 'admin';
}

function isTeacher() {
    return APP_STATE.currentUserActive !== false && APP_STATE.currentUserRole === 'teacher';
}

function isViewer() {
    return APP_STATE.currentUserActive !== false && APP_STATE.currentUserRole === 'viewer';
}

function canManageSystem() {
    return isAdmin();
}

function canEditData() {
    return isAdmin() || isTeacher();
}

// BƯỚC 151.49.3F.6: đồng bộ menu quản trị theo vai trò.
// Nội dung website là module quản trị hệ thống nên chỉ Admin được nhìn thấy/mở.
function applyRoleBasedNavigation() {
    const adminOnlyNav = document.querySelectorAll('.admin-public-nav');
    adminOnlyNav.forEach(item => {
        item.style.display = isAdmin() ? '' : 'none';
        item.setAttribute('aria-hidden', isAdmin() ? 'false' : 'true');
    });
}

function requireEditPermission(action = 'thao tác này') {
    if (canEditData()) return true;
    showToast(`Tài khoản chỉ xem không được phép ${action}.`, 'warning', 2200);
    return false;
}

// BƯỚC 151.10: các thao tác sao lưu/khôi phục hệ thống chỉ dành cho Admin.
function requireAdminPermission(action = 'thao tác này') {
    if (isAdmin()) return true;
    showToast(`Chỉ tài khoản Admin được phép ${action}.`, 'warning', 2400);
    return false;
}

function applyViewerReadOnlyUI() {
    if (!isViewer()) return;
    const root = document.getElementById('pageContainer');
    if (!root) return;

    const writeHandlers = [
        'openAddStudent','editStudent','deleteStudent','deleteSelectedStudents','importExcel',
        'openAddClass','editClass','deleteClass','updateScore','saveScore','importScoresExcel',
        'updateAttendanceStatus','saveAttendance','openAddReward','deleteReward',
        'openAddDiscipline','deleteDiscipline','openAddLearningComment','editLearningComment','deleteLearningComment',
        'openUploadFile','editFile','deleteFile','saveSettings','saveSubjectConfig',
        'mergeBackupData','fullRestoreBackupData','saveUserRole'
    ];

    root.querySelectorAll('button,[onclick]').forEach(el => {
        const handler = el.getAttribute('onclick') || '';
        if (writeHandlers.some(name => handler.includes(name))) {
            el.disabled = true;
            el.style.opacity = '0.55';
            el.style.cursor = 'not-allowed';
            el.title = 'Tài khoản Viewer chỉ được xem';
        }
    });

    root.querySelectorAll('input[onchange],select[onchange],textarea[onchange]').forEach(el => {
        const handler = el.getAttribute('onchange') || '';
        if (writeHandlers.some(name => handler.includes(name))) {
            el.disabled = true;
            el.title = 'Tài khoản Viewer chỉ được xem';
        }
    });

    ['importFileInput','scoreImportFile','mergeBackupInput','fullRestoreBackupInput'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = true;
    });
}

function isActiveUser() {
    return APP_STATE.currentUserActive !== false;
}

function updateCurrentUserHeader() {
    const nameEl = document.getElementById('topbarCurrentUserName');
    if (!nameEl) return;

    const displayName = (APP_STATE.currentUserDisplayName || '').trim();
    const email = (APP_STATE.currentUserEmail || '').trim();
    nameEl.textContent = displayName || email || 'Người dùng';
    nameEl.title = email || nameEl.textContent;
}

let userAccessLoadPromise = null;

async function loadCurrentUserAccess(force = false) {
    // Tránh gọi lặp app3_user_roles khi nhiều luồng khởi động cùng kiểm tra session.
    if (!force && APP_STATE.userAccessLoaded && APP_STATE.currentUserId && APP_STATE.currentUserActive !== false) {
        updateCurrentUserHeader();
        return true;
    }

    if (!force && userAccessLoadPromise) {
        return userAccessLoadPromise;
    }

    userAccessLoadPromise = (async () => {
        try {
            // getSession() dùng session cục bộ của Supabase Auth, tránh request /auth/v1/user lặp lại.
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) throw sessionError;
            const user = session?.user || null;

            if (!user) {
                APP_STATE.currentUserId = null;
                APP_STATE.currentUserEmail = '';
                APP_STATE.currentUserDisplayName = '';
                APP_STATE.currentUserRole = 'teacher';
                APP_STATE.currentUserActive = false;
                APP_STATE.currentUserAccessScope = 'all';
                APP_STATE.currentUserAssignments = [];
                APP_STATE.userAccessLoaded = false;
                updateCurrentUserHeader();
                return false;
            }

            const { data: roleRow, error: roleError } = await supabase
                .from('app3_user_roles')
                .select('user_id,email,display_name,role,active,access_scope')
                .eq('user_id', user.id)
                .maybeSingle();

            if (roleError) throw roleError;

            const hasValidRoleProfile = !!roleRow && ['admin', 'teacher', 'viewer'].includes(roleRow.role);
            const role = hasValidRoleProfile ? roleRow.role : 'viewer';
            const active = hasValidRoleProfile && roleRow.active === true;

            APP_STATE.currentUserId = user.id;
            APP_STATE.currentUserEmail = roleRow?.email || user.email || '';
            APP_STATE.currentUserDisplayName = (roleRow?.display_name || '').trim() || APP_STATE.currentUserEmail;
            APP_STATE.currentUserRole = role;
            APP_STATE.currentUserActive = active;
            APP_STATE.currentUserAccessScope = roleRow?.access_scope === 'assigned' ? 'assigned' : 'all';
            APP_STATE.currentUserAssignments = [];

            if (APP_STATE.currentUserAccessScope === 'assigned') {
                const { data: assignmentRows, error: assignmentError } = await supabase
                    .from('app3_teacher_assignments')
                    .select('subject_id,class_id,active')
                    .eq('user_id', user.id)
                    .eq('active', true);
                if (assignmentError) throw assignmentError;
                APP_STATE.currentUserAssignments = assignmentRows || [];
            }

            APP_STATE.userAccessLoaded = true;
            updateCurrentUserHeader();
            applyRoleBasedNavigation();


            if (!active) {
                await supabase.auth.signOut();
                const loginScreen = document.getElementById('loginScreen');
                const app = document.getElementById('app');
                if (loginScreen) loginScreen.style.display = 'flex';
                if (loginScreen) loginScreen.classList.remove('hidden');
                if (app) app.classList.add('hidden');
                showToast('Tài khoản này đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.', 'error');
                return false;
            }

            return true;
        } catch (err) {
            console.error('Không thể nạp quyền người dùng:', err);
            APP_STATE.userAccessLoaded = false;
            showToast('Không thể xác định quyền tài khoản: ' + err.message, 'error');
            return false;
        }
    })();

    try {
        return await userAccessLoadPromise;
    } finally {
        userAccessLoadPromise = null;
    }
}

function getSubjectId(subjectName) {
    const catalogSubject = APP_STATE.subjectCatalog?.find(
        subject => subject.name === subjectName
    );

    if (catalogSubject?.id) {
        return catalogSubject.id;
    }

    return SUBJECT_CONFIG.find(
        subject => subject.name === subjectName
    )?.id || null;
}


// ============================================================
// PHẠM VI HIỂN THỊ THEO PHÂN CÔNG - BƯỚC 120.1
// Chỉ giới hạn dữ liệu/selector hiển thị. Chưa thay thế RLS bảo mật.
// ============================================================
function hasAssignedScope() {
    return !isAdmin() && APP_STATE.currentUserAccessScope === 'assigned';
}

function getAssignedSubjectIds() {
    return new Set(
        (APP_STATE.currentUserAssignments || [])
            .filter(a => a.active !== false)
            .map(a => a.subject_id)
            .filter(Boolean)
    );
}

function getAssignedClassIds(subjectName = '') {
    if (!hasAssignedScope()) {
        return new Set((APP_STATE.classes || []).map(c => c.id));
    }

    const subjectId = subjectName ? getSubjectId(subjectName) : null;
    return new Set(
        (APP_STATE.currentUserAssignments || [])
            .filter(a => a.active !== false && (!subjectId || a.subject_id === subjectId))
            .map(a => a.class_id)
            .filter(Boolean)
    );
}

function getAccessibleClassesForSubject(subjectName = '') {
    const source = APP_STATE.allClasses?.length ? APP_STATE.allClasses : APP_STATE.classes;
    let classes = [...(source || [])];

    // BƯỚC 150.4.4: lọc lớp theo khối áp dụng của môn.
    // Nhờ đó lớp 1-2 mới xuất hiện ở Toán/Tiếng Việt/... nhưng không lọt vào
    // Tin học/Công nghệ nếu danh mục môn không áp dụng cho khối đó.
    if (subjectName) {
        const subject = (APP_STATE.subjectCatalog || []).find(x =>
            normalizeVnEduText(x.name).toLowerCase() === normalizeVnEduText(subjectName).toLowerCase()
        );
        const grades = Array.isArray(subject?.grades) ? subject.grades.map(String) : [];
        if (grades.length) classes = classes.filter(c => grades.includes(String(c.grade ?? c.name?.[0] ?? '')));
    }

    if (!hasAssignedScope()) return classes;
    const allowedIds = getAssignedClassIds(subjectName);
    return classes.filter(c => allowedIds.has(c.id));
}

function getVisibleSubjectNames() {
    // Với phạm vi assigned, tuyệt đối không fallback sang toàn bộ SUBJECTS.
    // Nếu chưa tải được phân công thì trả về [] để tránh lộ môn ngoài quyền.
    if (hasAssignedScope()) {
        return (APP_STATE.subjectCatalog || []).map(subject => subject.name);
    }
    return APP_STATE.subjectCatalog?.length
        ? APP_STATE.subjectCatalog.map(subject => subject.name)
        : SUBJECTS;
}


// ============================================================
// Bộ chọn ngữ cảnh LỚP -> MÔN -> HỌC SINH
// Dùng cho Khen thưởng, Kỷ luật, Nhận xét học tập.
// ============================================================
function getContextSubjectsForClass(classId) {
    if (!classId) return [];

    const classSource = APP_STATE.allClasses?.length
        ? APP_STATE.allClasses
        : APP_STATE.classes;
    const cls = (classSource || []).find(item => item.id === classId);
    if (!cls) return [];

    let subjects = (APP_STATE.subjectCatalog || []).filter(subject => subject.active !== false);

    if (hasAssignedScope()) {
        const allowedSubjectIds = new Set(
            (APP_STATE.currentUserAssignments || [])
                .filter(a => a.active !== false && a.class_id === classId)
                .map(a => a.subject_id)
        );
        subjects = subjects.filter(subject => allowedSubjectIds.has(subject.id));
    }

    const classGrade = String(cls.grade ?? '');
    return subjects.filter(subject => {
        const grades = Array.isArray(subject.grades) ? subject.grades.map(String) : [];
        return !grades.length || grades.includes(classGrade);
    });
}

function getContextStudentsForClass(classId) {
    if (!classId) return [];
    return (APP_STATE.students || []).filter(student => student.class_id === classId);
}

function getContextClassName(classId) {
    const source = APP_STATE.allClasses?.length ? APP_STATE.allClasses : APP_STATE.classes;
    return (source || []).find(cls => cls.id === classId)?.name || '—';
}

function isAssignedPairAccessible(classId, subjectId) {
    if (!hasAssignedScope()) return true;
    if (!classId || !subjectId) return false;
    return (APP_STATE.currentUserAssignments || []).some(a =>
        a.active !== false && a.class_id === classId && a.subject_id === subjectId
    );
}

function setupClassSubjectStudentSelectors({
    classSelectId,
    subjectSelectId,
    studentSelectId,
    initialClassId = '',
    initialSubjectId = '',
    initialStudentUuid = ''
}) {
    const classSelect = document.getElementById(classSelectId);
    const subjectSelect = document.getElementById(subjectSelectId);
    const studentSelect = document.getElementById(studentSelectId);
    if (!classSelect || !subjectSelect || !studentSelect) return;

    const renderStudents = () => {
        const classId = classSelect.value;
        const subjectId = subjectSelect.value;
        const students = classId && subjectId ? getContextStudentsForClass(classId) : [];
        studentSelect.innerHTML = `
            <option value="">-- Chọn học sinh --</option>
            ${students.map(student => `
                <option value="${student.db_uuid}">${student.fullName}</option>
            `).join('')}
        `;
        studentSelect.disabled = !classId || !subjectId;
        if (initialStudentUuid && students.some(student => student.db_uuid === initialStudentUuid)) {
            studentSelect.value = initialStudentUuid;
        }
    };

    const renderSubjects = () => {
        const classId = classSelect.value;
        const subjects = getContextSubjectsForClass(classId);
        subjectSelect.innerHTML = `
            <option value="">-- Chọn môn --</option>
            ${subjects.map(subject => `
                <option value="${subject.id}">${subject.name}</option>
            `).join('')}
        `;
        subjectSelect.disabled = !classId;

        if (initialSubjectId && subjects.some(subject => subject.id === initialSubjectId)) {
            subjectSelect.value = initialSubjectId;
        } else if (subjects.length === 1) {
            subjectSelect.value = subjects[0].id;
        }
        renderStudents();
    };

    classSelect.addEventListener('change', () => {
        initialSubjectId = '';
        initialStudentUuid = '';
        renderSubjects();
    });
    subjectSelect.addEventListener('change', () => {
        initialStudentUuid = '';
        renderStudents();
    });

    if (initialClassId && [...classSelect.options].some(option => option.value === initialClassId)) {
        classSelect.value = initialClassId;
    } else if (classSelect.options.length === 2) {
        classSelect.selectedIndex = 1;
    }
    renderSubjects();
}

async function refreshCurrentUserAssignments() {
    if (!hasAssignedScope() || !APP_STATE.currentUserId) return;
    const { data, error } = await supabase
        .from('app3_teacher_assignments')
        .select('subject_id,class_id,active')
        .eq('user_id', APP_STATE.currentUserId)
        .eq('active', true);
    if (error) throw error;
    APP_STATE.currentUserAssignments = data || [];
}

function applyCurrentUserDisplayScope() {
    if (!hasAssignedScope()) return;

    const subjectIds = getAssignedSubjectIds();
    APP_STATE.subjectCatalog = (APP_STATE.allSubjectCatalog || [])
        .filter(subject => subject.active !== false && subjectIds.has(subject.id));

    const allAssignedClassIds = getAssignedClassIds();
    APP_STATE.classes = (APP_STATE.allClasses || [])
        .filter(c => allAssignedClassIds.has(c.id));

    APP_STATE.classMap = {};
    APP_STATE.classes.forEach(c => { APP_STATE.classMap[c.name] = c.id; });


    const visibleSubjects = APP_STATE.subjectCatalog.map(s => s.name);
    ['currentSubject', 'studentSubject', 'statSubject', 'searchSubject'].forEach(key => {
        if (!visibleSubjects.includes(APP_STATE[key])) {
            APP_STATE[key] = visibleSubjects[0] || '';
        }
    });
}

// ============================================================
// 2. FUNCTIONS TẢI DỮ LIỆU TỪ SUPABASE
// ============================================================

async function loadAllData() {
    showLoading();

    try {
        // BƯỚC 122.6C: quyền phải có trước dữ liệu để phạm vi assigned được áp đúng.
        if (!APP_STATE.userAccessLoaded) {
            const accessOk = await loadCurrentUserAccess();
            if (!accessOk) return;
        }

        // BƯỚC 150.4.11: gom toàn bộ truy vấn độc lập vào MỘT lượt song song.
        // BƯỚC 151.6: đã gỡ mã đo chẩn đoán tạm thời; giữ nguyên cơ chế tải song song.
        const [
            subjectsResult,
            classesResult,
            studentsResult,
            scoresResult,
            attendanceResult,
            rewardsResult,
            disciplinesResult,
            learningCommentsResult,
            filesResult,
            settingsResult
        ] = await Promise.all([
            supabase
                .from('app3_subjects')
                .select('id, name, grades, active')
                .order('name'),
            supabase
                .from('app3_classes')
                .select('*')
                .order('name'),
            supabase
                .from('app3_students')
                // BƯỚC 151.5: không tải avatar_url ở lần vào hệ thống.
                // Ảnh sẽ được tải theo nhu cầu để tránh kéo toàn bộ base64 của 443 học sinh.
                .select('id, student_code, full_name, dob, gender, class_id, class_code, grade, address, phone, email, father_name, mother_name, parent_phone, enrollment_date, status, note, app3_classes(name)')
                .order('full_name'),
            supabase
                .from('app3_scores')
                .select('*'),
            supabase
                .from('app3_attendance')
                .select('*'),
            supabase
                .from('app3_rewards')
                .select('*')
                .order('date', { ascending: false }),
            supabase
                .from('app3_disciplines')
                .select('*')
                .order('date', { ascending: false }),
            supabase
                .from('app3_learning_comments')
                .select('*')
                .order('comment_datetime', { ascending: false }),
            supabase
                .from('app3_files')
                .select('*')
                .order('created_at', { ascending: false }),
            supabase
                .from('app3_settings')
                .select('*')
                .limit(1)
                .maybeSingle()
        ]);

        if (subjectsResult.error) {
            console.warn(
                'Không tải được app3_subjects, tiếp tục dùng cấu hình môn mặc định:',
                subjectsResult.error
            );
            APP_STATE.allSubjectCatalog = SUBJECT_CONFIG.map(subject => ({
                ...subject,
                grades: [1, 2, 3, 4, 5],
                active: true
            }));
        } else {
            APP_STATE.allSubjectCatalog = subjectsResult.data || [];
        }

        APP_STATE.subjectCatalog = APP_STATE.allSubjectCatalog.filter(subject => subject.active !== false);

        if (classesResult.error) throw classesResult.error;
        APP_STATE.allClasses = classesResult.data || [];
        APP_STATE.classes = APP_STATE.allClasses;
        APP_STATE.classMap = {};
        APP_STATE.classes.forEach(c => { APP_STATE.classMap[c.name] = c.id; });

        // Phân công đã được nạp cùng loadCurrentUserAccess(). Không query lại ở đây.
        applyCurrentUserDisplayScope();

        const visibleSubjectNames = APP_STATE.subjectCatalog.map(subject => subject.name);
        ['currentSubject', 'studentSubject', 'statSubject', 'searchSubject'].forEach(key => {
            if (visibleSubjectNames.length > 0 && !visibleSubjectNames.includes(APP_STATE[key])) {
                APP_STATE[key] = visibleSubjectNames[0];
            }
        });

        if (studentsResult.error) throw studentsResult.error;

        if (scoresResult.error) throw scoresResult.error;
        if (attendanceResult.error) throw attendanceResult.error;
        if (rewardsResult.error) throw rewardsResult.error;
        if (disciplinesResult.error) throw disciplinesResult.error;
        if (learningCommentsResult.error) throw learningCommentsResult.error;
        if (filesResult.error) throw filesResult.error;
        if (settingsResult.error) throw settingsResult.error;

        APP_STATE.students = (studentsResult.data || []).map(s => ({
            ...s,
            db_uuid: s.id,
            class: s.app3_classes?.name || s.class_code || s.class || '',
            id: s.student_code,
            fullName: s.full_name,
            dob: s.dob,
            gender: s.gender,
            address: s.address,
            phone: s.phone,
            email: s.email,
            fatherName: s.father_name,
            motherName: s.mother_name,
            parentPhone: s.parent_phone,
            enrollmentDate: s.enrollment_date,
            status: s.status,
            note: s.note,
            // BƯỚC 151.5: avatar chưa tải ở lần đăng nhập; chỉ lấy khi giao diện cần.
            avatar_url: null,
            avatar: DEFAULT_AVATAR,
            _avatarLoaded: false,
            grade: s.grade,
            class_id: s.class_id
        }));

        if (hasAssignedScope()) {
            const allowedClassIds = getAssignedClassIds();
            APP_STATE.students = APP_STATE.students.filter(student => allowedClassIds.has(student.class_id));
        }


        // Lập map UUID -> học sinh một lần để tránh find() lặp khi xử lý điểm/điểm danh.
        const studentByUuid = new Map(APP_STATE.students.map(student => [student.db_uuid, student]));

        APP_STATE.scores = {};
        (scoresResult.data || []).forEach(rec => {
            const student = studentByUuid.get(rec.student_id);
            if (!student) return;
            const studentId = student.id;
            if (!APP_STATE.scores[studentId]) APP_STATE.scores[studentId] = {};
            APP_STATE.scores[studentId][rec.subject] = {
                giuaKy1: normalizeVnEduRating(rec.giua_ky_1 || ''),
                cuoiKy1: rec.cuoi_ky_1 !== null ? rec.cuoi_ky_1 : null,
                giuaKy2: normalizeVnEduRating(rec.giua_ky_2 || ''),
                cuoiKy2: rec.cuoi_ky_2 !== null ? rec.cuoi_ky_2 : null,
                competence: rec.competence || '',
                quality: rec.quality || '',
                xepLoaiCuoiKy1: normalizeVnEduRating(rec.xep_loai_cuoi_ky_1 || ''),
                xepLoaiCuoiKy2: normalizeVnEduRating(rec.xep_loai_cuoi_ky_2 || ''),
                cuoiKy2SauThiLai: rec.cuoi_ky_2_sau_thi_lai !== null ? rec.cuoi_ky_2_sau_thi_lai : null,
                xepLoaiCuoiKy2SauThiLai: normalizeVnEduRating(rec.xep_loai_cuoi_ky_2_sau_thi_lai || ''),
                nhanXetGk1: rec.nhan_xet_gk1 || '', nhanXetCk1: rec.nhan_xet_ck1 || '',
                nhanXetGk2: rec.nhan_xet_gk2 || '', nhanXetCk2: rec.nhan_xet_ck2 || ''
            };
        });

        APP_STATE.attendance = [];
        const attMap = {};
        (attendanceResult.data || []).forEach(rec => {
            const key = `${rec.attendance_date}_${rec.class_id}`;
            if (!attMap[key]) {
                attMap[key] = {
                    date: rec.attendance_date,
                    class: APP_STATE.classes.find(c => c.id === rec.class_id)?.name || '',
                    class_id: rec.class_id,
                    records: []
                };
                APP_STATE.attendance.push(attMap[key]);
            }
            const student = studentByUuid.get(rec.student_id);
            if (student) {
                attMap[key].records.push({
                    studentId: student.id,
                    status: rec.status
                });
            }
        });

        APP_STATE.rewards = (rewardsResult.data || []).map(r => ({
            id: r.id,
            studentId: r.student_id,
            classId: r.class_id,
            subjectId: r.subject_id,
            subject: r.subject,
            date: r.date,
            content: r.content,
            decisionBy: r.decision_by
        })).filter(r => isAssignedPairAccessible(r.classId, r.subjectId));

        APP_STATE.disciplines = (disciplinesResult.data || []).map(d => ({
            id: d.id,
            studentId: d.student_id,
            classId: d.class_id,
            subjectId: d.subject_id,
            subject: d.subject,
            date: d.date,
            content: d.content,
            decisionBy: d.decision_by
        })).filter(d => isAssignedPairAccessible(d.classId, d.subjectId));

        APP_STATE.learningComments = (learningCommentsResult.data || []).map(c => ({
            id: c.id,
            studentId: c.student_id,
            classId: c.class_id,
            subjectId: c.subject_id,
            commentDatetime: c.comment_datetime,
            subject: c.subject,
            commentType: c.comment_type,
            content: c.content,
            teacherName: c.teacher_name,
            createdAt: c.created_at,
            updatedAt: c.updated_at
        }));

        APP_STATE.files = (filesResult.data || []).map(f => ({
            id: f.id,
            name: f.file_name,
            type: f.file_type,
            size: f.file_size,
            uploadDate: f.created_at,
            desc: f.description,
            path: f.file_path,
            url: f.file_url
        }));

        const settings = settingsResult.data;
        if (settings) {
            APP_STATE.settings = {
                schoolName: settings.school_name || APP_STATE.settings.schoolName,
                schoolYear: settings.school_year || APP_STATE.settings.schoolYear,
                teacherName: settings.teacher_name || APP_STATE.settings.teacherName,
                theme: settings.theme || 'light',
                logo: settings.logo_url || ''
            };
        }

        // BƯỚC 148.5.7: cấu hình nhận diện tạm dùng cho năm học 2026-2027.
        // Giữ cố định tại runtime để dữ liệu app3_settings cũ không ghi đè tên trường/năm học mới.
        APP_STATE.settings.schoolName = 'Trường Tiểu học-Trung học Cơ sở & Trung học phổ thông Lại Sơn_Phân hiệu trường Tiểu học Trần Quốc Toản';
        APP_STATE.settings.schoolYear = '2026-2027';

        if (APP_STATE.settings.theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            APP_STATE.darkMode = true;
        } else {
            document.documentElement.removeAttribute('data-theme');
            APP_STATE.darkMode = false;
        }

        updateClassCounts();
    } catch (err) {
        console.error('Lỗi tải dữ liệu:', err);
        showToast('Không thể tải dữ liệu từ Supabase. Vui lòng kiểm tra kết nối.', 'error');
    } finally {
        hideLoading();
    }
}

function updateClassCounts() {
    APP_STATE.classes.forEach(cls => {
        const list = APP_STATE.students.filter(s => s.class === cls.name || s.class_code === cls.name);
        cls.count = list.length;
        cls.male = list.filter(s => s.gender === 'Nam').length;
        cls.female = list.filter(s => s.gender === 'Nữ').length;
    });
}

// ============================================================
// VNEDU HELPERS - ĐẶT Ở PHẠM VI TOÀN CỤC
// Các hàm này được loadAllData() và bảng Điểm dùng trước DOMContentLoaded.
// ============================================================
function normalizeVnEduText(v) {
    return String(v ?? '').replace(/\s+/g, ' ').trim();
}

function escapeHtml(v) {
    return String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeHtmlAttr(v) {
    return String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function normalizeVnEduRating(v) {
    const raw = normalizeVnEduText(v);
    if (!raw) return '';
    const x = raw.toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/Đ/g, 'D');
    if (['T', '2', 'HTT', 'HOAN THANH TOT'].includes(x)) return 'Hoàn thành tốt';
    if (['H', '1', 'HT', 'HOAN THANH'].includes(x)) return 'Hoàn thành';
    if (['C', '0', 'CHT', 'CHUA HOAN THANH'].includes(x)) return 'Chưa hoàn thành';
    return raw;
}

function toVnEduRating(v) {
    const n = normalizeVnEduRating(v);
    if (n === 'Hoàn thành tốt') return 'T';
    if (n === 'Hoàn thành') return 'H';
    if (n === 'Chưa hoàn thành') return 'C';
    return normalizeVnEduText(v);
}

// ============================================================
// 3. UTILITY FUNCTIONS
// ============================================================
function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
}

function getStatusBadge(status) {
    const map = {
        'Đang học': 'badge-success',
        'Đã chuyển': 'badge-warning',
        'Đã tốt nghiệp': 'badge-info',
        'Bảo lưu': 'badge-danger'
    };
    return `<span class="badge ${map[status] || 'badge-info'}">${status}</span>`;
}

function displayText(value) {
    return value || '';
}

function showToast(message, type = 'success', duration = 3000) {
    const container = document.getElementById('toastContainer');
    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
    };
    const colors = {
        success: '#16a34a',
        error: '#dc2626',
        warning: '#f59e0b',
        info: '#2563eb'
    };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="${icons[type] || icons.info}" style="color:${colors[type] || colors.info};"></i>
        <span>${message}</span>
        <button class="toast-close"><i class="fas fa-times"></i></button>
    `;
    container.appendChild(toast);
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => removeToast(toast));
    setTimeout(() => removeToast(toast), duration);
}

function removeToast(toast) {
    toast.classList.add('toast-removing');
    setTimeout(() => toast.remove(), 300);
}

let modalResolve = null;
function showModal(title, bodyHTML, confirmText = 'Xác nhận', cancelText = 'Hủy') {
    return new Promise((resolve) => {
        const container = document.getElementById('modalContainer');
        document.getElementById('modalTitle').textContent = title;
        document.getElementById('modalBody').innerHTML = bodyHTML;
        document.getElementById('modalConfirm').textContent = confirmText;
        document.getElementById('modalCancel').textContent = cancelText;
        container.classList.remove('hidden');
        modalResolve = resolve;
    });
}

document.getElementById('modalConfirm').addEventListener('click', () => {
    document.getElementById('modalContainer').classList.add('hidden');
    if (modalResolve) modalResolve(true);
});
document.getElementById('modalCancel').addEventListener('click', () => {
    document.getElementById('modalContainer').classList.add('hidden');
    if (modalResolve) modalResolve(false);
});
document.getElementById('modalClose').addEventListener('click', () => {
    document.getElementById('modalContainer').classList.add('hidden');
    if (modalResolve) modalResolve(false);
});

function showLoading() { document.getElementById('loadingOverlay').classList.remove('hidden'); }
function hideLoading() { document.getElementById('loadingOverlay').classList.add('hidden'); }

function renderLearningComments() {
    const comments = APP_STATE.learningComments || [];
    const studentMap = new Map((APP_STATE.students || []).map(student => [student.db_uuid, student]));

    return `
        <section class="learning-comments-pro-page">
            <div class="learning-comments-header">
                <div class="learning-comments-title">
                    <span class="learning-comments-title-icon"><i class="fas fa-book-open"></i></span>
                    <div>
                        <span class="learning-comments-kicker">THEO DÕI HỌC TẬP</span>
                        <h2>Nhận xét học tập</h2>
                        <p>Ghi nhận quá trình tiến bộ, cố gắng hoặc những điểm cần hỗ trợ của học sinh.</p>
                    </div>
                </div>
                <button class="btn btn-primary btn-sm learning-comments-add-btn" onclick="openAddLearningComment()">
                    <i class="fas fa-plus"></i> Thêm nhận xét
                </button>
            </div>

            <div class="learning-comments-filter-card">
                <div class="learning-comments-filter-icon"><i class="fas fa-filter"></i></div>
                <div class="learning-comments-filter-control">
                    <label for="learningCommentStudentFilter">Lọc theo học sinh</label>
                    <select id="learningCommentStudentFilter" onchange="filterLearningCommentsByStudent(this.value)">
                        <option value="">Tất cả học sinh</option>
                        ${(APP_STATE.students || []).map(s => `<option value="${s.db_uuid}">${s.fullName}</option>`).join('')}
                    </select>
                </div>
                <div class="learning-comments-total">
                    <span>Tổng nhận xét</span>
                    <strong>${comments.length}</strong>
                </div>
            </div>

            <div class="learning-comments-table-card">
                <div class="learning-comments-table-heading">
                    <span class="learning-comments-table-icon"><i class="fas fa-list-check"></i></span>
                    <div>
                        <h3>Danh sách nhận xét</h3>
                        <p>Xem, chỉnh sửa hoặc xóa nhận xét học tập đã ghi nhận.</p>
                    </div>
                </div>
                <div class="table-wrapper learning-comments-table-wrapper">
                    <table class="learning-comments-table">
                        <thead>
                            <tr>
                                <th>STT</th><th>Lớp</th><th>Môn</th><th>Học sinh</th><th>Thời điểm</th>
                                <th>Diễn biến</th><th>Nội dung</th><th>Thao tác</th>
                            </tr>
                        </thead>
                        <tbody id="learningCommentsTableBody">
                            ${comments.length === 0
                                ? '<tr><td colspan="8" class="text-center text-muted learning-comments-empty">Chưa có nhận xét học tập nào.</td></tr>'
                                : comments.map((c, index) => {
                                    const student = studentMap.get(c.studentId);
                                    return `
                                        <tr data-student-id="${c.studentId}">
                                            <td>${index + 1}</td>
                                            <td>${getContextClassName(c.classId)}</td>
                                            <td>${c.subject || '—'}</td>
                                            <td class="learning-comment-student">${student ? student.fullName : 'Không xác định'}</td>
                                            <td>${c.commentDatetime ? new Date(c.commentDatetime).toLocaleString('vi-VN') : ''}</td>
                                            <td><span class="learning-comment-type">${c.commentType || '—'}</span></td>
                                            <td class="learning-comment-content">${c.content || ''}</td>
                                            <td class="text-center">
                                                <div class="action-buttons learning-comment-actions">
                                                    <button class="btn btn-info btn-sm" title="Xem nhận xét" onclick="viewLearningComment('${c.id}')"><i class="fas fa-eye"></i></button>
                                                    <button class="btn btn-warning btn-sm" title="Sửa nhận xét" onclick="editLearningComment('${c.id}')"><i class="fas fa-edit"></i></button>
                                                    <button class="btn btn-danger btn-sm" title="Xóa nhận xét" onclick="deleteLearningComment('${c.id}')"><i class="fas fa-trash"></i></button>
                                                </div>
                                            </td>
                                        </tr>`;
                                }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>`;
}

window.filterLearningCommentsByStudent = function(studentUuid) {
    document.querySelectorAll('#learningCommentsTableBody tr[data-student-id]').forEach(row => {
        row.style.display = !studentUuid || row.getAttribute('data-student-id') === studentUuid ? '' : 'none';
    });
};

function openAddLearningComment() {
    if (!requireEditPermission('thêm nhận xét học tập')) return;

    const classes = APP_STATE.classes || [];
    const now = new Date();
    const localDate = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
    const localTime = [String(now.getHours()).padStart(2, '0'), String(now.getMinutes()).padStart(2, '0')].join(':');

    const modalPromise = showModal('Thêm nhận xét học tập', `
        <div class="form-group">
            <label>Lớp *</label>
            <select id="lcClassSelect"><option value="">-- Chọn lớp --</option>${classes.map(cls => `<option value="${cls.id}">${cls.name}</option>`).join('')}</select>
        </div>
        <div class="form-group">
            <label>Môn học *</label>
            <select id="lcSubjectSelect" disabled><option value="">-- Chọn môn --</option></select>
        </div>
        <div class="form-group">
            <label>Chọn học sinh *</label>
            <select id="lcStudentSelect" disabled><option value="">-- Chọn học sinh --</option></select>
        </div>
        <div class="form-grid">
            <div class="form-group"><label>Ngày *</label><input type="date" id="lcCommentDate" value="${localDate}"></div>
            <div class="form-group"><label>Thời gian *</label><input type="time" id="lcCommentTime" value="${localTime}"></div>
        </div>
        <div class="form-group">
            <label>Diễn biến học tập *</label>
            <select id="lcTypeSelect">
                <option value="Tiến bộ">Tiến bộ</option><option value="Cần cố gắng">Cần cố gắng</option>
                <option value="Học tập sa sút">Học tập sa sút</option><option value="Nhận xét khác">Nhận xét khác</option>
            </select>
        </div>
        <div class="form-group"><label>Nội dung nhận xét *</label><textarea id="lcContent" rows="4" placeholder="Nhập nhận xét cụ thể về quá trình học tập của học sinh..."></textarea></div>
        <div class="form-group"><label>Người nhận xét</label><input type="text" id="lcTeacherName" value="${APP_STATE.settings?.teacherName || APP_STATE.currentUserDisplayName || ''}"></div>
    `, 'Thêm', 'Hủy');

    setupClassSubjectStudentSelectors({
        classSelectId: 'lcClassSelect', subjectSelectId: 'lcSubjectSelect', studentSelectId: 'lcStudentSelect'
    });

    modalPromise.then(async confirmed => {
        if (!confirmed) return;
        const classId = document.getElementById('lcClassSelect')?.value;
        const subjectId = document.getElementById('lcSubjectSelect')?.value;
        const studentUuid = document.getElementById('lcStudentSelect')?.value;
        const date = document.getElementById('lcCommentDate')?.value;
        const time = document.getElementById('lcCommentTime')?.value;
        const type = document.getElementById('lcTypeSelect')?.value;
        const content = document.getElementById('lcContent')?.value.trim();
        const teacherName = document.getElementById('lcTeacherName')?.value.trim();
        const subjectObj = (APP_STATE.subjectCatalog || []).find(subject => subject.id === subjectId);
        const selectedStudent = APP_STATE.students.find(student => student.db_uuid === studentUuid);

        if (!classId || !subjectId || !studentUuid || !date || !time || !content || !subjectObj || !selectedStudent) {
            showToast('Vui lòng chọn đầy đủ Lớp, Môn, Học sinh và nhập các thông tin bắt buộc!', 'error');
            return;
        }
        if (selectedStudent.class_id !== classId) {
            showToast('Học sinh không thuộc lớp đã chọn.', 'error');
            return;
        }

        try {
            const { data, error } = await supabase.from('app3_learning_comments').insert([{
                student_id: studentUuid,
                class_id: classId,
                subject_id: subjectId,
                comment_datetime: `${date}T${time}:00`,
                subject: subjectObj.name,
                comment_type: type,
                content,
                teacher_name: teacherName || null
            }]).select().single();
            if (error) throw error;
            APP_STATE.learningComments.unshift({
                id: data.id, studentId: data.student_id, classId: data.class_id, subjectId: data.subject_id,
                commentDatetime: data.comment_datetime, subject: data.subject, commentType: data.comment_type,
                content: data.content, teacherName: data.teacher_name, createdAt: data.created_at, updatedAt: data.updated_at
            });
            showToast('Thêm nhận xét học tập thành công!', 'success');
            renderPage('learning-comments');
        } catch (err) {
            console.error('Lỗi thêm nhận xét học tập:', err);
            showToast('Lỗi thêm nhận xét: ' + (err?.message || 'Không xác định'), 'error');
        }
    });
}

window.viewLearningComment = function(commentId) {

    const comment = (APP_STATE.learningComments || [])
        .find(c => String(c.id) === String(commentId));

    if (!comment) {
        showToast(
            'Không tìm thấy nhận xét học tập.',
            'error'
        );
        return;
    }

    const student = (APP_STATE.students || [])
        .find(s => s.db_uuid === comment.studentId);

    const studentName = student
        ? student.fullName
        : 'Không xác định';

    let formattedDatetime = '';

    if (comment.commentDatetime) {
        const date = new Date(comment.commentDatetime);

        if (!isNaN(date.getTime())) {
            formattedDatetime =
                date.toLocaleString('vi-VN');
        }
    }

    showModal(
        'Xem nhận xét học tập',
        `
            <div class="form-group">
                <label><strong>Học sinh</strong></label>
                <div>${studentName}</div>
            </div>

            <div class="form-grid">

                <div class="form-group">
                    <label><strong>Thời điểm</strong></label>
                    <div>${formattedDatetime || '—'}</div>
                </div>

                <div class="form-group">
                    <label><strong>Môn học</strong></label>
                    <div>${comment.subject || '—'}</div>
                </div>

            </div>

            <div class="form-group">
                <label><strong>Diễn biến học tập</strong></label>
                <div>${comment.commentType || '—'}</div>
            </div>

            <div class="form-group">
                <label><strong>Nội dung nhận xét</strong></label>

                <div style="
                    padding:12px;
                    border:1px solid var(--border);
                    border-radius:8px;
                    white-space:pre-wrap;
                ">
                    ${comment.content || ''}
                </div>
            </div>

            <div class="form-group">
                <label><strong>Người nhận xét</strong></label>
                <div>${comment.teacherName || '—'}</div>
            </div>
        `,
        'Đóng',
        ''
    );
};
window.editLearningComment = function(commentId) {
    if (!requireEditPermission('sửa nhận xét học tập')) return;
    const comment = (APP_STATE.learningComments || []).find(c => String(c.id) === String(commentId));
    if (!comment) {
        showToast('Không tìm thấy nhận xét cần sửa.', 'error');
        return;
    }

    let dateValue = '';
    let timeValue = '';
    if (comment.commentDatetime) {
        const date = new Date(comment.commentDatetime);
        if (!isNaN(date.getTime())) {
            dateValue = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
            timeValue = [String(date.getHours()).padStart(2, '0'), String(date.getMinutes()).padStart(2, '0')].join(':');
        }
    }

    const classes = APP_STATE.classes || [];
    const modalPromise = showModal('Sửa nhận xét học tập', `
        <div class="form-group">
            <label>Lớp *</label>
            <select id="lcClassSelect"><option value="">-- Chọn lớp --</option>${classes.map(cls => `<option value="${cls.id}">${cls.name}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label>Môn học *</label><select id="lcSubjectSelect" disabled><option value="">-- Chọn môn --</option></select></div>
        <div class="form-group"><label>Chọn học sinh *</label><select id="lcStudentSelect" disabled><option value="">-- Chọn học sinh --</option></select></div>
        <div class="form-grid">
            <div class="form-group"><label>Ngày *</label><input type="date" id="lcCommentDate" value="${dateValue}"></div>
            <div class="form-group"><label>Thời gian *</label><input type="time" id="lcCommentTime" value="${timeValue}"></div>
        </div>
        <div class="form-group">
            <label>Diễn biến học tập *</label>
            <select id="lcTypeSelect">
                <option value="Tiến bộ" ${comment.commentType === 'Tiến bộ' ? 'selected' : ''}>Tiến bộ</option>
                <option value="Cần cố gắng" ${comment.commentType === 'Cần cố gắng' ? 'selected' : ''}>Cần cố gắng</option>
                <option value="Học tập sa sút" ${comment.commentType === 'Học tập sa sút' ? 'selected' : ''}>Học tập sa sút</option>
                <option value="Nhận xét khác" ${comment.commentType === 'Nhận xét khác' ? 'selected' : ''}>Nhận xét khác</option>
            </select>
        </div>
        <div class="form-group"><label>Nội dung nhận xét *</label><textarea id="lcContent" rows="4">${comment.content || ''}</textarea></div>
        <div class="form-group"><label>Người nhận xét</label><input type="text" id="lcTeacherName" value="${comment.teacherName || ''}"></div>
    `, 'Cập nhật', 'Hủy');

    setupClassSubjectStudentSelectors({
        classSelectId: 'lcClassSelect', subjectSelectId: 'lcSubjectSelect', studentSelectId: 'lcStudentSelect',
        initialClassId: comment.classId || '', initialSubjectId: comment.subjectId || getSubjectId(comment.subject),
        initialStudentUuid: comment.studentId || ''
    });

    modalPromise.then(async confirmed => {
        if (!confirmed) return;
        const classId = document.getElementById('lcClassSelect')?.value;
        const subjectId = document.getElementById('lcSubjectSelect')?.value;
        const studentUuid = document.getElementById('lcStudentSelect')?.value;
        const date = document.getElementById('lcCommentDate')?.value;
        const time = document.getElementById('lcCommentTime')?.value;
        const type = document.getElementById('lcTypeSelect')?.value;
        const content = document.getElementById('lcContent')?.value.trim();
        const teacherName = document.getElementById('lcTeacherName')?.value.trim();
        const subjectObj = (APP_STATE.subjectCatalog || []).find(subject => subject.id === subjectId);
        const selectedStudent = APP_STATE.students.find(student => student.db_uuid === studentUuid);

        if (!classId || !subjectId || !studentUuid || !date || !time || !content || !subjectObj || !selectedStudent) {
            showToast('Vui lòng chọn đầy đủ Lớp, Môn, Học sinh và nhập các thông tin bắt buộc!', 'error');
            return;
        }
        if (selectedStudent.class_id !== classId) {
            showToast('Học sinh không thuộc lớp đã chọn.', 'error');
            return;
        }

        try {
            const { data, error } = await supabase.from('app3_learning_comments').update({
                student_id: studentUuid,
                class_id: classId,
                subject_id: subjectId,
                comment_datetime: `${date}T${time}:00`,
                subject: subjectObj.name,
                comment_type: type,
                content,
                teacher_name: teacherName || null,
                updated_at: new Date().toISOString()
            }).eq('id', commentId).select().single();
            if (error) throw error;
            const index = APP_STATE.learningComments.findIndex(c => String(c.id) === String(commentId));
            if (index !== -1) {
                APP_STATE.learningComments[index] = {
                    id: data.id, studentId: data.student_id, classId: data.class_id, subjectId: data.subject_id,
                    commentDatetime: data.comment_datetime, subject: data.subject, commentType: data.comment_type,
                    content: data.content, teacherName: data.teacher_name, createdAt: data.created_at, updatedAt: data.updated_at
                };
            }
            showToast('Cập nhật nhận xét học tập thành công!', 'success');
            renderPage('learning-comments');
        } catch (err) {
            console.error('Lỗi cập nhật nhận xét học tập:', err);
            showToast('Lỗi cập nhật nhận xét: ' + (err?.message || 'Không xác định'), 'error');
        }
    });
};

window.deleteLearningComment = async function(commentId) {
    if (!requireEditPermission('xóa nhận xét học tập')) return;

    const comment =
        (APP_STATE.learningComments || [])
            .find(c => String(c.id) === String(commentId));

    if (!comment) {

        showToast(
            'Không tìm thấy nhận xét cần xóa.',
            'error'
        );

        return;
    }

    const confirmed = window.confirm(
        'Bạn có chắc chắn muốn xóa nhận xét học tập này không?'
    );

    if (!confirmed) return;

    try {

        const { error } = await supabase
            .from('app3_learning_comments')
            .delete()
            .eq('id', commentId);

        if (error) {
            throw error;
        }

        APP_STATE.learningComments =
            APP_STATE.learningComments.filter(
                c => String(c.id) !== String(commentId)
            );

        showToast(
            'Đã xóa nhận xét học tập.',
            'success'
        );

        renderPage('learning-comments');

    } catch (err) {

        console.error(
            'Lỗi xóa nhận xét học tập:',
            err
        );

        showToast(
            'Lỗi xóa nhận xét: ' +
            (err?.message || 'Không xác định'),
            'error'
        );
    }
};

// ============================================================
// BƯỚC 151.29 - MODULE AI LÀ TRIỆU PHÚ (BẢN CƠ BẢN, LOCAL)
// Không dùng Supabase. Không ảnh hưởng các module nghiệp vụ.
// ============================================================

const MILLIONAIRE_PRIZES = [
    '200.000', '400.000', '600.000', '1.000.000', '2.000.000',
    '3.000.000', '6.000.000', '10.000.000', '14.000.000', '22.000.000',
    '30.000.000', '40.000.000', '60.000.000', '85.000.000', '150.000.000'
];

const MILLIONAIRE_SYSTEM_SUBJECTS = [
    'Tiếng Việt',
    'Toán',
    'Đạo đức',
    'Tự nhiên và Xã hội',
    'Khoa học',
    'Lịch sử và Địa lí',
    'Ngoại ngữ 1',
    'Âm nhạc',
    'Mĩ thuật',
    'Giáo dục thể chất',
    'Tin học',
    'Công nghệ',
    'Hoạt động trải nghiệm'
];

const MILLIONAIRE_QUESTION_BANK = [
    // ===== KHỐI 1 =====
    { grade:'1', subject:'Toán', topic:'Số học', difficulty:'easy', q:'Số nào lớn hơn: 7 hay 5?', a:['5','6','7','4'], c:2 },
    { grade:'1', subject:'Toán', topic:'Số học', difficulty:'easy', q:'2 + 3 bằng bao nhiêu?', a:['4','5','6','7'], c:1 },
    { grade:'1', subject:'Toán', topic:'Hình học', difficulty:'easy', q:'Hình nào có 3 cạnh?', a:['Hình vuông','Hình tròn','Hình tam giác','Hình chữ nhật'], c:2 },
    { grade:'1', subject:'Tiếng Việt', topic:'Từ và câu', difficulty:'easy', q:'Từ nào chỉ con vật?', a:['Bút','Mèo','Đẹp','Chạy'], c:1 },
    { grade:'1', subject:'Tiếng Việt', topic:'Âm vần', difficulty:'easy', q:'Chữ nào đứng đầu từ “cá”?', a:['c','k','q','g'], c:0 },
    { grade:'1', subject:'Tự nhiên và Xã hội', topic:'Cơ thể', difficulty:'medium', q:'Bộ phận nào giúp em nghe?', a:['Mắt','Tai','Mũi','Tay'], c:1 },
    { grade:'1', subject:'Đạo đức', topic:'Ứng xử', difficulty:'medium', q:'Khi được người khác giúp đỡ, em nên nói gì?', a:['Không cần','Cảm ơn','Đi đi','Im lặng'], c:1 },
    { grade:'1', subject:'Toán', topic:'Số học', difficulty:'medium', q:'Số liền sau của 9 là số nào?', a:['8','9','10','11'], c:2 },
    { grade:'1', subject:'Tiếng Việt', topic:'Từ và câu', difficulty:'medium', q:'Từ nào chỉ hoạt động?', a:['Xanh','Bàn','Chạy','Đẹp'], c:2 },
    { grade:'1', subject:'Tự nhiên và Xã hội', topic:'Gia đình', difficulty:'hard', q:'Người sinh ra bố hoặc mẹ của em thường được gọi là gì?', a:['Bạn','Ông bà','Thầy cô','Hàng xóm'], c:1 },

    // ===== KHỐI 2 =====
    { grade:'2', subject:'Toán', topic:'Số học', difficulty:'easy', q:'9 + 6 bằng bao nhiêu?', a:['13','14','15','16'], c:2 },
    { grade:'2', subject:'Toán', topic:'Đại lượng', difficulty:'easy', q:'1 mét bằng bao nhiêu xăng-ti-mét?', a:['10','100','1000','50'], c:1 },
    { grade:'2', subject:'Tiếng Việt', topic:'Từ và câu', difficulty:'easy', q:'Từ nào dưới đây là từ chỉ đặc điểm?', a:['Chạy','Xanh','Bàn','Mèo'], c:1 },
    { grade:'2', subject:'Tự nhiên và Xã hội', topic:'Môi trường', difficulty:'easy', q:'Cây xanh cần gì để sống?', a:['Ánh sáng','Khói bụi','Rác','Bóng tối hoàn toàn'], c:0 },
    { grade:'2', subject:'Đạo đức', topic:'Ứng xử', difficulty:'medium', q:'Khi làm sai, em nên làm gì?', a:['Đổ lỗi','Xin lỗi và sửa sai','Bỏ đi','Cãi lại'], c:1 },
    { grade:'2', subject:'Toán', topic:'Số học', difficulty:'medium', q:'24 - 9 bằng bao nhiêu?', a:['13','14','15','16'], c:2 },
    { grade:'2', subject:'Tiếng Việt', topic:'Chính tả', difficulty:'medium', q:'Từ nào viết đúng chính tả?', a:['xạch sẽ','sạch sẽ','sạch sẻ','xạch sẻ'], c:1 },
    { grade:'2', subject:'Tự nhiên và Xã hội', topic:'An toàn', difficulty:'medium', q:'Khi qua đường, em nên làm gì trước?', a:['Chạy thật nhanh','Quan sát hai bên','Nhắm mắt','Đi giữa đường'], c:1 },
    { grade:'2', subject:'Toán', topic:'Hình học', difficulty:'hard', q:'Hình chữ nhật có mấy góc vuông?', a:['2','3','4','5'], c:2 },
    { grade:'2', subject:'Tiếng Việt', topic:'Từ và câu', difficulty:'hard', q:'Câu nào là câu hỏi?', a:['Em đi học.','Em đi học à?','Em hãy đi học.','Ôi, vui quá!'], c:1 },

    // ===== KHỐI 3 =====
    { grade:'3', subject:'Toán', topic:'Số học', difficulty:'easy', q:'7 × 8 bằng bao nhiêu?', a:['54','56','58','64'], c:1 },
    { grade:'3', subject:'Toán', topic:'Đại lượng', difficulty:'easy', q:'1 giờ có bao nhiêu phút?', a:['30','45','60','90'], c:2 },
    { grade:'3', subject:'Tiếng Việt', topic:'Từ và câu', difficulty:'easy', q:'Từ nào là từ chỉ hoạt động?', a:['Nhanh','Đọc','Sách','Đỏ'], c:1 },
    { grade:'3', subject:'Tin học', topic:'Máy tính', difficulty:'easy', q:'Thiết bị nào dùng để gõ chữ vào máy tính?', a:['Màn hình','Bàn phím','Loa','Máy in'], c:1 },
    { grade:'3', subject:'Tự nhiên và Xã hội', topic:'Cơ thể', difficulty:'medium', q:'Cơ quan nào bơm máu đi khắp cơ thể?', a:['Phổi','Tim','Dạ dày','Não'], c:1 },
    { grade:'3', subject:'Toán', topic:'Số học', difficulty:'medium', q:'125 + 378 bằng bao nhiêu?', a:['493','503','513','523'], c:1 },
    { grade:'3', subject:'Tiếng Việt', topic:'Từ và câu', difficulty:'medium', q:'Trong câu “Lan chăm chỉ học bài”, từ “chăm chỉ” chỉ gì?', a:['Sự vật','Hoạt động','Đặc điểm','Số lượng'], c:2 },
    { grade:'3', subject:'Tin học', topic:'An toàn số', difficulty:'medium', q:'Mật khẩu tốt nên như thế nào?', a:['Chỉ có tên mình','Dễ đoán','Có chữ, số và ký tự phù hợp','Giống tên lớp'], c:2 },
    { grade:'3', subject:'Toán', topic:'Hình học', difficulty:'hard', q:'Chu vi hình vuông cạnh 6 cm là bao nhiêu?', a:['12 cm','18 cm','24 cm','36 cm'], c:2 },
    { grade:'3', subject:'Tin học', topic:'Tệp và thư mục', difficulty:'hard', q:'Thư mục trong máy tính dùng chủ yếu để làm gì?', a:['Tắt máy','Sắp xếp tệp','Tăng âm lượng','Kết nối điện'], c:1 },

    // ===== KHỐI 4 =====
    { grade:'4', subject:'Toán', topic:'Số học', difficulty:'easy', q:'1 000 × 6 bằng bao nhiêu?', a:['600','6 000','60 000','600 000'], c:1 },
    { grade:'4', subject:'Toán', topic:'Phân số', difficulty:'easy', q:'Trong phân số 3/5, số 3 được gọi là gì?', a:['Mẫu số','Tử số','Thương','Số dư'], c:1 },
    { grade:'4', subject:'Tiếng Việt', topic:'Từ và câu', difficulty:'easy', q:'Từ “dũng cảm” gần nghĩa nhất với từ nào?', a:['Nhút nhát','Can đảm','Lười biếng','Buồn bã'], c:1 },
    { grade:'4', subject:'Khoa học', topic:'Vật chất', difficulty:'easy', q:'Nước có thể tồn tại ở những thể nào?', a:['Chỉ thể lỏng','Rắn, lỏng, khí','Chỉ rắn và lỏng','Chỉ khí'], c:1 },
    { grade:'4', subject:'Tin học', topic:'Soạn thảo', difficulty:'medium', q:'Phím nào thường dùng để xuống dòng khi soạn thảo?', a:['Shift','Enter','Tab','Ctrl'], c:1 },
    { grade:'4', subject:'Toán', topic:'Hình học', difficulty:'medium', q:'Diện tích hình chữ nhật dài 8 cm, rộng 5 cm là bao nhiêu?', a:['13 cm²','26 cm²','40 cm²','80 cm²'], c:2 },
    { grade:'4', subject:'Lịch sử và Địa lý', topic:'Địa lý', difficulty:'medium', q:'Việt Nam nằm ở khu vực nào của châu Á?', a:['Đông Nam Á','Nam Á','Tây Á','Bắc Á'], c:0 },
    { grade:'4', subject:'Tin học', topic:'Internet', difficulty:'medium', q:'Khi gặp nội dung xấu trên Internet, em nên làm gì?', a:['Chia sẻ ngay','Báo người lớn/thầy cô','Bình luận gây gổ','Tải về'], c:1 },
    { grade:'4', subject:'Khoa học', topic:'Năng lượng', difficulty:'hard', q:'Nguồn năng lượng nào sau đây là năng lượng tái tạo?', a:['Than đá','Dầu mỏ','Gió','Khí tự nhiên'], c:2 },
    { grade:'4', subject:'Toán', topic:'Số học', difficulty:'hard', q:'25 × 16 bằng bao nhiêu?', a:['350','375','400','425'], c:2 },

    // ===== KHỐI 5 =====
    { grade:'5', subject:'Toán', topic:'Số thập phân', difficulty:'easy', q:'0,5 bằng phân số nào?', a:['1/2','1/5','5/100','2/5'], c:0 },
    { grade:'5', subject:'Tiếng Việt', topic:'Từ và câu', difficulty:'easy', q:'Từ nào là quan hệ từ?', a:['và','đẹp','chạy','sách'], c:0 },
    { grade:'5', subject:'Khoa học', topic:'Cơ thể', difficulty:'easy', q:'Cơ quan nào điều khiển hoạt động của cơ thể?', a:['Tim','Não','Phổi','Dạ dày'], c:1 },
    { grade:'5', subject:'Tin học', topic:'Máy tính', difficulty:'easy', q:'CPU thường được ví như bộ phận nào của máy tính?', a:['Tai','Bộ não','Mắt','Bàn tay'], c:1 },
    { grade:'5', subject:'Lịch sử và Địa lý', topic:'Lịch sử', difficulty:'medium', q:'Ngày Quốc khánh Việt Nam là ngày nào?', a:['30/4','1/5','2/9','20/11'], c:2 },
    { grade:'5', subject:'Toán', topic:'Tỉ số phần trăm', difficulty:'medium', q:'25% của 200 bằng bao nhiêu?', a:['25','40','50','75'], c:2 },
    { grade:'5', subject:'Tiếng Việt', topic:'Từ và câu', difficulty:'medium', q:'Trong câu “Vì trời mưa nên đường trơn”, cặp từ quan hệ là gì?', a:['trời - đường','mưa - trơn','vì - nên','trời - mưa'], c:2 },
    { grade:'5', subject:'Tin học', topic:'Lập trình', difficulty:'medium', q:'Trong lập trình, lệnh lặp dùng để làm gì?', a:['Lặp lại một nhóm lệnh','Tắt máy','Đổi tên tệp','Xóa màn hình'], c:0 },
    { grade:'5', subject:'Khoa học', topic:'Năng lượng', difficulty:'hard', q:'Thiết bị nào biến điện năng thành cơ năng rõ nhất?', a:['Bóng đèn','Quạt điện','Bàn là','Nồi cơm'], c:1 },
    { grade:'5', subject:'Toán', topic:'Hình học', difficulty:'hard', q:'Thể tích hình hộp chữ nhật dài 5 cm, rộng 4 cm, cao 3 cm là bao nhiêu?', a:['12 cm³','20 cm³','60 cm³','120 cm³'], c:2 },

    // ===== TỔNG HỢP / DÙNG BỔ SUNG =====
    { grade:'all', subject:'Kiến thức chung', topic:'Kiến thức chung', difficulty:'easy', q:'Một tuần có bao nhiêu ngày?', a:['5','6','7','8'], c:2 },
    { grade:'all', subject:'Kiến thức chung', topic:'Kiến thức chung', difficulty:'easy', q:'Màu của lá cây khỏe mạnh thường là màu gì?', a:['Xanh','Đen','Tím','Cam'], c:0 },
    { grade:'all', subject:'Kiến thức chung', topic:'Kiến thức chung', difficulty:'easy', q:'Thiết bị nào hiển thị hình ảnh của máy tính?', a:['Chuột','Màn hình','Bàn phím','Loa'], c:1 },
    { grade:'all', subject:'Kiến thức chung', topic:'Kiến thức chung', difficulty:'medium', q:'Nước sôi ở khoảng bao nhiêu độ C trong điều kiện thông thường?', a:['0°C','50°C','100°C','150°C'], c:2 },
    { grade:'all', subject:'Kiến thức chung', topic:'Kiến thức chung', difficulty:'medium', q:'Hành tinh nào gần Mặt Trời nhất?', a:['Sao Kim','Sao Thủy','Trái Đất','Sao Hỏa'], c:1 },
    { grade:'all', subject:'Kiến thức chung', topic:'Kiến thức chung', difficulty:'medium', q:'Đại dương lớn nhất trên Trái Đất là gì?', a:['Đại Tây Dương','Ấn Độ Dương','Thái Bình Dương','Bắc Băng Dương'], c:2 },
    { grade:'all', subject:'Kiến thức chung', topic:'Kiến thức chung', difficulty:'hard', q:'Châu lục có diện tích lớn nhất thế giới là châu nào?', a:['Châu Á','Châu Âu','Châu Phi','Châu Đại Dương'], c:0 },
    { grade:'all', subject:'Kiến thức chung', topic:'Kiến thức chung', difficulty:'hard', q:'Trong hệ nhị phân, hai chữ số được dùng là gì?', a:['0 và 1','1 và 2','0 và 9','2 và 8'], c:0 },
    { grade:'all', subject:'Kiến thức chung', topic:'Kiến thức chung', difficulty:'hard', q:'Quá trình cây xanh dùng ánh sáng để tạo chất dinh dưỡng gọi là gì?', a:['Hô hấp','Quang hợp','Nảy mầm','Thoát hơi nước'], c:1 }
];


const MILLIONAIRE_CUSTOM_STORAGE_KEY = 'qlhs_millionaire_custom_questions_v1';

// ============================================================
// BƯỚC 151.49.3F.17B.6
// Bộ nhớ đệm ngân hàng câu hỏi dùng chung từ Supabase.
// Giai đoạn này chỉ bổ sung nền tảng, chưa thay localStorage.
// ============================================================
let MILLIONAIRE_SUPABASE_QUESTIONS = [];
let millionaireSupabaseQuestionsLoaded = false;

function mapMillionaireQuestionFromSupabase(row) {
    const correctMap = {
        A: 0,
        B: 1,
        C: 2,
        D: 3
    };

    return normalizeMillionaireQuestionInput({
        id: row.id,
        grade: row.grade || 'all',
        subject: row.subject || '',
        topic: row.topic || '',
        difficulty: row.difficulty || 'easy',
        q: row.question || '',
        a: [
            row.answer_a || '',
            row.answer_b || '',
            row.answer_c || '',
            row.answer_d || ''
        ],
        c: correctMap[String(row.correct_answer || 'A').toUpperCase()] ?? 0,
        createdBy: row.created_by || null
    });
}

async function loadMillionaireQuestionsFromSupabase() {
    try {
        const { data, error } = await supabase
            .from('app3_millionaire_questions')
            .select(`
                id,
                grade,
                subject,
                topic,
                difficulty,
                question,
                answer_a,
                answer_b,
                answer_c,
                answer_d,
                correct_answer,
                active,
                created_by,
                created_at
            `)
            .eq('active', true)
            .order('created_at', { ascending: true });

        if (error) throw error;

        MILLIONAIRE_SUPABASE_QUESTIONS =
            (data || []).map(mapMillionaireQuestionFromSupabase);

        millionaireSupabaseQuestionsLoaded = true;

        console.log(
            `[151.49.3F.17B.6] Đã tải ${MILLIONAIRE_SUPABASE_QUESTIONS.length} câu hỏi từ Supabase.`
        );

        return MILLIONAIRE_SUPABASE_QUESTIONS;

    } catch (error) {
        console.error(
            '[151.49.3F.17B.6] Không tải được câu hỏi Supabase:',
            error
        );

        millionaireSupabaseQuestionsLoaded = false;
        return [];
    }
}
window.loadMillionaireQuestionsFromSupabase = loadMillionaireQuestionsFromSupabase;


// BƯỚC 151.49.3F.17B.10A:
// Công cụ phục hồi MỘT LẦN cho các câu đã được lưu local trước khi Nhập Excel/Dán AI
// được chuyển sang Supabase. Không tự chạy để tránh khôi phục nhầm câu người dùng đã xóa.
async function syncMillionaireMissingLocalToSupabase() {
    const localItems = loadMillionaireCustomQuestions();
    const remoteItems = millionaireSupabaseQuestionsLoaded
        ? [...MILLIONAIRE_SUPABASE_QUESTIONS]
        : await loadMillionaireQuestionsFromSupabase();

    const remoteKeys = new Set(remoteItems.map(makeMillionaireDuplicateKey));
    const defaultKeys = new Set(MILLIONAIRE_QUESTION_BANK.map(makeMillionaireDuplicateKey));
    const missing = [];

    for (const item of localItems) {
        const normalized = normalizeMillionaireQuestionInput(item);
        const key = makeMillionaireDuplicateKey(normalized);
        if (!key || remoteKeys.has(key) || defaultKeys.has(key)) continue;
        remoteKeys.add(key);
        missing.push(normalized);
    }

    if (!missing.length) {
        console.log('[151.49.3F.17B.10A] Không có câu local nào thiếu trên Supabase.');
        return { local: localItems.length, remote: remoteItems.length, added: 0 };
    }

    const { error } = await supabase
        .from('app3_millionaire_questions')
        .insert(missing.map(mapMillionaireQuestionToSupabase));
    if (error) throw error;

    await loadMillionaireQuestionsFromSupabase();
    saveMillionaireCustomQuestions(MILLIONAIRE_SUPABASE_QUESTIONS);
    refreshMillionaire();

    console.log(
        `[151.49.3F.17B.10A] Đã phục hồi ${missing.length} câu local còn thiếu lên Supabase. Tổng Supabase: ${MILLIONAIRE_SUPABASE_QUESTIONS.length}.`
    );
    return {
        local: localItems.length,
        remoteBefore: remoteItems.length,
        added: missing.length,
        remoteAfter: MILLIONAIRE_SUPABASE_QUESTIONS.length
    };
}

window.syncMillionaireMissingLocalToSupabase = syncMillionaireMissingLocalToSupabase;
function loadMillionaireCustomQuestions() {
    try {
        const raw = localStorage.getItem(MILLIONAIRE_CUSTOM_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch (err) {
        console.warn('Không đọc được ngân hàng câu hỏi local:', err);
        return [];
    }
}

function saveMillionaireCustomQuestions(items) {
    localStorage.setItem(MILLIONAIRE_CUSTOM_STORAGE_KEY, JSON.stringify(items || []));
}

// ============================================================
// BƯỚC 151.49.3F.17B.9
// Chuyển một câu hỏi trong giao diện sang cấu trúc bảng Supabase.
// Chỉ dùng cho thao tác Thêm / Sửa; các thao tác khác chưa thay đổi ở bước này.
// ============================================================
function mapMillionaireQuestionToSupabase(item) {
    const correctAnswer = ['A', 'B', 'C', 'D'][Number(item?.c)] || 'A';

    return {
        grade: String(item?.grade || 'all'),
        subject: String(item?.subject || '').trim(),
        topic: String(item?.topic || '').trim(),
        difficulty: ['easy', 'medium', 'hard'].includes(item?.difficulty) ? item.difficulty : 'easy',
        question: String(item?.q || '').trim(),
        answer_a: String(item?.a?.[0] || '').trim(),
        answer_b: String(item?.a?.[1] || '').trim(),
        answer_c: String(item?.a?.[2] || '').trim(),
        answer_d: String(item?.a?.[3] || '').trim(),
        correct_answer: correctAnswer,
        active: true,
        updated_at: new Date().toISOString()
    };
}

function getAllMillionaireQuestions() {
    return [...MILLIONAIRE_QUESTION_BANK, ...loadMillionaireCustomQuestions()];
}

function makeMillionaireQuestionId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `mq_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeMillionaireQuestionInput(item) {
    const answers = Array.isArray(item?.a) ? item.a.map(v => String(v ?? '').trim()).slice(0, 4) : [];
    while (answers.length < 4) answers.push('');

    return {
        id: item?.id || makeMillionaireQuestionId(),
        grade: String(item?.grade || 'all'),
        subject: String(item?.subject || '').trim(),
        topic: String(item?.topic || '').trim(),
        difficulty: ['easy','medium','hard'].includes(item?.difficulty) ? item.difficulty : 'easy',
        q: String(item?.q || '').trim(),
        a: answers,
        c: Number.isInteger(Number(item?.c)) ? Number(item.c) : 0,
        createdBy: item?.createdBy || item?.created_by || null,
        custom: true
    };
}

function validateMillionaireQuestion(item) {
    if (!item.q) return 'Vui lòng nhập nội dung câu hỏi.';
    if (!item.subject) return 'Vui lòng nhập môn học.';
    if (!item.topic) return 'Vui lòng nhập chủ đề.';
    if (!Array.isArray(item.a) || item.a.length !== 4 || item.a.some(v => !String(v).trim())) {
        return 'Vui lòng nhập đủ 4 đáp án.';
    }
    if (![0,1,2,3].includes(Number(item.c))) return 'Vui lòng chọn đáp án đúng.';
    return '';
}

const MILLIONAIRE_QUESTIONS = MILLIONAIRE_QUESTION_BANK
    .filter(q => q.grade === 'all' || q.grade === '5')
    .slice(0, 15)
    .map(q => ({ q:q.q, a:[...q.a], c:q.c }));

const MILLIONAIRE_SWITCH_QUESTIONS = [
    { q: 'Loài vật nào là biểu tượng của hòa bình?', a: ['Đại bàng', 'Bồ câu', 'Chim sẻ', 'Công'], c: 1 },
    { q: '10 dm bằng bao nhiêu mét?', a: ['0,1 m', '1 m', '10 m', '100 m'], c: 1 },
    { q: 'Phím nào thường dùng để xuống dòng khi soạn thảo văn bản?', a: ['Shift', 'Ctrl', 'Enter', 'Alt'], c: 2 },
    { q: 'Đại dương lớn nhất trên Trái Đất là đại dương nào?', a: ['Ấn Độ Dương', 'Đại Tây Dương', 'Bắc Băng Dương', 'Thái Bình Dương'], c: 3 },
    { q: 'Số La Mã X có giá trị bằng bao nhiêu?', a: ['5', '10', '50', '100'], c: 1 }
];

const MILLIONAIRE_STATE = {
    started: false,
    ended: false,
    level: 0,
    correctCount: 0,
    locked: false,
    questions: [],
    usedSwitchIndexes: [],
    lifelines: { fifty: true, audience: true, switch: true },
    hiddenAnswers: [],
    selectedIndex: null,
    audienceResult: null,
    phase: 'idle',
    soundEnabled: true,
    mcEnabled: true,
    selectedGrade: 'all',
    selectedSubject: 'all',
    selectedTopic: 'all',
    questionSource: 'custom',
    bankInfo: null,
    playMode: 'stop_on_wrong',
    wrongAttempts: [],
    timerEnabled: false,
    timerSoundEnabled: true,
    timerSeconds: 30,
    timerRemaining: 30,
    timerIntervalId: null,
    selectedQuestionIds: [],
    managerOpen: false,
    editingQuestionId: null,
    managerFilter: '',
    message: 'Chọn bộ câu hỏi rồi nhấn “Bắt đầu”.'
};

function resetMillionaireState() {
    MILLIONAIRE_STATE.started = false;
    MILLIONAIRE_STATE.ended = false;
    MILLIONAIRE_STATE.level = 0;
    MILLIONAIRE_STATE.correctCount = 0;
    MILLIONAIRE_STATE.locked = false;
    MILLIONAIRE_STATE.questions = MILLIONAIRE_QUESTIONS.map(item => ({
        ...item,
        a: [...item.a]
    }));
    MILLIONAIRE_STATE.usedSwitchIndexes = [];
    MILLIONAIRE_STATE.lifelines = { fifty: true, audience: true, switch: true };
    MILLIONAIRE_STATE.hiddenAnswers = [];
    MILLIONAIRE_STATE.selectedIndex = null;
    MILLIONAIRE_STATE.audienceResult = null;
    MILLIONAIRE_STATE.phase = 'idle';
    MILLIONAIRE_STATE.soundEnabled = MILLIONAIRE_STATE.soundEnabled !== false;
    MILLIONAIRE_STATE.mcEnabled = MILLIONAIRE_STATE.mcEnabled !== false;
    MILLIONAIRE_STATE.selectedGrade = MILLIONAIRE_STATE.selectedGrade || 'all';
    MILLIONAIRE_STATE.selectedSubject = MILLIONAIRE_STATE.selectedSubject || 'all';
    MILLIONAIRE_STATE.selectedTopic = MILLIONAIRE_STATE.selectedTopic || 'all';
    MILLIONAIRE_STATE.questionSource = ['custom','default'].includes(MILLIONAIRE_STATE.questionSource) ? MILLIONAIRE_STATE.questionSource : 'custom';
    MILLIONAIRE_STATE.bankInfo = null;
    MILLIONAIRE_STATE.playMode = MILLIONAIRE_STATE.playMode || 'stop_on_wrong';
    MILLIONAIRE_STATE.wrongAttempts = [];
    MILLIONAIRE_STATE.selectedQuestionIds = [];
    MILLIONAIRE_STATE.managerOpen = false;
    MILLIONAIRE_STATE.editingQuestionId = null;
    MILLIONAIRE_STATE.managerFilter = '';
    MILLIONAIRE_STATE.message = 'Chọn bộ câu hỏi rồi nhấn “Bắt đầu”.';
}


function shuffleMillionaireArray(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

// ============================================================
// BƯỚC 151.49.3F.19 - HẠN CHẾ LẶP CÂU GIỮA CÁC VÁN
// Lịch sử chỉ là trạng thái chơi nên lưu localStorage trên từng thiết bị,
// hoàn toàn không sửa/xóa dữ liệu ngân hàng câu hỏi trên Supabase.
// ============================================================
function millionaireQuestionHistoryKey(item, source = MILLIONAIRE_STATE.questionSource || 'custom') {
    const normalizedSource = source === 'default' ? 'default' : 'custom';
    const id = String(item?.id || '').trim();
    if (id) return `${normalizedSource}|id:${id}`;

    // Bộ câu hỏi mẫu không có UUID: dùng nội dung ổn định làm khóa dự phòng.
    return [
        normalizedSource,
        String(item?.grade || '').trim(),
        String(item?.subject || '').trim(),
        String(item?.topic || '').trim(),
        String(item?.difficulty || '').trim(),
        String(item?.q || '').trim()
    ].join('|');
}

function loadMillionaireQuestionHistory() {
    try {
        const raw = localStorage.getItem(GAME_STATE_STORAGE_KEYS.millionaireQuestionHistory);
        const parsed = raw ? JSON.parse(raw) : [];
        return new Set(Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : []);
    } catch (err) {
        console.warn('[151.49.3F.19] Không đọc được lịch sử câu hỏi:', err);
        return new Set();
    }
}

function saveMillionaireQuestionHistory(historySet) {
    try {
        localStorage.setItem(
            GAME_STATE_STORAGE_KEYS.millionaireQuestionHistory,
            JSON.stringify([...historySet])
        );
    } catch (err) {
        console.warn('[151.49.3F.19] Không lưu được lịch sử câu hỏi:', err);
    }
}

function markMillionaireQuestionsUsed(items, source = MILLIONAIRE_STATE.questionSource || 'custom') {
    if (!Array.isArray(items) || !items.length) return;
    const history = loadMillionaireQuestionHistory();
    items.forEach(item => history.add(millionaireQuestionHistoryKey(item, item?.source || source)));
    saveMillionaireQuestionHistory(history);
}

function millionaireGetHistoryStatsForCurrentSelection() {
    const state = MILLIONAIRE_STATE;
    const grade = state.selectedGrade || 'all';
    const subject = state.selectedSubject || 'all';
    const topic = state.selectedTopic || 'all';
    const source = state.questionSource || 'custom';
    const history = loadMillionaireQuestionHistory();
    const exact = getMillionaireQuestionsBySource(source).filter(item => {
        const gradeOk = grade === 'all' || item.grade === grade;
        const subjectOk = subject === 'all' || item.subject === subject;
        const topicOk = topic === 'all' || item.topic === topic;
        return gradeOk && subjectOk && topicOk;
    });
    const used = exact.filter(item => history.has(millionaireQuestionHistoryKey(item, source))).length;
    return { total: exact.length, used, unused: Math.max(0, exact.length - used) };
}

function millionaireResetQuestionHistory() {
    const stats = millionaireGetHistoryStatsForCurrentSelection();
    if (!confirm(`Đặt lại lịch sử câu hỏi đã chơi trên thiết bị này?\n\nHiện bộ lọc đang chọn có ${stats.used}/${stats.total} câu đã được ghi nhận.\nNgân hàng câu hỏi trên Supabase sẽ không bị xóa hoặc thay đổi.`)) {
        return;
    }
    try {
        localStorage.removeItem(GAME_STATE_STORAGE_KEYS.millionaireQuestionHistory);
    } catch (err) {}
    MILLIONAIRE_STATE.message = 'Đã đặt lại lịch sử câu hỏi. Tất cả câu có thể được chọn lại từ đầu.';
    refreshMillionaire();
}

function millionaireSelectSmartByDifficulty(pool, targetCount) {
    const target = Math.min(Math.max(0, Number(targetCount) || 0), pool.length);
    if (!target) return [];

    const byDifficulty = {
        easy: shuffleMillionaireArray(pool.filter(x => x.difficulty === 'easy')),
        medium: shuffleMillionaireArray(pool.filter(x => x.difficulty === 'medium')),
        hard: shuffleMillionaireArray(pool.filter(x => x.difficulty === 'hard'))
    };
    const difficultyOrder = ['easy', 'medium', 'hard'];
    const desiredCounts = {
        easy: Math.ceil(target / 3),
        medium: Math.floor(target / 3),
        hard: target - Math.ceil(target / 3) - Math.floor(target / 3)
    };
    const selectedByDifficulty = { easy: [], medium: [], hard: [] };

    difficultyOrder.forEach(level => {
        const take = Math.min(desiredCounts[level], byDifficulty[level].length);
        selectedByDifficulty[level].push(...byDifficulty[level].splice(0, take));
    });

    let remaining = target - difficultyOrder.reduce(
        (sum, level) => sum + selectedByDifficulty[level].length, 0
    );
    while (remaining > 0) {
        const availableLevels = difficultyOrder
            .filter(level => byDifficulty[level].length > 0)
            .sort((a, b) => byDifficulty[b].length - byDifficulty[a].length);
        if (!availableLevels.length) break;
        for (const level of availableLevels) {
            if (remaining <= 0) break;
            if (byDifficulty[level].length) {
                selectedByDifficulty[level].push(byDifficulty[level].shift());
                remaining--;
            }
        }
    }

    return [
        ...selectedByDifficulty.easy,
        ...selectedByDifficulty.medium,
        ...selectedByDifficulty.hard
    ];
}

function getMillionaireSubjectsForGrade(grade) {
    // BƯỚC 151.40: luôn hiển thị đúng 13 môn của hệ thống,
    // không suy ra danh sách môn từ số câu hỏi đang có.
    return [...MILLIONAIRE_SYSTEM_SUBJECTS];
}

function getMillionaireQuestionsBySource(source = MILLIONAIRE_STATE.questionSource || 'custom') {
    // Câu hỏi mặc định vẫn lấy từ mã nguồn như cũ.
    if (source === 'default') {
        return [...MILLIONAIRE_QUESTION_BANK];
    }

    // BƯỚC 151.49.3F.17B.8:
    // Khi Supabase đã tải xong, dùng ngân hàng dùng chung.
    if (millionaireSupabaseQuestionsLoaded) {
        return [...MILLIONAIRE_SUPABASE_QUESTIONS];
    }

    // Trong lúc Supabase chưa tải xong hoặc gặp lỗi,
    // tạm dùng localStorage để không làm gián đoạn trò chơi.
    return loadMillionaireCustomQuestions();
}

function millionaireSetQuestionSource(value) {
    MILLIONAIRE_STATE.questionSource = value === 'default' ? 'default' : 'custom';
    MILLIONAIRE_STATE.selectedTopic = 'all';
    MILLIONAIRE_STATE.bankInfo = null;
    refreshMillionaire();
}

function getMillionaireTopicsForSelection(grade, subject) {
    const values = new Set();

    getMillionaireQuestionsBySource().forEach(item => {
        // Lọc tuyệt đối theo khối/môn đã chọn. Không kéo "Tổng hợp" vào môn cụ thể.
        const gradeOk = grade === 'all' || item.grade === grade;
        const subjectOk = subject === 'all' || item.subject === subject;
        if (gradeOk && subjectOk && item.topic) values.add(item.topic);
    });

    return [...values].sort((a,b) => a.localeCompare(b, 'vi'));
}

function millionaireSetGrade(value) {
    MILLIONAIRE_STATE.selectedGrade = value || 'all';
    MILLIONAIRE_STATE.selectedSubject = 'all';
    MILLIONAIRE_STATE.selectedTopic = 'all';
    refreshMillionaire();
}

function millionaireSetSubject(value) {
    MILLIONAIRE_STATE.selectedSubject = value || 'all';
    MILLIONAIRE_STATE.selectedTopic = 'all';
    refreshMillionaire();
}

function millionaireSetTopic(value) {
    MILLIONAIRE_STATE.selectedTopic = value || 'all';
    refreshMillionaire();
}

function createMillionaireQuestionSet() {
    const state = MILLIONAIRE_STATE;
    const grade = state.selectedGrade || 'all';
    const subject = state.selectedSubject || 'all';
    const topic = state.selectedTopic || 'all';

    const questionSource = state.questionSource || 'custom';
    const allQuestions = getMillionaireQuestionsBySource(questionSource);
    const exact = allQuestions.filter(item => {
        const gradeOk = grade === 'all' || item.grade === grade;
        const subjectOk = subject === 'all' || item.subject === subject;
        const topicOk = topic === 'all' || item.topic === topic;
        return gradeOk && subjectOk && topicOk;
    });

    // BƯỚC 151.49.3F.19:
    // 1) Ưu tiên tuyệt đối các câu chưa xuất hiện ở những ván trước trên thiết bị này.
    // 2) Chỉ lấy lại câu cũ khi số câu chưa chơi không đủ cho ván hiện tại.
    // 3) Trong mỗi nhóm vẫn giữ lộ trình Dễ -> Trung bình -> Khó của BƯỚC 18.
    const targetCount = Math.min(15, exact.length);
    const history = loadMillionaireQuestionHistory();
    const unused = exact.filter(item => !history.has(millionaireQuestionHistoryKey(item, questionSource)));
    const used = exact.filter(item => history.has(millionaireQuestionHistoryKey(item, questionSource)));

    let selected = [];
    let reusedCount = 0;

    if (unused.length >= targetCount) {
        selected = millionaireSelectSmartByDifficulty(unused, targetCount);
    } else {
        // Chọn hết các câu chưa chơi trước.
        const freshSelected = millionaireSelectSmartByDifficulty(unused, unused.length);
        const needOld = targetCount - freshSelected.length;
        const oldSelected = millionaireSelectSmartByDifficulty(used, needOld);
        reusedCount = oldSelected.length;

        // Gộp rồi sắp lại theo độ khó để tiến trình câu hỏi vẫn tăng dần.
        const combined = [...freshSelected, ...oldSelected];
        selected = [
            ...shuffleMillionaireArray(combined.filter(x => x.difficulty === 'easy')),
            ...shuffleMillionaireArray(combined.filter(x => x.difficulty === 'medium')),
            ...shuffleMillionaireArray(combined.filter(x => x.difficulty === 'hard'))
        ];
    }

    state.bankInfo = {
        exactCount: exact.length,
        selectedCount: selected.length,
        grade,
        subject,
        topic,
        strictFilter: true,
        questionSource,
        counts: {
            easy: exact.filter(x => x.difficulty === 'easy').length,
            medium: exact.filter(x => x.difficulty === 'medium').length,
            hard: exact.filter(x => x.difficulty === 'hard').length
        },
        selectedCounts: {
            easy: selected.filter(x => x.difficulty === 'easy').length,
            medium: selected.filter(x => x.difficulty === 'medium').length,
            hard: selected.filter(x => x.difficulty === 'hard').length
        },
        history: {
            usedBefore: used.length,
            unusedBefore: unused.length,
            freshSelected: selected.length - reusedCount,
            reusedSelected: reusedCount
        }
    };

    return selected.map(item => ({
        q: item.q,
        a: [...item.a],
        c: item.c,
        difficulty: item.difficulty,
        grade: item.grade,
        subject: item.subject,
        topic: item.topic,
        id: item.id || null,
        source: questionSource
    }));
}
// ============================================================
// BƯỚC 151.49.3F.20E
// Đồng bộ giao diện Quản lý câu hỏi với RLS Supabase.
// Admin: quản lý mọi câu. Teacher: tạo câu mới và chỉ quản lý câu của mình.
// Viewer: chỉ xem/xuất, không hiển thị thao tác ghi dữ liệu.
// ============================================================
function millionaireCanCreateQuestion() {
    return isAdmin() || isTeacher();
}

function millionaireCanManageQuestion(item) {
    if (isAdmin()) return true;
    if (!isTeacher()) return false;
    return !!item?.createdBy && item.createdBy === APP_STATE.currentUserId;
}

function millionaireOpenQuestionManager() {
    MILLIONAIRE_STATE.managerOpen = true;
    MILLIONAIRE_STATE.editingQuestionId = null;
    refreshMillionaire();
}

function millionaireCloseQuestionManager() {
    MILLIONAIRE_STATE.managerOpen = false;
    MILLIONAIRE_STATE.editingQuestionId = null;
    refreshMillionaire();
}

function millionaireEditQuestion(id) {
    const item = getMillionaireQuestionsBySource('custom').find(q => q.id === id);
    if (!item || !millionaireCanManageQuestion(item)) {
        alert('Bạn chỉ có thể sửa câu hỏi do chính mình tạo.');
        return;
    }
    MILLIONAIRE_STATE.managerOpen = true;
    MILLIONAIRE_STATE.editingQuestionId = id;
    refreshMillionaire();
}

// ============================================================
// BƯỚC 151.49.3F.17B.10
// Xóa 1 câu hỏi trực tiếp trên Supabase để mọi thiết bị đồng bộ.
// Chỉ xóa câu hỏi tự thêm; ngân hàng mặc định trong mã nguồn không bị tác động.
// ============================================================
async function millionaireDeleteQuestion(id) {
    const items = getMillionaireQuestionsBySource('custom');
    const target = items.find(q => q.id === id);
    if (!target) return;
    if (!millionaireCanManageQuestion(target)) {
        alert('Bạn không có quyền xóa câu hỏi này.');
        return;
    }

    if (!confirm(`Xóa câu hỏi:\n${target.q}\n\nCâu hỏi sẽ bị xóa khỏi ngân hàng dùng chung trên mọi thiết bị.`)) return;

    try {
        const { data, error } = await supabase
            .from('app3_millionaire_questions')
            .delete()
            .eq('id', id)
            .select('id');

        if (error) throw error;
        if (!Array.isArray(data) || !data.length) {
            throw new Error('Không tìm thấy câu hỏi trên Supabase hoặc bạn không có quyền xóa.');
        }

        MILLIONAIRE_SUPABASE_QUESTIONS = MILLIONAIRE_SUPABASE_QUESTIONS.filter(q => q.id !== id);
        millionaireSupabaseQuestionsLoaded = true;
        MILLIONAIRE_STATE.selectedQuestionIds = (MILLIONAIRE_STATE.selectedQuestionIds || []).filter(qid => qid !== id);

        if (MILLIONAIRE_STATE.editingQuestionId === id) {
            MILLIONAIRE_STATE.editingQuestionId = null;
        }

        MILLIONAIRE_STATE.message = 'Đã xóa câu hỏi khỏi Supabase.';
        refreshMillionaire();
        console.log('[151.49.3F.17B.10] Đã xóa câu hỏi trên Supabase:', id);
    } catch (error) {
        console.error('[151.49.3F.17B.10] Lỗi xóa câu hỏi trên Supabase:', error);
        alert(
            'Không thể xóa câu hỏi trên Supabase. Câu hỏi hiện tại vẫn được giữ nguyên.\n\n' +
            (error?.message || String(error))
        );
    }
}

async function millionaireSaveQuestion() {
    if (!millionaireCanCreateQuestion()) {
        alert('Tài khoản chỉ xem không có quyền thêm hoặc sửa câu hỏi.');
        return;
    }
    const get = id => document.getElementById(id);
    const existingId = MILLIONAIRE_STATE.editingQuestionId;
    if (existingId) {
        const existingItem = getMillionaireQuestionsBySource('custom').find(q => q.id === existingId);
        if (!existingItem || !millionaireCanManageQuestion(existingItem)) {
            alert('Bạn chỉ có thể sửa câu hỏi do chính mình tạo.');
            return;
        }
    }

    const item = normalizeMillionaireQuestionInput({
        id: existingId || undefined,
        grade: get('mqGrade')?.value || 'all',
        subject: get('mqSubject')?.value || '',
        topic: get('mqTopic')?.value || '',
        difficulty: get('mqDifficulty')?.value || 'easy',
        q: get('mqQuestion')?.value || '',
        a: [
            get('mqA0')?.value || '',
            get('mqA1')?.value || '',
            get('mqA2')?.value || '',
            get('mqA3')?.value || ''
        ],
        c: Number(get('mqCorrect')?.value ?? 0)
    });

    const validationError = validateMillionaireQuestion(item);
    if (validationError) {
        alert(validationError);
        return;
    }

    try {
        const row = mapMillionaireQuestionToSupabase(item);
        let savedRow = null;

        if (existingId) {
            // SỬA: cập nhật đúng câu hỏi đang có trên Supabase.
            const { data, error } = await supabase
                .from('app3_millionaire_questions')
                .update(row)
                .eq('id', existingId)
                .select()
                .single();

            if (error) throw error;
            savedRow = data;
        } else {
            // THÊM: để Supabase tự tạo UUID cho câu hỏi mới.
            const { data, error } = await supabase
                .from('app3_millionaire_questions')
                .insert(row)
                .select()
                .single();

            if (error) throw error;
            savedRow = data;
        }

        const savedItem = mapMillionaireQuestionFromSupabase(savedRow);

        // Cập nhật ngay bộ nhớ đệm để giao diện không cần chờ tải lại trang.
        if (existingId) {
            const idx = MILLIONAIRE_SUPABASE_QUESTIONS.findIndex(q => q.id === existingId);
            if (idx >= 0) MILLIONAIRE_SUPABASE_QUESTIONS[idx] = savedItem;
            else MILLIONAIRE_SUPABASE_QUESTIONS.push(savedItem);
        } else {
            MILLIONAIRE_SUPABASE_QUESTIONS.push(savedItem);
        }
        millionaireSupabaseQuestionsLoaded = true;

        MILLIONAIRE_STATE.editingQuestionId = null;
        MILLIONAIRE_STATE.message = existingId
            ? 'Đã cập nhật câu hỏi trên Supabase.'
            : 'Đã thêm câu hỏi mới lên Supabase.';

        refreshMillionaire();
        console.log(
            `[151.49.3F.17B.9] ${existingId ? 'Đã cập nhật' : 'Đã thêm'} câu hỏi trên Supabase:`,
            savedItem.id
        );
    } catch (error) {
        console.error('[151.49.3F.17B.9] Lỗi lưu câu hỏi lên Supabase:', error);
        alert(
            'Không thể lưu câu hỏi lên Supabase. Dữ liệu cũ vẫn được giữ nguyên.\n\n' +
            (error?.message || String(error))
        );
    }
}

function millionaireResetQuestionForm() {
    MILLIONAIRE_STATE.editingQuestionId = null;
    refreshMillionaire();
}


function normalizeMillionaireExcelHeader(value) {
    return String(value ?? '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/\s+/g, ' ');
}

function normalizeMillionaireDifficulty(value) {
    const v = normalizeMillionaireExcelHeader(value);
    if (['de', 'easy', '1', 'nhan biet'].includes(v)) return 'easy';
    if (['trung binh', 'medium', 'tb', '2', 'thong hieu'].includes(v)) return 'medium';
    if (['kho', 'hard', '3', 'van dung', 'van dung cao'].includes(v)) return 'hard';
    return '';
}

function normalizeMillionaireCorrectAnswer(value) {
    const v = String(value ?? '').trim().toUpperCase();
    if (['A','1','0'].includes(v)) return 0;
    if (['B','2'].includes(v)) return 1;
    if (['C','3'].includes(v)) return 2;
    if (['D','4'].includes(v)) return 3;
    return -1;
}

function normalizeMillionaireGrade(value) {
    const raw = String(value ?? '').trim();
    const normalized = normalizeMillionaireExcelHeader(raw);
    if (!raw || ['tat ca', 'all', '*'].includes(normalized)) return 'all';
    const m = raw.match(/[1-5]/);
    return m ? m[0] : '';
}

function makeMillionaireDuplicateKey(item) {
    return [
        String(item.grade || '').trim().toLowerCase(),
        String(item.subject || '').trim().toLowerCase(),
        String(item.q || '').trim().toLowerCase().replace(/\s+/g, ' ')
    ].join('|');
}

function millionaireDownloadExcelTemplate() {
    if (typeof XLSX === 'undefined') {
        alert('Thư viện Excel chưa sẵn sàng.');
        return;
    }

    const rows = [
        ['Khối', 'Môn', 'Chủ đề', 'Mức độ', 'Câu hỏi', 'A', 'B', 'C', 'D', 'Đáp án đúng'],
        ['5', 'Tin học', 'Internet', 'Dễ', 'Thiết bị nào dùng để nhập dữ liệu vào máy tính?', 'Màn hình', 'Bàn phím', 'Loa', 'Máy in', 'B'],
        ['4', 'Toán', 'Hình học', 'Trung bình', 'Hình vuông có mấy cạnh bằng nhau?', '2', '3', '4', '5', 'C'],
        ['all', 'Tổng hợp', 'Kiến thức chung', 'Khó', 'Ví dụ câu hỏi tổng hợp?', 'Đáp án A', 'Đáp án B', 'Đáp án C', 'Đáp án D', 'A']
    ];

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
        { wch: 10 }, { wch: 18 }, { wch: 22 }, { wch: 14 }, { wch: 55 },
        { wch: 24 }, { wch: 24 }, { wch: 24 }, { wch: 24 }, { wch: 14 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cau hoi');
    XLSX.writeFile(wb, 'MAU_NGAN_HANG_CAU_HOI_AI_LA_TRIEU_PHU.xlsx');
}

function millionairePickExcelFile() {
    let input = document.getElementById('millionaireExcelImportInput');
    if (!input) {
        input = document.createElement('input');
        input.type = 'file';
        input.id = 'millionaireExcelImportInput';
        input.accept = '.xlsx,.xls';
        input.style.display = 'none';
        input.addEventListener('change', millionaireImportExcelQuestions);
        document.body.appendChild(input);
    }
    input.value = '';
    input.click();
}

async function millionaireImportExcelQuestions(event) {
    const file = event?.target?.files?.[0];
    if (!file) return;

    try {
        if (typeof XLSX === 'undefined') {
            throw new Error('Thư viện Excel chưa sẵn sàng.');
        }

        const data = new Uint8Array(await file.arrayBuffer());
        const wb = XLSX.read(data, { type: 'array', cellDates: false });
        const sheetName = wb.SheetNames[0];
        if (!sheetName) throw new Error('File Excel không có sheet dữ liệu.');

        const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
            header: 1,
            defval: '',
            raw: false
        });

        if (!rows.length) throw new Error('File Excel không có dữ liệu.');

        const headerIndex = rows.findIndex(row => {
            const normalized = row.map(normalizeMillionaireExcelHeader);
            return normalized.includes('cau hoi') &&
                   normalized.includes('a') &&
                   normalized.includes('b') &&
                   normalized.includes('c') &&
                   normalized.includes('d');
        });

        if (headerIndex < 0) {
            throw new Error('Không tìm thấy hàng tiêu đề đúng mẫu.');
        }

        const header = rows[headerIndex].map(normalizeMillionaireExcelHeader);
        const findCol = (...names) => {
            const candidates = names.map(normalizeMillionaireExcelHeader);
            return header.findIndex(h => candidates.includes(h));
        };

        const cols = {
            grade: findCol('Khối', 'Khoi'),
            subject: findCol('Môn', 'Mon', 'Môn học', 'Mon hoc'),
            topic: findCol('Chủ đề', 'Chu de'),
            difficulty: findCol('Mức độ', 'Muc do'),
            q: findCol('Câu hỏi', 'Cau hoi'),
            a0: findCol('A'),
            a1: findCol('B'),
            a2: findCol('C'),
            a3: findCol('D'),
            correct: findCol('Đáp án đúng', 'Dap an dung', 'Đáp án', 'Dap an')
        };

        const required = Object.entries(cols).filter(([,idx]) => idx < 0);
        if (required.length) {
            throw new Error('Thiếu cột bắt buộc trong file Excel.');
        }

        // BƯỚC 151.49.3F.17B.10A:
        // Nhập Excel phải đối chiếu và ghi trực tiếp với ngân hàng Supabase dùng chung.
        // Không dùng localStorage làm nguồn chính nữa, nếu không thiết bị khác sẽ không thấy câu vừa nhập.
        const custom = millionaireSupabaseQuestionsLoaded
            ? [...MILLIONAIRE_SUPABASE_QUESTIONS]
            : await loadMillionaireQuestionsFromSupabase();
        const defaultQuestions = MILLIONAIRE_QUESTION_BANK;

        const defaultKeys = new Set(defaultQuestions.map(makeMillionaireDuplicateKey));
        const workingCustom = custom.map(item => ({ ...item, a: Array.isArray(item.a) ? [...item.a] : [] }));
        const customIndexByKey = new Map();
        workingCustom.forEach((item, index) => customIndexByKey.set(makeMillionaireDuplicateKey(item), index));

        const imported = [];
        const updatedItems = [];
        const errors = [];
        let duplicates = 0;

        for (let r = headerIndex + 1; r < rows.length; r++) {
            const row = rows[r] || [];
            if (row.every(v => String(v ?? '').trim() === '')) continue;

            const item = normalizeMillionaireQuestionInput({
                grade: normalizeMillionaireGrade(row[cols.grade]),
                subject: String(row[cols.subject] ?? '').trim(),
                topic: String(row[cols.topic] ?? '').trim(),
                difficulty: normalizeMillionaireDifficulty(row[cols.difficulty]),
                q: String(row[cols.q] ?? '').trim(),
                a: [
                    String(row[cols.a0] ?? '').trim(),
                    String(row[cols.a1] ?? '').trim(),
                    String(row[cols.a2] ?? '').trim(),
                    String(row[cols.a3] ?? '').trim()
                ],
                c: normalizeMillionaireCorrectAnswer(row[cols.correct])
            });

            const problems = [];
            if (!item.grade) problems.push('Khối không hợp lệ');
            if (!item.subject) problems.push('Thiếu môn');
            if (!item.topic) problems.push('Thiếu chủ đề');
            if (!item.difficulty) problems.push('Mức độ không hợp lệ');
            if (!item.q) problems.push('Thiếu câu hỏi');
            if (item.a.some(v => !String(v).trim())) problems.push('Thiếu đáp án A/B/C/D');
            if (![0,1,2,3].includes(Number(item.c))) problems.push('Đáp án đúng không hợp lệ');

            if (problems.length) {
                errors.push({ row: r + 1, q: item.q || '(trống)', message: problems.join(', ') });
                continue;
            }

            const key = makeMillionaireDuplicateKey(item);

            if (defaultKeys.has(key)) {
                duplicates++;
                continue;
            }

            if (customIndexByKey.has(key)) {
                const index = customIndexByKey.get(key);
                const existing = workingCustom[index];
                const updatedItem = { ...item, id: existing.id };
                const sameContent =
                    String(existing.grade || '') === String(updatedItem.grade || '') &&
                    String(existing.subject || '') === String(updatedItem.subject || '') &&
                    String(existing.topic || '') === String(updatedItem.topic || '') &&
                    String(existing.difficulty || '') === String(updatedItem.difficulty || '') &&
                    String(existing.q || '') === String(updatedItem.q || '') &&
                    Number(existing.c) === Number(updatedItem.c) &&
                    JSON.stringify(existing.a || []) === JSON.stringify(updatedItem.a || []);

                if (sameContent) {
                    duplicates++;
                } else {
                    workingCustom[index] = updatedItem;
                    updatedItems.push(updatedItem);
                }
                continue;
            }

            customIndexByKey.set(key, workingCustom.length);
            workingCustom.push(item);
            imported.push(item);
        }

        // Ghi các câu cập nhật lên Supabase, giữ nguyên UUID hiện có.
        for (const item of updatedItems) {
            const { error } = await supabase
                .from('app3_millionaire_questions')
                .update(mapMillionaireQuestionToSupabase(item))
                .eq('id', item.id);
            if (error) throw error;
        }

        // Ghi các câu mới lên Supabase và để database tự sinh UUID.
        if (imported.length) {
            const { error } = await supabase
                .from('app3_millionaire_questions')
                .insert(imported.map(mapMillionaireQuestionToSupabase));
            if (error) throw error;
        }

        if (imported.length || updatedItems.length) {
            // Tải lại nguồn chuẩn từ Supabase để danh sách/thống kê cập nhật ngay.
            await loadMillionaireQuestionsFromSupabase();
            // Giữ một bản local dự phòng trên thiết bị hiện tại, nhưng không dùng làm nguồn chính.
            saveMillionaireCustomQuestions(MILLIONAIRE_SUPABASE_QUESTIONS);
        }

        MILLIONAIRE_STATE.managerOpen = true;
        MILLIONAIRE_STATE.editingQuestionId = null;
        MILLIONAIRE_STATE.message = (imported.length || updatedItems.length)
            ? `Excel: thêm ${imported.length}, cập nhật ${updatedItems.length} câu hỏi trên Supabase.`
            : 'Không có câu hỏi mới hoặc thay đổi cần cập nhật.';
        refreshMillionaire();

        const errorText = errors.length
            ? '\n\nDòng lỗi:\n' + errors.slice(0, 12).map(e => `- Dòng ${e.row}: ${e.message}`).join('\n') +
              (errors.length > 12 ? `\n... và ${errors.length - 12} dòng lỗi khác.` : '')
            : '';

        alert(
            `Kết quả nhập Excel:\n` +
            `- Thêm mới: ${imported.length}\n` +
            `- Cập nhật: ${updatedItems.length}\n` +
            `- Trùng không đổi / câu mặc định, bỏ qua: ${duplicates}\n` +
            `- Lỗi, bỏ qua: ${errors.length}` +
            errorText
        );

    } catch (err) {
        console.error('Lỗi nhập câu hỏi Excel:', err);
        alert('Không thể nhập Excel lên Supabase: ' + (err?.message || err));
    } finally {
        if (event?.target) event.target.value = '';
    }
}

function millionaireDifficultyLabel(value) {
    if (value === 'easy') return 'Dễ';
    if (value === 'medium') return 'Trung bình';
    if (value === 'hard') return 'Khó';
    return value || '';
}

function millionaireCorrectLabel(index) {
    return ['A','B','C','D'][Number(index)] || '';
}

function buildMillionaireExcelRows(items) {
    const rows = [[
        'Khối', 'Môn', 'Chủ đề', 'Mức độ',
        'Câu hỏi', 'A', 'B', 'C', 'D', 'Đáp án đúng'
    ]];

    (items || []).forEach(item => {
        rows.push([
            item.grade === 'all' ? 'all' : String(item.grade || ''),
            item.subject || '',
            item.topic || '',
            millionaireDifficultyLabel(item.difficulty),
            item.q || '',
            item.a?.[0] || '',
            item.a?.[1] || '',
            item.a?.[2] || '',
            item.a?.[3] || '',
            millionaireCorrectLabel(item.c)
        ]);
    });

    return rows;
}

function exportMillionaireQuestionsToExcel(mode = 'custom') {
    if (typeof XLSX === 'undefined') {
        alert('Thư viện Excel chưa sẵn sàng.');
        return;
    }

    let items = [];
    let fileName = '';
    let sheetName = '';

    if (mode === 'all') {
        items = getAllMillionaireQuestions();
        fileName = 'NGAN_HANG_CAU_HOI_AI_LA_TRIEU_PHU_TOAN_BO.xlsx';
        sheetName = 'Toan bo';
    } else {
        items = loadMillionaireCustomQuestions();
        fileName = 'NGAN_HANG_CAU_HOI_AI_LA_TRIEU_PHU_TU_THEM.xlsx';
        sheetName = 'Tu them';
    }

    if (!items.length) {
        alert(mode === 'all'
            ? 'Ngân hàng câu hỏi hiện chưa có dữ liệu.'
            : 'Chưa có câu hỏi tự thêm để xuất.');
        return;
    }

    const rows = buildMillionaireExcelRows(items);
    const ws = XLSX.utils.aoa_to_sheet(rows);

    ws['!cols'] = [
        { wch: 10 },
        { wch: 18 },
        { wch: 22 },
        { wch: 14 },
        { wch: 58 },
        { wch: 24 },
        { wch: 24 },
        { wch: 24 },
        { wch: 24 },
        { wch: 14 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, fileName);

    showToast(
        `Đã xuất ${items.length} câu hỏi ra Excel.`,
        'success',
        2200
    );
}

function normalizeMillionairePasteLine(line) {
    return String(line ?? '').replace(/\u00a0/g, ' ').trim();
}

function parseMillionaireMarkdownOrTabTable(rawText) {
    const lines = String(rawText || '')
        .split(/\r?\n/)
        .map(normalizeMillionairePasteLine)
        .filter(Boolean);

    if (!lines.length) return [];

    const isPipe = lines.some(line => line.includes('|'));
    const delimiter = isPipe ? 'pipe' : 'tab';

    const splitLine = (line) => {
        if (delimiter === 'pipe') {
            return line
                .replace(/^\|/, '')
                .replace(/\|$/, '')
                .split('|')
                .map(v => v.trim());
        }
        return line.split('\t').map(v => v.trim());
    };

    const rows = lines
        .filter(line => !/^\s*\|?\s*:?-{3,}/.test(line))
        .map(splitLine)
        .filter(row => row.length >= 5);

    if (!rows.length) return [];

    const header = rows[0].map(normalizeMillionaireExcelHeader);
    const hasHeader = header.some(v => ['khoi','môn','mon','chu de','cau hoi','dap an dung'].includes(v));

    const findCol = (...names) => {
        const candidates = names.map(normalizeMillionaireExcelHeader);
        return header.findIndex(h => candidates.includes(h));
    };

    let cols;
    let dataRows;

    if (hasHeader) {
        cols = {
            grade: findCol('Khối', 'Khoi'),
            subject: findCol('Môn', 'Mon', 'Môn học', 'Mon hoc'),
            topic: findCol('Chủ đề', 'Chu de'),
            difficulty: findCol('Mức độ', 'Muc do'),
            q: findCol('Câu hỏi', 'Cau hoi'),
            a0: findCol('A'),
            a1: findCol('B'),
            a2: findCol('C'),
            a3: findCol('D'),
            correct: findCol('Đáp án đúng', 'Dap an dung', 'Đáp án', 'Dap an')
        };
        dataRows = rows.slice(1);
    } else if (rows[0].length >= 10) {
        cols = { grade:0, subject:1, topic:2, difficulty:3, q:4, a0:5, a1:6, a2:7, a3:8, correct:9 };
        dataRows = rows;
    } else {
        return [];
    }

    if (Object.values(cols).some(i => i < 0)) return [];

    return dataRows.map((row, idx) => ({
        sourceLine: idx + (hasHeader ? 2 : 1),
        item: {
            grade: normalizeMillionaireGrade(row[cols.grade]),
            subject: String(row[cols.subject] ?? '').trim(),
            topic: String(row[cols.topic] ?? '').trim(),
            difficulty: normalizeMillionaireDifficulty(row[cols.difficulty]),
            q: String(row[cols.q] ?? '').trim(),
            a: [
                String(row[cols.a0] ?? '').trim(),
                String(row[cols.a1] ?? '').trim(),
                String(row[cols.a2] ?? '').trim(),
                String(row[cols.a3] ?? '').trim()
            ],
            c: normalizeMillionaireCorrectAnswer(row[cols.correct])
        }
    }));
}

function parseMillionaireLabeledBlocks(rawText) {
    const raw = String(rawText || '').replace(/\r/g, '');
    const blocks = raw
        .split(/\n{2,}(?=\s*(?:Khối|Khoi)\s*:)/i)
        .map(b => b.trim())
        .filter(Boolean);

    const parsed = [];

    const read = (block, labels) => {
        for (const label of labels) {
            const re = new RegExp(`^\\s*${label}\\s*:\\s*(.+)$`, 'im');
            const m = block.match(re);
            if (m) return m[1].trim();
        }
        return '';
    };

    blocks.forEach((block, idx) => {
        const q = read(block, ['Câu hỏi', 'Cau hoi']);
        if (!q) return;

        const answer = (letter) => {
            const patterns = [
                new RegExp(`^\\s*${letter}\\s*[\\.:\\)]\\s*(.+)$`, 'im'),
                new RegExp(`^\\s*Đáp án ${letter}\\s*:\\s*(.+)$`, 'im'),
                new RegExp(`^\\s*Dap an ${letter}\\s*:\\s*(.+)$`, 'im')
            ];
            for (const re of patterns) {
                const m = block.match(re);
                if (m) return m[1].trim();
            }
            return '';
        };

        parsed.push({
            sourceLine: idx + 1,
            item: {
                grade: normalizeMillionaireGrade(read(block, ['Khối', 'Khoi'])),
                subject: read(block, ['Môn', 'Mon', 'Môn học', 'Mon hoc']),
                topic: read(block, ['Chủ đề', 'Chu de']),
                difficulty: normalizeMillionaireDifficulty(read(block, ['Mức độ', 'Muc do'])),
                q,
                a: [answer('A'), answer('B'), answer('C'), answer('D')],
                c: normalizeMillionaireCorrectAnswer(read(block, ['Đáp án đúng', 'Dap an dung', 'Đáp án', 'Dap an']))
            }
        });
    });

    return parsed;
}

function parseMillionaireAIText(rawText) {
    const text = String(rawText || '').trim();
    if (!text) return [];

    let parsed = parseMillionaireMarkdownOrTabTable(text);
    if (parsed.length) return parsed;

    parsed = parseMillionaireLabeledBlocks(text);
    if (parsed.length) return parsed;

    return [];
}

async function importMillionaireQuestionsFromPastedAI() {
    const textarea = document.getElementById('millionaireAIPasteBox');
    const rawText = textarea?.value || '';

    if (!rawText.trim()) {
        alert('Vui lòng dán nội dung câu hỏi từ AI vào vùng trống.');
        return;
    }

    const parsed = parseMillionaireAIText(rawText);
    if (!parsed.length) {
        alert(
            'Không nhận diện được cấu trúc câu hỏi.\n\n' +
            'Hãy dùng một trong hai dạng:\n' +
            '1) Bảng có 10 cột Khối | Môn | Chủ đề | Mức độ | Câu hỏi | A | B | C | D | Đáp án đúng\n' +
            '2) Khối văn bản có nhãn Khối:, Môn:, Chủ đề:, Mức độ:, Câu hỏi:, A:, B:, C:, D:, Đáp án đúng:'
        );
        return;
    }

    try {
        // BƯỚC 151.49.3F.17B.10A:
        // Dán từ AI cũng phải đối chiếu và ghi trực tiếp lên Supabase.
        const custom = millionaireSupabaseQuestionsLoaded
            ? [...MILLIONAIRE_SUPABASE_QUESTIONS]
            : await loadMillionaireQuestionsFromSupabase();
        const duplicateKeys = new Set(
            [...MILLIONAIRE_QUESTION_BANK, ...custom].map(makeMillionaireDuplicateKey)
        );

        const imported = [];
        const errors = [];
        let duplicates = 0;

        for (const record of parsed) {
            const normalized = normalizeMillionaireQuestionInput(record.item);
            const problems = [];

            if (!normalized.grade) problems.push('Khối không hợp lệ');
            if (!normalized.subject) problems.push('Thiếu môn');
            if (!normalized.topic) problems.push('Thiếu chủ đề');
            if (!normalized.difficulty) problems.push('Mức độ không hợp lệ');
            if (!normalized.q) problems.push('Thiếu câu hỏi');
            if (normalized.a.some(v => !String(v).trim())) problems.push('Thiếu đáp án A/B/C/D');
            if (![0,1,2,3].includes(Number(normalized.c))) problems.push('Đáp án đúng không hợp lệ');

            if (problems.length) {
                errors.push({
                    sourceLine: record.sourceLine,
                    q: normalized.q || '(trống)',
                    message: problems.join(', ')
                });
                continue;
            }

            const key = makeMillionaireDuplicateKey(normalized);
            if (duplicateKeys.has(key)) {
                duplicates++;
                continue;
            }

            duplicateKeys.add(key);
            imported.push(normalized);
        }

        // Giữ nguyên cơ chế cân bằng vị trí đáp án đúng A/B/C/D đã đạt trước đây.
        if (imported.length) {
            const targetPositions = [];
            for (let i = 0; i < imported.length; i++) targetPositions.push(i % 4);
            shuffleMillionaireArray(targetPositions);
            imported.forEach((item, idx) => {
                const current = Number(item.c);
                const target = targetPositions[idx];
                if (current !== target && [0,1,2,3].includes(current)) {
                    const answers = [...item.a];
                    [answers[current], answers[target]] = [answers[target], answers[current]];
                    item.a = answers;
                    item.c = target;
                }
            });

            const { error } = await supabase
                .from('app3_millionaire_questions')
                .insert(imported.map(mapMillionaireQuestionToSupabase));
            if (error) throw error;

            await loadMillionaireQuestionsFromSupabase();
            saveMillionaireCustomQuestions(MILLIONAIRE_SUPABASE_QUESTIONS);
        }

        MILLIONAIRE_STATE.managerOpen = true;
        MILLIONAIRE_STATE.editingQuestionId = null;
        MILLIONAIRE_STATE.message = imported.length
            ? `Đã nhập ${imported.length} câu hỏi từ AI lên Supabase.`
            : 'Không có câu hỏi mới được nhập.';
        refreshMillionaire();

        const errorText = errors.length
            ? '\n\nLỗi:\n' + errors.slice(0, 12).map(e => `- Mục ${e.sourceLine}: ${e.message}`).join('\n') +
              (errors.length > 12 ? `\n... và ${errors.length - 12} lỗi khác.` : '')
            : '';

        alert(
            `Kết quả dán từ AI:\n` +
            `- Thêm mới: ${imported.length}\n` +
            `- Trùng, bỏ qua: ${duplicates}\n` +
            `- Lỗi, bỏ qua: ${errors.length}` +
            errorText
        );

        const newBox = document.getElementById('millionaireAIPasteBox');
        if (newBox && imported.length) newBox.value = '';

    } catch (error) {
        console.error('[151.49.3F.17B.10A] Lỗi dán câu hỏi AI lên Supabase:', error);
        alert(
            'Không thể lưu câu hỏi AI lên Supabase. Dữ liệu hiện có vẫn được giữ nguyên.\n\n' +
            (error?.message || String(error))
        );
    }
}

function getMillionaireAIPromptData() {
    const gradeValue = String(document.getElementById('mqGrade')?.value || 'all').trim();
    const subject = String(document.getElementById('mqSubject')?.value || '').trim();
    const topic = String(document.getElementById('mqTopic')?.value || '').trim();
    return {
        grade: gradeValue === 'all' ? '[xác định theo bài học hoặc tôi sẽ bổ sung]' : `Khối ${gradeValue}`,
        subject: subject || '[xác định theo ảnh bài học hoặc tôi sẽ bổ sung]',
        topic: topic || '[xác định theo ảnh bài học]'
    };
}

function buildMillionaireAIPrompt() {
    const data = getMillionaireAIPromptData();
    return `Tôi sẽ gửi cho bạn MỘT HOẶC NHIỀU ẢNH chứa TOÀN BỘ nội dung của một bài học trong sách giáo khoa/sách giáo viên.

Khối dự kiến: ${data.grade}
Môn dự kiến: ${data.subject}
Bài/Chủ đề dự kiến: ${data.topic}

NHIỆM VỤ CỦA BẠN:
1. Đọc kỹ toàn bộ các ảnh tôi gửi và chỉ sử dụng kiến thức có trong bài học đó để tạo câu hỏi.
2. Tự xác định bài học cần BAO NHIÊU câu hỏi trắc nghiệm để học sinh ôn tập và hiểu được các kiến thức, ý chính và yêu cầu quan trọng của bài. KHÔNG bắt buộc 15 câu, KHÔNG cố kéo dài cho đủ số lượng. Bài ngắn có thể ít câu, bài nhiều nội dung có thể nhiều câu.
3. Không bỏ sót nội dung trọng tâm, nhưng không tạo nhiều câu hỏi lặp ý chỉ để tăng số lượng.
4. Mỗi câu có đúng 4 phương án A, B, C, D và chỉ có 1 đáp án đúng. Các phương án nhiễu phải hợp lý, rõ ràng, phù hợp lứa tuổi và không gây tranh cãi.
5. Phân bố mức độ Dễ – Trung bình – Khó phù hợp với nội dung bài học. Mỗi câu phải ghi rõ mức độ.
6. ĐẶC BIỆT QUAN TRỌNG VỀ ĐÁP ÁN: vị trí đáp án đúng phải được phân bố tương đối cân bằng giữa A, B, C và D. Không được để phần lớn hoặc toàn bộ câu có cùng đáp án đúng A/B/C/D; không tạo quy luật dễ đoán như tất cả A, tất cả B hoặc lặp một mẫu cố định. Hãy kiểm tra lại toàn bộ danh sách trước khi trả kết quả.
7. Nếu ảnh bị mờ, thiếu trang hoặc chưa đủ nội dung để xác định bài học, hãy nói rõ phần nào còn thiếu thay vì tự suy đoán kiến thức ngoài ảnh.

CÁCH TÔI GỬI ẢNH:
- Sau câu lệnh này tôi sẽ gửi lần lượt các ảnh của bài học.
- Trong lúc tôi đang gửi ảnh, chỉ tiếp nhận và chưa tạo câu hỏi.
- Chỉ bắt đầu phân tích và tạo danh sách khi tôi nhắn chính xác: ĐÃ GỬI ĐỦ ẢNH.

KHI TÔI NHẮN “ĐÃ GỬI ĐỦ ẢNH”, hãy tự xác định số câu phù hợp rồi trả kết quả. Không viết lời mở đầu, không giải thích, không dùng bảng Markdown và không thêm nội dung trước hoặc sau danh sách câu hỏi.

Mỗi câu phải đúng cấu trúc sau:
Khối: [1/2/3/4/5]
Môn: [tên môn]
Chủ đề: [tên bài/chủ đề]
Mức độ: [Dễ/Trung bình/Khó]
Câu hỏi: [nội dung câu hỏi]
A: [phương án A]
B: [phương án B]
C: [phương án C]
D: [phương án D]
Đáp án đúng: [A/B/C/D]

Giữa hai câu để đúng 1 dòng trống. Trước khi trả kết quả, hãy kiểm tra lần cuối: số câu đã đủ để bao quát bài học nhưng không dư thừa, và đáp án đúng đã được phân bố đa dạng giữa A/B/C/D.`;
}
async function millionaireBuildAndCopyAIPrompt() {
    const prompt = buildMillionaireAIPrompt();
    const box = document.getElementById('millionaireAIPromptBox');
    if (box) box.value = prompt;

    try {
        await navigator.clipboard.writeText(prompt);
        alert(`Đã tạo và sao chép câu lệnh AI.

Bây giờ hãy dán câu lệnh này vào ChatGPT.`);
    } catch (error) {
        if (box) {
            box.removeAttribute('readonly');
            box.focus();
            box.select();
            try { document.execCommand('copy'); } catch (_) {}
            box.setAttribute('readonly', 'readonly');
        }
        alert('Đã tạo câu lệnh AI. Nếu trình duyệt không tự sao chép, hãy bấm vào ô câu lệnh và nhấn Ctrl+C.');
    }
}

function millionaireFillAIPasteExample() {
    const box = document.getElementById('millionaireAIPasteBox');
    if (!box) return;

    box.value =
`Khối: 5
Môn: Tin học
Chủ đề: Internet
Mức độ: Dễ
Câu hỏi: Trình duyệt web dùng để làm gì?
A: Soạn văn bản ngoại tuyến
B: Truy cập và xem các trang web
C: In giấy
D: Tắt máy tính
Đáp án đúng: B

Khối: 5
Môn: Toán
Chủ đề: Số thập phân
Mức độ: Trung bình
Câu hỏi: 2,5 + 1,75 bằng bao nhiêu?
A: 3,25
B: 4,25
C: 4,5
D: 5,25
Đáp án đúng: B`;
}


// BƯỚC 151.49.3F.16B: Cập nhật trạng thái chọn ngay trên DOM, không render lại toàn bộ
// module. Nhờ đó thanh cuộn của danh sách câu hỏi giữ nguyên vị trí khi tích từng câu.
function millionaireRefreshQuestionSelectionUI() {
    const panel = document.querySelector('.millionaire-manager-panel');
    if (!panel) return;

    const selected = new Set(MILLIONAIRE_STATE.selectedQuestionIds || []);
    // BƯỚC 151.49.3F.17B.8B: số lượng phải theo nguồn dùng chung Supabase khi đã tải xong.
    const customCount = getMillionaireQuestionsBySource('custom').length;

    const countStrong = panel.querySelector('.millionaire-bulk-right > span strong');
    if (countStrong) countStrong.textContent = String(selected.size);

    const headerCheckbox = panel.querySelector('.millionaire-manager-table thead .millionaire-select-cell input[type="checkbox"]');
    if (headerCheckbox) {
        headerCheckbox.checked = customCount > 0 && selected.size === customCount;
        headerCheckbox.indeterminate = selected.size > 0 && selected.size < customCount;
    }
}

function millionaireToggleQuestionSelection(id, checked) {
    const selected = new Set(MILLIONAIRE_STATE.selectedQuestionIds || []);
    if (checked) selected.add(id);
    else selected.delete(id);
    MILLIONAIRE_STATE.selectedQuestionIds = [...selected];
    millionaireRefreshQuestionSelectionUI();
}

function millionaireSelectAllCustomQuestions(checked = true) {
    if (checked) {
        // BƯỚC 151.49.3F.17B.8B: chọn các câu đang hiển thị từ nguồn dùng chung.
        MILLIONAIRE_STATE.selectedQuestionIds = getMillionaireQuestionsBySource('custom')
            .filter(millionaireCanManageQuestion)
            .map(q => q.id);
    } else {
        MILLIONAIRE_STATE.selectedQuestionIds = [];
    }

    // Đồng bộ các checkbox hàng hiện có mà không làm mất vị trí cuộn.
    const selected = new Set(MILLIONAIRE_STATE.selectedQuestionIds || []);
    document.querySelectorAll('.millionaire-manager-table tbody .millionaire-select-cell input[data-question-id]').forEach(box => {
        box.checked = selected.has(box.dataset.questionId || '');
    });
    millionaireRefreshQuestionSelectionUI();
}

// BƯỚC 151.49.3F.17B.10: Xóa hàng loạt trên Supabase.
async function millionaireDeleteSelectedQuestions() {
    const selected = new Set(MILLIONAIRE_STATE.selectedQuestionIds || []);
    if (!selected.size) {
        alert('Bạn chưa chọn câu hỏi nào để xóa.');
        return;
    }

    const items = getMillionaireQuestionsBySource('custom');
    const targets = items.filter(q => selected.has(q.id) && millionaireCanManageQuestion(q));

    if (!targets.length) {
        MILLIONAIRE_STATE.selectedQuestionIds = [];
        refreshMillionaire();
        return;
    }

    const ok = confirm(
        `Bạn có chắc muốn xóa ${targets.length} câu hỏi đã chọn?\n\n` +
        `Các câu này sẽ bị xóa khỏi ngân hàng dùng chung trên mọi thiết bị.\n` +
        `Các câu hỏi mặc định của hệ thống không bị ảnh hưởng.`
    );
    if (!ok) return;

    try {
        const targetIds = targets.map(q => q.id);
        const { data, error } = await supabase
            .from('app3_millionaire_questions')
            .delete()
            .in('id', targetIds)
            .select('id');

        if (error) throw error;

        const deletedIds = new Set((data || []).map(row => row.id));
        if (!deletedIds.size) {
            throw new Error('Không xóa được câu hỏi nào trên Supabase hoặc bạn không có quyền xóa.');
        }

        MILLIONAIRE_SUPABASE_QUESTIONS = MILLIONAIRE_SUPABASE_QUESTIONS.filter(q => !deletedIds.has(q.id));
        millionaireSupabaseQuestionsLoaded = true;

        if (MILLIONAIRE_STATE.editingQuestionId && deletedIds.has(MILLIONAIRE_STATE.editingQuestionId)) {
            MILLIONAIRE_STATE.editingQuestionId = null;
        }

        MILLIONAIRE_STATE.selectedQuestionIds = [];
        MILLIONAIRE_STATE.message = deletedIds.size === targets.length
            ? `Đã xóa ${deletedIds.size} câu hỏi đã chọn khỏi Supabase.`
            : `Đã xóa ${deletedIds.size}/${targets.length} câu hỏi. Hãy tải lại danh sách để kiểm tra.`;
        refreshMillionaire();
        console.log(`[151.49.3F.17B.10] Đã xóa ${deletedIds.size}/${targets.length} câu hỏi đã chọn trên Supabase.`);
    } catch (error) {
        console.error('[151.49.3F.17B.10] Lỗi xóa các câu đã chọn trên Supabase:', error);
        alert(
            'Không thể xóa các câu hỏi đã chọn trên Supabase. Dữ liệu hiện tại vẫn được giữ nguyên.\n\n' +
            (error?.message || String(error))
        );
    }
}

// BƯỚC 151.49.3F.17B.10: Xóa toàn bộ câu hỏi tự thêm đang có trong ngân hàng dùng chung.
async function millionaireDeleteAllCustomQuestions() {
    if (!isAdmin()) {
        alert('Chỉ Admin mới được xóa toàn bộ ngân hàng câu hỏi tự thêm.');
        return;
    }
    const items = getMillionaireQuestionsBySource('custom');
    if (!items.length) {
        alert('Hiện không có câu hỏi tự thêm để xóa.');
        return;
    }

    const ok = confirm(
        `Xóa toàn bộ ${items.length} câu hỏi tự thêm?\n\n` +
        `Các câu hỏi này sẽ bị xóa khỏi ngân hàng dùng chung trên mọi thiết bị.\n` +
        `59 câu hỏi mặc định của hệ thống sẽ được giữ nguyên.`
    );
    if (!ok) return;

    try {
        const targetIds = items.map(q => q.id);
        const { data, error } = await supabase
            .from('app3_millionaire_questions')
            .delete()
            .in('id', targetIds)
            .select('id');

        if (error) throw error;

        const deletedIds = new Set((data || []).map(row => row.id));
        if (!deletedIds.size) {
            throw new Error('Không xóa được câu hỏi nào trên Supabase hoặc bạn không có quyền xóa.');
        }

        MILLIONAIRE_SUPABASE_QUESTIONS = MILLIONAIRE_SUPABASE_QUESTIONS.filter(q => !deletedIds.has(q.id));
        millionaireSupabaseQuestionsLoaded = true;
        MILLIONAIRE_STATE.selectedQuestionIds = [];
        MILLIONAIRE_STATE.editingQuestionId = null;
        MILLIONAIRE_STATE.message = deletedIds.size === items.length
            ? `Đã xóa toàn bộ ${deletedIds.size} câu hỏi tự thêm khỏi Supabase.`
            : `Đã xóa ${deletedIds.size}/${items.length} câu hỏi. Hãy tải lại danh sách để kiểm tra.`;
        refreshMillionaire();
        console.log(`[151.49.3F.17B.10] Đã xóa ${deletedIds.size}/${items.length} câu hỏi tự thêm trên Supabase.`);
    } catch (error) {
        console.error('[151.49.3F.17B.10] Lỗi xóa toàn bộ câu hỏi trên Supabase:', error);
        alert(
            'Không thể xóa toàn bộ câu hỏi trên Supabase. Dữ liệu hiện tại vẫn được giữ nguyên.\n\n' +
            (error?.message || String(error))
        );
    }
}

function renderMillionaireQuestionManager() {
    if (!MILLIONAIRE_STATE.managerOpen) return '';

    const custom = getMillionaireQuestionsBySource('custom');
    const canCreate = millionaireCanCreateQuestion();
    const manageable = custom.filter(millionaireCanManageQuestion);
    const manageableIds = new Set(manageable.map(q => q.id));
    const editing = custom.find(q => q.id === MILLIONAIRE_STATE.editingQuestionId) || null;
    const form = editing || {
        grade: MILLIONAIRE_STATE.selectedGrade !== 'all' ? MILLIONAIRE_STATE.selectedGrade : 'all',
        subject: MILLIONAIRE_STATE.selectedSubject !== 'all' ? MILLIONAIRE_STATE.selectedSubject : '',
        topic: MILLIONAIRE_STATE.selectedTopic !== 'all' ? MILLIONAIRE_STATE.selectedTopic : '',
        difficulty: 'easy',
        q: '',
        a: ['', '', '', ''],
        c: 0
    };

    const selectedIds = new Set((MILLIONAIRE_STATE.selectedQuestionIds || []).filter(id => manageableIds.has(id)));
    MILLIONAIRE_STATE.selectedQuestionIds = [...selectedIds];
    const rows = custom.length
        ? custom.map((item, index) => `
            <tr>
                <td class="millionaire-select-cell">
                    ${millionaireCanManageQuestion(item) ? `
                    <input type="checkbox"
                        data-question-id="${escapeHtml(item.id)}"
                        ${selectedIds.has(item.id) ? 'checked' : ''}
                        onchange="millionaireToggleQuestionSelection('${item.id}', this.checked)">` : '<span title="Chỉ xem">—</span>'}
                </td>
                <td>${index + 1}</td>
                <td>${escapeHtml(item.grade === 'all' ? 'Tất cả' : 'Khối ' + item.grade)}</td>
                <td>${escapeHtml(item.subject)}</td>
                <td>${escapeHtml(item.topic)}</td>
                <td>${item.difficulty === 'easy' ? 'Dễ' : item.difficulty === 'medium' ? 'Trung bình' : 'Khó'}</td>
                <td class="millionaire-manager-question-cell">${escapeHtml(item.q)}</td>
                <td>
                    <div class="millionaire-manager-actions">
                        ${millionaireCanManageQuestion(item) ? `
                        <button onclick="millionaireEditQuestion('${item.id}')" title="Sửa"><i class="fas fa-pen"></i></button>
                        <button class="danger" onclick="millionaireDeleteQuestion('${item.id}')" title="Xóa"><i class="fas fa-trash"></i></button>` : '<span title="Bạn chỉ có quyền xem câu hỏi này">Chỉ xem</span>'}
                    </div>
                </td>
            </tr>
        `).join('')
        : '<tr><td colspan="8" class="millionaire-manager-empty">Chưa có câu hỏi tự thêm.</td></tr>';

    return `
        <div class="millionaire-manager-panel">
            <div class="millionaire-manager-head">
                <div>
                    <strong><i class="fas fa-list-check"></i> Quản lý câu hỏi</strong>
                    <span>Ngân hàng câu hỏi dùng chung trên Supabase · ${isAdmin() ? 'Admin' : isTeacher() ? 'Giáo viên' : 'Chỉ xem'}.</span>
                </div>
                <div class="millionaire-manager-head-actions">
                    ${canCreate ? `
                    <button onclick="millionaireDownloadExcelTemplate()" title="Tải file mẫu Excel">
                        <i class="fas fa-file-arrow-down"></i>
                    </button>
                    <button onclick="millionairePickExcelFile()" title="Nhập câu hỏi từ Excel">
                        <i class="fas fa-file-import"></i>
                    </button>` : ''}
                    <button onclick="exportMillionaireQuestionsToExcel('custom')" title="Xuất câu hỏi tự thêm">
                        <i class="fas fa-file-export"></i>
                    </button>
                    <button onclick="exportMillionaireQuestionsToExcel('all')" title="Xuất toàn bộ ngân hàng">
                        <i class="fas fa-table-list"></i>
                    </button>
                    <button onclick="millionaireCloseQuestionManager()" title="Đóng">
                        <i class="fas fa-xmark"></i>
                    </button>
                </div>
            </div>

            ${canCreate ? `
            <div class="millionaire-manager-form">
                <div class="millionaire-manager-grid">
                    <label>
                        <span>Khối</span>
                        <select id="mqGrade">
                            <option value="all" ${form.grade === 'all' ? 'selected' : ''}>Tất cả khối</option>
                            ${['1','2','3','4','5'].map(g => `<option value="${g}" ${String(form.grade) === g ? 'selected' : ''}>Khối ${g}</option>`).join('')}
                        </select>
                    </label>
                    <label>
                        <span>Môn học</span>
                        <input id="mqSubject" value="${escapeHtml(form.subject || '')}" placeholder="Ví dụ: Tin học">
                    </label>
                    <label>
                        <span>Chủ đề</span>
                        <input id="mqTopic" value="${escapeHtml(form.topic || '')}" placeholder="Ví dụ: Internet">
                    </label>
                    <label>
                        <span>Mức độ</span>
                        <select id="mqDifficulty">
                            <option value="easy" ${form.difficulty === 'easy' ? 'selected' : ''}>Dễ</option>
                            <option value="medium" ${form.difficulty === 'medium' ? 'selected' : ''}>Trung bình</option>
                            <option value="hard" ${form.difficulty === 'hard' ? 'selected' : ''}>Khó</option>
                        </select>
                    </label>
                </div>

                <label class="millionaire-manager-wide">
                    <span>Câu hỏi</span>
                    <textarea id="mqQuestion" rows="2" placeholder="Nhập nội dung câu hỏi">${escapeHtml(form.q || '')}</textarea>
                </label>

                <div class="millionaire-manager-answer-grid">
                    ${['A','B','C','D'].map((label, idx) => `
                        <label>
                            <span>Đáp án ${label}</span>
                            <input id="mqA${idx}" value="${escapeHtml(form.a?.[idx] || '')}" placeholder="Nhập đáp án ${label}">
                        </label>
                    `).join('')}
                </div>

                <label class="millionaire-manager-correct">
                    <span>Đáp án đúng</span>
                    <select id="mqCorrect">
                        ${['A','B','C','D'].map((label, idx) => `<option value="${idx}" ${Number(form.c) === idx ? 'selected' : ''}>${label}</option>`).join('')}
                    </select>
                </label>

                <div class="millionaire-manager-form-actions">
                    <button class="btn millionaire-manager-save" onclick="millionaireSaveQuestion()">
                        <i class="fas fa-floppy-disk"></i> ${editing ? 'Lưu thay đổi' : 'Thêm câu hỏi'}
                    </button>
                    ${editing ? `
                        <button class="btn millionaire-manager-cancel" onclick="millionaireResetQuestionForm()">
                            <i class="fas fa-ban"></i> Hủy sửa
                        </button>
                    ` : ''}
                </div>
            </div>

            <div class="millionaire-ai-paste-panel">
                <div class="millionaire-ai-paste-title">
                    <div>
                        <strong><i class="fas fa-wand-magic-sparkles"></i> Tạo câu hỏi bằng AI</strong>
                        <span>Phần mềm tạo sẵn câu lệnh theo Khối – Môn – Chủ đề – Mức độ ở phía trên. Sao chép câu lệnh sang ChatGPT, rồi dán kết quả trở lại đây.</span>
                    </div>
                    <button type="button" onclick="millionaireFillAIPasteExample()" title="Điền ví dụ kết quả AI">
                        <i class="fas fa-lightbulb"></i> Ví dụ kết quả
                    </button>
                </div>

                <div class="millionaire-ai-prompt-builder">
                    <div class="millionaire-ai-prompt-row">
                        <div class="millionaire-ai-auto-count-note">
                            <i class="fas fa-images"></i>
                            <span><strong>Không cần nhập số câu.</strong> Hãy đưa toàn bộ ảnh bài học cho ChatGPT; AI sẽ tự xác định số câu cần thiết để bao quát nội dung.</span>
                        </div>
                        <button type="button" class="btn millionaire-ai-copy-btn" onclick="millionaireBuildAndCopyAIPrompt()">
                            <i class="fas fa-copy"></i> Tạo & sao chép câu lệnh AI
                        </button>
                    </div>
                    <textarea id="millionaireAIPromptBox" rows="9" readonly
                        placeholder="Nhấn “Tạo & sao chép câu lệnh AI”. Câu lệnh hoàn chỉnh sẽ xuất hiện tại đây và được sao chép vào clipboard."></textarea>
                    <div class="millionaire-ai-guide">
                        <strong>Cách dùng:</strong> 1. Chọn Khối, nhập Môn/Chủ đề nếu đã biết → 2. Sao chép câu lệnh AI → 3. Dán vào ChatGPT → 4. Gửi lần lượt toàn bộ ảnh bài học → 5. Nhắn <b>ĐÃ GỬI ĐỦ ẢNH</b> → 6. Sao chép danh sách AI trả về, dán xuống dưới và bấm <b>Phân tích & nhập</b>.
                    </div>
                </div>

                <div class="millionaire-ai-result-title">
                    <strong><i class="fas fa-paste"></i> Dán danh sách câu hỏi ChatGPT trả về</strong>
                    <span>Không cần sửa lại nếu ChatGPT làm đúng câu lệnh mẫu.</span>
                </div>
                <textarea id="millionaireAIPasteBox" rows="10"
                    placeholder="Dán danh sách câu hỏi ChatGPT/AI trả về vào đây...

Ví dụ mỗi câu:
Khối: 5
Môn: Tin học
Chủ đề: Internet
Mức độ: Dễ
Câu hỏi: ...
A: ...
B: ...
C: ...
D: ...
Đáp án đúng: B"></textarea>
                <div class="millionaire-ai-paste-actions">
                    <button class="btn" onclick="importMillionaireQuestionsFromPastedAI()">
                        <i class="fas fa-wand-magic-sparkles"></i> Phân tích & nhập
                    </button>
                    <span>Hệ thống tự bỏ qua câu trùng và báo các mục sai định dạng.</span>
                </div>
            </div>

            ` : `
            <div class="millionaire-manager-readonly-note">
                <i class="fas fa-eye"></i> Tài khoản Viewer chỉ được xem, chơi và xuất ngân hàng câu hỏi.
            </div>
            `}

            <div class="millionaire-manager-import-toolbar">
                ${canCreate ? `
                <button class="btn" onclick="millionaireDownloadExcelTemplate()">
                    <i class="fas fa-download"></i> Tải mẫu Excel
                </button>
                <button class="btn" onclick="millionairePickExcelFile()">
                    <i class="fas fa-file-import"></i> Nhập Excel
                </button>` : ''}
                <button class="btn" onclick="exportMillionaireQuestionsToExcel('custom')">
                    <i class="fas fa-file-export"></i> Xuất câu tự thêm
                </button>
                <button class="btn" onclick="exportMillionaireQuestionsToExcel('all')">
                    <i class="fas fa-table-list"></i> Xuất toàn bộ
                </button>
            </div>

            ${manageable.length ? `
            <div class="millionaire-bulk-toolbar">
                <div class="millionaire-bulk-left">
                    <button class="btn" onclick="millionaireSelectAllCustomQuestions(true)">
                        <i class="fas fa-square-check"></i> Chọn tất cả
                    </button>
                    <button class="btn" onclick="millionaireSelectAllCustomQuestions(false)">
                        <i class="fas fa-square-minus"></i> Bỏ chọn
                    </button>
                </div>
                <div class="millionaire-bulk-right">
                    <span>Đã chọn: <strong>${selectedIds.size}</strong></span>
                    <button class="btn danger" onclick="millionaireDeleteSelectedQuestions()">
                        <i class="fas fa-trash"></i> Xóa câu đã chọn
                    </button>
                    ${isAdmin() ? `
                    <button class="btn danger-outline" onclick="millionaireDeleteAllCustomQuestions()">
                        <i class="fas fa-trash-can"></i> Xóa toàn bộ câu tự thêm
                    </button>` : ''}
                </div>
            </div>
            ` : ''}

            <div class="millionaire-manager-table-wrap">
                <div class="millionaire-manager-count">
                    Câu hỏi mặc định: <strong>${MILLIONAIRE_QUESTION_BANK.length}</strong> ·
                    Tự thêm: <strong>${custom.length}</strong> ·
                    Tổng: <strong>${MILLIONAIRE_QUESTION_BANK.length + custom.length}</strong>
                </div>
                <table class="millionaire-manager-table">
                    <thead>
                        <tr>
                            <th class="millionaire-select-cell">
                                ${manageable.length ? `<input type="checkbox"
                                    ${selectedIds.size > 0 && selectedIds.size === manageable.length ? 'checked' : ''}
                                    onchange="millionaireSelectAllCustomQuestions(this.checked)"
                                    title="Chọn tất cả câu bạn có quyền quản lý">` : '—'}
                            </th>
                            <th>STT</th><th>Khối</th><th>Môn</th><th>Chủ đề</th><th>Mức</th><th>Câu hỏi</th><th>Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </div>
    `;
}

function renderMillionaireBankSelector() {
    const state = MILLIONAIRE_STATE;
    // BƯỚC 151.49.3F.17B.8B: thống kê câu đã thêm theo Supabase, có localStorage làm dự phòng.
    const customCount = getMillionaireQuestionsBySource('custom').length;
    const defaultCount = MILLIONAIRE_QUESTION_BANK.length;
    const subjects = getMillionaireSubjectsForGrade(state.selectedGrade);
    const topics = getMillionaireTopicsForSelection(state.selectedGrade, state.selectedSubject);
    const historyStats = millionaireGetHistoryStatsForCurrentSelection();

    const subjectOptions = ['all', ...subjects]
        .map(value => `<option value="${escapeHtml(value)}" ${state.selectedSubject === value ? 'selected' : ''}>${value === 'all' ? 'Tất cả 13 môn' : escapeHtml(value)}</option>`)
        .join('');

    const topicOptions = ['all', ...topics]
        .map(value => `<option value="${escapeHtml(value)}" ${state.selectedTopic === value ? 'selected' : ''}>${value === 'all' ? 'Tất cả chủ đề' : escapeHtml(value)}</option>`)
        .join('');

    return `
        <div class="millionaire-bank-selector">
            <div class="millionaire-bank-title"><i class="fas fa-layer-group"></i> Chọn bộ câu hỏi</div>
            <div class="millionaire-source-choice">
                <label class="millionaire-source-option ${state.questionSource === 'custom' ? 'active' : ''}">
                    <input type="radio" name="millionaireQuestionSource" value="custom" ${state.questionSource === 'custom' ? 'checked' : ''} onchange="millionaireSetQuestionSource(this.value)">
                    <span><strong>Câu hỏi đã thêm</strong><small>${customCount} câu · dùng câu do giáo viên/AI nhập</small></span>
                </label>
                <label class="millionaire-source-option ${state.questionSource === 'default' ? 'active' : ''}">
                    <input type="radio" name="millionaireQuestionSource" value="default" ${state.questionSource === 'default' ? 'checked' : ''} onchange="millionaireSetQuestionSource(this.value)">
                    <span><strong>Câu hỏi mẫu của phần mềm</strong><small>${defaultCount} câu · chỉ dùng khi muốn chơi bộ mẫu</small></span>
                </label>
            </div>
            <div class="millionaire-bank-grid">
                <label>
                    <span>Khối lớp</span>
                    <select onchange="millionaireSetGrade(this.value)">
                        <option value="all" ${state.selectedGrade === 'all' ? 'selected' : ''}>Tất cả khối</option>
                        ${['1','2','3','4','5'].map(g => `<option value="${g}" ${state.selectedGrade === g ? 'selected' : ''}>Khối ${g}</option>`).join('')}
                    </select>
                </label>
                <label>
                    <span>Môn học</span>
                    <select onchange="millionaireSetSubject(this.value)">
                        ${subjectOptions}
                    </select>
                </label>
                <label>
                    <span>Chủ đề</span>
                    <select onchange="millionaireSetTopic(this.value)">
                        ${topicOptions}
                    </select>
                </label>
            </div>
            <div class="millionaire-bank-note">
                <strong>Hai nguồn câu hỏi được tách hoàn toàn.</strong>
                Khi chọn <strong>Câu hỏi đã thêm</strong>, trò chơi tuyệt đối không lấy câu hỏi mẫu có sẵn; kể cả khi dùng quyền <strong>Đổi câu</strong>.
                Mỗi lượt dùng số câu phù hợp bộ lọc (tối đa 15 câu).<br>
                <strong>Lịch sử trên thiết bị này:</strong> đã dùng ${historyStats.used}/${historyStats.total} câu trong bộ lọc hiện tại; còn ${historyStats.unused} câu chưa dùng.
                Ván mới sẽ ưu tiên câu chưa dùng và chỉ lặp lại khi không còn đủ câu mới.
            </div>
        </div>
    `;
}

function getMillionaireCurrentQuestion() {

    return MILLIONAIRE_STATE.questions[MILLIONAIRE_STATE.level] || null;
}


const MILLIONAIRE_MASTER_VOLUME = 4.8;
const MILLIONAIRE_MAX_AUDIO_VOLUME = 1.0;

function millionaireBoostVolume(baseVolume) {
    const boosted = Number(baseVolume || 0) * MILLIONAIRE_MASTER_VOLUME;
    return Math.max(0, Math.min(MILLIONAIRE_MAX_AUDIO_VOLUME, boosted));
}

let millionaireAudioCtx = null;

function getMillionaireAudioContext() {
    if (!MILLIONAIRE_STATE.soundEnabled) return null;
    try {
        if (!millionaireAudioCtx) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return null;
            millionaireAudioCtx = new Ctx();
        }
        if (millionaireAudioCtx.state === 'suspended') millionaireAudioCtx.resume();
        return millionaireAudioCtx;
    } catch (err) {
        return null;
    }
}

function millionaireTone(freq = 440, duration = .12, type = 'sine', volume = .035, delay = 0) {
    const ctx = getMillionaireAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = ctx.currentTime + delay;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    const boostedVolume = millionaireBoostVolume(volume);
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0002, boostedVolume), start + .015);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + .02);
}

const MILLIONAIRE_AUDIO_FILES = {
    start: 'assets/sounds/millionaire/opening.mp3',
    thinking: 'assets/sounds/millionaire/thinking.mp3',
    lock: 'assets/sounds/millionaire/lock.mp3',
    correct: 'assets/sounds/millionaire/correct.mp3',
    wrong: 'assets/sounds/millionaire/wrong.mp3',
    fifty: 'assets/sounds/millionaire/fifty.mp3',
    audience: 'assets/sounds/millionaire/audience.mp3',
    switch: 'assets/sounds/millionaire/switch.mp3',
    milestone: 'assets/sounds/millionaire/milestone.mp3',
    winner: 'assets/sounds/millionaire/winner.mp3'
};

let millionaireThinkingAudio = null;
const millionaireActiveAudio = new Set();

function preloadMillionaireAudio() {
    Object.entries(MILLIONAIRE_AUDIO_FILES).forEach(([name, src]) => {
        if (name === 'thinking') return;
        try {
            const audio = new Audio(src);
            audio.preload = 'auto';
        } catch (err) {}
    });
}

function stopMillionaireThinking() {
    if (!millionaireThinkingAudio) return;
    try {
        millionaireThinkingAudio.pause();
        millionaireThinkingAudio.currentTime = 0;
    } catch (err) {}
    millionaireThinkingAudio = null;
}

function stopMillionaireAllAudio() {
    stopMillionaireThinking();
    millionaireActiveAudio.forEach(audio => {
        try {
            audio.pause();
            audio.currentTime = 0;
        } catch (err) {}
    });
    millionaireActiveAudio.clear();
}

function playMillionaireAudioFile(name, options = {}) {
    if (!MILLIONAIRE_STATE.soundEnabled) return false;
    const src = MILLIONAIRE_AUDIO_FILES[name];
    if (!src) return false;

    try {
        if (name === 'thinking') {
            stopMillionaireThinking();
            const audio = new Audio(src);
            audio.loop = true;
            audio.volume = millionaireBoostVolume(options.volume ?? 0.36);
            millionaireThinkingAudio = audio;
            const promise = audio.play();
            if (promise?.catch) {
                promise.catch(() => {
                    if (millionaireThinkingAudio === audio) millionaireThinkingAudio = null;
                });
            }
            return true;
        }

        const audio = new Audio(src);
        audio.volume = millionaireBoostVolume(options.volume ?? 0.72);
        millionaireActiveAudio.add(audio);
        audio.addEventListener('ended', () => millionaireActiveAudio.delete(audio), { once: true });
        audio.addEventListener('error', () => millionaireActiveAudio.delete(audio), { once: true });
        const promise = audio.play();
        if (promise?.catch) {
            promise.catch(() => {
                millionaireActiveAudio.delete(audio);
                millionaireFallbackSound(name);
            });
        }
        return true;
    } catch (err) {
        return false;
    }
}

function millionaireFallbackSound(name) {
    if (!MILLIONAIRE_STATE.soundEnabled) return;
    switch (name) {
        case 'start':
            [392, 523.25, 659.25, 783.99].forEach((f, i) => millionaireTone(f, .16, 'triangle', .04, i * .09));
            break;
        case 'lock':
            millionaireTone(220, .12, 'square', .025);
            millionaireTone(330, .12, 'square', .025, .13);
            break;
        case 'correct':
        case 'milestone':
            [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => millionaireTone(f, .18, 'triangle', .045, i * .08));
            break;
        case 'wrong':
            [220, 185, 147].forEach((f, i) => millionaireTone(f, .24, 'sawtooth', .03, i * .11));
            break;
        case 'fifty':
            // Hiệu ứng 50:50: hai nhịp hạ dần, gợi cảm giác loại bỏ hai phương án.
            [880, 660, 440].forEach((f, i) => millionaireTone(f, .16, 'triangle', .045, i * .10));
            break;
        case 'audience':
            // Hiệu ứng khán giả: chuỗi nhịp tăng dần như kết quả bình chọn xuất hiện.
            [392, 523.25, 659.25, 783.99].forEach((f, i) => millionaireTone(f, .13, 'sine', .04, i * .075));
            break;
        case 'switch':
        case 'lifeline':
            [660, 880].forEach((f, i) => millionaireTone(f, .14, 'sine', .03, i * .08));
            break;
        case 'question':
            millionaireTone(440, .08, 'sine', .02);
            millionaireTone(554.37, .10, 'sine', .02, .06);
            break;
        case 'winner':
            [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => millionaireTone(f, .25, 'triangle', .045, i * .10));
            break;
    }
}

function millionaireSound(name) {
    const mappedName = name === 'lifeline' ? 'audience' : name;

    // 3F.12C: 50:50 và Khán giả phải luôn có âm thanh ngay cả khi gói web
    // không có file MP3 riêng. Dùng hiệu ứng Web Audio tích hợp để bảo đảm phát được.
    if (name === 'fifty' || name === 'audience') {
        millionaireFallbackSound(name);
        return;
    }

    if (!playMillionaireAudioFile(mappedName)) {
        millionaireFallbackSound(name);
    }
}

function millionaireStartThinking(delay = 0) {
    if (!MILLIONAIRE_STATE.soundEnabled || MILLIONAIRE_STATE.ended) return;
    setTimeout(() => {
        if (
            MILLIONAIRE_STATE.soundEnabled &&
            MILLIONAIRE_STATE.started &&
            !MILLIONAIRE_STATE.ended &&
            !MILLIONAIRE_STATE.locked
        ) {
            playMillionaireAudioFile('thinking', { volume: 0.34 });
        }
    }, delay);
}

function millionaireToggleSound() {
    MILLIONAIRE_STATE.soundEnabled = !MILLIONAIRE_STATE.soundEnabled;
    if (!MILLIONAIRE_STATE.soundEnabled) {
        stopMillionaireAllAudio();
    } else {
        millionaireSound('question');
        if (MILLIONAIRE_STATE.started && !MILLIONAIRE_STATE.ended && !MILLIONAIRE_STATE.locked) {
            millionaireStartThinking(180);
        }
    }
    refreshMillionaire();
}

// ============================================================
// BƯỚC 151.49.3F.12B - GIỌNG MC (Web Speech API, không dùng API trả phí)
// ============================================================
let millionaireMCVoice = null;

function millionaireMCSupported() {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

// BƯỚC 151.49.3F.17B.11 - Ưu tiên giọng đọc tiếng Việt miền Nam.
// Web Speech API phụ thuộc bộ giọng có sẵn trên từng thiết bị/trình duyệt.
// Nếu thiết bị có giọng được nhận diện là miền Nam, hệ thống ưu tiên giọng đó;
// nếu không có thì tự động dùng giọng tiếng Việt tốt nhất đang có để trò chơi vẫn hoạt động.
const MILLIONAIRE_SOUTHERN_VOICE_HINTS = [
    /hoai\s*my/i,
    /hoài\s*my/i,
    /southern/i,
    /south\s*vietnam/i,
    /south\s*vietnamese/i,
    /mi[eề]n\s*nam/i,
    /sai\s*gon/i,
    /sài\s*gòn/i
];

function millionaireMCIsSouthernVoice(voice) {
    const text = `${voice?.name || ''} ${voice?.voiceURI || ''}`;
    return MILLIONAIRE_SOUTHERN_VOICE_HINTS.some(pattern => pattern.test(text));
}

function millionaireMCFindVietnameseVoice() {
    if (!millionaireMCSupported()) return null;

    const voices = window.speechSynthesis.getVoices() || [];
    const vietnameseVoices = voices.filter(v =>
        /^vi(?:-|$)/i.test(String(v.lang || '')) || /Vietnam/i.test(String(v.name || ''))
    );

    // Ưu tiên 1: giọng tiếng Việt có dấu hiệu miền Nam.
    millionaireMCVoice = vietnameseVoices.find(millionaireMCIsSouthernVoice)
        // Ưu tiên 2: giọng vi-VN chuẩn của thiết bị.
        || vietnameseVoices.find(v => /^vi-VN$/i.test(String(v.lang || '')))
        // Ưu tiên 3: bất kỳ giọng tiếng Việt nào còn lại.
        || vietnameseVoices[0]
        || null;

    if (millionaireMCVoice) {
        console.log(
            `[MILLIONAIRE MC] Giọng đang dùng: ${millionaireMCVoice.name} (${millionaireMCVoice.lang})` +
            `${millionaireMCIsSouthernVoice(millionaireMCVoice) ? ' - ưu tiên miền Nam' : ' - giọng Việt dự phòng'}`
        );
    }

    return millionaireMCVoice;
}

// Công cụ kiểm tra nhanh các giọng tiếng Việt mà thiết bị hiện có.
// Chỉ phục vụ kiểm tra; không ảnh hưởng trò chơi.
function millionaireMCListVietnameseVoices() {
    if (!millionaireMCSupported()) return [];
    return (window.speechSynthesis.getVoices() || [])
        .filter(v => /^vi(?:-|$)/i.test(String(v.lang || '')) || /Vietnam/i.test(String(v.name || '')))
        .map(v => ({
            name: v.name,
            lang: v.lang,
            voiceURI: v.voiceURI,
            localService: v.localService,
            southernPreferred: millionaireMCIsSouthernVoice(v)
        }));
}

window.millionaireMCListVietnameseVoices = millionaireMCListVietnameseVoices;

function millionaireMCStop() {
    if (!millionaireMCSupported()) return;
    try { window.speechSynthesis.cancel(); } catch (e) {}
}

function millionaireMCSpeak(text, options = {}) {
    const onEnd = typeof options.onEnd === 'function' ? options.onEnd : null;
    if (!MILLIONAIRE_STATE.mcEnabled || !millionaireMCSupported() || !String(text || '').trim()) {
        if (onEnd) setTimeout(onEnd, 0);
        return false;
    }
    try {
        if (options.clear) millionaireMCStop();
        const utter = new SpeechSynthesisUtterance(String(text).replace(/\s+/g, ' ').trim());
        utter.lang = 'vi-VN';
        // 3F.12C: đọc nhanh hơn để nhịp trò chơi tự nhiên, không kéo dài thời gian chờ.
        utter.rate = 1.15;
        utter.pitch = 1.0;
        utter.volume = 1.0;
        const voice = millionaireMCVoice || millionaireMCFindVietnameseVoice();
        if (voice) utter.voice = voice;
        let finished = false;
        const done = () => {
            if (finished) return;
            finished = true;
            if (onEnd) onEnd();
        };
        utter.onend = done;
        utter.onerror = done;
        window.speechSynthesis.speak(utter);
        return true;
    } catch (err) {
        console.warn('[MILLIONAIRE MC] Không đọc được:', err);
        if (onEnd) setTimeout(onEnd, 0);
        return false;
    }
}

function millionaireMCPlayModeRule() {
    const mode = MILLIONAIRE_STATE.playMode || 'stop_on_wrong';
    if (mode === 'continue_on_wrong') return 'Nếu trả lời sai, người chơi vẫn tiếp tục sang câu tiếp theo.';
    if (mode === 'retry_until_correct') return 'Nếu trả lời sai, người chơi được chọn lại cho đến khi có đáp án đúng.';
    return 'Nếu trả lời sai, lượt chơi sẽ kết thúc.';
}

function millionaireMCRulesText() {
    const timer = MILLIONAIRE_STATE.timerEnabled
        ? `Mỗi câu có ${millionaireTimerTotalSeconds()} giây để trả lời.`
        : 'Trò chơi hiện không giới hạn thời gian cho mỗi câu.';
    return `Xin chào! Chào mừng bạn đến với trò chơi Ai là triệu phú. Trò chơi sử dụng số câu hỏi hiện có của bộ câu hỏi đã chọn. Mỗi câu có bốn phương án A, B, C và D, chỉ có một đáp án đúng. Bạn có ba quyền trợ giúp: năm mươi năm mươi, hỏi ý kiến khán giả và đổi câu hỏi. ${millionaireMCPlayModeRule()} ${timer} Chúc bạn bình tĩnh, tự tin và có một lượt chơi thật vui!`;
}

function millionaireMCQuestionText(question = getMillionaireCurrentQuestion()) {
    if (!question) return '';
    const labels = ['A', 'B', 'C', 'D'];
    const answers = (question.a || []).map((answer, idx) => `Đáp án ${labels[idx]}: ${answer}.`).join(' ');
    return `Câu ${MILLIONAIRE_STATE.level + 1} trên ${MILLIONAIRE_STATE.questions.length}. ${question.q}. ${answers} Bạn chọn đáp án nào?`;
}

function millionaireMCPresentCurrentQuestion({ intro = false, clear = false } = {}) {
    const state = MILLIONAIRE_STATE;
    const question = getMillionaireCurrentQuestion();
    if (!state.started || state.ended || !question) return;
    millionaireStopTimer();
    stopMillionaireThinking();
    const expectedLevel = state.level;
    const speech = `${intro ? millionaireMCRulesText() + ' ' : ''}${millionaireMCQuestionText(question)}`;
    const resume = () => {
        if (!state.started || state.ended || state.locked || state.level !== expectedLevel) return;
        millionaireStartThinking(180);
        millionaireStartTimer(true);
    };
    if (!state.mcEnabled || !millionaireMCSupported()) {
        resume();
        return;
    }
    millionaireMCSpeak(speech, { clear, onEnd: resume });
}

function millionaireMCAnnounce(text) {
    if (!MILLIONAIRE_STATE.mcEnabled) return;
    millionaireMCSpeak(text, { clear: false });
}

function millionaireMCRepeatQuestion() {
    if (!MILLIONAIRE_STATE.started || MILLIONAIRE_STATE.ended) return;
    millionaireMCPresentCurrentQuestion({ intro: false, clear: true });
}

function millionaireMCReadRules() {
    millionaireMCSpeak(millionaireMCRulesText(), { clear: true });
}

function millionaireSetMCEnabled(value) {
    MILLIONAIRE_STATE.mcEnabled = !!value;
    if (!MILLIONAIRE_STATE.mcEnabled) millionaireMCStop();
    saveMillionaireStateToStorage();
    refreshMillionaire();
}

if (millionaireMCSupported()) {
    millionaireMCFindVietnameseVoice();
    window.speechSynthesis.onvoiceschanged = () => millionaireMCFindVietnameseVoice();
}


// ============================================================
// BƯỚC 151.49.3F.13 - KHÔNG KHÍ GAMESHOW + NGHI THỨC MỐC ĐIỂM
// Nhạc mở màn là bản hiệu ứng gốc của ứng dụng, không sao chép nhạc chương trình truyền hình.
// ============================================================
function millionairePrizeAtLevel(level) {
    const safe = Math.max(1, Math.min(15, Number(level) || 1));
    return MILLIONAIRE_PRIZES[safe - 1] || '0';
}

function millionaireRemoveCelebration() {
    document.querySelectorAll('.millionaire-celebration-overlay').forEach(el => el.remove());
}

function millionaireShowCelebration({ icon = 'fa-award', kicker = '', title = '', message = '', cheque = '', winner = false, duration = 3200 } = {}) {
    millionaireRemoveCelebration();
    const overlay = document.createElement('div');
    overlay.className = `millionaire-celebration-overlay ${winner ? 'winner' : ''}`;
    overlay.innerHTML = `
        <div class="millionaire-celebration-card">
            <div class="millionaire-celebration-rays"></div>
            <div class="millionaire-celebration-icon"><i class="fas ${icon}"></i></div>
            ${kicker ? `<div class="millionaire-celebration-kicker">${escapeHtml(kicker)}</div>` : ''}
            <div class="millionaire-celebration-title">${escapeHtml(title)}</div>
            <div class="millionaire-celebration-message">${escapeHtml(message)}</div>
            ${cheque ? `<div class="millionaire-cheque"><small>TẤM SÉC THÀNH TÍCH</small><strong>${escapeHtml(cheque)}</strong><span>ĐIỂM THƯỞNG</span></div>` : ''}
        </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('show'));

    const close = () => {
        if (!overlay.isConnected) return;
        overlay.classList.remove('show');
        setTimeout(() => overlay.remove(), 320);
    };
    overlay._millionaireClose = close;
    if (duration > 0) setTimeout(close, Math.max(1600, duration));
    return overlay;
}

function millionaireMilestoneMCText(level) {
    const prize = millionairePrizeAtLevel(level);
    if (level === 5) return `Xin chúc mừng! Bạn đã vượt qua mốc số 5 và nhận tấm séc thành tích tượng trưng ${prize} điểm thưởng. Một khởi đầu rất tuyệt vời. Hãy tiếp tục tự tin!`;
    if (level === 10) return `Tuyệt vời! Bạn đã chinh phục mốc số 10 và nhận tấm séc thành tích tượng trưng ${prize} điểm thưởng. Bạn đang tiến rất gần đến đích. Chúc bạn giữ vững phong độ!`;
    return `Xin chúc mừng! Bạn đã vượt qua mốc ${level}.`;
}

function millionaireCelebrateMilestone(level, onComplete = null) {
    const prize = millionairePrizeAtLevel(level);
    millionaireSound('milestone');
    const startedAt = Date.now();
    const overlay = millionaireShowCelebration({
        icon: 'fa-file-signature',
        kicker: `CHINH PHỤC MỐC ${level}`,
        title: 'XIN CHÚC MỪNG!',
        message: level === 5 ? 'Bạn đã có một khởi đầu rất ấn tượng.' : 'Bạn đang tiến rất gần đến thử thách cuối cùng.',
        cheque: prize,
        duration: 0
    });

    const finish = () => {
        const wait = Math.max(0, 3400 - (Date.now() - startedAt));
        setTimeout(() => {
            if (overlay && typeof overlay._millionaireClose === 'function') overlay._millionaireClose();
            if (typeof onComplete === 'function') setTimeout(onComplete, 380);
        }, wait);
    };

    if (MILLIONAIRE_STATE.mcEnabled && millionaireMCSupported()) {
        millionaireMCSpeak(millionaireMilestoneMCText(level), { clear: false, onEnd: finish });
    } else {
        finish();
    }
}

function millionaireWinnerMCText(totalQuestions) {
    if (totalQuestions >= 15) {
        return `Một màn chinh phục xuất sắc! Xin chúc mừng bạn đã vượt qua cả 15 câu hỏi và hoàn thành thử thách cao nhất của trò chơi. Bạn xứng đáng nhận tấm séc thành tích ở mốc 15. Cảm ơn bạn đã tham gia và hẹn gặp lại ở lượt chơi tiếp theo!`;
    }
    return `Xuất sắc! Xin chúc mừng bạn đã trả lời đúng toàn bộ ${totalQuestions} câu hỏi của bài học và hoàn thành trọn vẹn thử thách hôm nay. Cảm ơn bạn đã tham gia và hẹn gặp lại ở lượt chơi tiếp theo!`;
}

function millionaireWrongEndingMCText(safeLevel, answeredCorrect, totalQuestions) {
    const correct = Math.max(0, Number(answeredCorrect) || 0);
    const total = Math.max(0, Number(totalQuestions) || 0);
    const result = `Trong lượt chơi này, bạn đã trả lời đúng ${correct} trên ${total} câu hỏi.`;
    if (safeLevel >= 10) {
        return `Rất tiếc, đáp án cuối cùng bạn vừa chọn chưa chính xác và cuộc chơi dừng lại tại đây. ${result} Bạn đã bảo toàn mốc số 10 với ${millionairePrizeAtLevel(10)} điểm thưởng. Đây là một kết quả rất đáng khen. Cảm ơn bạn đã tham gia và hẹn gặp lại!`;
    }
    if (safeLevel >= 5) {
        return `Rất tiếc, đáp án cuối cùng bạn vừa chọn chưa chính xác và cuộc chơi phải dừng lại. ${result} Bạn đã bảo toàn mốc số 5 với ${millionairePrizeAtLevel(5)} điểm thưởng. Chúc mừng những gì bạn đã làm được và hẹn gặp lại ở lượt chơi tiếp theo!`;
    }
    return `Rất tiếc, đáp án cuối cùng bạn vừa chọn chưa chính xác và cuộc chơi dừng lại tại đây. ${result} Cảm ơn bạn đã tham gia. Hãy ôn lại bài học và trở lại chinh phục thử thách trong lượt chơi tiếp theo nhé!`;
}

function millionaireStageClass() {
    const p = MILLIONAIRE_STATE.phase;
    return p ? `millionaire-phase-${p}` : '';
}

function renderMillionaireLadder() {
    const total = MILLIONAIRE_STATE.questions?.length || 15;
    const prizes = MILLIONAIRE_PRIZES.slice(0, Math.max(1, Math.min(15, total)));
    return prizes.map((prize, idx) => {
        const level = idx + 1;
        const current = MILLIONAIRE_STATE.started && !MILLIONAIRE_STATE.ended && MILLIONAIRE_STATE.level === idx;
        const passed = MILLIONAIRE_STATE.started && idx < MILLIONAIRE_STATE.level;
        const milestone = [5, 10, total].includes(level);
        return `
            <div class="millionaire-ladder-row ${current ? 'current' : ''} ${passed ? 'passed' : ''} ${milestone ? 'milestone' : ''}">
                <span>${level}</span>
                <strong>${prize}</strong>
            </div>
        `;
    }).reverse().join('');
}

function renderMillionaireAudience() {
    const result = MILLIONAIRE_STATE.audienceResult;
    if (!result) return '';
    const labels = ['A', 'B', 'C', 'D'];
    return `
        <div class="millionaire-audience-panel">
            <div class="millionaire-audience-title"><i class="fas fa-users"></i> Ý kiến khán giả</div>
            <div class="millionaire-audience-bars">
                ${result.map((percent, idx) => `
                    <div class="millionaire-audience-item">
                        <div class="millionaire-audience-bar-wrap">
                            <div class="millionaire-audience-bar" style="height:${Math.max(4, percent)}%"></div>
                        </div>
                        <strong>${percent}%</strong>
                        <span>${labels[idx]}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function renderMillionaire() {
    restoreMillionaireStateFromStorage();
    const state = MILLIONAIRE_STATE;
    const question = getMillionaireCurrentQuestion();
    const labels = ['A', 'B', 'C', 'D'];

    let mainContent = '';
    if (!state.started) {
        mainContent = `
            <div class="millionaire-welcome">
                <div class="millionaire-logo-orb"><i class="fas fa-coins"></i></div>
                <h2>AI LÀ TRIỆU PHÚ</h2>
                <p>Số câu linh hoạt · 4 phương án · 3 quyền trợ giúp</p>
                ${renderMillionaireBankSelector()}
                <div class="millionaire-welcome-actions">
                    <button class="btn millionaire-manager-open-btn" onclick="millionaireOpenQuestionManager()">
                        <i class="fas fa-list-check"></i> Quản lý câu hỏi
                    </button>
                    <button class="btn" onclick="millionaireResetQuestionHistory()" title="Cho phép toàn bộ câu hỏi được chọn lại từ đầu trên thiết bị này">
                        <i class="fas fa-rotate-left"></i> Đặt lại lịch sử câu hỏi
                    </button>
                </div>
                ${renderMillionaireQuestionManager()}
                <div class="millionaire-timer-settings">
                    <div class="millionaire-timer-settings-title"><i class="fas fa-stopwatch"></i> Bộ đếm thời gian</div>
                    <label class="millionaire-timer-switch"><input type="checkbox" ${state.timerEnabled ? 'checked' : ''} onchange="millionaireSetTimerEnabled(this.checked)"><span><strong>Bật bộ đếm</strong><small>Tự đếm lại ở mỗi câu.</small></span></label>
                    <label class="millionaire-timer-switch"><input type="checkbox" ${state.timerSoundEnabled ? 'checked' : ''} onchange="millionaireSetTimerSoundEnabled(this.checked)"><span><strong>Âm báo thời gian</strong><small>Tít 10 giây cuối, dồn ở 5 giây cuối và âm riêng khi hết giờ.</small></span></label>
                    <div class="millionaire-timer-controls">
                        <select onchange="if(this.value)millionaireSetTimerPreset(this.value)"><option value="">Chọn nhanh...</option>${[15,30,45,60,90,120].map(v=>`<option value="${v}" ${state.timerSeconds===v?'selected':''}>${v<60?v+' giây':v===60?'1 phút':v===90?'1 phút 30 giây':'2 phút'}</option>`).join('')}</select>
                        <input id="millionaireTimerMinutes" type="number" min="0" max="59" value="${Math.floor((state.timerSeconds||30)/60)}"><span>phút</span>
                        <input id="millionaireTimerSeconds" type="number" min="0" max="59" value="${(state.timerSeconds||30)%60}"><span>giây</span>
                        <button class="btn" onclick="millionaireSetCustomTimer()"><i class="fas fa-check"></i> Áp dụng</button>
                    </div>
                </div>
                <div class="millionaire-play-mode-box">
                    <div class="millionaire-play-mode-title"><i class="fas fa-gamepad"></i> Luật chơi</div>
                    <label><input type="radio" name="millionairePlayMode" value="stop_on_wrong" ${state.playMode === 'stop_on_wrong' ? 'checked' : ''} onchange="millionaireSetPlayMode(this.value)"><span><strong>1. Sai là dừng</strong><small>Chọn sai → kết thúc lượt chơi.</small></span></label>
                    <label><input type="radio" name="millionairePlayMode" value="continue_on_wrong" ${state.playMode === 'continue_on_wrong' ? 'checked' : ''} onchange="millionaireSetPlayMode(this.value)"><span><strong>2. Sai vẫn tiếp tục</strong><small>Chọn sai → báo sai → chuyển sang câu tiếp theo.</small></span></label>
                    <label><input type="radio" name="millionairePlayMode" value="retry_until_correct" ${state.playMode === 'retry_until_correct' ? 'checked' : ''} onchange="millionaireSetPlayMode(this.value)"><span><strong>3. Phải chọn đúng mới qua câu</strong><small>Chọn sai → ở nguyên câu và chọn lại đến khi đúng.</small></span></label>
                </div>
                <div class="millionaire-mc-settings">
                    <div class="millionaire-mc-settings-title"><i class="fas fa-microphone-lines"></i> Người dẫn chương trình</div>
                    <label class="millionaire-timer-switch"><input type="checkbox" ${state.mcEnabled ? 'checked' : ''} onchange="millionaireSetMCEnabled(this.checked)"><span><strong>Bật giọng MC</strong><small>MC đọc luật chơi, câu hỏi, 4 đáp án và thông báo đúng/sai bằng tiếng Việt.</small></span></label>
                    <button class="btn millionaire-mc-test-btn" onclick="millionaireMCReadRules()"><i class="fas fa-volume-high"></i> Nghe thử luật chơi</button>
                    ${!millionaireMCSupported() ? '<small class="millionaire-mc-warning">Trình duyệt này không hỗ trợ đọc văn bản. Trò chơi vẫn hoạt động bình thường.</small>' : ''}
                </div>
                <button class="btn millionaire-start-btn" onclick="millionaireStart()">
                    <i class="fas fa-play"></i> Bắt đầu
                </button>
            </div>
        `;
    } else if (state.ended) {
        const wonLevel = Math.max(0, state.level);
        const wonPrize = wonLevel > 0 ? MILLIONAIRE_PRIZES[Math.min(wonLevel - 1, 14)] : '0';
        const isWinner = state.questions.length > 0 && state.level >= state.questions.length;
        mainContent = `
            <div class="millionaire-welcome millionaire-end">
                <div class="millionaire-logo-orb ${isWinner ? 'winner' : ''}">
                    <i class="fas ${isWinner ? 'fa-trophy' : 'fa-flag-checkered'}"></i>
                </div>
                <h2>${isWinner ? 'XUẤT SẮC!' : 'KẾT THÚC LƯỢT CHƠI'}</h2>
                <p>${escapeHtml(state.message)}</p>
                <div class="millionaire-final-prize">${wonPrize} điểm thưởng</div>
                <button class="btn millionaire-start-btn" onclick="millionaireRestart()">
                    <i class="fas fa-rotate-right"></i> Chơi lại
                </button>
            </div>
        `;
    } else if (question) {
        mainContent = `
            <div class="millionaire-stage">
                <div class="millionaire-status-line">
                    <span>Câu ${state.level + 1}/${state.questions.length} · ${question?.difficulty === 'easy' ? 'Dễ' : question?.difficulty === 'medium' ? 'Trung bình' : 'Khó'}</span>
                    ${state.timerEnabled ? `<span id="millionaireTimerDisplay" class="millionaire-timer-display ${state.timerRemaining<=10?'urgent':''} ${state.timerRemaining<=5?'critical':''}">${millionaireFormatTimer(state.timerRemaining)}</span>` : ''}
                    <strong>${MILLIONAIRE_PRIZES[state.level]} điểm</strong>
                </div>
                <div class="millionaire-question-meta">
                    ${escapeHtml(question?.subject || 'Tổng hợp')} · ${escapeHtml(question?.topic || 'Kiến thức chung')}
                </div>

                <div class="millionaire-question millionaire-question-animate">
                    ${escapeHtml(question.q)}
                </div>

                <div class="millionaire-answers">
                    ${question.a.map((answer, idx) => {
                        const hidden = state.hiddenAnswers.includes(idx);
                        const triedWrong = state.playMode === 'retry_until_correct' && state.wrongAttempts.includes(idx);
                        const selected = state.selectedIndex === idx;
                        const isCorrectReveal = state.locked && idx === question.c;
                        const isWrongReveal = state.locked && selected && idx !== question.c;
                        return `
                            <button class="millionaire-answer
                                ${hidden ? 'hidden-answer' : ''}
                                ${triedWrong ? 'wrong-attempt' : ''}
                                ${selected ? 'selected' : ''}
                                ${isCorrectReveal ? 'correct' : ''}
                                ${isWrongReveal ? 'wrong' : ''}"
                                ${hidden || triedWrong || state.locked ? 'disabled' : ''}
                                onclick="millionaireChooseAnswer(${idx})">
                                <span class="millionaire-answer-label">${labels[idx]}:</span>
                                <span>${escapeHtml(answer)}</span>
                            </button>
                        `;
                    }).join('')}
                </div>

                <div class="millionaire-message">${escapeHtml(state.message)}</div>
                ${renderMillionaireAudience()}
            </div>
        `;
    }

    return `
        <div class="millionaire-page ${millionaireStageClass()}">
            <div class="millionaire-shell">
                <section class="millionaire-main">
                    <div class="millionaire-brand">
                        <div class="millionaire-brand-top">
                            <span><i class="fas fa-star"></i> Trò chơi kiến thức</span>
                            <div class="millionaire-audio-actions">
                                <button class="millionaire-sound-toggle ${state.mcEnabled ? 'mc-on' : 'mc-off'}" onclick="millionaireSetMCEnabled(${state.mcEnabled ? 'false' : 'true'})" title="${state.mcEnabled ? 'Tắt giọng MC' : 'Bật giọng MC'}">
                                    <i class="fas ${state.mcEnabled ? 'fa-microphone-lines' : 'fa-microphone-slash'}"></i>
                                </button>
                                <button class="millionaire-sound-toggle" onclick="millionaireMCRepeatQuestion()" title="Đọc lại câu hỏi và 4 đáp án" ${!state.started || state.ended ? 'disabled' : ''}>
                                    <i class="fas fa-ear-listen"></i>
                                </button>
                                <button class="millionaire-sound-toggle" onclick="millionaireToggleSound()" title="${state.soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}">
                                    <i class="fas ${state.soundEnabled ? 'fa-volume-high' : 'fa-volume-xmark'}"></i>
                                </button>
                            </div>
                        </div>
                        <h3>AI LÀ TRIỆU PHÚ</h3>
                    </div>

                    ${mainContent}

                    <div class="millionaire-lifelines">
                        <button class="millionaire-lifeline ${state.lifelines.fifty ? '' : 'used'}"
                                onclick="millionaireUseFifty()"
                                ${!state.started || state.ended || !state.lifelines.fifty || state.locked ? 'disabled' : ''}>
                            <i class="fas fa-divide"></i><span>50:50</span>
                        </button>
                        <button class="millionaire-lifeline ${state.lifelines.audience ? '' : 'used'}"
                                onclick="millionaireUseAudience()"
                                ${!state.started || state.ended || !state.lifelines.audience || state.locked ? 'disabled' : ''}>
                            <i class="fas fa-users"></i><span>Khán giả</span>
                        </button>
                        <button class="millionaire-lifeline ${state.lifelines.switch ? '' : 'used'}"
                                onclick="millionaireUseSwitch()"
                                ${!state.started || state.ended || !state.lifelines.switch || state.locked ? 'disabled' : ''}>
                            <i class="fas fa-shuffle"></i><span>Đổi câu</span>
                        </button>
                        <button class="millionaire-lifeline quit" onclick="millionaireQuit()"
                                ${!state.started || state.ended || state.locked ? 'disabled' : ''}>
                            <i class="fas fa-door-open"></i><span>Dừng chơi</span>
                        </button>
                        <button class="millionaire-lifeline end-session" onclick="millionaireEndSession()"
                                ${!state.started && !state.ended ? 'disabled' : ''}>
                            <i class="fas fa-stop"></i><span>Kết thúc</span>
                        </button>
                    </div>
                </section>

                <aside class="millionaire-ladder">
                    <div class="millionaire-ladder-title"><i class="fas fa-trophy"></i> Mốc điểm</div>
                    ${renderMillionaireLadder()}
                </aside>
            </div>
        </div>
    `;
}

function refreshMillionaire() {
    saveMillionaireStateToStorage();
    if (APP_STATE.currentPage !== 'millionaire') return;
    const container = document.getElementById('pageContainer');
    if (container) container.innerHTML = renderMillionaire();
}

function initMillionaire() {
    // Không reset khi quay lại module. Chỉ khởi tạo nếu chưa từng có state.
    if (!Array.isArray(MILLIONAIRE_STATE.questions)) {
        resetMillionaireState();
    }

        // BƯỚC 151.49.3F.17B.7:
    // Tự động tải ngân hàng câu hỏi dùng chung từ Supabase.
    if (!millionaireSupabaseQuestionsLoaded) {
        loadMillionaireQuestionsFromSupabase()
            .then(items => {
    console.log(
        `[151.49.3F.17B.7] Ngân hàng dùng chung sẵn sàng: ${items.length} câu.`
    );

    // Render lại một lần sau khi dữ liệu Supabase đã tải xong.
    refreshMillionaire();
})
            .catch(error => {
                console.error(
                    '[151.49.3F.17B.7] Lỗi khởi tạo ngân hàng Supabase:',
                    error
                );
            });
    }
    preloadMillionaireAudio();

    // Nếu đang giữa một câu và chỉ vừa chuyển module rồi quay lại,
    // tiếp tục nhạc suy nghĩ sau khi giao diện đã được render lại.
    if (
        MILLIONAIRE_STATE.started &&
        !MILLIONAIRE_STATE.ended &&
        !MILLIONAIRE_STATE.locked &&
        MILLIONAIRE_STATE.soundEnabled
    ) {
        millionaireStartThinking(220);
    }
}


function millionaireTimerTotalSeconds(){const v=Number(MILLIONAIRE_STATE.timerSeconds);return Number.isFinite(v)?Math.max(1,Math.min(3599,Math.round(v))):30}
function millionaireSetTimerEnabled(v){MILLIONAIRE_STATE.timerEnabled=!!v;if(!v)millionaireStopTimer();saveMillionaireStateToStorage();refreshMillionaire()}
function millionaireSetTimerSoundEnabled(v){MILLIONAIRE_STATE.timerSoundEnabled=!!v;saveMillionaireStateToStorage();refreshMillionaire()}
function millionaireSetTimerPreset(v){v=Number(v);if(v>0){MILLIONAIRE_STATE.timerSeconds=Math.min(3599,Math.round(v));MILLIONAIRE_STATE.timerRemaining=MILLIONAIRE_STATE.timerSeconds;saveMillionaireStateToStorage();refreshMillionaire()}}
function millionaireSetCustomTimer(){const m=Math.max(0,Number(document.getElementById('millionaireTimerMinutes')?.value||0));const s=Math.max(0,Number(document.getElementById('millionaireTimerSeconds')?.value||0));const total=Math.min(3599,Math.round(m*60+s));if(total<1){alert('Thời gian phải lớn hơn 0 giây.');return}MILLIONAIRE_STATE.timerSeconds=total;MILLIONAIRE_STATE.timerRemaining=total;saveMillionaireStateToStorage();refreshMillionaire()}
function millionaireFormatTimer(v){v=Math.max(0,Number(v)||0);return `${String(Math.floor(v/60)).padStart(2,'0')}:${String(v%60).padStart(2,'0')}`}
function millionaireTimerBeep(kind='tick'){if(!MILLIONAIRE_STATE.timerEnabled||!MILLIONAIRE_STATE.timerSoundEnabled)return;try{const C=window.AudioContext||window.webkitAudioContext;if(!C)return;const c=millionaireTimerBeep._ctx||(millionaireTimerBeep._ctx=new C());if(c.state==='suspended')c.resume();const o=c.createOscillator(),g=c.createGain(),n=c.currentTime;o.connect(g);g.connect(c.destination);if(kind==='timeout'){o.frequency.setValueAtTime(330,n);o.frequency.exponentialRampToValueAtTime(180,n+.55);g.gain.setValueAtTime(millionaireBoostVolume(.14),n);g.gain.exponentialRampToValueAtTime(.001,n+.65);o.start(n);o.stop(n+.68)}else{o.frequency.value=kind==='urgent'?980:720;g.gain.setValueAtTime(millionaireBoostVolume(kind==='urgent'?.10:.055),n);g.gain.exponentialRampToValueAtTime(.001,n+.10);o.start(n);o.stop(n+.11)}}catch(e){}}
function millionaireStopTimer(){if(MILLIONAIRE_STATE.timerIntervalId){clearInterval(MILLIONAIRE_STATE.timerIntervalId);MILLIONAIRE_STATE.timerIntervalId=null}}
function millionaireStartTimer(reset=true){millionaireStopTimer();const s=MILLIONAIRE_STATE;if(!s.timerEnabled||!s.started||s.ended)return;if(reset)s.timerRemaining=millionaireTimerTotalSeconds();s.timerIntervalId=setInterval(()=>{if(s.locked||s.ended||!s.started)return;s.timerRemaining=Math.max(0,s.timerRemaining-1);const r=s.timerRemaining;if(r>0&&r<=10)millionaireTimerBeep(r<=5?'urgent':'tick');const el=document.getElementById('millionaireTimerDisplay');if(el){el.textContent=millionaireFormatTimer(r);el.classList.toggle('urgent',r<=10);el.classList.toggle('critical',r<=5)}if(r<=0){millionaireStopTimer();millionaireTimerBeep('timeout');millionaireHandleTimeout()}},1000)}
function millionaireHandleTimeout(){
    const s=MILLIONAIRE_STATE;
    if(!s.started||s.ended)return;
    const total=s.questions.length;
    stopMillionaireThinking();s.locked=true;s.phase='timeout';s.message='Hết thời gian!';millionaireMCAnnounce('Hết thời gian trả lời.');refreshMillionaire();
    if(s.playMode==='continue_on_wrong'){
        setTimeout(()=>{
            if(s.level>=total-1){s.level=total;s.ended=true;s.phase='finished';s.message=`Hết thời gian. Đã hoàn thành ${total} câu hỏi.`;refreshMillionaire();return}
            s.level++;s.locked=false;s.selectedIndex=null;s.hiddenAnswers=[];s.audienceResult=null;s.wrongAttempts=[];s.phase='question';s.message=`Hết thời gian. Tiếp tục câu ${s.level+1}.`;millionaireSound('question');refreshMillionaire();millionaireMCPresentCurrentQuestion()
        },1000);return
    }
    if(s.playMode==='retry_until_correct'){
        setTimeout(()=>{s.locked=false;s.selectedIndex=null;s.phase='question';s.message='Hết thời gian. Hãy tiếp tục chọn đến khi đúng.';refreshMillionaire()},900);return
    }
    setTimeout(()=>{
        const safe=s.level>=10?10:(s.level>=5?5:0);s.level=Math.min(safe,total);s.ended=true;s.phase='ended';s.message=safe?`Hết thời gian. Bạn bảo toàn mốc câu ${Math.min(safe,total)}.`:'Hết thời gian. Lượt chơi kết thúc.';refreshMillionaire()
    },900)
}

function millionaireSetPlayMode(mode) {
    if (!['stop_on_wrong','continue_on_wrong','retry_until_correct'].includes(mode)) return;
    MILLIONAIRE_STATE.playMode = mode;
    saveMillionaireStateToStorage();
    refreshMillionaire();
}

function millionaireStart() {
    stopMillionaireAllAudio();
    const playMode = MILLIONAIRE_STATE.playMode || 'stop_on_wrong';
    const mcEnabled = MILLIONAIRE_STATE.mcEnabled !== false;
    const timerEnabled=MILLIONAIRE_STATE.timerEnabled, timerSoundEnabled=MILLIONAIRE_STATE.timerSoundEnabled, timerSeconds=millionaireTimerTotalSeconds();
    const grade = MILLIONAIRE_STATE.selectedGrade || 'all';
    const subject = MILLIONAIRE_STATE.selectedSubject || 'all';
    const topic = MILLIONAIRE_STATE.selectedTopic || 'all';
    const questionSource = MILLIONAIRE_STATE.questionSource || 'custom';

    resetMillionaireState();
    MILLIONAIRE_STATE.playMode = playMode;
    MILLIONAIRE_STATE.mcEnabled = mcEnabled;
    MILLIONAIRE_STATE.timerEnabled=timerEnabled; MILLIONAIRE_STATE.timerSoundEnabled=timerSoundEnabled; MILLIONAIRE_STATE.timerSeconds=timerSeconds; MILLIONAIRE_STATE.timerRemaining=timerSeconds;
    MILLIONAIRE_STATE.wrongAttempts = [];
    MILLIONAIRE_STATE.selectedGrade = grade;
    MILLIONAIRE_STATE.selectedSubject = subject;
    MILLIONAIRE_STATE.selectedTopic = topic;
    MILLIONAIRE_STATE.questionSource = questionSource;
    MILLIONAIRE_STATE.questions = createMillionaireQuestionSet();

    if (MILLIONAIRE_STATE.questions.length < 1) {
        const info = MILLIONAIRE_STATE.bankInfo || {};
        MILLIONAIRE_STATE.started = false;
        MILLIONAIRE_STATE.message =
            `Nguồn ${questionSource === 'custom' ? 'Câu hỏi đã thêm' : 'Câu hỏi mẫu'} hiện chưa có câu hỏi phù hợp (${info.exactCount || 0} câu). ` +
            `Hãy kiểm tra Khối/Môn/Chủ đề hoặc chọn nguồn câu hỏi khác.`;
        refreshMillionaire();
        alert(MILLIONAIRE_STATE.message);
        return;
    }

    // BƯỚC 151.49.3F.19: ghi nhận toàn bộ câu đã được đưa vào ván này.
    // Ghi sau khi xác nhận ván hợp lệ để không tạo lịch sử giả khi bộ lọc rỗng.
    markMillionaireQuestionsUsed(MILLIONAIRE_STATE.questions, questionSource);

    MILLIONAIRE_STATE.started = true;
    MILLIONAIRE_STATE.phase = 'question';
    MILLIONAIRE_STATE.message = `Bộ câu hỏi có ${MILLIONAIRE_STATE.questions.length} câu. Chọn đáp án đúng.`;
    millionaireSound('start');
    refreshMillionaire();
    // 3F.13: dành vài giây cho nhạc mở màn trước khi MC bắt đầu dẫn chương trình.
    setTimeout(() => {
        if (MILLIONAIRE_STATE.started && !MILLIONAIRE_STATE.ended && MILLIONAIRE_STATE.level === 0) {
            millionaireMCPresentCurrentQuestion({ intro: true, clear: true });
        }
    }, 3600);
}

function millionaireRestart() {
    millionaireStart();
}

function millionaireChooseAnswer(index) {
    const state = MILLIONAIRE_STATE;
    const question = getMillionaireCurrentQuestion();
    if (!state.started || state.ended || state.locked || !question) return;
    if (state.hiddenAnswers.includes(index)) return;
    if (state.playMode === 'retry_until_correct' && state.wrongAttempts.includes(index)) return;

    state.selectedIndex = index;
    millionaireStopTimer();
    stopMillionaireThinking();
    millionaireMCStop();
    state.locked = true;
    state.phase = 'locked';
    state.message = 'Đã khóa đáp án...';
    millionaireSound('lock');
    refreshMillionaire();

    setTimeout(() => {
        if (index === question.c) {
            state.correctCount = Math.min(state.questions.length, (Number(state.correctCount) || 0) + 1);
            state.phase = 'correct';
            state.message = 'Chính xác!';
            state.wrongAttempts = [];
            millionaireSound('correct');
            millionaireMCAnnounce('Chính xác! Xin chúc mừng bạn.');
            refreshMillionaire();

            setTimeout(() => {
                const answeredLevel = state.level + 1;
                const totalQuestions = state.questions.length;
                if (answeredLevel >= totalQuestions) {
                    state.level = totalQuestions;
                    state.ended = true;
                    stopMillionaireThinking();
                    state.phase = 'winner';
                    state.message = `Bạn đã hoàn thành ${totalQuestions} câu hỏi!`;
                    millionaireSound('winner');
                    refreshMillionaire();
                    millionaireShowCelebration({
                        icon: 'fa-trophy',
                        kicker: totalQuestions >= 15 ? 'CHINH PHỤC MỐC 15' : 'HOÀN THÀNH THỬ THÁCH',
                        title: 'XUẤT SẮC!',
                        message: totalQuestions >= 15 ? 'Bạn đã vượt qua toàn bộ 15 câu hỏi.' : `Bạn đã trả lời đúng toàn bộ ${totalQuestions} câu hỏi của bài học.`,
                        cheque: totalQuestions >= 15 ? millionairePrizeAtLevel(15) : millionairePrizeAtLevel(totalQuestions),
                        winner: true,
                        duration: 4600
                    });
                    millionaireMCAnnounce(millionaireWinnerMCText(totalQuestions));
                    return;
                }
                state.level++;
                state.locked = false;
                state.selectedIndex = null;
                state.hiddenAnswers = [];
                state.audienceResult = null;
                state.wrongAttempts = [];
                state.phase = 'question';
                state.message = `Chính xác! Tiếp tục câu ${state.level + 1}.`;
                const isMilestone = [5,10].includes(answeredLevel);
                if (isMilestone) {
                    refreshMillionaire();
                    millionaireCelebrateMilestone(answeredLevel, () => {
                        if (state.started && !state.ended && state.level === answeredLevel) {
                            millionaireMCPresentCurrentQuestion({ clear: true });
                        }
                    });
                } else {
                    millionaireSound('question');
                    refreshMillionaire();
                    millionaireMCPresentCurrentQuestion();
                }
            }, 850);
            return;
        }

        stopMillionaireThinking();
        state.phase = 'wrong';
        millionaireSound('wrong');

        if (state.playMode === 'continue_on_wrong') {
            state.message = `Chưa đúng. Đáp án đúng là ${['A','B','C','D'][question.c]}.`;
            millionaireMCAnnounce(`Rất tiếc, đáp án chưa chính xác. Đáp án đúng là ${['A','B','C','D'][question.c]}: ${question.a[question.c]}.`);
            refreshMillionaire();
            setTimeout(() => {
                const totalQuestions = state.questions.length;
                if (state.level >= totalQuestions - 1) {
                    state.level = totalQuestions;
                    state.ended = true;
                    state.phase = 'finished';
                    state.message = `Đã hoàn thành ${totalQuestions} câu hỏi.`;
                    refreshMillionaire();
                    millionaireMCAnnounce(`Bạn đã đi hết ${totalQuestions} câu hỏi của lượt chơi. Cảm ơn bạn đã tham gia. Hãy xem lại những câu chưa chính xác và thử sức thêm một lần nữa nhé!`);
                    return;
                }
                state.level++;
                state.locked = false;
                state.selectedIndex = null;
                state.hiddenAnswers = [];
                state.audienceResult = null;
                state.wrongAttempts = [];
                state.phase = 'question';
                state.message = `Tiếp tục câu ${state.level + 1}.`;
                millionaireSound('question');
                refreshMillionaire();
                millionaireMCPresentCurrentQuestion();
            }, 1200);
            return;
        }

        if (state.playMode === 'retry_until_correct') {
            if (!state.wrongAttempts.includes(index)) state.wrongAttempts.push(index);
            state.message = 'Chưa đúng. Hãy chọn lại đáp án khác.';
            millionaireMCAnnounce('Rất tiếc, đáp án chưa chính xác. Bạn hãy suy nghĩ và chọn lại một đáp án khác.');
            refreshMillionaire();
            setTimeout(() => {
                state.locked = false;
                state.selectedIndex = null;
                state.phase = 'question';
                state.message = 'Hãy chọn lại. Chỉ khi đúng mới chuyển sang câu tiếp theo.';
                refreshMillionaire();
                millionaireStartThinking(250);
                millionaireStartTimer(true);
            }, 900);
            return;
        }

        state.message = 'Rất tiếc, đáp án chưa đúng.';
        millionaireMCAnnounce(`Rất tiếc, đáp án chưa chính xác. Đáp án đúng là ${['A','B','C','D'][question.c]}: ${question.a[question.c]}.`);
        refreshMillionaire();
        setTimeout(() => {
            const safeLevel = state.level >= 10 ? 10 : (state.level >= 5 ? 5 : 0);
            state.level = safeLevel;
            state.ended = true;
            state.phase = 'ended';
            state.message = safeLevel
                ? `Rất tiếc, đáp án chưa đúng. Bạn đã trả lời đúng ${state.correctCount}/${state.questions.length} câu và bảo toàn mốc câu ${safeLevel}.`
                : `Rất tiếc, đáp án chưa đúng. Bạn đã trả lời đúng ${state.correctCount}/${state.questions.length} câu.`;
            refreshMillionaire();
            if (safeLevel) {
                millionaireShowCelebration({
                    icon: 'fa-file-signature',
                    kicker: `BẢO TOÀN MỐC ${safeLevel}`,
                    title: 'CẢM ƠN BẠN ĐÃ THAM GIA',
                    message: 'Bạn đã giữ được thành tích ở mốc an toàn.',
                    cheque: millionairePrizeAtLevel(safeLevel),
                    duration: 3900
                });
            }
            millionaireMCAnnounce(millionaireWrongEndingMCText(safeLevel, state.correctCount, state.questions.length));
        }, 1000);
    }, 800);
}

function millionaireUseFifty() {
    const state = MILLIONAIRE_STATE;
    const q = getMillionaireCurrentQuestion();
    if (!q || !state.lifelines.fifty || state.locked) return;

    const wrong = [0,1,2,3].filter(i => i !== q.c);
    // Chọn 2 đáp án sai để loại.
    const shuffled = wrong.sort(() => Math.random() - 0.5);
    state.hiddenAnswers = shuffled.slice(0, 2);
    state.lifelines.fifty = false;
    state.phase = 'lifeline';
    stopMillionaireThinking();
    millionaireSound('fifty');
    state.message = '50:50 đã loại 2 phương án sai.';
    refreshMillionaire();
    millionaireMCAnnounce('Bạn đã sử dụng quyền trợ giúp năm mươi năm mươi. Hai phương án sai đã được loại bỏ.');
    setTimeout(() => millionaireStartThinking(0), 900);
}

function millionaireUseAudience() {
    const state = MILLIONAIRE_STATE;
    const q = getMillionaireCurrentQuestion();
    if (!q || !state.lifelines.audience || state.locked) return;

    const hidden = new Set(state.hiddenAnswers);
    const active = [0,1,2,3].filter(i => !hidden.has(i));
    const result = [0,0,0,0];

    // Khán giả có xu hướng nghiêng về đáp án đúng, nhưng không tuyệt đối.
    let correctPercent = active.length === 2
        ? 62 + Math.floor(Math.random() * 22)
        : 45 + Math.floor(Math.random() * 25);

    result[q.c] = correctPercent;
    let remaining = 100 - correctPercent;
    const others = active.filter(i => i !== q.c);

    others.forEach((idx, pos) => {
        if (pos === others.length - 1) {
            result[idx] = remaining;
        } else {
            const max = Math.max(1, remaining - (others.length - pos - 1));
            const val = Math.floor(Math.random() * max);
            result[idx] = val;
            remaining -= val;
        }
    });

    state.audienceResult = result;
    state.lifelines.audience = false;
    state.phase = 'lifeline';
    stopMillionaireThinking();
    millionaireSound('audience');
    state.message = 'Khán giả đã đưa ra lựa chọn tham khảo.';
    refreshMillionaire();

    const labels = ['A','B','C','D'];
    const spokenResult = result
        .map((percent, idx) => percent > 0 ? `${labels[idx]} ${percent} phần trăm` : '')
        .filter(Boolean)
        .join(', ');
    millionaireMCAnnounce(`Kết quả hỏi ý kiến khán giả: ${spokenResult}. Đây là kết quả để bạn tham khảo.`);
    setTimeout(() => millionaireStartThinking(0), 1200);
}

function millionaireUseSwitch() {
    const state = MILLIONAIRE_STATE;
    if (!state.lifelines.switch || state.locked) return;

    const grade = state.selectedGrade || 'all';
    const subject = state.selectedSubject || 'all';
    const topic = state.selectedTopic || 'all';
    const source = state.questionSource || 'custom';
    const usedTexts = new Set((state.questions || []).map(item => String(item?.q || '').trim()).filter(Boolean));

    // 12D: câu đổi phải lấy đúng CÙNG NGUỒN + CÙNG BỘ LỌC; không dùng bộ câu dự phòng mẫu cứng.
    const available = getMillionaireQuestionsBySource(source).filter(item => {
        const gradeOk = grade === 'all' || item.grade === grade;
        const subjectOk = subject === 'all' || item.subject === subject;
        const topicOk = topic === 'all' || item.topic === topic;
        return gradeOk && subjectOk && topicOk && !usedTexts.has(String(item.q || '').trim());
    });

    if (!available.length) {
        state.message = 'Không còn câu hỏi khác trong đúng nguồn và bộ lọc hiện tại để đổi.';
        refreshMillionaire();
        millionaireMCAnnounce('Không còn câu hỏi khác trong đúng bộ câu hỏi hiện tại để đổi.');
        return;
    }

    // BƯỚC 151.49.3F.19: quyền Đổi câu cũng ưu tiên câu chưa từng dùng.
    const history = loadMillionaireQuestionHistory();
    const neverUsed = available.filter(item => !history.has(millionaireQuestionHistoryKey(item, source)));
    const switchPool = neverUsed.length ? neverUsed : available;
    const pick = switchPool[Math.floor(Math.random() * switchPool.length)];
    state.questions[state.level] = {
        q: pick.q,
        a: [...pick.a],
        c: pick.c,
        difficulty: pick.difficulty,
        grade: pick.grade,
        subject: pick.subject,
        topic: pick.topic,
        id: pick.id || null,
        source
    };
    markMillionaireQuestionsUsed([state.questions[state.level]], source);
    state.hiddenAnswers = [];
    state.audienceResult = null;
    state.selectedIndex = null;
    state.lifelines.switch = false;
    state.phase = 'question';
    millionaireSound('switch');
    state.message = 'Đã đổi sang câu hỏi mới trong cùng bộ câu hỏi.';
    refreshMillionaire();
    millionaireMCAnnounce('Bạn đã sử dụng quyền đổi câu hỏi. Câu hỏi mới vẫn thuộc đúng bộ câu hỏi đang chơi.');
    millionaireMCPresentCurrentQuestion();
}

function millionaireEndSession() {
    const state = MILLIONAIRE_STATE;
    const hasSession = state.started || state.ended;

    if (hasSession && !confirm('Kết thúc phiên Ai là triệu phú hiện tại và trở về màn hình ban đầu?')) {
        return;
    }

    const keepGrade = state.selectedGrade || 'all';
    const keepSubject = state.selectedSubject || 'all';
    const keepTopic = state.selectedTopic || 'all';
    const keepQuestionSource = state.questionSource || 'custom';
    const keepSound = state.soundEnabled;
    const keepMC = state.mcEnabled !== false;
    const keepPlayMode = state.playMode || 'stop_on_wrong';

    stopMillionaireAllAudio();
    millionaireMCStop();
    resetMillionaireState();

    // Trở về màn hình ban đầu nhưng giữ bộ lọc người dùng đã chọn.
    state.selectedGrade = keepGrade;
    state.selectedSubject = keepSubject;
    state.selectedTopic = keepTopic;
    state.questionSource = keepQuestionSource;
    state.soundEnabled = keepSound;
    state.mcEnabled = keepMC;
    state.playMode = keepPlayMode;
    state.wrongAttempts = [];
    state.started = false;
    state.ended = false;
    state.locked = false;
    state.level = 0;
    state.phase = 'idle';
    state.message = 'Chọn bộ câu hỏi rồi nhấn “Bắt đầu”.';

    clearMillionaireStateStorage();
    refreshMillionaire();
}

function millionaireQuit() {
    const state = MILLIONAIRE_STATE;
    if (!state.started || state.ended || state.locked) return;

    stopMillionaireThinking();
    state.ended = true;
    state.phase = 'ended';
    state.message = state.level > 0
        ? `Bạn chủ động dừng cuộc chơi sau ${state.level} câu đúng.`
        : 'Bạn đã dừng cuộc chơi.';
    millionaireMCAnnounce(`${state.message} Cảm ơn bạn đã tham gia chương trình. Hẹn gặp lại ở lượt chơi tiếp theo!`);
    refreshMillionaire();
}

window.addEventListener('pagehide', () => {
    saveWheelStateToStorage();
    saveMillionaireStateToStorage();
});

window.endWheelSession = endWheelSession;
window.millionaireSetTimerEnabled=millionaireSetTimerEnabled;
window.millionaireSetTimerSoundEnabled=millionaireSetTimerSoundEnabled;
window.millionaireSetTimerPreset=millionaireSetTimerPreset;
window.millionaireSetCustomTimer=millionaireSetCustomTimer;
window.millionaireSetPlayMode = millionaireSetPlayMode;
window.millionaireStart = millionaireStart;
window.millionaireRestart = millionaireRestart;
window.millionaireChooseAnswer = millionaireChooseAnswer;
window.millionaireUseFifty = millionaireUseFifty;
window.millionaireUseAudience = millionaireUseAudience;
window.millionaireUseSwitch = millionaireUseSwitch;
window.millionaireQuit = millionaireQuit;
window.millionaireEndSession = millionaireEndSession;
window.millionaireToggleSound = millionaireToggleSound;
window.millionaireSetMCEnabled = millionaireSetMCEnabled;
window.millionaireMCReadRules = millionaireMCReadRules;
window.millionaireMCRepeatQuestion = millionaireMCRepeatQuestion;
window.millionaireSetGrade = millionaireSetGrade;
window.millionaireSetSubject = millionaireSetSubject;
window.millionaireSetTopic = millionaireSetTopic;
window.millionaireSetQuestionSource = millionaireSetQuestionSource;
window.millionaireResetQuestionHistory = millionaireResetQuestionHistory;
window.millionaireOpenQuestionManager = millionaireOpenQuestionManager;
window.millionaireCloseQuestionManager = millionaireCloseQuestionManager;
window.millionaireSaveQuestion = millionaireSaveQuestion;
window.millionaireEditQuestion = millionaireEditQuestion;
window.millionaireDeleteQuestion = millionaireDeleteQuestion;
window.millionaireResetQuestionForm = millionaireResetQuestionForm;
window.millionaireToggleQuestionSelection = millionaireToggleQuestionSelection;
window.millionaireSelectAllCustomQuestions = millionaireSelectAllCustomQuestions;
window.millionaireDeleteSelectedQuestions = millionaireDeleteSelectedQuestions;
window.millionaireDeleteAllCustomQuestions = millionaireDeleteAllCustomQuestions;
window.millionaireDownloadExcelTemplate = millionaireDownloadExcelTemplate;
window.millionairePickExcelFile = millionairePickExcelFile;
window.exportMillionaireQuestionsToExcel = exportMillionaireQuestionsToExcel;
window.importMillionaireQuestionsFromPastedAI = importMillionaireQuestionsFromPastedAI;
window.millionaireBuildAndCopyAIPrompt = millionaireBuildAndCopyAIPrompt;
window.millionaireFillAIPasteExample = millionaireFillAIPasteExample;
window.runAdminHealthCheck = runAdminHealthCheck;



// ============================================================
// BƯỚC 151.49.2N-FINAL - EXPORT HANDLER CHO INLINE ONCLICK
// ============================================================
window.closeStudentInlineEditor = closeStudentInlineEditor;
window.goHome = goHome;

// ============================================================
// 4. RENDER PAGES
// ============================================================

// ============================================================
// BƯỚC 152.1 -> 152.5 - MODULE GỌI TÊN BẰNG HÌNH ẢNH
// 152.5: Gọi tiếp không trùng; đánh dấu học sinh đã gọi;
// cập nhật Tổng / Đã gọi / Còn lại và cho phép Đặt lại vòng gọi.
// ============================================================
const IMAGE_CALLER_STATE = {
    classId: '',
    students: [],
    isSpinning: false,
    motionTimer: null,
    finishTimer: null,
    winner: null,
    calledKeys: new Set(),
    audioContext: null,
    spinSound: null
};

function getImageCallerClasses() {
    return [...(APP_STATE.classes || [])].sort((a, b) =>
        String(a.name || '').localeCompare(String(b.name || ''), 'vi', { numeric: true })
    );
}

function getImageCallerClassGrade(cls) {
    return String(cls?.grade ?? String(cls?.name || '').match(/[1-5]/)?.[0] ?? '');
}

function imageCallerInjectMotionStyles() {
    if (document.getElementById('imageCallerMotionStyles')) return;
    const style = document.createElement('style');
    style.id = 'imageCallerMotionStyles';
    style.textContent = `
        .image-caller-stage{position:relative;overflow:hidden;min-height:560px}
        .image-caller-arena{position:relative;width:100%;height:390px;min-height:390px;border-radius:24px;overflow:hidden;
            background:radial-gradient(circle at 50% 45%,rgba(59,130,246,.18),rgba(14,165,233,.06) 45%,rgba(15,23,42,.02) 75%);
            border:1px solid rgba(96,165,250,.18)}
        .image-caller-arena::before{content:'';position:absolute;inset:0;pointer-events:none;opacity:.28;
            background-image:radial-gradient(circle,rgba(96,165,250,.35) 1px,transparent 1px);background-size:28px 28px}
        .image-caller-bubble{position:absolute;left:0;top:0;width:92px;height:92px;border-radius:50%;padding:4px;
            background:linear-gradient(135deg,#60a5fa,#22d3ee,#a78bfa);box-shadow:0 10px 28px rgba(0,0,0,.22);
            will-change:transform;transition:transform .32s cubic-bezier(.2,.75,.25,1),opacity .35s,filter .35s}
        .image-caller-bubble img{display:block;width:100%;height:100%;border-radius:50%;object-fit:cover;background:#e5e7eb;border:3px solid rgba(255,255,255,.92)}
        .image-caller-bubble.is-moving{transition:transform .18s linear}
        .image-caller-bubble.is-called{opacity:.18;filter:grayscale(1);box-shadow:none}
        .image-caller-bubble.is-dimmed{opacity:.08;filter:blur(2px);transform:scale(.55)!important}
        .image-caller-bubble.is-winner{z-index:20;width:240px;height:240px;padding:7px;opacity:1;filter:none;
            box-shadow:0 0 0 7px rgba(250,204,21,.22),0 20px 55px rgba(0,0,0,.38)}
        .image-caller-result{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;min-height:86px;padding-top:12px;text-align:center}
        .image-caller-result .image-caller-status{display:inline-flex;align-items:center;justify-content:center}
        .image-caller-result h3{margin:3px 0 0;font-size:clamp(24px,3vw,38px);line-height:1.12}
        .image-caller-result p{margin:0;opacity:.78}
        .image-caller-countdown{position:absolute;right:16px;top:14px;z-index:30;display:none;min-width:74px;padding:8px 12px;border-radius:999px;
            background:rgba(15,23,42,.76);color:#fff;font-weight:800;text-align:center;backdrop-filter:blur(6px)}
        .image-caller-countdown.show{display:block}
        .image-caller-empty-stage{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:30px;opacity:.72}
        @media(max-width:760px){.image-caller-arena{height:330px;min-height:330px}.image-caller-bubble{width:72px;height:72px}.image-caller-bubble.is-winner{width:190px;height:190px}.image-caller-stage{min-height:500px}}
    `;
    document.head.appendChild(style);
}

function imageCallerClearTimers() {
    if (IMAGE_CALLER_STATE.motionTimer) clearInterval(IMAGE_CALLER_STATE.motionTimer);
    if (IMAGE_CALLER_STATE.finishTimer) clearTimeout(IMAGE_CALLER_STATE.finishTimer);
    IMAGE_CALLER_STATE.motionTimer = null;
    IMAGE_CALLER_STATE.finishTimer = null;
    IMAGE_CALLER_STATE.isSpinning = false;
}

function initImageCaller() {
    imageCallerInjectMotionStyles();
    imageCallerClearTimers();

    const gradeSelect = document.getElementById('imageCallerGradeSelect');
    const classSelect = document.getElementById('imageCallerClassSelect');
    if (!gradeSelect || !classSelect) return;

    const classes = getImageCallerClasses();
    const availableGrades = new Set(classes.map(getImageCallerClassGrade).filter(Boolean));

    [...gradeSelect.options].forEach(option => {
        if (!option.value) return;
        option.disabled = !availableGrades.has(option.value);
    });

    gradeSelect.addEventListener('change', () => imageCallerHandleGradeChange(gradeSelect.value));
    classSelect.addEventListener('change', () => imageCallerHandleClassChange(classSelect.value));

    // BƯỚC 152.7: nếu đang có phiên gọi tên, khôi phục đúng lớp và tiến độ
    // khi giáo viên chuyển module rồi quay lại. Không xóa calledKeys ở đây.
    if (IMAGE_CALLER_STATE.classId && IMAGE_CALLER_STATE.students.length) {
        imageCallerRestoreSession();
    }
}

function imageCallerHandleGradeChange(grade) {
    const classSelect = document.getElementById('imageCallerClassSelect');
    if (!classSelect) return;

    imageCallerClearTimers();
    classSelect.innerHTML = '<option value="">-- Chọn lớp --</option>';

    if (!grade) {
        classSelect.disabled = true;
        imageCallerHandleClassChange('');
        return;
    }

    const classes = getImageCallerClasses().filter(cls => getImageCallerClassGrade(cls) === String(grade));
    classes.forEach(cls => {
        const option = document.createElement('option');
        option.value = cls.id;
        option.textContent = cls.name || 'Lớp chưa đặt tên';
        classSelect.appendChild(option);
    });

    classSelect.disabled = classes.length === 0;
    imageCallerHandleClassChange('');
}

function getImageCallerStudents(classId) {
    if (!classId) return [];

    const cls = getImageCallerClasses().find(item => item.id === classId);
    let students = (APP_STATE.students || []).filter(student => student.class_id === classId);

    if (students.length === 0 && cls) {
        students = (APP_STATE.students || []).filter(student =>
            student.class === cls.name || student.class_code === cls.name
        );
    }

    const uniqueStudents = [];
    const seen = new Set();
    students.forEach(student => {
        const key = String(student.db_uuid || student.id || '').trim();
        if (!key || seen.has(key)) return;
        seen.add(key);
        uniqueStudents.push(student);
    });

    return uniqueStudents.sort((a, b) =>
        String(a.fullName || '').localeCompare(String(b.fullName || ''), 'vi')
    );
}

function imageCallerStudentKey(student) {
    return String(student?.db_uuid || student?.id || student?.student_code || student?.fullName || '').trim();
}

function renderImageCallerStudentList(students = []) {
    const list = document.getElementById('imageCallerStudentList');
    if (!list) return;

    if (students.length === 0) {
        list.innerHTML = `<div class="image-caller-empty"><i class="fas fa-user-slash"></i><strong>Chưa có học sinh</strong><span>Lớp này hiện chưa có học sinh trong dữ liệu.</span></div>`;
        return;
    }

    list.innerHTML = students.map((student, index) => {
        const key = imageCallerStudentKey(student);
        const called = IMAGE_CALLER_STATE.calledKeys.has(key);
        return `
        <div class="student-item${called ? ' image-caller-student-called' : ''}">
            <span class="badge">${called ? '✓' : index + 1}</span>
            <span class="student-name">${escapeHtml(student.fullName || 'Chưa có họ tên')}</span>
        </div>`;
    }).join('');
}

function updateImageCallerStats(total = IMAGE_CALLER_STATE.students.length) {
    const called = IMAGE_CALLER_STATE.calledKeys.size;
    const remaining = Math.max(0, total - called);
    const totalEl = document.getElementById('imageCallerTotalCount');
    const calledEl = document.getElementById('imageCallerCalledCount');
    const remainingEl = document.getElementById('imageCallerRemainingCount');
    if (totalEl) totalEl.textContent = String(total);
    if (calledEl) calledEl.textContent = String(called);
    if (remainingEl) remainingEl.textContent = String(remaining);
}

function imageCallerGetRemainingIndexes() {
    const indexes = [];
    IMAGE_CALLER_STATE.students.forEach((student, index) => {
        if (!IMAGE_CALLER_STATE.calledKeys.has(imageCallerStudentKey(student))) indexes.push(index);
    });
    return indexes;
}

function imageCallerSetActionState(hasStudents = IMAGE_CALLER_STATE.students.length > 0) {
    const randomBtn = document.getElementById('imageCallerRandomBtn');
    const nextBtn = document.getElementById('imageCallerNextBtn');
    const resetBtn = document.getElementById('imageCallerResetBtn');
    const endBtn = document.getElementById('imageCallerEndBtn');
    const gradeSelect = document.getElementById('imageCallerGradeSelect');
    const classSelect = document.getElementById('imageCallerClassSelect');
    const called = IMAGE_CALLER_STATE.calledKeys.size;
    const remaining = imageCallerGetRemainingIndexes().length;
    const spinning = IMAGE_CALLER_STATE.isSpinning;
    const activeSession = called > 0;

    if (randomBtn) randomBtn.disabled = !hasStudents || spinning || called > 0 || remaining === 0;
    if (nextBtn) nextBtn.disabled = !hasStudents || spinning || called === 0 || remaining === 0;
    if (resetBtn) resetBtn.disabled = !hasStudents || spinning || called === 0;
    if (endBtn) endBtn.disabled = !hasStudents || spinning;

    // Khi đã bắt đầu gọi tên, khóa Khối/Lớp để phiên chỉ kết thúc bằng nút Kết thúc gọi tên.
    if (gradeSelect) gradeSelect.disabled = spinning || activeSession;
    if (classSelect) classSelect.disabled = spinning || activeSession;
}

function imageCallerPlayTone(frequency = 520, duration = 0.06, volume = 0.035) {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        if (!IMAGE_CALLER_STATE.audioContext) IMAGE_CALLER_STATE.audioContext = new AudioCtx();
        const ctx = IMAGE_CALLER_STATE.audioContext;
        if (ctx.state === 'suspended') ctx.resume();
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(volume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start();
        oscillator.stop(ctx.currentTime + duration);
    } catch (error) {
        console.warn('[152.6] Không phát được âm thanh:', error);
    }
}

function imageCallerStartSpinSound(duration = 10000) {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        if (!IMAGE_CALLER_STATE.audioContext) IMAGE_CALLER_STATE.audioContext = new AudioCtx();
        const ctx = IMAGE_CALLER_STATE.audioContext;
        if (ctx.state === 'suspended') ctx.resume();
        imageCallerStopSpinSound();

        const startedAt = performance.now();
        const soundState = { timer: null, stopped: false };
        IMAGE_CALLER_STATE.spinSound = soundState;

        const playClick = () => {
            if (soundState.stopped || IMAGE_CALLER_STATE.spinSound !== soundState) return;
            const elapsed = performance.now() - startedAt;
            const progress = Math.min(1, elapsed / duration);
            if (progress >= 1) return;

            // Click ngắn kiểu vòng quay/game show, không tạo tiếng ù liên tục.
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(progress < 0.72 ? 980 : 820, ctx.currentTime);
            gain.gain.setValueAtTime(0.0001, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.225, ctx.currentTime + 0.004); // 152.6.3: tăng âm lượng click chuyển động x5
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.035);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.04);

            // 7 giây đầu nhanh; 3 giây cuối chậm dần để tạo cảm giác sắp dừng.
            let delay = 105;
            if (progress > 0.70) {
                const slow = (progress - 0.70) / 0.30;
                delay = 120 + Math.round(520 * slow * slow);
            }
            soundState.timer = setTimeout(playClick, delay);
        };

        playClick();
    } catch (error) {
        console.warn('[152.6.2] Không khởi động được âm thanh vòng quay:', error);
    }
}

function imageCallerStopSpinSound() {
    const sound = IMAGE_CALLER_STATE.spinSound;
    if (!sound) return;
    sound.stopped = true;
    if (sound.timer) clearTimeout(sound.timer);
    IMAGE_CALLER_STATE.spinSound = null;
}

function imageCallerSpeakWinner(student, className = '') {
    if (!('speechSynthesis' in window) || !student) return;
    try {
        window.speechSynthesis.cancel();
        const fullName = String(student.fullName || '').trim();
        if (!fullName) return;
        const utterance = new SpeechSynthesisUtterance(fullName);
        utterance.lang = 'vi-VN';
        utterance.rate = 0.88;
        utterance.pitch = 1;
        utterance.volume = 1;
        const voices = window.speechSynthesis.getVoices();
        const viVoice = voices.find(voice => String(voice.lang || '').toLowerCase().startsWith('vi'));
        if (viVoice) utterance.voice = viVoice;
        window.speechSynthesis.speak(utterance);
    } catch (error) {
        console.warn('[152.6] Không đọc được tên học sinh:', error);
    }
}

function imageCallerGetArenaSize() {
    const arena = document.getElementById('imageCallerArena');
    if (!arena) return { width: 700, height: 390 };
    return { width: Math.max(260, arena.clientWidth), height: Math.max(260, arena.clientHeight) };
}

function imageCallerRandomPosition(bubbleSize = 92) {
    const { width, height } = imageCallerGetArenaSize();
    const pad = 12;
    return {
        x: pad + Math.random() * Math.max(1, width - bubbleSize - pad * 2),
        y: pad + Math.random() * Math.max(1, height - bubbleSize - pad * 2)
    };
}

function imageCallerRenderBubbles(students = []) {
    const arena = document.getElementById('imageCallerArena');
    if (!arena) return;

    if (!students.length) {
        arena.innerHTML = '<div class="image-caller-empty-stage">Chọn một lớp có học sinh để hiển thị ảnh.</div><div id="imageCallerCountdown" class="image-caller-countdown"></div>';
        return;
    }

    arena.innerHTML = `<div id="imageCallerCountdown" class="image-caller-countdown"></div>` + students.map((student, index) => {
        const avatar = (student.avatar && typeof student.avatar === 'string') ? student.avatar : DEFAULT_AVATAR;
        return `<div class="image-caller-bubble" data-image-caller-index="${index}" title="${escapeHtml(student.fullName || '')}"><img src="${avatar}" alt="${escapeHtml(student.fullName || 'Học sinh')}" onerror="this.src='${DEFAULT_AVATAR}'"></div>`;
    }).join('');

    requestAnimationFrame(() => {
        arena.querySelectorAll('.image-caller-bubble').forEach(bubble => {
            const size = bubble.offsetWidth || 92;
            const pos = imageCallerRandomPosition(size);
            bubble.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
        });
    });
}

async function imageCallerPrepareStudentImages(students) {
    imageCallerRenderBubbles(students); // Hiện ngay avatar mặc định/ảnh đã cache.
    try {
        await loadStudentAvatars(students);
    } catch (error) {
        console.warn('[152.4R] Không tải đủ ảnh học sinh:', error);
    }

    if (IMAGE_CALLER_STATE.students !== students || IMAGE_CALLER_STATE.isSpinning) return;
    const arena = document.getElementById('imageCallerArena');
    if (!arena) return;
    arena.querySelectorAll('.image-caller-bubble').forEach((bubble, index) => {
        const img = bubble.querySelector('img');
        const student = students[index];
        if (img && student) img.src = student.avatar || DEFAULT_AVATAR;
    });
}

function imageCallerMoveBubbles() {
    const arena = document.getElementById('imageCallerArena');
    if (!arena) return;
    arena.querySelectorAll('.image-caller-bubble').forEach((bubble, index) => {
        const student = IMAGE_CALLER_STATE.students[index];
        if (bubble.classList.contains('is-winner')) return;
        const size = bubble.offsetWidth || 92;
        const pos = imageCallerRandomPosition(size);
        bubble.classList.add('is-moving');
        bubble.style.transform = `translate(${pos.x}px, ${pos.y}px) rotate(${Math.round(Math.random()*24-12)}deg)`;
    });
}

function imageCallerRevealWinner(winnerIndex) {
    const arena = document.getElementById('imageCallerArena');
    const winner = IMAGE_CALLER_STATE.students[winnerIndex];
    if (!arena || !winner) return;

    const bubbles = [...arena.querySelectorAll('.image-caller-bubble')];
    const winnerBubble = bubbles[winnerIndex];
    bubbles.forEach((bubble, index) => {
        bubble.classList.remove('is-moving');
        if (index !== winnerIndex) bubble.classList.add('is-dimmed');
    });

    if (winnerBubble) {
        winnerBubble.classList.add('is-winner');
        const { width, height } = imageCallerGetArenaSize();
        const winnerSize = window.innerWidth <= 760 ? 190 : 240;
        const x = Math.max(8, (width - winnerSize) / 2);
        const y = Math.max(8, (height - winnerSize) / 2);
        winnerBubble.style.transform = `translate(${x}px, ${y}px) scale(1)`;
    }

    const cls = getImageCallerClasses().find(item => item.id === IMAGE_CALLER_STATE.classId);
    const status = document.querySelector('.image-caller-status');
    const title = document.querySelector('.image-caller-result h3');
    const description = document.querySelector('.image-caller-result p');
    if (status) status.textContent = '🎉 Học sinh được gọi';
    if (title) title.textContent = winner.fullName || 'Chưa có họ tên';
    if (description) description.textContent = cls?.name ? `Lớp ${cls.name}` : 'Học sinh được chọn ngẫu nhiên';

    // BƯỚC 152.6.2: chime ngắn công bố kết quả, sau đó mới đọc tên.
    imageCallerPlayTone(659, 0.10, 0.055);
    setTimeout(() => imageCallerPlayTone(880, 0.12, 0.06), 105);
    setTimeout(() => imageCallerPlayTone(1175, 0.22, 0.065), 225);
    setTimeout(() => imageCallerSpeakWinner(winner), 620);

    IMAGE_CALLER_STATE.winner = winner;
    IMAGE_CALLER_STATE.calledKeys.add(imageCallerStudentKey(winner));
    IMAGE_CALLER_STATE.isSpinning = false;

    renderImageCallerStudentList(IMAGE_CALLER_STATE.students);
    updateImageCallerStats();

    const remaining = imageCallerGetRemainingIndexes().length;
    if (remaining === 0 && description) {
        description.textContent = 'Đã gọi hết học sinh trong lớp. Bấm “Đặt lại” để bắt đầu vòng mới.';
    }

    imageCallerSetActionState(true);
}

function imageCallerStartRandom() {
    if (IMAGE_CALLER_STATE.isSpinning || !IMAGE_CALLER_STATE.students.length) return;

    const remainingIndexes = imageCallerGetRemainingIndexes();
    if (!remainingIndexes.length) {
        alert('Đã gọi hết học sinh trong lớp. Hãy bấm “Đặt lại” để bắt đầu vòng mới.');
        imageCallerSetActionState(true);
        return;
    }

    const winnerIndex = remainingIndexes[Math.floor(Math.random() * remainingIndexes.length)];
    const arena = document.getElementById('imageCallerArena');
    const countdown = document.getElementById('imageCallerCountdown');
    if (!arena) return;

    IMAGE_CALLER_STATE.isSpinning = true;
    IMAGE_CALLER_STATE.winner = null;
    imageCallerSetActionState(true);

    const status = document.querySelector('.image-caller-status');
    const title = document.querySelector('.image-caller-result h3');
    const description = document.querySelector('.image-caller-result p');
    if (status) status.textContent = 'Đang quay...';
    if (title) title.textContent = 'Ai sẽ được gọi?';
    if (description) description.textContent = `Còn ${remainingIndexes.length} học sinh chưa được gọi...`;

    arena.querySelectorAll('.image-caller-bubble').forEach((bubble, index) => {
        bubble.classList.remove('is-dimmed', 'is-winner', 'is-moving');
        // Học sinh đã gọi vẫn tham gia hiệu ứng chuyển động bình thường,
        // nhưng vẫn bị loại khỏi danh sách có thể được chọn lại.
        bubble.classList.remove('is-called');
    });

    const startedAt = Date.now();
    const duration = 10000;
    if (countdown) countdown.classList.add('show');

    // BƯỚC 152.6.1: âm thanh chuyển động liên tục, bắt đầu ngay từ thao tác bấm của người dùng.
    imageCallerStartSpinSound(duration);
    imageCallerMoveBubbles();
    IMAGE_CALLER_STATE.motionTimer = setInterval(() => {
        const elapsed = Date.now() - startedAt;
        const remain = Math.max(0, Math.ceil((duration - elapsed) / 1000));
        if (countdown) countdown.textContent = `${remain}s`;
        imageCallerMoveBubbles();
    }, 220);

    IMAGE_CALLER_STATE.finishTimer = setTimeout(() => {
        if (IMAGE_CALLER_STATE.motionTimer) clearInterval(IMAGE_CALLER_STATE.motionTimer);
        IMAGE_CALLER_STATE.motionTimer = null;
        imageCallerStopSpinSound();
        if (countdown) {
            countdown.textContent = 'Kết quả!';
            setTimeout(() => countdown.classList.remove('show'), 900);
        }
        imageCallerRevealWinner(winnerIndex);
    }, duration);
}

function imageCallerNext() {
    imageCallerStartRandom();
}

function imageCallerResetRound() {
    if (IMAGE_CALLER_STATE.isSpinning || !IMAGE_CALLER_STATE.students.length) return;

    IMAGE_CALLER_STATE.calledKeys.clear();
    IMAGE_CALLER_STATE.winner = null;

    const status = document.querySelector('.image-caller-status');
    const title = document.querySelector('.image-caller-result h3');
    const description = document.querySelector('.image-caller-result p');
    const cls = getImageCallerClasses().find(item => item.id === IMAGE_CALLER_STATE.classId);

    if (status) status.textContent = 'Sẵn sàng';
    if (title) title.textContent = cls?.name || 'Lớp đã chọn';
    if (description) description.textContent = `${IMAGE_CALLER_STATE.students.length} học sinh đã sẵn sàng. Bấm “Gọi ngẫu nhiên” để bắt đầu.`;

    renderImageCallerStudentList(IMAGE_CALLER_STATE.students);
    updateImageCallerStats();
    imageCallerRenderBubbles(IMAGE_CALLER_STATE.students);
    imageCallerPrepareStudentImages(IMAGE_CALLER_STATE.students);
    imageCallerSetActionState(true);
}

function imageCallerRestoreSession() {
    const cls = getImageCallerClasses().find(item => item.id === IMAGE_CALLER_STATE.classId);
    if (!cls || !IMAGE_CALLER_STATE.students.length) return;

    const gradeSelect = document.getElementById('imageCallerGradeSelect');
    const classSelect = document.getElementById('imageCallerClassSelect');
    const grade = getImageCallerClassGrade(cls);

    if (gradeSelect) gradeSelect.value = grade;
    if (classSelect) {
        const classes = getImageCallerClasses().filter(item => getImageCallerClassGrade(item) === String(grade));
        classSelect.innerHTML = '<option value="">-- Chọn lớp --</option>' + classes.map(item =>
            `<option value="${escapeHtml(String(item.id))}">${escapeHtml(item.name || 'Lớp chưa đặt tên')}</option>`
        ).join('');
        classSelect.value = IMAGE_CALLER_STATE.classId;
    }

    renderImageCallerStudentList(IMAGE_CALLER_STATE.students);
    updateImageCallerStats();
    imageCallerPrepareStudentImages(IMAGE_CALLER_STATE.students).then(() => {
        if (!IMAGE_CALLER_STATE.winner || APP_STATE.currentPage !== 'image-caller') return;
        const winnerIndex = IMAGE_CALLER_STATE.students.findIndex(student =>
            imageCallerStudentKey(student) === imageCallerStudentKey(IMAGE_CALLER_STATE.winner)
        );
        const arena = document.getElementById('imageCallerArena');
        if (!arena || winnerIndex < 0) return;
        const bubbles = [...arena.querySelectorAll('.image-caller-bubble')];
        const winnerBubble = bubbles[winnerIndex];
        bubbles.forEach((bubble, index) => {
            if (index !== winnerIndex) bubble.classList.add('is-dimmed');
        });
        if (winnerBubble) {
            winnerBubble.classList.add('is-winner');
            const { width, height } = imageCallerGetArenaSize();
            const winnerSize = window.innerWidth <= 760 ? 190 : 240;
            winnerBubble.style.transform = `translate(${Math.max(8, (width - winnerSize) / 2)}px, ${Math.max(8, (height - winnerSize) / 2)}px) scale(1)`;
        }
    });

    const status = document.querySelector('.image-caller-status');
    const title = document.querySelector('.image-caller-result h3');
    const description = document.querySelector('.image-caller-result p');
    const remaining = imageCallerGetRemainingIndexes().length;
    if (IMAGE_CALLER_STATE.winner) {
        if (status) status.textContent = '🎉 Học sinh được gọi';
        if (title) title.textContent = IMAGE_CALLER_STATE.winner.fullName || 'Chưa có họ tên';
        if (description) description.textContent = remaining > 0 ? `Lớp ${cls.name}` : 'Đã gọi hết học sinh trong lớp.';
    } else {
        if (status) status.textContent = 'Đã chọn lớp';
        if (title) title.textContent = cls.name || 'Lớp đã chọn';
        if (description) description.textContent = `${IMAGE_CALLER_STATE.students.length} học sinh đã sẵn sàng. Bấm “Gọi ngẫu nhiên” để bắt đầu.`;
    }
    imageCallerSetActionState(true);
}

function imageCallerEndSession() {
    if (IMAGE_CALLER_STATE.isSpinning) return;
    if (!IMAGE_CALLER_STATE.classId) return;
    if (!confirm('Kết thúc phiên gọi tên hiện tại? Danh sách học sinh đã gọi trong phiên này sẽ được xóa.')) return;

    imageCallerClearTimers();
    imageCallerStopSpinSound();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();

    IMAGE_CALLER_STATE.classId = '';
    IMAGE_CALLER_STATE.students = [];
    IMAGE_CALLER_STATE.winner = null;
    IMAGE_CALLER_STATE.calledKeys.clear();

    const gradeSelect = document.getElementById('imageCallerGradeSelect');
    const classSelect = document.getElementById('imageCallerClassSelect');
    if (gradeSelect) {
        gradeSelect.value = '';
        gradeSelect.disabled = false;
    }
    if (classSelect) {
        classSelect.innerHTML = '<option value="">-- Chọn lớp --</option>';
        classSelect.value = '';
        classSelect.disabled = true;
    }

    const status = document.querySelector('.image-caller-status');
    const title = document.querySelector('.image-caller-result h3');
    const description = document.querySelector('.image-caller-result p');
    if (status) status.textContent = 'Sẵn sàng';
    if (title) title.textContent = 'Chưa chọn lớp';
    if (description) description.textContent = 'Chọn lớp để hiển thị hình ảnh học sinh.';
    resetImageCallerStudentList();
}

function resetImageCallerStudentList() {
    const list = document.getElementById('imageCallerStudentList');
    if (list) list.innerHTML = `<div class="image-caller-empty"><i class="fas fa-image"></i><strong>Chưa có danh sách</strong><span>Chọn khối và lớp để nạp danh sách học sinh.</span></div>`;
    updateImageCallerStats(0);
    IMAGE_CALLER_STATE.classId = '';
    IMAGE_CALLER_STATE.students = [];
    IMAGE_CALLER_STATE.winner = null;
    IMAGE_CALLER_STATE.calledKeys.clear();
    imageCallerRenderBubbles([]);
    imageCallerSetActionState(false);
}

function imageCallerHandleClassChange(classId) {
    imageCallerClearTimers();
    const status = document.querySelector('.image-caller-status');
    const title = document.querySelector('.image-caller-result h3');
    const description = document.querySelector('.image-caller-result p');
    if (!status || !title || !description) return;

    if (!classId) {
        status.textContent = 'Sẵn sàng';
        title.textContent = 'Chưa chọn lớp';
        description.textContent = 'Chọn lớp để hiển thị hình ảnh học sinh.';
        resetImageCallerStudentList();
        return;
    }

    const cls = getImageCallerClasses().find(item => item.id === classId);
    const students = getImageCallerStudents(classId);
    IMAGE_CALLER_STATE.classId = classId;
    IMAGE_CALLER_STATE.students = students;
    IMAGE_CALLER_STATE.winner = null;
    IMAGE_CALLER_STATE.calledKeys.clear();

    status.textContent = 'Đã chọn lớp';
    title.textContent = cls?.name || 'Lớp đã chọn';
    description.textContent = students.length > 0
        ? `${students.length} học sinh đã sẵn sàng. Bấm “Gọi ngẫu nhiên” để bắt đầu.`
        : 'Lớp này hiện chưa có học sinh trong dữ liệu.';

    renderImageCallerStudentList(students);
    updateImageCallerStats(students.length);
    imageCallerSetActionState(students.length > 0);
    imageCallerPrepareStudentImages(students);
}

window.imageCallerHandleGradeChange = imageCallerHandleGradeChange;
window.imageCallerHandleClassChange = imageCallerHandleClassChange;
window.imageCallerStartRandom = imageCallerStartRandom;
window.imageCallerNext = imageCallerNext;
window.imageCallerResetRound = imageCallerResetRound;
window.imageCallerEndSession = imageCallerEndSession;

// ============================================================
// BƯỚC 153.4 - TRẮC NGHIỆM HÌNH ẢNH: HIỂN THỊ 1 CÂU HỎI THẬT
// Module này chỉ đọc dữ liệu đã có từ app3_millionaire_questions.
// Không thay đổi logic, trạng thái hoặc giao diện Ai là triệu phú.
// ============================================================
const IMAGE_QUIZ_STATE = {
    questions: [],
    grade: '',
    subject: '',
    topic: '',
    currentQuestion: null
};

function imageQuizUniqueValues(items, field) {
    return [...new Set(items.map(item => String(item?.[field] || '').trim()).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'vi', { numeric: true }));
}

function imageQuizSetOptions(select, values, placeholder, labelPrefix = '') {
    if (!select) return;
    select.innerHTML = `<option value="">${placeholder}</option>` + values.map(value => {
        const safeValue = escapeHtml(value);
        return `<option value="${safeValue}">${labelPrefix}${safeValue}</option>`;
    }).join('');
    select.disabled = values.length === 0;
}

function imageQuizUpdateInfo() {
    const info = document.getElementById('imageQuizBankInfo');
    if (!info) return;

    const { questions, grade, subject, topic } = IMAGE_QUIZ_STATE;
    if (!questions.length) {
        info.textContent = 'Chưa có câu hỏi đang hoạt động trong ngân hàng dùng chung.';
        return;
    }

    let filtered = questions;
    if (grade) filtered = filtered.filter(item => item.grade === grade);
    if (subject) filtered = filtered.filter(item => item.subject === subject);
    if (topic) filtered = filtered.filter(item => item.topic === topic);

    if (!grade) {
        info.textContent = `Đã kết nối ngân hàng dùng chung: ${questions.length} câu hỏi. Chọn khối để tiếp tục.`;
    } else if (!subject) {
        info.textContent = `Khối ${grade}: ${filtered.length} câu hỏi. Chọn môn học để tiếp tục.`;
    } else if (!topic) {
        info.textContent = `${subject} - Khối ${grade}: ${filtered.length} câu hỏi. Chọn chủ đề để tiếp tục.`;
    } else {
        info.textContent = `${subject} - Khối ${grade} - ${topic}: ${filtered.length} câu hỏi sẵn sàng.`;
    }
}

function imageQuizGetFilteredQuestions() {
    const { questions, grade, subject, topic } = IMAGE_QUIZ_STATE;
    if (!grade || !subject || !topic) return [];
    return questions.filter(item =>
        item.grade === grade && item.subject === subject && item.topic === topic
    );
}

function imageQuizBindStartButton() {
    const button = document.getElementById('imageQuizStartBtn');
    if (!button) return;

    // BƯỚC 153.4.3: gắn listener trực tiếp bằng addEventListener và đánh dấu
    // để không bị gắn trùng khi module được khởi tạo lại.
    if (button.dataset.imageQuizBound === '1') return;
    button.dataset.imageQuizBound = '1';
    button.addEventListener('click', function(event) {
        event.preventDefault();
        event.stopPropagation();
        imageQuizStart();
    });
}

function imageQuizUpdateStartButton() {
    const button = document.getElementById('imageQuizStartBtn');
    if (!button) return;
    imageQuizBindStartButton();
    const hasQuestions = imageQuizGetFilteredQuestions().length > 0;
    button.disabled = !hasQuestions;
    button.style.display = hasQuestions ? 'inline-flex' : 'none';
}

function imageQuizResetQuestionView() {
    IMAGE_QUIZ_STATE.currentQuestion = null;
    const title = document.getElementById('imageQuizQuestionTitle');
    const info = document.getElementById('imageQuizBankInfo');
    if (title) title.textContent = 'Trắc nghiệm bằng hình ảnh';

    const answerMap = [
        ['A', 'Đáp án A'], ['B', 'Đáp án B'], ['C', 'Đáp án C'], ['D', 'Đáp án D']
    ];
    answerMap.forEach(([letter, fallback]) => {
        const span = document.getElementById(`imageQuizAnswer${letter}`);
        if (span) span.textContent = fallback;
    });

    if (info) imageQuizUpdateInfo();
    imageQuizUpdateStartButton();
}

function imageQuizPlayResultSound(isCorrect) {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const now = ctx.currentTime;
        const notes = isCorrect ? [660, 880] : [220, 165];
        notes.forEach((freq, index) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + index * 0.12);
            gain.gain.setValueAtTime(0.0001, now + index * 0.12);
            gain.gain.exponentialRampToValueAtTime(0.16, now + index * 0.12 + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.12 + 0.18);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + index * 0.12);
            osc.stop(now + index * 0.12 + 0.2);
        });
        setTimeout(() => { try { ctx.close(); } catch (_) {} }, 700);
    } catch (_) {}
}

function imageQuizHandleAnswer(selectedIndex, button) {
    const question = IMAGE_QUIZ_STATE.currentQuestion;
    if (!question || !button) return;

    const stage = document.querySelector('.image-quiz-page .image-quiz-stage');
    if (!stage || stage.dataset.answered === '1') return;

    const correctIndex = Number(question.c);
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) return;

    stage.dataset.answered = '1';
    const buttons = Array.from(stage.querySelectorAll('.image-quiz-answers button'));
    buttons.forEach(btn => {
        btn.disabled = true;
        btn.style.cursor = 'default';
    });

    const correctButton = buttons[correctIndex];
    if (selectedIndex === correctIndex) {
        button.style.borderColor = '#22c55e';
        button.style.background = 'rgba(34, 197, 94, 0.16)';
        const strong = button.querySelector('strong');
        if (strong) strong.textContent = '✓';
        button.setAttribute('aria-label', 'Chính xác');
        imageQuizPlayResultSound(true);
    } else {
        button.style.borderColor = '#ef4444';
        button.style.background = 'rgba(239, 68, 68, 0.16)';
        const selectedStrong = button.querySelector('strong');
        if (selectedStrong) selectedStrong.textContent = '✕';
        button.setAttribute('aria-label', 'Chưa chính xác');

        if (correctButton) {
            correctButton.style.borderColor = '#22c55e';
            correctButton.style.background = 'rgba(34, 197, 94, 0.16)';
            const correctStrong = correctButton.querySelector('strong');
            if (correctStrong) correctStrong.textContent = '✓';
            correctButton.setAttribute('aria-label', 'Đáp án đúng');
        }
        imageQuizPlayResultSound(false);
    }
}

function imageQuizStart() {
    const pool = imageQuizGetFilteredQuestions();
    if (!pool.length) {
        imageQuizUpdateInfo();
        return;
    }

    // BƯỚC 153.4.8: object câu hỏi dùng chung có dạng q + a[0..3] + c.
    // c là chỉ số đáp án đúng, chỉ lưu lại để dùng ở bước chấm đáp án sau; chưa hiển thị ở bước này.
    const question = pool[Math.floor(Math.random() * pool.length)];
    IMAGE_QUIZ_STATE.currentQuestion = question;

    const stage = document.querySelector('.image-quiz-page .image-quiz-stage');
    if (!stage) return;

    const questionText = String(question.q || 'Câu hỏi');
    const answerList = Array.isArray(question.a) ? question.a : [];
    const answers = {
        A: String(answerList[0] ?? ''),
        B: String(answerList[1] ?? ''),
        C: String(answerList[2] ?? ''),
        D: String(answerList[3] ?? '')
    };

    stage.innerHTML = `
        <div class="image-quiz-placeholder">
            <div class="image-quiz-placeholder-icon"><i class="fas fa-image"></i></div>
            <h3 id="imageQuizQuestionTitle"></h3>
            <p id="imageQuizBankInfo"></p>
        </div>
        <div class="image-quiz-answers" aria-label="Khu vực đáp án">
            <button type="button" data-answer-index="0"><strong>A</strong><span id="imageQuizAnswerA"></span></button>
            <button type="button" data-answer-index="1"><strong>B</strong><span id="imageQuizAnswerB"></span></button>
            <button type="button" data-answer-index="2"><strong>C</strong><span id="imageQuizAnswerC"></span></button>
            <button type="button" data-answer-index="3"><strong>D</strong><span id="imageQuizAnswerD"></span></button>
        </div>`;

    const title = stage.querySelector('#imageQuizQuestionTitle');
    const info = stage.querySelector('#imageQuizBankInfo');
    if (title) title.textContent = questionText;
    if (info) info.textContent = `${IMAGE_QUIZ_STATE.subject} - Khối ${IMAGE_QUIZ_STATE.grade} - ${IMAGE_QUIZ_STATE.topic}`;

    Object.entries(answers).forEach(([letter, value]) => {
        const span = stage.querySelector(`#imageQuizAnswer${letter}`);
        if (span) span.textContent = value;
    });

    stage.dataset.answered = '0';
    stage.querySelectorAll('.image-quiz-answers button').forEach((button, index) => {
        button.disabled = false;
        button.style.cursor = 'pointer';
        button.addEventListener('click', () => imageQuizHandleAnswer(index, button));
    });
}

function imageQuizHandleGradeChange(value) {
    IMAGE_QUIZ_STATE.grade = value || '';
    IMAGE_QUIZ_STATE.subject = '';
    IMAGE_QUIZ_STATE.topic = '';
    IMAGE_QUIZ_STATE.currentQuestion = null;

    const subjectSelect = document.getElementById('imageQuizSubjectSelect');
    const topicSelect = document.getElementById('imageQuizTopicSelect');
    const questions = IMAGE_QUIZ_STATE.grade
        ? IMAGE_QUIZ_STATE.questions.filter(item => item.grade === IMAGE_QUIZ_STATE.grade)
        : [];

    imageQuizSetOptions(subjectSelect, imageQuizUniqueValues(questions, 'subject'), '-- Chọn môn học --');
    imageQuizSetOptions(topicSelect, [], '-- Chọn chủ đề --');
    imageQuizResetQuestionView();
}

function imageQuizHandleSubjectChange(value) {
    IMAGE_QUIZ_STATE.subject = value || '';
    IMAGE_QUIZ_STATE.topic = '';
    IMAGE_QUIZ_STATE.currentQuestion = null;

    const topicSelect = document.getElementById('imageQuizTopicSelect');
    const questions = IMAGE_QUIZ_STATE.subject
        ? IMAGE_QUIZ_STATE.questions.filter(item =>
            item.grade === IMAGE_QUIZ_STATE.grade && item.subject === IMAGE_QUIZ_STATE.subject
        )
        : [];

    imageQuizSetOptions(topicSelect, imageQuizUniqueValues(questions, 'topic'), '-- Chọn chủ đề --');
    imageQuizResetQuestionView();
}

function imageQuizHandleTopicChange(value) {
    IMAGE_QUIZ_STATE.topic = value || '';
    imageQuizResetQuestionView();
}

async function initImageQuiz() {
    const gradeSelect = document.getElementById('imageQuizGradeSelect');
    const subjectSelect = document.getElementById('imageQuizSubjectSelect');
    const topicSelect = document.getElementById('imageQuizTopicSelect');
    if (!gradeSelect || !subjectSelect || !topicSelect) return;

    imageQuizBindStartButton();
    imageQuizSetOptions(gradeSelect, [], 'Đang tải...');
    imageQuizSetOptions(subjectSelect, [], '-- Chọn môn học --');
    imageQuizSetOptions(topicSelect, [], '-- Chọn chủ đề --');

    const questions = millionaireSupabaseQuestionsLoaded
        ? [...MILLIONAIRE_SUPABASE_QUESTIONS]
        : await loadMillionaireQuestionsFromSupabase();

    // Chỉ lấy khối cụ thể cho module học sinh; câu grade='all' không đưa vào bộ lọc Khối.
    IMAGE_QUIZ_STATE.questions = (questions || []).filter(item => item && item.grade && item.grade !== 'all');
    IMAGE_QUIZ_STATE.grade = '';
    IMAGE_QUIZ_STATE.subject = '';
    IMAGE_QUIZ_STATE.topic = '';
    IMAGE_QUIZ_STATE.currentQuestion = null;

    imageQuizSetOptions(
        gradeSelect,
        imageQuizUniqueValues(IMAGE_QUIZ_STATE.questions, 'grade'),
        '-- Chọn khối --',
        'Khối '
    );
    imageQuizUpdateInfo();
}

window.imageQuizHandleGradeChange = imageQuizHandleGradeChange;
window.imageQuizHandleSubjectChange = imageQuizHandleSubjectChange;
window.imageQuizHandleTopicChange = imageQuizHandleTopicChange;
window.imageQuizStart = imageQuizStart;

function renderImageQuiz() {
    return `
        <section class="image-quiz-page">
            <div class="image-quiz-toolbar">
                <div class="image-quiz-heading">
                    <div class="image-quiz-heading-icon"><i class="fas fa-images"></i></div>
                    <div><h2>Trắc nghiệm hình ảnh</h2><p>Chọn bộ câu hỏi để bắt đầu.</p></div>
                </div>
                <div class="image-quiz-filters">
                    <label class="image-quiz-field"><span>Khối</span><select id="imageQuizGradeSelect" onchange="imageQuizHandleGradeChange(this.value)" disabled><option>Đang tải...</option></select></label>
                    <label class="image-quiz-field"><span>Môn học</span><select id="imageQuizSubjectSelect" onchange="imageQuizHandleSubjectChange(this.value)" disabled><option>-- Chọn môn học --</option></select></label>
                    <label class="image-quiz-field"><span>Chủ đề</span><select id="imageQuizTopicSelect" onchange="imageQuizHandleTopicChange(this.value)" disabled><option>-- Chọn chủ đề --</option></select></label>
                </div>
            </div>
            <div class="image-quiz-stage">
                <div class="image-quiz-placeholder">
                    <div class="image-quiz-placeholder-icon"><i class="fas fa-image"></i></div>
                    <h3 id="imageQuizQuestionTitle">Trắc nghiệm bằng hình ảnh</h3>
                    <p id="imageQuizBankInfo">Đang kết nối ngân hàng câu hỏi dùng chung...</p>
                    <div style="margin-top:18px;display:flex;justify-content:center;">
                        <button id="imageQuizStartBtn" type="button" class="btn btn-primary" disabled style="display:none;min-width:150px;min-height:46px;justify-content:center;font-weight:800;font-size:15px;"><i class="fas fa-play"></i> Bắt đầu</button>
                    </div>
                </div>
                <div class="image-quiz-answers" aria-label="Khu vực đáp án">
                    <button type="button" disabled><strong>A</strong><span id="imageQuizAnswerA">Đáp án A</span></button>
                    <button type="button" disabled><strong>B</strong><span id="imageQuizAnswerB">Đáp án B</span></button>
                    <button type="button" disabled><strong>C</strong><span id="imageQuizAnswerC">Đáp án C</span></button>
                    <button type="button" disabled><strong>D</strong><span id="imageQuizAnswerD">Đáp án D</span></button>
                </div>
            </div>
        </section>`;
}

function renderImageCaller() {
    return `
        <section class="image-caller-page">
            <div class="image-caller-toolbar">
                <div class="image-caller-heading">
                    <div class="image-caller-heading-icon"><i class="fas fa-id-card"></i></div>
                    <div><h2>Gọi tên bằng hình ảnh</h2><p>Ảnh học sinh chuyển động khoảng 10 giây rồi chọn ngẫu nhiên một em.</p></div>
                </div>
                <div class="image-caller-filters">
                    <label class="image-caller-field"><span>Khối</span><select id="imageCallerGradeSelect" aria-label="Chọn khối">
                        <option value="">-- Chọn khối --</option><option value="1">Khối 1</option><option value="2">Khối 2</option><option value="3">Khối 3</option><option value="4">Khối 4</option><option value="5">Khối 5</option>
                    </select></label>
                    <label class="image-caller-field"><span>Lớp</span><select id="imageCallerClassSelect" aria-label="Chọn lớp" disabled><option value="">-- Chọn lớp --</option></select></label>
                </div>
            </div>
            <div class="image-caller-layout">
                <div class="image-caller-stage">
                    <div id="imageCallerArena" class="image-caller-arena"><div class="image-caller-empty-stage">Chọn khối và lớp để hiển thị hình ảnh học sinh.</div><div id="imageCallerCountdown" class="image-caller-countdown"></div></div>
                    <div class="image-caller-result"><span class="image-caller-status">Sẵn sàng</span><h3>Chưa chọn lớp</h3><p>Chọn lớp để hiển thị hình ảnh học sinh.</p></div>
                    <div class="image-caller-actions">
                        <button id="imageCallerRandomBtn" type="button" class="btn btn-primary" onclick="imageCallerStartRandom()" disabled><i class="fas fa-shuffle"></i> Gọi ngẫu nhiên</button>
                        <button id="imageCallerNextBtn" type="button" class="btn btn-secondary" onclick="imageCallerNext()" disabled><i class="fas fa-forward-step"></i> Gọi tiếp</button>
                        <button id="imageCallerResetBtn" type="button" class="btn btn-secondary" onclick="imageCallerResetRound()" disabled><i class="fas fa-rotate-left"></i> Đặt lại</button>
                        <button id="imageCallerEndBtn" type="button" class="btn btn-danger" onclick="imageCallerEndSession()" disabled><i class="fas fa-stop"></i> Kết thúc gọi tên</button>
                    </div>
                </div>
                <aside class="image-caller-side">
                    <div class="image-caller-side-card"><div class="image-caller-side-title"><i class="fas fa-users"></i> Danh sách gọi tên</div><div class="student-list-scroll" id="imageCallerStudentList"><div class="image-caller-empty"><i class="fas fa-image"></i><strong>Chưa có danh sách</strong><span>Chọn khối và lớp để nạp danh sách học sinh.</span></div></div></div>
                    <div class="image-caller-stats"><div><strong id="imageCallerTotalCount">0</strong><span>Tổng học sinh</span></div><div><strong id="imageCallerCalledCount">0</strong><span>Đã gọi</span></div><div><strong id="imageCallerRemainingCount">0</strong><span>Còn lại</span></div></div>
                </aside>
            </div>
        </section>
    `;
}

function renderPage(page) {
    const previousPage = APP_STATE.currentPage;

    // BƯỚC 151.33:
    // - Không reset Vòng quay / Ai là triệu phú khi đổi menu.
    // - Chỉ tạm dừng nhạc suy nghĩ khi rời màn hình Triệu phú.
    // - Nếu Vòng quay đang quay, không cho rời trang giữa animation để tránh mất kết quả.
    if (previousPage === 'wheel' && page !== 'wheel' && WHEEL_STATE.isSpinning) {
        showToast('Vòng quay đang chạy. Vui lòng chờ kết quả trước khi chuyển module.', 'warning', 2200);
        return;
    }

    // BƯỚC 152.7: không rời module giữa lúc ảnh đang quay để tránh mất kết quả.
    // Sau khi có kết quả, giáo viên có thể chuyển module bình thường và phiên vẫn được giữ.
    if (previousPage === 'image-caller' && page !== 'image-caller' && IMAGE_CALLER_STATE.isSpinning) {
        showToast('Đang gọi tên. Vui lòng chờ kết quả trước khi chuyển module.', 'warning', 2200);
        return;
    }

    if (previousPage === 'millionaire' && page !== 'millionaire') {
        stopMillionaireThinking();
        millionaireMCStop();
        saveMillionaireStateToStorage();
    }

    if (previousPage === 'wheel' && page !== 'wheel') {
        saveWheelStateToStorage();
    }

    // BƯỚC 151.49.3F.6: chặn truy cập trực tiếp module quản trị nội dung.
    if (page === 'public-content' && !isAdmin()) {
        showToast('Chỉ tài khoản Admin được quản trị nội dung website.', 'warning', 2400);
        page = 'dashboard';
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        document.querySelector('.nav-item[data-page="dashboard"]')?.classList.add('active');
    }

    APP_STATE.currentPage = page;
    document.body.classList.toggle('page-wheel-active', page === 'wheel');
    document.getElementById('pageTitle').textContent = getPageTitle(page);
    const container = document.getElementById('pageContainer');
    switch (page) {
        case 'dashboard': container.innerHTML = renderDashboard(); break;
        case 'students': container.innerHTML = renderStudents(); break;
        case 'classes': container.innerHTML = renderClasses(); break;
        case 'scores': container.innerHTML = renderScores(); break;
        case 'attendance': container.innerHTML = renderAttendance(); break;
        case 'rewards': container.innerHTML = renderRewards(); break;
        case 'disciplines': container.innerHTML = renderDisciplines(); break;
        case 'learning-comments':
    container.innerHTML = renderLearningComments();
    break;
        case 'files': container.innerHTML = renderFiles(); break;
        case 'statistics': container.innerHTML = renderStatistics(); break;
        case 'search': container.innerHTML = renderSearch(); break;
        case 'settings': container.innerHTML = renderSettings(); break;
        case 'public-content': container.innerHTML = renderPublicContentManager(); break;
        case 'wheel': container.innerHTML = renderWheel(); break;
        case 'image-caller': container.innerHTML = renderImageCaller(); break;
        case 'image-quiz': container.innerHTML = renderImageQuiz(); break;
        case 'millionaire': container.innerHTML = renderMillionaire(); break;
        default: container.innerHTML = '<p>Trang không tồn tại.</p>';
    }
    setTimeout(() => {
        if (page === 'dashboard') { initCharts(); loadAdminVisitStats(); }
        if (page === 'students') initStudentTable();
        if (page === 'classes') initClassTable();
        if (page === 'scores') initScoreTable();
        if (page === 'attendance') loadAttendance();
        if (page === 'settings') initSettings();
        if (page === 'public-content') initPublicContentManager();
        if (page === 'search') initSearch();
        if (page === 'statistics') initStatCharts();
        if (page === 'wheel') initWheel();
        if (page === 'image-caller') initImageCaller();
        if (page === 'image-quiz') initImageQuiz();
        if (page === 'millionaire') initMillionaire();
        applyViewerReadOnlyUI();
        if (isViewer() && page === 'attendance') {
            setTimeout(applyViewerReadOnlyUI, 120);
        }
    }, 50);
}

function getPageTitle(page) {
    const titles = {
        'learning-comments': 'Nhận xét học tập',
        dashboard: 'Dashboard',
        students: 'Học sinh',
        classes: 'Lớp',
        scores: 'Điểm',
        attendance: 'Điểm danh',
        rewards: 'Khen thưởng',
        disciplines: 'Kỷ luật',
        files: 'File',
        statistics: 'Thống kê',
        search: 'Tìm kiếm',
        settings: 'Cài đặt',
        'public-content': 'Nội dung website công khai',
        wheel: 'Vòng quay may mắn',
        'image-caller': 'Gọi tên bằng hình ảnh',
        'image-quiz': 'Trắc nghiệm hình ảnh',
        millionaire: 'Ai là triệu phú'
    };
    return titles[page] || page;
}

// ============================================================
// 5. DASHBOARD & CHARTS
// ============================================================
function renderDashboard() {
    const students = APP_STATE.students;
    const total = students.length;
    const male = students.filter(s => s.gender === 'Nam').length;
    const female = total - male;
    const classes = APP_STATE.classes;

    return `
        <section class="dashboard-overview">
            <div class="stats-grid dashboard-stats-grid">
                <div class="stat-card dashboard-stat stat-total">
                    <div class="stat-icon"><i class="fas fa-user-graduate"></i></div>
                    <div class="stat-content">
                        <div class="stat-value">${total}</div>
                        <div class="stat-label">Tổng học sinh</div>
                    </div>
                </div>
                <div class="stat-card dashboard-stat stat-class">
                    <div class="stat-icon"><i class="fas fa-chalkboard"></i></div>
                    <div class="stat-content">
                        <div class="stat-value">${classes.length}</div>
                        <div class="stat-label">Số lớp</div>
                    </div>
                </div>
                <div class="stat-card dashboard-stat stat-male">
                    <div class="stat-icon"><i class="fas fa-male"></i></div>
                    <div class="stat-content">
                        <div class="stat-value">${male}</div>
                        <div class="stat-label">Học sinh nam</div>
                    </div>
                </div>
                <div class="stat-card dashboard-stat stat-female">
                    <div class="stat-icon"><i class="fas fa-female"></i></div>
                    <div class="stat-content">
                        <div class="stat-value">${female}</div>
                        <div class="stat-label">Học sinh nữ</div>
                    </div>
                </div>
            </div>

            <section class="admin-visit-section" id="adminVisitStats" hidden>
                <div class="admin-visit-head">
                    <div>
                        <span class="dashboard-chart-kicker">THỐNG KÊ WEBSITE</span>
                        <h3>Lượt truy cập website công khai</h3>
                        <p>Chỉ tài khoản Admin nhìn thấy thống kê chi tiết này.</p>
                    </div>
                    <span class="admin-visit-status" id="visitStatsStatus"><i class="fas fa-spinner fa-spin"></i> Đang tải...</span>
                </div>

                <div class="admin-visit-grid">
                    <div class="admin-visit-card">
                        <i class="far fa-eye"></i>
                        <div><b id="visitStatTotal">--</b><span>Tổng lượt</span></div>
                    </div>
                    <div class="admin-visit-card">
                        <i class="far fa-calendar-check"></i>
                        <div><b id="visitStatToday">--</b><span>Hôm nay</span></div>
                    </div>
                    <div class="admin-visit-card">
                        <i class="fas fa-calendar-week"></i>
                        <div><b id="visitStat7Days">--</b><span>7 ngày gần đây</span></div>
                    </div>
                    <div class="admin-visit-card">
                        <i class="far fa-calendar-alt"></i>
                        <div><b id="visitStat30Days">--</b><span>30 ngày gần đây</span></div>
                    </div>
                </div>

                <div class="admin-visit-chart">
                    <div class="admin-visit-chart-title">
                        <strong>Biểu đồ lượt truy cập theo ngày</strong>
                        <span>30 ngày gần nhất</span>
                    </div>
                    <div class="admin-visit-chart-canvas">
                        <canvas id="chartSiteVisits"></canvas>
                    </div>
                </div>
            </section>

            <div class="chart-grid dashboard-chart-grid">
                <div class="chart-box dashboard-chart-card">
                    <div class="dashboard-chart-head">
                        <div>
                            <span class="dashboard-chart-kicker">CƠ CẤU HỌC SINH</span>
                            <h3>Nam / Nữ</h3>
                        </div>
                        <i class="fas fa-venus-mars"></i>
                    </div>
                    <div class="dashboard-chart-canvas">
                        <canvas id="chartGender"></canvas>
                    </div>
                </div>

                <div class="chart-box dashboard-chart-card">
                    <div class="dashboard-chart-head">
                        <div>
                            <span class="dashboard-chart-kicker">QUY MÔ LỚP HỌC</span>
                            <h3>Số học sinh theo lớp</h3>
                        </div>
                        <i class="fas fa-chart-column"></i>
                    </div>
                    <div class="dashboard-chart-canvas">
                        <canvas id="chartClass"></canvas>
                    </div>
                </div>
            </div>
        </section>
    `;
}

let chartInstances = {};

function initCharts() {
    const students = APP_STATE.students;
    const classes = APP_STATE.classes;

    const male = students.filter(s => s.gender === 'Nam').length;
    const female = students.length - male;
    if (chartInstances.gender) chartInstances.gender.destroy();
    chartInstances.gender = new Chart(document.getElementById('chartGender'), {
        type: 'doughnut',
        data: {
            labels: ['Nam', 'Nữ'],
            datasets: [{
                data: [male, female],
                backgroundColor: ['#2563eb', '#ec4899'],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { font: { size: 12 } } } }
        }
    });

    const classNames = classes.map(c => c.name);
    const classCounts = classes.map(c => c.count);
    if (chartInstances.class) chartInstances.class.destroy();
    chartInstances.class = new Chart(document.getElementById('chartClass'), {
        type: 'bar',
        data: {
            labels: classNames,
            datasets: [{
                label: 'Sĩ số',
                data: classCounts,
                backgroundColor: '#60a5fa',
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } } }
        }
    });
}

// ============================================================
// BƯỚC 151.5 - TẢI ẢNH HỌC SINH THEO NHU CẦU
// ============================================================
function getCanonicalStudent(studentOrId) {
    if (!studentOrId) return null;
    if (typeof studentOrId === 'object') {
        return (APP_STATE.students || []).find(s =>
            (studentOrId.db_uuid && s.db_uuid === studentOrId.db_uuid) ||
            (studentOrId.id && s.id === studentOrId.id)
        ) || studentOrId;
    }
    return (APP_STATE.students || []).find(s => s.id === studentOrId || s.db_uuid === studentOrId) || null;
}

function copyStudentAvatar(source, target) {
    if (!source || !target || source === target) return;
    target.avatar_url = source.avatar_url || null;
    target.avatar = source.avatar || DEFAULT_AVATAR;
    target._avatarLoaded = source._avatarLoaded === true;
}

async function ensureStudentAvatar(studentOrId, { throwOnError = false } = {}) {
    const original = typeof studentOrId === 'object' ? studentOrId : null;
    const student = getCanonicalStudent(studentOrId);
    if (!student) return DEFAULT_AVATAR;

    if (student._avatarLoaded === true) {
        copyStudentAvatar(student, original);
        return student.avatar || DEFAULT_AVATAR;
    }

    const uuid = student.db_uuid;
    if (!uuid) return DEFAULT_AVATAR;

    const { data, error } = await supabase
        .from('app3_students')
        .select('id, avatar_url')
        .eq('id', uuid)
        .maybeSingle();

    if (error) {
        console.warn('[LAZY AVATAR] Không tải được ảnh học sinh:', student.id, error.message);
        if (throwOnError) throw error;
        return student.avatar || DEFAULT_AVATAR;
    }

    student.avatar_url = data?.avatar_url || null;
    student.avatar = data?.avatar_url || DEFAULT_AVATAR;
    student._avatarLoaded = true;
    copyStudentAvatar(student, original);
    return student.avatar;
}

async function loadStudentAvatars(students) {
    const list = Array.isArray(students) ? students : [];
    const pending = list.filter(s => s && s.db_uuid && s._avatarLoaded !== true);
    if (!pending.length) return;

    const uuids = [...new Set(pending.map(s => s.db_uuid))];
    const { data, error } = await supabase
        .from('app3_students')
        .select('id, avatar_url')
        .in('id', uuids);

    if (error) {
        console.warn('[LAZY AVATAR] Không tải được ảnh trang học sinh:', error.message);
        return;
    }

    const avatarMap = new Map((data || []).map(row => [row.id, row.avatar_url || null]));
    pending.forEach(student => {
        student.avatar_url = avatarMap.get(student.db_uuid) || null;
        student.avatar = student.avatar_url || DEFAULT_AVATAR;
        student._avatarLoaded = true;
    });
}

function refreshStudentAvatarCells(students) {
    (students || []).forEach(student => {
        document.querySelectorAll(`[data-student-avatar="${student.db_uuid}"]`).forEach(img => {
            img.src = student.avatar || DEFAULT_AVATAR;
        });
    });
}

// ============================================================
// 6. QUẢN LÝ HỌC SINH (CRUD + IMPORT/EXCEL + AVATAR)
// ============================================================
let studentPage = 1;
const STUDENT_PAGE_SIZE = 10;
let studentSort = { field: 'fullName', order: 'asc' };

// BƯỚC 149.3: Giữ nguyên ngữ cảnh danh sách học sinh sau khi thêm/sửa ảnh/cập nhật/xóa.
// Người dùng đang làm việc ở lớp nào, trang nào và bộ lọc nào thì quay lại đúng vị trí đó.
let studentViewState = {
    search: '',
    className: '',
    grade: '',
    gender: ''
};

function captureStudentViewState() {
    studentViewState.search = document.getElementById('studentSearch')?.value ?? studentViewState.search;
    studentViewState.className = document.getElementById('filterClass')?.value ?? studentViewState.className;
    studentViewState.grade = document.getElementById('filterGrade')?.value ?? studentViewState.grade;
    studentViewState.gender = document.getElementById('filterGender')?.value ?? studentViewState.gender;
}

function restoreStudentViewState() {
    const searchEl = document.getElementById('studentSearch');
    const classEl = document.getElementById('filterClass');
    const gradeEl = document.getElementById('filterGrade');
    const genderEl = document.getElementById('filterGender');

    if (searchEl) searchEl.value = studentViewState.search || '';
    if (classEl) {
        const classStillAvailable = [...classEl.options].some(option => option.value === studentViewState.className);
        classEl.value = classStillAvailable ? (studentViewState.className || '') : '';
        if (!classStillAvailable) studentViewState.className = '';
    }
    if (gradeEl) gradeEl.value = studentViewState.grade || '';
    if (genderEl) genderEl.value = studentViewState.gender || '';
}

function renderStudents() {
    const studentSubject = APP_STATE.studentSubject || APP_STATE.subjectCatalog?.[0]?.name || SUBJECTS[0];
    const studentSubjectNames = getVisibleSubjectNames();
    const studentSubjectOptions = studentSubjectNames.map(subject => `<option value="${subject}" ${subject === studentSubject ? 'selected' : ''}>${subject}</option>`).join('');
    const studentAccessibleClasses = getAccessibleClassesForSubject(studentSubject);
    const selectedClass = studentViewState.className || '';
    const selectedStudent = window.__studentInlineEditorId ? APP_STATE.students.find(s => s.id === window.__studentInlineEditorId) : null;
    let editorHtml = '';
    if (selectedStudent) {
        const subjectScore = APP_STATE.scores[selectedStudent.id]?.[studentSubject] || {};
        const studentForForm = {...selectedStudent, competence: subjectScore.competence || '', quality: subjectScore.quality || ''};
        editorHtml = `
          <section class="student-editor-card">
            <div class="student-panel-heading">
              <div><span class="student-heading-icon"><i class="fas fa-user-pen"></i></span><div><h3>Cập nhật học sinh</h3><p>Chỉnh sửa hồ sơ và ảnh học sinh. Sau khi lưu vẫn giữ nguyên lớp đang chọn.</p></div></div>
              <button class="student-close-editor" onclick="closeStudentInlineEditor()" title="Đóng"><i class="fas fa-xmark"></i></button>
            </div>
            <div class="student-inline-form">${getStudentFormHTML(studentForForm, true)}</div>
            <label class="student-keep-class"><input type="checkbox" id="keepStudentClassAfterSave" checked><span><strong>Giữ nguyên lớp hiện tại sau khi lưu</strong><small>Thuận tiện cập nhật liên tục nhiều học sinh trong cùng lớp.</small></span></label>
            <div class="student-editor-actions">
              <button class="btn btn-primary" onclick="saveStudentInline(false)"><i class="fas fa-floppy-disk"></i> Lưu cập nhật</button>
              <button class="btn btn-secondary student-next-btn" onclick="saveStudentInline(true)"><i class="fas fa-forward-step"></i> Lưu & sang học sinh kế tiếp</button>
              <button class="btn btn-secondary" onclick="closeStudentInlineEditor()">Hủy</button>
            </div>
          </section>`;
    } else {
        editorHtml = `
          <section class="student-editor-card student-editor-empty">
            <div class="student-empty-icon"><i class="fas fa-user-pen"></i></div>
            <h3>Chọn học sinh để cập nhật</h3>
            <p>Bấm <strong>Sửa</strong> ở danh sách bên trái. Hệ thống sẽ giữ nguyên lớp và bộ lọc sau khi lưu.</p>
          </section>`;
    }

    return `
      <div class="student-pro-page">
        <div class="student-pro-header">
          <div class="student-pro-title"><span class="student-title-icon"><i class="fas fa-users"></i></span><div><h2>Quản lý học sinh</h2><p>Quản lý thông tin, hình ảnh, hồ sơ và thao tác liên tục theo lớp.</p></div></div>
          <div class="student-top-actions">
            <button class="btn btn-primary" onclick="openAddStudent()"><i class="fas fa-plus"></i> Thêm học sinh</button>
            <button class="btn btn-secondary" onclick="document.getElementById('importFileInput').click()"><i class="fas fa-file-import"></i> Nhập Excel</button>
            <button class="btn btn-info" onclick="document.getElementById('vneduStudentImportInput').click()"><i class="fas fa-school"></i> Cập nhật VNEDU</button>
            <button class="btn btn-secondary" onclick="exportExcel()"><i class="fas fa-download"></i> Xuất danh sách</button>
            <button id="exportSelectedStudentPhotosBtn" class="btn btn-secondary student-photo-export-btn" onclick="exportStudentPhotos('selected')" title="Xuất ảnh của các học sinh đã đánh dấu trong danh sách"><i class="fas fa-images"></i> Ảnh đã chọn <span id="selectedStudentPhotoCount" class="student-photo-export-count">(0)</span></button>
            <button class="btn btn-secondary student-photo-export-btn" onclick="exportStudentPhotos('all')" title="Xuất ảnh của toàn bộ học sinh mà tài khoản hiện tại được phép truy cập"><i class="fas fa-file-zipper"></i> Toàn bộ ảnh HS</button>
            <input type="file" id="importFileInput" accept=".xlsx,.xls" style="display:none" onchange="importExcel(event)">
          </div>
        </div>

        <div class="student-filter-card">
          <div class="student-filter-item"><label>Môn đánh giá</label><select id="studentSubject" onchange="window.switchStudentSubject(this.value)">${studentSubjectOptions}</select></div>
          <div class="student-filter-item"><label>Khối</label><select id="filterGrade" onchange="filterStudents()"><option value="">Tất cả khối</option><option value="1">Khối 1</option><option value="2">Khối 2</option><option value="3">Khối 3</option><option value="4">Khối 4</option><option value="5">Khối 5</option></select></div>
          <div class="student-filter-item"><label>Lớp</label><select id="filterClass" onchange="filterStudents()"><option value="">Tất cả lớp</option>${studentAccessibleClasses.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}</select></div>
          <div class="student-filter-item student-search-field"><label>Tìm học sinh</label><div class="student-search-wrap"><i class="fas fa-magnifying-glass"></i><input type="text" id="studentSearch" placeholder="Nhập mã học sinh, họ tên..." oninput="filterStudents()"></div></div>
          <div class="student-filter-item"><label>Giới tính</label><select id="filterGender" onchange="filterStudents()"><option value="">Tất cả</option><option value="Nam">Nam</option><option value="Nữ">Nữ</option></select></div>
          <button class="student-reset-btn" onclick="resetFilters()" title="Đặt lại bộ lọc"><i class="fas fa-rotate-right"></i></button>
          <div class="student-class-chip"><span class="student-heading-icon"><i class="fas fa-users"></i></span><div><small>Lớp đang chọn</small><strong>${selectedClass || 'Tất cả lớp'}</strong></div></div>
        </div>

        <div class="student-pro-grid ${selectedStudent ? 'has-editor' : ''}">
          <section class="student-list-card">
            <div class="student-panel-heading">
              <div><span class="student-heading-icon"><i class="fas fa-list"></i></span><div><h3>Danh sách học sinh</h3><p id="studentListSummary">Sẵn sàng tải danh sách</p></div></div>
              <div class="student-list-tools">
                <button class="btn btn-danger btn-sm" onclick="deleteSelectedStudents()"><i class="fas fa-trash"></i> Xóa đã chọn</button>
              </div>
            </div>
            <div class="table-wrapper student-table-shell"><table id="studentTable"><thead><tr>
              <th><input type="checkbox" id="selectAll" onchange="toggleSelectAll()"></th><th>STT</th><th>Ảnh</th><th data-sort="id">Mã HS</th><th data-sort="fullName">Họ tên</th><th data-sort="dob">Ngày sinh</th><th data-sort="gender">Giới tính</th><th data-sort="class">Lớp</th><th data-sort="competence">Năng lực</th><th data-sort="quality">Phẩm chất</th><th data-sort="status">Trạng thái</th><th>Thao tác</th>
            </tr></thead><tbody id="studentTableBody"></tbody></table></div>
            <div class="student-list-footer"><div class="student-export-hint"><i class="fas fa-circle-info"></i> Nút <strong>Xuất danh sách</strong> sẽ xuất đúng danh sách đang lọc phía trên.</div><div class="pagination" id="studentPagination"></div></div>
            <input type="file" id="vneduStudentImportInput" accept=".xlsx,.xls" multiple style="display:none" onchange="importVnEduStudentWorkbook(event)">
          </section>
          ${editorHtml}
        </div>
      </div>`;
}
function switchStudentSubject(subject) {
    const validSubjects =
        APP_STATE.subjectCatalog?.length
            ? APP_STATE.subjectCatalog.map(item => item.name)
            : SUBJECTS;

    if (!validSubjects.includes(subject)) return;

    APP_STATE.studentSubject = subject;
    studentPage = 1;
    renderPage('students');
}
function getFilteredStudents() {
    let list = [...APP_STATE.students];
    if (hasAssignedScope()) {
        const allowedClassIds = getAssignedClassIds(APP_STATE.studentSubject);
        list = list.filter(student => allowedClassIds.has(student.class_id));
    }
    const k = document.getElementById('studentSearch')?.value?.toLowerCase() || '';
    if (k) list = list.filter(s => s.fullName.toLowerCase().includes(k) || s.id.toLowerCase().includes(k));
    const cls = document.getElementById('filterClass')?.value || '';
    if (cls) list = list.filter(s => s.class === cls);
    const grd = document.getElementById('filterGrade')?.value || '';
    if (grd) list = list.filter(s => s.grade === grd);
    const gen = document.getElementById('filterGender')?.value || '';
    if (gen) list = list.filter(s => s.gender === gen);
    const field = studentSort.field;
const order = studentSort.order;
const subject =
    APP_STATE.studentSubject ||
    APP_STATE.subjectCatalog?.[0]?.name ||
    SUBJECTS[0];

list.sort((a, b) => {
    let va;
    let vb;

    if (field === 'competence' || field === 'quality') {
        const evaluationA = APP_STATE.scores?.[a.id]?.[subject] || {};
        const evaluationB = APP_STATE.scores?.[b.id]?.[subject] || {};

        va = evaluationA[field] || '';
        vb = evaluationB[field] || '';
    } else {
        va = a[field] || '';
        vb = b[field] || '';
    }

    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();

    if (va < vb) return order === 'asc' ? -1 : 1;
    if (va > vb) return order === 'asc' ? 1 : -1;

    return 0;
});
    return list;
}

function initStudentTable() {
    // Sau renderPage('students'), các ô lọc được tạo lại. Khôi phục chúng trước khi lọc dữ liệu.
    restoreStudentViewState();

    const subject =
    APP_STATE.studentSubject ||
    APP_STATE.subjectCatalog?.[0]?.name ||
    SUBJECTS[0];

    const list = getFilteredStudents();
    const total = list.length;
    const summaryEl = document.getElementById('studentListSummary'); if (summaryEl) summaryEl.textContent = `Hiển thị ${total} học sinh${studentViewState.className ? ' · Lớp ' + studentViewState.className : ''}`;
    const totalPages = Math.ceil(total / STUDENT_PAGE_SIZE);
    if (studentPage > totalPages) studentPage = totalPages || 1;
    const start = (studentPage - 1) * STUDENT_PAGE_SIZE;
    const pageData = list.slice(start, start + STUDENT_PAGE_SIZE);
    const tbody = document.getElementById('studentTableBody');
    if (!tbody) return;
    tbody.innerHTML = pageData.map((s, idx) => {
        const stt = start + idx + 1;
        const checked = APP_STATE.selectedStudents.includes(s.id) ? 'checked' : '';
        const avatarSrc = (s.avatar && s.avatar.startsWith('data:image')) ? s.avatar : DEFAULT_AVATAR;
        const evaluation = APP_STATE.scores?.[s.id]?.[subject] || {};
const competence = evaluation.competence || '';
const quality = evaluation.quality || '';
        return `<tr>
            <td><input type="checkbox" class="student-check" data-id="${s.id}" ${checked} onchange="toggleStudent('${s.id}')"></td>
            <td>${stt}</td>
            <td><img src="${avatarSrc}" data-student-avatar="${s.db_uuid}" class="avatar-sm" alt="avatar" style="width:32px;height:32px;border-radius:50%;object-fit:cover;"></td>
            <td><strong>${s.id}</strong></td>
            <td>${s.fullName}</td>
            <td>${formatDate(s.dob)}</td>
            <td>${s.gender}</td>
            <td>${s.class}</td>
            <td>${displayText(competence)}</td>
            <td>${displayText(quality)}</td>
            <td>${getStatusBadge(s.status)}</td>
            <td>
                <div class="table-actions">
                    <button class="btn-icon" title="Xem" onclick="viewStudent('${s.id}')"><i class="fas fa-eye"></i></button>
                    <button class="btn-icon" title="Sửa" onclick="editStudent('${s.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon" title="Xóa" onclick="deleteStudent('${s.id}')" style="color:#dc2626;"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('');

    // BƯỚC 151.5: chỉ tải ảnh của 10 học sinh trên trang hiện tại, không chặn render bảng.
    loadStudentAvatars(pageData)
        .then(() => refreshStudentAvatarCells(pageData))
        .catch(err => console.warn('[LAZY AVATAR] Lỗi tải ảnh trang hiện tại:', err));

    const pag = document.getElementById('studentPagination');
    if (pag) {
        let html = `<button onclick="goStudentPage(${studentPage - 1})" ${studentPage <= 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>`;
        for (let i = 1; i <= totalPages; i++) {
            html += `<button class="${i === studentPage ? 'active' : ''}" onclick="goStudentPage(${i})">${i}</button>`;
        }
        html += `<button onclick="goStudentPage(${studentPage + 1})" ${studentPage >= totalPages ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>`;
        pag.innerHTML = html;
    }
    document.querySelectorAll('#studentTable thead th[data-sort]').forEach(th => {
        th.style.cursor = 'pointer';
        th.onclick = function() {
            const field = this.dataset.sort;
            if (studentSort.field === field) {
                studentSort.order = studentSort.order === 'asc' ? 'desc' : 'asc';
            } else {
                studentSort.field = field;
                studentSort.order = 'asc';
            }
            initStudentTable();
        };
    });
    updateStudentPhotoExportButtons();
}

function filterStudents() {
    captureStudentViewState();
    studentPage = 1;
    initStudentTable();
}
function resetFilters() {
    studentViewState = { search: '', className: '', grade: '', gender: '' };
    document.getElementById('studentSearch').value = '';
    document.getElementById('filterClass').value = '';
    document.getElementById('filterGrade').value = '';
    document.getElementById('filterGender').value = '';
    studentPage = 1;
    initStudentTable();
}
function goStudentPage(p) {
    const list = getFilteredStudents();
    const totalPages = Math.ceil(list.length / STUDENT_PAGE_SIZE);
    if (p < 1 || p > totalPages) return;
    studentPage = p;
    initStudentTable();
}

function toggleStudent(id) {
    const idx = APP_STATE.selectedStudents.indexOf(id);
    if (idx > -1) APP_STATE.selectedStudents.splice(idx, 1);
    else APP_STATE.selectedStudents.push(id);
    initStudentTable();
}
function toggleSelectAll() {
    const checked = document.getElementById('selectAll').checked;
    const list = getFilteredStudents();
    const start = (studentPage - 1) * STUDENT_PAGE_SIZE;
    const pageData = list.slice(start, start + STUDENT_PAGE_SIZE);
    if (checked) {
        pageData.forEach(s => { if (!APP_STATE.selectedStudents.includes(s.id)) APP_STATE.selectedStudents.push(s.id); });
    } else {
        pageData.forEach(s => {
            const idx = APP_STATE.selectedStudents.indexOf(s.id);
            if (idx > -1) APP_STATE.selectedStudents.splice(idx, 1);
        });
    }
    initStudentTable();
}

// ============================================================
// 7. CÁC HÀM XỬ LÝ AVATAR VÀ THÊM/SỬA HỌC SINH (có dùng Supabase)
// ============================================================
function resizeImage(dataUrl, maxWidth = 200, maxHeight = 200, quality = 0.7) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = function() {
            let width = img.width;
            let height = img.height;
            if (width > height) {
                if (width > maxWidth) {
                    height = Math.round(height * maxWidth / width);
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width = Math.round(width * maxHeight / height);
                    height = maxHeight;
                }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            const resizedDataUrl = canvas.toDataURL('image/jpeg', quality);
            resolve(resizedDataUrl);
        };
        img.src = dataUrl;
    });
}

function previewAvatar(input) {
    const preview = document.getElementById('sfAvatarPreview');
    if (preview) preview.dataset.avatarCleared = 'false';
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = async function(e) {
            const dataUrl = e.target.result;
            const resizedUrl = await resizeImage(dataUrl, 200, 200, 0.7);
            preview.src = resizedUrl;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function clearAvatar() {
    const preview = document.getElementById('sfAvatarPreview');
    if (preview) { preview.src = DEFAULT_AVATAR; preview.dataset.avatarCleared = 'true'; }
    const input = document.getElementById('sfAvatarInput');
    if (input) input.value = '';
}

function getStudentFormHTML(student = null, showAvatar = true) {
    const s = student || {};
    const classes = APP_STATE.classes.map(c => c.name);
    const avatarSrc = (s.avatar && s.avatar.startsWith('data:image')) ? s.avatar : DEFAULT_AVATAR;
    const compOptions = ['', 'Tốt', 'Đạt', 'Cần cố gắng'];
    const qualOptions = ['', 'Tốt', 'Đạt', 'Cần cố gắng'];

    return `
        ${showAvatar ? `
        <div style="text-align:center; margin-bottom:1rem;">
            <img id="sfAvatarPreview" src="${avatarSrc}" class="profile-avatar" style="width:120px; height:120px; border-radius:50%; object-fit:cover; border:3px solid var(--primary);">
            <div style="margin-top:0.5rem; display:flex; gap:0.5rem; justify-content:center; flex-wrap:wrap;">
                <label class="btn btn-secondary btn-sm" style="cursor:pointer;">
                    <i class="fas fa-upload"></i> Tải ảnh
                    <input type="file" id="sfAvatarInput" accept="image/*" style="display:none" onchange="previewAvatar(this)">
                </label>
                <button class="btn btn-danger btn-sm" onclick="clearAvatar()"><i class="fas fa-times"></i> Xóa ảnh</button>
            </div>
        </div>
        ` : ''}
        <div class="form-grid">
            <div class="form-group"><label>Họ và tên *</label><input type="text" id="sfFullName" value="${s.fullName || ''}" placeholder="Nguyễn Văn A"></div>
            <div class="form-group"><label>Ngày sinh *</label><input type="date" id="sfDob" value="${s.dob || ''}"></div>
            <div class="form-group"><label>Giới tính</label>
                <select id="sfGender"><option value="Nam" ${s.gender === 'Nam' ? 'selected' : ''}>Nam</option><option value="Nữ" ${s.gender === 'Nữ' ? 'selected' : ''}>Nữ</option></select>
            </div>
            <div class="form-group"><label>Lớp</label>
                <select id="sfClass">${classes.map(c => `<option value="${c}" ${s.class === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
            </div>
            <div class="form-group"><label>Khối</label>
                <select id="sfGrade"><option value="1" ${s.grade === '1' ? 'selected' : ''}>1</option><option value="2" ${s.grade === '2' ? 'selected' : ''}>2</option><option value="3" ${s.grade === '3' ? 'selected' : ''}>3</option><option value="4" ${s.grade === '4' ? 'selected' : ''}>4</option><option value="5" ${s.grade === '5' ? 'selected' : ''}>5</option></select>
            <div class="form-group"><label>Địa chỉ</label><input type="text" id="sfAddress" value="${s.address || ''}"></div>
            <div class="form-group"><label>Số điện thoại</label><input type="text" id="sfPhone" value="${s.phone || ''}"></div>
            <div class="form-group"><label>Email</label><input type="email" id="sfEmail" value="${s.email || ''}"></div>
            <div class="form-group"><label>Tên cha</label><input type="text" id="sfFather" value="${s.fatherName || ''}"></div>
            <div class="form-group"><label>Tên mẹ</label><input type="text" id="sfMother" value="${s.motherName || ''}"></div>
            <div class="form-group"><label>SĐT phụ huynh</label><input type="text" id="sfParentPhone" value="${s.parentPhone || ''}"></div>
            <div class="form-group"><label>Trạng thái</label>
                <select id="sfStatus"><option value="Đang học" ${s.status === 'Đang học' ? 'selected' : ''}>Đang học</option><option value="Đã chuyển" ${s.status === 'Đã chuyển' ? 'selected' : ''}>Đã chuyển</option><option value="Đã tốt nghiệp" ${s.status === 'Đã tốt nghiệp' ? 'selected' : ''}>Đã tốt nghiệp</option><option value="Bảo lưu" ${s.status === 'Bảo lưu' ? 'selected' : ''}>Bảo lưu</option></select>
            </div>
            <div class="form-group"><label>Năng lực</label>
                <select id="sfCompetence">
                    ${compOptions.map(opt => `<option value="${opt}" ${s.competence === opt ? 'selected' : ''}>${opt || ''}</option>`).join('')}
                </select>
            </div>
            <div class="form-group"><label>Phẩm chất</label>
                <select id="sfQuality">
                    ${qualOptions.map(opt => `<option value="${opt}" ${s.quality === opt ? 'selected' : ''}>${opt || ''}</option>`).join('')}
                </select>
            </div>
            <div class="form-group"><label>Ngày nhập học</label><input type="date" id="sfEnrollmentDate" value="${s.enrollmentDate || ''}"></div>
            <div class="form-group"><label>Ghi chú</label><textarea id="sfNote">${s.note || ''}</textarea></div>
        </div>
    `;
}

function getStudentFormData() {
    const dob = document.getElementById('sfDob').value;
    return {
        fullName: document.getElementById('sfFullName').value.trim(),
        dob: dob,
        gender: document.getElementById('sfGender').value,
        class: document.getElementById('sfClass').value,
        grade: document.getElementById('sfGrade').value,
        address: document.getElementById('sfAddress').value.trim(),
        phone: document.getElementById('sfPhone').value.trim(),
        email: document.getElementById('sfEmail').value.trim(),
        fatherName: document.getElementById('sfFather').value.trim(),
        motherName: document.getElementById('sfMother').value.trim(),
        parentPhone: document.getElementById('sfParentPhone').value.trim(),
        status: document.getElementById('sfStatus').value,
        note: document.getElementById('sfNote').value.trim(),
        competence: document.getElementById('sfCompetence').value,
        quality: document.getElementById('sfQuality').value,
        enrollmentDate: document.getElementById('sfEnrollmentDate').value || new Date().toISOString().split('T')[0]
    };
}

async function addStudentToSupabase(data, avatarFile) {
    if (!requireEditPermission('thêm học sinh')) return null;
    const classObj = APP_STATE.classes.find(c => c.name === data.class);
    const classId = classObj ? classObj.id : null;

    const maxCode = APP_STATE.students.reduce((max, s) => {
        const num = parseInt(s.id.replace('HS', ''));
        return num > max ? num : max;
    }, 10000);
    const studentCode = `HS${String(maxCode + 1).padStart(5, '0')}`;

    let avatarUrl = DEFAULT_AVATAR;
    if (avatarFile) {
        try {
            const reader = new FileReader();
            const base64 = await new Promise((resolve) => {
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsDataURL(avatarFile);
            });
            const resized = await resizeImage(base64, 200, 200, 0.7);
            avatarUrl = resized;
        } catch (err) {
            console.warn('Lỗi xử lý ảnh:', err);
        }
    }

    const studentData = {
        student_code: studentCode,
        full_name: data.fullName,
        dob: data.dob || null,
        gender: data.gender,
        address: data.address,
        phone: data.phone,
        email: data.email,
        class_id: classId,
        grade: data.grade,
        father_name: data.fatherName,
        mother_name: data.motherName,
        parent_phone: data.parentPhone,
        enrollment_date: data.enrollmentDate || null,
        status: data.status || 'Đang học',
        note: data.note,
        avatar_url: (avatarCleared && !avatarFile) ? null : avatarUrl
    };

    const { data: inserted, error } = await supabase
        .from('app3_students')
        .insert([studentData])
        .select()
        .single();

    if (error) throw error;

// Lưu Năng lực + Phẩm chất theo môn đang chọn vào app3_scores
const subject =
    APP_STATE.studentSubject ||
    APP_STATE.subjectCatalog?.[0]?.name ||
    SUBJECTS[0] ||
    'Tin học';

const { error: scoreError } = await supabase
    .from('app3_scores')
    .upsert({
        student_id: inserted.id,
        subject: subject,
        subject_id: getSubjectId(subject),
        competence: data.competence || '',
        quality: data.quality || ''
    }, {
        onConflict: 'student_id,subject'
    });

if (scoreError) throw scoreError;

const newStudent = {
        ...inserted,
        db_uuid: inserted.id,
        id: inserted.student_code,
        fullName: inserted.full_name,
        dob: inserted.dob,
        gender: inserted.gender,
        address: inserted.address,
        phone: inserted.phone,
        email: inserted.email,
        fatherName: inserted.father_name,
        motherName: inserted.mother_name,
        parentPhone: inserted.parent_phone,
        competence: inserted.competence,
        quality: inserted.quality,
        enrollmentDate: inserted.enrollment_date,
        status: inserted.status,
        note: inserted.note,
        avatar: inserted.avatar_url || DEFAULT_AVATAR,
        _avatarLoaded: true,
        grade: inserted.grade,
        class: data.class,
        class_id: inserted.class_id
    };
    APP_STATE.students.push(newStudent);
    APP_STATE.scores[newStudent.id] = {};
    const studentSubjects =
    APP_STATE.subjectCatalog?.length
        ? APP_STATE.subjectCatalog.map(subject => subject.name)
        : SUBJECTS;

studentSubjects.forEach(sub => {
    APP_STATE.scores[newStudent.id][sub] = {
        giuaKy1: '',
        cuoiKy1: null,
        giuaKy2: '',
        cuoiKy2: null,
        competence: '',
        quality: ''
    };
});
    updateClassCounts();
    return newStudent;
}

function openAddStudent() {
    if (!requireEditPermission('thêm học sinh')) return;
    captureStudentViewState();
    showModal('Thêm học sinh', getStudentFormHTML(null, true), 'Thêm', 'Hủy').then(async confirmed => {
        if (confirmed) {
            const data = getStudentFormData();
            if (!data.fullName || !data.dob) {
                showToast('Vui lòng điền đầy đủ thông tin!', 'error');
                return;
            }
            const avatarInput = document.getElementById('sfAvatarInput');
            const avatarFile = avatarInput && avatarInput.files.length ? avatarInput.files[0] : null;

            try {
                await addStudentToSupabase(data, avatarFile);
                showToast('Thêm học sinh thành công!');
                renderPage('students');
            } catch (err) {
                showToast('Lỗi khi thêm học sinh: ' + err.message, 'error');
            }
        }
    });
}

async function updateStudentInSupabase(id, data, avatarFile, avatarCleared = false) {
    if (!requireEditPermission('sửa học sinh')) return;
    const existing = APP_STATE.students.find(s => s.id === id);
    if (!existing) throw new Error('Không tìm thấy học sinh');

    const classObj = APP_STATE.classes.find(c => c.name === data.class);
    const classId = classObj ? classObj.id : null;

    // BƯỚC 151.5: phải biết ảnh gốc trước khi cập nhật để không ghi đè ảnh cũ
    // chỉ vì avatar chưa được tải trong lần đăng nhập ban đầu.
    await ensureStudentAvatar(existing, { throwOnError: true });
    let avatarUrl = existing.avatar;
    if (avatarCleared && !avatarFile) {
        avatarUrl = DEFAULT_AVATAR;
    } else if (avatarFile) {
        try {
            const reader = new FileReader();
            const base64 = await new Promise((resolve) => {
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsDataURL(avatarFile);
            });
            const resized = await resizeImage(base64, 200, 200, 0.7);
            avatarUrl = resized;
        } catch (err) {
            console.warn('Lỗi xử lý ảnh mới:', err);
        }
    } else {
        if (!avatarUrl || avatarUrl === DEFAULT_AVATAR) {
            avatarUrl = DEFAULT_AVATAR;
        }
    }

    const updateData = {
        full_name: data.fullName,
        dob: data.dob || null,
        gender: data.gender,
        address: data.address,
        phone: data.phone,
        email: data.email,
        class_id: classId,
        grade: data.grade,
        father_name: data.fatherName,
        mother_name: data.motherName,
        parent_phone: data.parentPhone,
        enrollment_date: data.enrollmentDate || null,
        status: data.status || 'Đang học',
        note: data.note,
        avatar_url: avatarUrl
    };

    const { error } = await supabase
        .from('app3_students')
        .update(updateData)
        .eq('student_code', id);

    if (error) throw error;
// Lưu Năng lực + Phẩm chất theo môn đang chọn
const subject =
    APP_STATE.studentSubject ||
    APP_STATE.subjectCatalog?.[0]?.name ||
    SUBJECTS[0];

const { error: scoreError } = await supabase
    .from('app3_scores')
    .upsert({
        student_id: existing.db_uuid,
        subject: subject,
        subject_id: getSubjectId(subject),
        competence: data.competence,
        quality: data.quality
    }, {
        onConflict: 'student_id,subject'
    });

if (scoreError) throw scoreError;

// Đồng bộ dữ liệu trong bộ nhớ
if (!APP_STATE.scores[id]) {
    APP_STATE.scores[id] = {};
}

if (!APP_STATE.scores[id][subject]) {
    APP_STATE.scores[id][subject] = {
        giuaKy1: '',
        cuoiKy1: null,
        giuaKy2: '',
        cuoiKy2: null,
        competence: '',
        quality: ''
    };
}

APP_STATE.scores[id][subject].competence = data.competence;
APP_STATE.scores[id][subject].quality = data.quality;
    Object.assign(existing, {
        fullName: data.fullName,
        dob: data.dob,
        gender: data.gender,
        address: data.address,
        phone: data.phone,
        email: data.email,
        fatherName: data.fatherName,
        motherName: data.motherName,
        parentPhone: data.parentPhone,
        enrollmentDate: data.enrollmentDate,
        status: data.status,
        note: data.note,
        avatar: (avatarCleared && !avatarFile) ? DEFAULT_AVATAR : avatarUrl,
        avatar_url: (avatarCleared && !avatarFile) ? DEFAULT_AVATAR : avatarUrl,
        _avatarLoaded: true,
        grade: data.grade,
        class: data.class,
        class_id: classId
    });
    updateClassCounts();
    return existing;
}

async function editStudent(id) {
    if (!requireEditPermission('sửa học sinh')) return;
    captureStudentViewState();
    const student = APP_STATE.students.find(s => s.id === id);
    if (student) await ensureStudentAvatar(student);
    window.__studentInlineEditorId = id;
    renderPage('students');
}

function closeStudentInlineEditor() {
    captureStudentViewState();
    window.__studentInlineEditorId = null;
    renderPage('students');
}

function setStudentGenderFilter(gender) {
    const el = document.getElementById('filterGender');
    if (el) el.value = gender || '';
    studentViewState.gender = gender || '';
    studentPage = 1;
    initStudentTable();
}

async function saveStudentInline(goNext = false) {
    const id = window.__studentInlineEditorId;
    if (!id) return;
    const data = getStudentFormData();
    if (!data.fullName || !data.dob) {
        showToast('Vui lòng điền đầy đủ họ tên và ngày sinh!', 'error');
        return;
    }
    const avatarInput = document.getElementById('sfAvatarInput');
    const avatarFile = avatarInput && avatarInput.files.length ? avatarInput.files[0] : null;
    const avatarCleared = document.getElementById('sfAvatarPreview')?.dataset?.avatarCleared === 'true';
    const keepClass = document.getElementById('keepStudentClassAfterSave')?.checked !== false;
    captureStudentViewState();
    const originalClass = studentViewState.className;
    try {
        await updateStudentInSupabase(id, data, avatarFile, avatarCleared);
        if (keepClass) studentViewState.className = originalClass || data.class || '';
        showToast(`Đã lưu thành công${studentViewState.className ? ' - vẫn giữ lớp ' + studentViewState.className : ''}!`);
        if (goNext) {
            const currentList = getFilteredStudents();
            const idx = currentList.findIndex(s => s.id === id);
            const next = currentList[idx + 1] || currentList[idx - 1] || null;
            window.__studentInlineEditorId = next?.id || null;
        }
        renderPage('students');
    } catch (err) {
        showToast('Lỗi cập nhật: ' + (err?.message || err), 'error');
    }
}
async function viewStudent(id) {
    const s = APP_STATE.students.find(st => st.id === id);
    if (!s) return;
    await ensureStudentAvatar(s);

    const avatarSrc = (s.avatar && s.avatar.startsWith('data:image'))
        ? s.avatar
        : DEFAULT_AVATAR;

    // Dữ liệu đánh giá theo từng môn của học sinh
    const studentScores = APP_STATE.scores[s.id] || {};

    // Dùng chung danh sách môn hiện tại của hệ thống
    const subjects =
    APP_STATE.subjectCatalog?.length
        ? APP_STATE.subjectCatalog.map(subject => subject.name)
        : [...SUBJECTS];

    // Mặc định mở môn đầu tiên
    const defaultSubject = subjects[0] || '';

    // Lấy dữ liệu đánh giá của môn mặc định
    const defaultScore = studentScores[defaultSubject] || {};

    const html = `
        <div class="profile-header">
            <img
                src="${avatarSrc}"
                class="profile-avatar"
                id="viewAvatar"
                alt="avatar"
                style="width:100px;height:100px;border-radius:50%;object-fit:cover;border:3px solid var(--primary);"
            >

            <div class="profile-info">
                <h2>${s.fullName}</h2>

                <p>
                    <strong>Mã HS:</strong> ${s.id}
                    | <strong>Lớp:</strong> ${s.class}
                    | <strong>Khối:</strong> ${s.grade}
                </p>

                <p>${getStatusBadge(s.status)}</p>

                <div style="margin-top:0.5rem; display:flex; gap:0.5rem;">
                    <button
                        class="btn btn-primary btn-sm"
                        onclick="downloadAvatar('${s.id}')"
                    >
                        <i class="fas fa-download"></i> Tải ảnh
                    </button>
                </div>
            </div>
        </div>

        <div class="form-grid">
            <div>
                <label>Ngày sinh</label>
                <p><strong>${formatDate(s.dob)}</strong></p>
            </div>

            <div>
                <label>Giới tính</label>
                <p><strong>${s.gender}</strong></p>
            </div>

            <div>
                <label>Địa chỉ</label>
                <p><strong>${s.address || ''}</strong></p>
            </div>

            <div>
                <label>SĐT</label>
                <p><strong>${s.phone || ''}</strong></p>
            </div>

            <div>
                <label>Email</label>
                <p><strong>${s.email || ''}</strong></p>
            </div>

            <!-- ĐÁNH GIÁ THEO MÔN -->
            <div class="form-group">
                <label for="viewStudentSubject">
                    <strong>Môn đánh giá</strong>
                </label>

                <select id="viewStudentSubject">
                    ${
                        subjects.map(subject => `
                            <option
                                value="${subject}"
                                ${subject === defaultSubject ? 'selected' : ''}
                            >
                                ${subject}
                            </option>
                        `).join('')
                    }
                </select>
            </div>

            <div id="viewStudentEvaluation">
                <div>
                    <label>Năng lực</label>
                    <p>
                        <strong id="viewStudentCompetence">
                            ${displayText(defaultScore.competence) || 'Chưa đánh giá'}
                        </strong>
                    </p>
                </div>

                <div>
                    <label>Phẩm chất</label>
                    <p>
                        <strong id="viewStudentQuality">
                            ${displayText(defaultScore.quality) || 'Chưa đánh giá'}
                        </strong>
                    </p>
                </div>
            </div>

            <div>
                <label>Ngày nhập học</label>
                <p><strong>${formatDate(s.enrollmentDate)}</strong></p>
            </div>

            <div>
                <label>Tên cha</label>
                <p><strong>${s.fatherName || ''}</strong></p>
            </div>

            <div>
                <label>Tên mẹ</label>
                <p><strong>${s.motherName || ''}</strong></p>
            </div>

            <div>
                <label>SĐT phụ huynh</label>
                <p><strong>${s.parentPhone || ''}</strong></p>
            </div>

            <div>
                <label>Ghi chú</label>
                <p><strong>${s.note || ''}</strong></p>
            </div>
        </div>

        <div class="flex gap-2 mt-2">
            <button
                class="btn btn-primary btn-sm"
                onclick="printStudent('${s.id}')"
            >
                <i class="fas fa-print"></i> In hồ sơ
            </button>
        </div>
    `;

    showModal('Hồ sơ học sinh', html, 'Đóng', '');

    // Khi thay đổi môn, chỉ cập nhật Năng lực + Phẩm chất
    const subjectSelect = document.getElementById('viewStudentSubject');
    const competenceElement = document.getElementById('viewStudentCompetence');
    const qualityElement = document.getElementById('viewStudentQuality');

    if (subjectSelect && competenceElement && qualityElement) {
        subjectSelect.addEventListener('change', function () {
            const selectedSubject = this.value;

            const score = studentScores[selectedSubject] || {};

            competenceElement.textContent =
                score.competence || 'Chưa đánh giá';

            qualityElement.textContent =
                score.quality || 'Chưa đánh giá';
        });
    }
}

async function downloadAvatar(studentId) {
    const student = APP_STATE.students.find(s => s.id === studentId);
    if (!student) return;
    await ensureStudentAvatar(student);
    const avatarSrc = (student.avatar && student.avatar.startsWith('data:image')) ? student.avatar : null;
    if (!avatarSrc || avatarSrc === DEFAULT_AVATAR) {
        showToast('Học sinh này chưa có ảnh riêng.', 'warning');
        return;
    }
    const link = document.createElement('a');
    link.href = avatarSrc;
    link.download = `avatar_${student.fullName.replace(/\s/g,'_')}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Đang tải ảnh...', 'info');
}

// ============================================================
// BƯỚC 151.49.3F.11 - XUẤT ẢNH HỌC SINH ĐÃ CHỌN / TOÀN BỘ
// ============================================================
function updateStudentPhotoExportButtons() {
    const selectedIds = new Set(APP_STATE.selectedStudents || []);
    const accessibleIds = new Set((APP_STATE.students || []).map(student => student.id));
    const count = [...selectedIds].filter(id => accessibleIds.has(id)).length;
    const countEl = document.getElementById('selectedStudentPhotoCount');
    const btn = document.getElementById('exportSelectedStudentPhotosBtn');
    if (countEl) countEl.textContent = `(${count})`;
    if (btn) btn.disabled = count === 0;
}

function sanitizeStudentPhotoFilePart(value, fallback = 'khong_ten') {
    const safe = String(value ?? '')
        .trim()
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^[_\.]+|[_\.]+$/g, '');
    return safe || fallback;
}

function studentPhotoExtension(blob, source = '') {
    const type = String(blob?.type || '').toLowerCase();
    if (type.includes('png')) return 'png';
    if (type.includes('webp')) return 'webp';
    if (type.includes('gif')) return 'gif';
    if (type.includes('jpeg') || type.includes('jpg')) return 'jpg';
    const cleanSource = String(source || '').split('?')[0].toLowerCase();
    const match = cleanSource.match(/\.(png|webp|gif|jpe?g)$/);
    if (match) return match[1] === 'jpeg' ? 'jpg' : match[1];
    return 'jpg';
}

async function getStudentPhotoBlob(student) {
    if (!student) return null;
    const source = student.avatar_url ||
        ((student.avatar && student.avatar !== DEFAULT_AVATAR) ? student.avatar : '');
    if (!source || source === DEFAULT_AVATAR) return null;

    try {
        const response = await fetch(source, { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        if (!blob || !String(blob.type || '').startsWith('image/')) return null;
        return { blob, source };
    } catch (error) {
        console.warn('[EXPORT STUDENT PHOTO] Không tải được ảnh:', student.id, error);
        return null;
    }
}

async function exportStudentPhotos(mode = 'selected') {
    if (typeof JSZip === 'undefined') {
        showToast('Chưa tải được thư viện đóng gói ZIP. Hãy kiểm tra Internet và thử lại.', 'error');
        return;
    }

    const accessibleStudents = [...(APP_STATE.students || [])];
    const accessibleById = new Map(accessibleStudents.map(student => [student.id, student]));
    let students = [];
    let exportLabel = '';

    if (mode === 'selected') {
        students = (APP_STATE.selectedStudents || [])
            .map(id => accessibleById.get(id))
            .filter(Boolean);
        exportLabel = 'các học sinh đã chọn';
        if (!students.length) {
            showToast('Vui lòng đánh dấu ít nhất một học sinh để xuất ảnh.', 'warning');
            return;
        }
    } else {
        students = accessibleStudents;
        exportLabel = 'toàn bộ học sinh';
        if (!students.length) {
            showToast('Không có học sinh để xuất ảnh.', 'warning');
            return;
        }
    }

    const confirmed = await showModal(
        'Xuất ảnh học sinh',
        `Hệ thống sẽ xuất ảnh của <strong>${students.length}</strong> học sinh (${exportLabel}) thành một file ZIP.<br><br>Học sinh chưa có ảnh riêng sẽ được <strong>bỏ qua</strong>. Ảnh được chia theo thư mục lớp để dễ quản lý.`,
        'Bắt đầu xuất',
        'Hủy'
    );
    if (!confirmed) return;

    try {
        showLoading();
        showToast(`Đang chuẩn bị ảnh của ${students.length} học sinh...`, 'info', 2500);

        // Tải avatar theo lô để không phải truy vấn Supabase từng học sinh.
        await loadStudentAvatars(students);

        const zip = new JSZip();
        let exported = 0;
        let skipped = 0;

        for (let index = 0; index < students.length; index++) {
            const student = students[index];
            const photo = await getStudentPhotoBlob(student);
            if (!photo) {
                skipped++;
                continue;
            }

            const className = sanitizeStudentPhotoFilePart(student.class || 'Chua_xep_lop', 'Chua_xep_lop');
            const studentCode = sanitizeStudentPhotoFilePart(student.id || student.db_uuid || String(index + 1), String(index + 1));
            const fullName = sanitizeStudentPhotoFilePart(student.fullName || 'Hoc_sinh', 'Hoc_sinh');
            const ext = studentPhotoExtension(photo.blob, photo.source);
            const folder = zip.folder(`Lop_${className}`);
            folder.file(`${studentCode}_${fullName}.${ext}`, photo.blob);
            exported++;

            if ((index + 1) % 10 === 0 || index === students.length - 1) {
                showToast(`Đang xử lý ảnh: ${index + 1}/${students.length}`, 'info', 1200);
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }

        if (!exported) {
            showToast('Không tìm thấy ảnh riêng của học sinh để xuất.', 'warning', 4500);
            return;
        }

        zip.file('THONG_TIN.txt',
            `XUẤT ẢNH HỌC SINH\n` +
            `Thời gian: ${new Date().toLocaleString('vi-VN')}\n` +
            `Số học sinh yêu cầu: ${students.length}\n` +
            `Số ảnh đã xuất: ${exported}\n` +
            `Số học sinh chưa có/không tải được ảnh: ${skipped}\n`
        );

        showToast(`Đang đóng gói ${exported} ảnh thành file ZIP...`, 'info', 2500);
        const zipBlob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 1 }
        });

        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement('a');
        const now = new Date();
        const stamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
        link.href = url;
        link.download = mode === 'selected'
            ? `anh_hoc_sinh_da_chon_${stamp}.zip`
            : `toan_bo_anh_hoc_sinh_${stamp}.zip`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);

        showToast(`Đã xuất ${exported} ảnh${skipped ? ` · Bỏ qua ${skipped} học sinh chưa có ảnh` : ''}.`, 'success', 5000);
    } catch (error) {
        console.error('[EXPORT STUDENT PHOTOS]', error);
        showToast('Lỗi xuất ảnh học sinh: ' + (error?.message || error), 'error', 5000);
    } finally {
        hideLoading();
    }
}

async function deleteStudent(id) {
    if (!requireEditPermission('xóa học sinh')) return;
    captureStudentViewState();
    const student = APP_STATE.students.find(s => s.id === id);
    if (!student) return;
    const confirmed = await showModal('Xóa học sinh', `Bạn có chắc muốn xóa học sinh <strong>${student.fullName}</strong>?`, 'Xóa', 'Hủy');
    if (confirmed) {
        try {
            const { error } = await supabase
                .from('app3_students')
                .delete()
                .eq('student_code', id);
            if (error) throw error;

            APP_STATE.students = APP_STATE.students.filter(s => s.id !== id);
            APP_STATE.selectedStudents = APP_STATE.selectedStudents.filter(sid => sid !== id);
            delete APP_STATE.scores[id];
            updateClassCounts();
            showToast('Đã xóa học sinh!', 'warning');
            renderPage('students');
        } catch (err) {
            showToast('Lỗi xóa: ' + err.message, 'error');
        }
    }
}

async function deleteSelectedStudents() {
    if (!requireEditPermission('xóa học sinh')) return;
    captureStudentViewState();
    if (APP_STATE.selectedStudents.length === 0) {
        showToast('Vui lòng chọn ít nhất một học sinh.', 'warning');
        return;
    }
    const confirmed = await showModal('Xóa nhiều học sinh', `Bạn có chắc muốn xóa <strong>${APP_STATE.selectedStudents.length}</strong> học sinh?`, 'Xóa tất cả', 'Hủy');
    if (confirmed) {
        try {
            const ids = APP_STATE.selectedStudents;
            const { error } = await supabase
                .from('app3_students')
                .delete()
                .in('student_code', ids);
            if (error) throw error;

            APP_STATE.students = APP_STATE.students.filter(s => !ids.includes(s.id));
            ids.forEach(id => delete APP_STATE.scores[id]);
            APP_STATE.selectedStudents = [];
            updateClassCounts();
            showToast('Đã xóa các học sinh đã chọn!', 'warning');
            renderPage('students');
        } catch (err) {
            showToast('Lỗi xóa: ' + err.message, 'error');
        }
    }
}

// ============================================================
// 8. IMPORT / EXPORT EXCEL (học sinh)
// ============================================================
function exportExcel() {
    // BƯỚC 150.4.5: Xuất đúng danh sách đang hiển thị theo bộ lọc chính
    // (môn, khối, lớp, tìm kiếm, giới tính). Không dùng bộ lọc phụ trùng lặp.
    captureStudentViewState();

    const subject =
        document.getElementById('studentSubject')?.value ||
        APP_STATE.studentSubject ||
        APP_STATE.subjectCatalog?.[0]?.name ||
        SUBJECTS[0];
    APP_STATE.studentSubject = subject;

    const currentClass = document.getElementById('filterClass')?.value || '';
    const currentGrade = document.getElementById('filterGrade')?.value || '';
    const currentGender = document.getElementById('filterGender')?.value || '';
    const currentSearch = document.getElementById('studentSearch')?.value?.trim() || '';

    // Dùng cùng một hàm với bảng học sinh để kết quả Excel khớp 100% danh sách đang lọc.
    const studentsToExport = getFilteredStudents();

    if (!studentsToExport.length) {
        showToast('Không có học sinh phù hợp với bộ lọc hiện tại để xuất.', 'warning');
        return;
    }

    const data = studentsToExport.map(s => {
        const evaluation = APP_STATE.scores?.[s.id]?.[subject] || {};
        return {
            'Môn đánh giá': subject,
            'Mã HS': s.id,
            'Họ tên': s.fullName,
            'Ngày sinh': s.dob,
            'Giới tính': s.gender,
            'Lớp': s.class,
            'Khối': s.grade,
            'Địa chỉ': s.address,
            'SĐT': s.phone,
            'Email': s.email,
            'Năng lực': evaluation.competence || '',
            'Phẩm chất': evaluation.quality || '',
            'Trạng thái': s.status,
            'Tên cha': s.fatherName || '',
            'Tên mẹ': s.motherName || '',
            'SĐT phụ huynh': s.parentPhone || '',
            'Ngày nhập học': s.enrollmentDate || '',
            'Ghi chú': s.note || ''
        };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    const sheetName = (currentClass ? `Lop_${currentClass}` : subject).slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const safePart = currentClass
        ? `lop_${currentClass}`
        : currentGrade
            ? `khoi_${currentGrade}`
            : currentGender
                ? currentGender
                : currentSearch
                    ? 'ket_qua_tim_kiem'
                    : 'tat_ca';
    const datePart = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Danh_sach_hoc_sinh_${safePart}_${datePart}.xlsx`);

    const filterText = [
        currentClass ? `lớp ${currentClass}` : '',
        currentGrade && !currentClass ? `khối ${currentGrade}` : '',
        currentGender ? currentGender : '',
        currentSearch ? `tìm kiếm “${currentSearch}”` : ''
    ].filter(Boolean).join(', ');
    showToast(`Đã xuất ${studentsToExport.length} học sinh${filterText ? ` (${filterText})` : ''}.`, 'success');
}

function downloadSampleExcel() {
    const sampleData = [{
        'Mã HS': 'HS10001',
        'Họ tên': 'Nguyễn Văn A',
        'Ngày sinh': '2015-05-15',
        'Giới tính': 'Nam',
        'Lớp': '3B1',
        'Khối': '3',
        'Địa chỉ': '123 Đường Lê Lợi, Khu phố 1, Đặc khu Kiên Hải',
        'SĐT': '0912345678',
        'Email': 'vana@gmail.com',
        'Năng lực': '',
        'Phẩm chất': '',
        'Trạng thái': 'Đang học',
        'Tên cha': 'Nguyễn Văn B',
        'Tên mẹ': 'Nguyễn Thị C',
        'SĐT phụ huynh': '0987654321',
        'Ngày nhập học': '2025-09-01',
        'Ghi chú': ''
    }, {
        'Mã HS': 'HS10002',
        'Họ tên': 'Trần Thị B',
        'Ngày sinh': '2015-08-20',
        'Giới tính': 'Nữ',
        'Lớp': '4B2',
        'Khối': '4',
        'Địa chỉ': '456 Đường Nguyễn Huệ, Khu phố 2, Đặc khu Kiên Hải',
        'SĐT': '0987654321',
        'Email': 'thib@gmail.com',
        'Năng lực': '',
        'Phẩm chất': '',
        'Trạng thái': 'Đang học',
        'Tên cha': 'Trần Văn D',
        'Tên mẹ': 'Trần Thị E',
        'SĐT phụ huynh': '0912345678',
        'Ngày nhập học': '2025-09-01',
        'Ghi chú': ''
    }];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(sampleData);
    XLSX.utils.book_append_sheet(wb, ws, 'Mau');
    XLSX.writeFile(wb, 'Mau_import_hoc_sinh.xlsx');
    showToast('Đã tải file mẫu!');
}

function importExcel(event) {
    if (!requireEditPermission('import học sinh')) { if (event?.target) event.target.value = ''; return; }
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
            let imported = 0;
            let errors = 0;
            const newStudents = [];

            for (const row of rows) {
                const fullName = row['Họ tên'] || row['Họ và tên'] || '';
                const dobRaw = row['Ngày sinh'] || '';
                const gender = row['Giới tính'] || '';
                const cls = row['Lớp'] || '';
                const grade = String(row['Khối'] || '').trim();
                const address = row['Địa chỉ'] || '';
                const phone = row['SĐT'] || '';
                const email = row['Email'] || '';
                const fatherName = row['Tên cha'] || '';
                const motherName = row['Tên mẹ'] || '';
                const parentPhone = row['SĐT phụ huynh'] || '';
                const status = row['Trạng thái'] || 'Đang học';
                const note = row['Ghi chú'] || '';
                const competence = row['Năng lực'] || '';
                const quality = row['Phẩm chất'] || '';
                const enrollmentRaw = row['Ngày nhập học'] || '';

                if (!fullName || !gender || !cls) {
                    errors++;
                    continue;
                }

                let dob = '';
                if (dobRaw) {
                    if (typeof dobRaw === 'number') {
                        const date = new Date((dobRaw - 25569) * 86400 * 1000);
                        if (!isNaN(date.getTime())) {
                            dob = date.toISOString().split('T')[0];
                        }
                    } else if (typeof dobRaw === 'string') {
                        let parts = dobRaw.split(/[\/\-]/);
                        if (parts.length === 3) {
                            let day = parseInt(parts[0]);
                            let month = parseInt(parts[1]);
                            let year = parseInt(parts[2]);
                            if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                                if (year < 100) year += 2000;
                                const date = new Date(year, month-1, day);
                                if (!isNaN(date.getTime())) {
                                    dob = date.toISOString().split('T')[0];
                                }
                            }
                        }
                        if (!dob) {
                            const date = new Date(dobRaw);
                            if (!isNaN(date.getTime())) {
                                dob = date.toISOString().split('T')[0];
                            }
                        }
                    }
                }

                let enrollmentDate = '';
                if (enrollmentRaw) {
                    if (typeof enrollmentRaw === 'number') {
                        const date = new Date((enrollmentRaw - 25569) * 86400 * 1000);
                        if (!isNaN(date.getTime())) {
                            enrollmentDate = date.toISOString().split('T')[0];
                        }
                    } else {
                        const date = new Date(enrollmentRaw);
                        if (!isNaN(date.getTime())) {
                            enrollmentDate = date.toISOString().split('T')[0];
                        }
                    }
                }

                const maxCode = APP_STATE.students.reduce((max, s) => {
                    const num = parseInt(s.id.replace('HS', ''));
                    return num > max ? num : max;
                }, 10000);
                const studentCode = `HS${String(maxCode + newStudents.length + 1).padStart(5, '0')}`;

                const classObj = APP_STATE.classes.find(c => c.name === cls);
                let classId = classObj ? classObj.id : null;
                if (!classObj) {
                    const newClass = {
                        name: cls,
                        grade: grade || cls.charAt(0),
                        teacher: 'Võ Thanh Đậm',
                        class_code: 'L' + cls
                    };
                    const { data: insertedClass, error: classErr } = await supabase
                        .from('app3_classes')
                        .insert([newClass])
                        .select()
                        .single();
                    if (!classErr && insertedClass) {
                        APP_STATE.classes.push(insertedClass);
                        APP_STATE.classMap[insertedClass.name] = insertedClass.id;
                        classId = insertedClass.id;
                    }
                }

                newStudents.push({
                    student_code: studentCode,
                    full_name: fullName.trim(),
                    dob: dob,
                    gender: gender.trim(),
                    class_id: classId,
                    grade: grade || cls.trim().charAt(0),
                    address: address.trim(),
                    phone: phone.trim(),
                    email: email.trim(),
                    father_name: fatherName.trim(),
                    mother_name: motherName.trim(),
                    parent_phone: parentPhone.trim(),
                    status: status.trim(),
                    note: note.trim(),
                    competence: competence.trim(),
                    quality: quality.trim(),
                    enrollment_date: enrollmentDate || new Date().toISOString().split('T')[0],
                    avatar_url: DEFAULT_AVATAR,
                    class: cls,
                    fullName: fullName.trim(),
                    id: studentCode
                });
                imported++;
            }

            if (newStudents.length > 0) {
    const { data: inserted, error: insertErr } = await supabase
        .from('app3_students')
        .insert(newStudents.map(s => ({
            student_code: s.student_code,
            full_name: s.full_name,
            dob: s.dob,
            gender: s.gender,
            class_id: s.class_id,
            grade: s.grade,
            address: s.address,
            phone: s.phone,
            email: s.email,
            father_name: s.father_name,
            mother_name: s.mother_name,
            parent_phone: s.parent_phone,
            status: s.status,
            note: s.note,
            enrollment_date: s.enrollment_date,
            avatar_url: s.avatar_url
        })))
        .select();

    if (insertErr) throw insertErr;

    const importSubject =
        APP_STATE.studentSubject ||
        APP_STATE.subjectCatalog?.[0]?.name ||
        SUBJECTS[0] ||
        'Tin học';

    for (let i = 0; i < inserted.length; i++) {
        const st = inserted[i];
        const sourceStudent = newStudents[i];

        const newStudent = {
            ...st,
            db_uuid: st.id,
            id: st.student_code,
            fullName: st.full_name,
            dob: st.dob,
            gender: st.gender,
            address: st.address,
            phone: st.phone,
            email: st.email,
            fatherName: st.father_name,
            motherName: st.mother_name,
            parentPhone: st.parent_phone,
            enrollmentDate: st.enrollment_date,
            status: st.status,
            note: st.note,
            avatar: st.avatar_url || DEFAULT_AVATAR,
            grade: st.grade,
            class: APP_STATE.classes.find(c => c.id === st.class_id)?.name || '',
            class_id: st.class_id
        };

        APP_STATE.students.push(newStudent);
        APP_STATE.scores[newStudent.id] = {};

        const importedStudentSubjects =
            getVisibleSubjectNames();

        importedStudentSubjects.forEach(sub => {
            APP_STATE.scores[newStudent.id][sub] = {
                giuaKy1: '',
                cuoiKy1: null,
                giuaKy2: '',
                cuoiKy2: null,
                competence: '',
                quality: ''
            };
        });

        // Lưu Năng lực + Phẩm chất của Excel vào môn đang chọn
        const { error: scoreError } = await supabase
            .from('app3_scores')
            .upsert({
                student_id: st.id,
                subject: importSubject,
                subject_id: getSubjectId(importSubject),
                competence: sourceStudent?.competence || '',
                quality: sourceStudent?.quality || ''
            }, {
                onConflict: 'student_id,subject'
            });

        if (scoreError) throw scoreError;

        // Đồng bộ dữ liệu trong bộ nhớ
        if (!APP_STATE.scores[newStudent.id][importSubject]) {
            APP_STATE.scores[newStudent.id][importSubject] = {
                giuaKy1: '',
                cuoiKy1: null,
                giuaKy2: '',
                cuoiKy2: null,
                competence: '',
                quality: ''
            };
        }

        APP_STATE.scores[newStudent.id][importSubject].competence =
            sourceStudent?.competence || '';

        APP_STATE.scores[newStudent.id][importSubject].quality =
            sourceStudent?.quality || '';
    }
                updateClassCounts();
                showToast(`Import thành công ${imported} học sinh. ${errors > 0 ? 'Có ' + errors + ' dòng bị lỗi (thiếu thông tin).' : ''}`);
            } else {
                showToast('Không có dữ liệu hợp lệ để import.', 'error');
            }
            renderPage('students');
            document.getElementById('importFileInput').value = '';
        } catch (err) {
            showToast('Lỗi đọc file: ' + err.message, 'error');
        }
    };
    reader.readAsArrayBuffer(file);
}

// ============================================================
// 9. QUẢN LÝ LỚP (CRUD với Supabase)
// ============================================================
function renderClasses() {
    updateClassCounts();
    const classOptions = APP_STATE.classes.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    return `
        <div class="card classes-card">
            <div class="classes-toolbar">
                <div class="classes-heading">
                    <span class="classes-kicker">HỌC SINH & LỚP</span>
                    <h3 class="card-title"><i class="fas fa-chalkboard-teacher"></i> Danh sách lớp</h3>
                    <span class="classes-count">${APP_STATE.classes.length} lớp</span>
                </div>
                <div class="classes-actions">
                    <div class="classes-export">
                        <select id="exportClassSelect" aria-label="Chọn lớp để xuất">
                            <option value="">Chọn lớp để xuất</option>
                            ${classOptions}
                        </select>
                        <button class="btn btn-success btn-sm" onclick="exportClassList()"><i class="fas fa-file-excel"></i> Xuất danh sách</button>
                    </div>
                    <button class="btn btn-primary btn-sm classes-add-btn" onclick="openAddClass()"><i class="fas fa-plus"></i> Thêm lớp</button>
                </div>
            </div>
            <div class="table-wrapper classes-table-wrapper">
                <table class="classes-table">
                    <thead><tr><th>STT</th><th>Tên lớp</th><th>Khối</th><th>GVCN</th><th>Sĩ số</th><th>Nam</th><th>Nữ</th><th>Thao tác</th></tr></thead>
                    <tbody id="classTableBody"></tbody>
                </table>
            </div>
        </div>
    `;
}

function initClassTable() {
    const tbody = document.getElementById('classTableBody');
    if (!tbody) return;
    const list = APP_STATE.classes;
    tbody.innerHTML = list.map((c, idx) => `
        <tr>
            <td>${idx + 1}</td>
            <td><strong>${c.name}</strong></td>
            <td>${c.grade}</td>
            <td>${c.teacher || 'Võ Thanh Đậm'}</td>
            <td>${c.count || 0}</td>
            <td>${c.male || 0}</td>
            <td>${c.female || 0}</td>
            <td>
                <div class="table-actions">
                    <button class="btn-icon" onclick="editClass('${c.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon" onclick="deleteClass('${c.id}')" style="color:#dc2626;"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
}

function openAddClass() {
    if (!requireEditPermission('thêm lớp')) return;
    showModal('Thêm lớp', `
        <div class="form-grid">
            <div class="form-group"><label>Tên lớp *</label><input type="text" id="cfName" placeholder="5B1"></div>
            <div class="form-group"><label>Khối *</label><select id="cfGrade"><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option></select></div>
            <div class="form-group"><label>Giáo viên chủ nhiệm</label><input type="text" id="cfTeacher" placeholder="Võ Thanh Đậm" value="Võ Thanh Đậm"></div>
        </div>
    `, 'Thêm', 'Hủy').then(async confirmed => {
        if (confirmed) {
            const name = document.getElementById('cfName').value.trim();
            const grade = document.getElementById('cfGrade').value;
            const teacher = document.getElementById('cfTeacher').value.trim() || 'Võ Thanh Đậm';
            if (!name) { showToast('Vui lòng nhập tên lớp!', 'error'); return; }
            if (APP_STATE.classes.some(c => c.name === name)) {
                showToast('Lớp đã tồn tại!', 'error'); return;
            }
            try {
                const { data: newClass, error } = await supabase
                    .from('app3_classes')
                    .insert([{
                        class_code: 'L' + name,
                        name: name,
                        grade: grade,
                        teacher: teacher
                    }])
                    .select()
                    .single();
                if (error) throw error;
                APP_STATE.classes.push(newClass);
                APP_STATE.classMap[newClass.name] = newClass.id;
                updateClassCounts();
                showToast('Thêm lớp thành công!');
                renderPage('classes');
            } catch (err) {
                showToast('Lỗi thêm lớp: ' + err.message, 'error');
            }
        }
    });
}

function editClass(id) {
    if (!requireEditPermission('sửa lớp')) return;
    const c = APP_STATE.classes.find(cls => cls.id === id);
    if (!c) return;
    showModal('Sửa lớp', `
        <div class="form-grid">
            <div class="form-group"><label>Tên lớp *</label><input type="text" id="cfName" value="${c.name}"></div>
            <div class="form-group"><label>Khối *</label><select id="cfGrade"><option value="1" ${c.grade === '1' ? 'selected' : ''}>1</option><option value="2" ${c.grade === '2' ? 'selected' : ''}>2</option><option value="3" ${c.grade === '3' ? 'selected' : ''}>3</option><option value="4" ${c.grade === '4' ? 'selected' : ''}>4</option><option value="5" ${c.grade === '5' ? 'selected' : ''}>5</option></select></div>
            <div class="form-group"><label>Giáo viên chủ nhiệm</label><input type="text" id="cfTeacher" value="${c.teacher || 'Võ Thanh Đậm'}"></div>
        </div>
    `, 'Cập nhật', 'Hủy').then(async confirmed => {
        if (confirmed) {
            const name = document.getElementById('cfName').value.trim();
            if (!name) { showToast('Vui lòng nhập tên lớp!', 'error'); return; }
            try {
                const { error } = await supabase
                    .from('app3_classes')
                    .update({
                        name: name,
                        grade: document.getElementById('cfGrade').value,
                        teacher: document.getElementById('cfTeacher').value.trim() || 'Võ Thanh Đậm'
                    })
                    .eq('id', id);
                if (error) throw error;
                const oldName = c.name;
                c.name = name;
                c.grade = document.getElementById('cfGrade').value;
                c.teacher = document.getElementById('cfTeacher').value.trim() || 'Võ Thanh Đậm';
                delete APP_STATE.classMap[oldName];
                APP_STATE.classMap[name] = id;
                APP_STATE.students.forEach(s => {
                    if (s.class === oldName) s.class = name;
                });
                updateClassCounts();
                showToast('Cập nhật thành công!');
                renderPage('classes');
            } catch (err) {
                showToast('Lỗi cập nhật: ' + err.message, 'error');
            }
        }
    });
}

async function deleteClass(id) {
    if (!requireEditPermission('xóa lớp')) return;
    const c = APP_STATE.classes.find(cls => cls.id === id);
    if (!c) return;
    const confirmed = await showModal('Xóa lớp', `Bạn có chắc muốn xóa lớp <strong>${c.name}</strong>?`, 'Xóa', 'Hủy');
    if (confirmed) {
        try {
            const { error } = await supabase
                .from('app3_classes')
                .delete()
                .eq('id', id);
            if (error) throw error;
            APP_STATE.classes = APP_STATE.classes.filter(cls => cls.id !== id);
            delete APP_STATE.classMap[c.name];
            updateClassCounts();
            showToast('Đã xóa lớp!', 'warning');
            renderPage('classes');
        } catch (err) {
            showToast('Lỗi xóa lớp: ' + err.message, 'error');
        }
    }
}

// ============================================================
// 10. QUẢN LÝ ĐIỂM (CÓ CỘT NĂNG LỰC & PHẨM CHẤT)
// ============================================================
function renderScores() {
    const scoreAccessibleClasses = getAccessibleClassesForSubject(APP_STATE.currentSubject);
    const classOptions = scoreAccessibleClasses.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    const scoreSubjectNames = getVisibleSubjectNames();

    const subjectOptions = scoreSubjectNames
        .map(sub => `<option value="${sub}" ${sub === APP_STATE.currentSubject ? 'selected' : ''}>${sub}</option>`)
        .join('');

    return `
        <section class="scores-pro-page">
            <div class="scores-pro-header">
                <div class="scores-pro-title">
                    <span class="scores-title-icon"><i class="fas fa-pencil-alt"></i></span>
                    <div>
                        <span class="scores-kicker">ĐÁNH GIÁ HỌC TẬP</span>
                        <h2>Quản lý điểm</h2>
                        <p>Nhập và theo dõi kết quả môn <strong>${APP_STATE.currentSubject}</strong> theo từng giai đoạn đánh giá.</p>
                    </div>
                </div>

                <div class="scores-header-actions">
                    <button class="btn btn-secondary btn-sm" onclick="downloadScoreImportTemplate()">
                        <i class="fas fa-download"></i> Mẫu nhập điểm
                    </button>
                    <button class="btn btn-primary btn-sm" onclick="document.getElementById('scoreImportInput').click()">
                        <i class="fas fa-file-import"></i> Nhập điểm Excel
                    </button>
                    <input type="file" id="scoreImportInput" accept=".xlsx,.xls" style="display:none" onchange="importScoresExcel(event)">
                </div>
            </div>

            <div class="scores-control-card">
                <div class="scores-control-item">
                    <label>Môn học</label>
                    <select id="scoreSubject" onchange="switchSubject(this.value)">
                        ${subjectOptions}
                    </select>
                </div>

                <div class="scores-control-item">
                    <label>Lớp hiển thị</label>
                    <select id="scoreClass" onchange="initScoreTable()">
                        <option value="">Tất cả lớp</option>
                        ${classOptions}
                    </select>
                </div>

                <div class="scores-control-item scores-search-item">
                    <label>Tìm học sinh</label>
                    <div class="scores-search-wrap">
                        <i class="fas fa-magnifying-glass"></i>
                        <input type="text" id="scoreSearch" placeholder="Nhập mã học sinh hoặc họ tên..." oninput="initScoreTable()">
                    </div>
                </div>

                <div class="scores-control-item">
                    <label>Giai đoạn VNEDU</label>
                    <select id="vneduPeriod" onchange="initScoreTable()">
                        <option value="gk1">Giữa kỳ 1</option>
                        <option value="ck1">Cuối kỳ 1</option>
                        <option value="gk2">Giữa kỳ 2</option>
                        <option value="ck2">Cuối kỳ 2</option>
                    </select>
                </div>
            </div>

            <div class="scores-actions-card">
                <div class="scores-export-group">
                    <select id="exportScoreClass">
                        <option value="">Chọn lớp để xuất</option>
                        ${classOptions}
                    </select>
                    <button class="btn btn-success btn-sm" onclick="exportScoreClass()">
                        <i class="fas fa-file-excel"></i> Xuất điểm
                    </button>
                </div>

                <div class="scores-vnedu-actions">
                    <button class="btn btn-success btn-sm" onclick="exportVnEduScores()">
                        <i class="fas fa-file-export"></i> Xuất VNEDU lớp
                    </button>
                    <button class="btn btn-info btn-sm" onclick="document.getElementById('vneduScoreImportInput').click()">
                        <i class="fas fa-file-import"></i> Nhập VNEDU lớp
                    </button>
                    <input type="file" id="vneduScoreImportInput" accept=".xlsx,.xls" style="display:none" onchange="importVnEduScoresExcel(event)">
                    <button class="btn btn-success btn-sm" onclick="exportVnEduTeachingWorkbook()">
                        <i class="fas fa-file-excel"></i> Xuất các môn tôi dạy
                    </button>
                    <button class="btn btn-info btn-sm" onclick="document.getElementById('vneduTeachingImportInput').click()">
                        <i class="fas fa-file-import"></i> Nhập các môn tôi dạy
                    </button>
                    <input type="file" id="vneduTeachingImportInput" accept=".xlsx,.xls" style="display:none" onchange="importVnEduTeachingWorkbook(event)">
                </div>
            </div>

            <div class="scores-table-card">
                <div class="scores-table-head">
                    <div>
                        <span class="scores-table-icon"><i class="fas fa-table-list"></i></span>
                        <div>
                            <h3>Bảng điểm học sinh</h3>
                            <p>Môn hiện tại: <strong>${APP_STATE.currentSubject}</strong>. Các thay đổi vẫn được lưu theo từng học sinh.</p>
                        </div>
                    </div>
                </div>
                <div class="table-wrapper scores-table-wrapper">
                    <table class="scores-table">
                        <thead><tr id="scoreTableHead"></tr></thead>
                        <tbody id="scoreTableBody"></tbody>
                    </table>
                </div>
            </div>
        </section>
    `;
}

function switchSubject(subject) {
    const validSubjects =
        APP_STATE.subjectCatalog?.length
            ? APP_STATE.subjectCatalog.map(item => item.name)
            : SUBJECTS;

    if (!validSubjects.includes(subject)) return;

    APP_STATE.currentSubject = subject;
    renderPage('scores');
}

function initScoreTable() {
    const tbody = document.getElementById('scoreTableBody');
    const thead = document.getElementById('scoreTableHead');
    if (!tbody || !thead) return;

    let list = APP_STATE.students;
    if (hasAssignedScope()) {
        const allowedClassIds = getAssignedClassIds(APP_STATE.currentSubject);
        list = list.filter(student => allowedClassIds.has(student.class_id));
    }

    const kw = document.getElementById('scoreSearch')?.value?.toLowerCase() || '';
    if (kw) list = list.filter(s => s.fullName.toLowerCase().includes(kw) || s.id.toLowerCase().includes(kw));
    const cls = document.getElementById('scoreClass')?.value || '';
    if (cls) list = list.filter(s => s.class === cls);

    const subject = APP_STATE.currentSubject;
    const period = document.getElementById('vneduPeriod')?.value || 'gk1';
    const gkOptions = ['', 'Hoàn thành tốt', 'Hoàn thành', 'Chưa hoàn thành'];

    const periodConfig = {
        gk1: {
            label: 'Giữa kỳ 1',
            commentField: 'nhanXetGk1',
            columns: ['rating']
        },
        ck1: {
            label: 'Cuối kỳ 1',
            commentField: 'nhanXetCk1',
            columns: ['score', 'rating']
        },
        gk2: {
            label: 'Giữa kỳ 2',
            commentField: 'nhanXetGk2',
            columns: ['rating']
        },
        ck2: {
            label: 'Cuối kỳ 2',
            commentField: 'nhanXetCk2',
            columns: ['score', 'rating', 'retestScore', 'retestRating']
        }
    };
    const cfg = periodConfig[period] || periodConfig.gk1;

    const dynamicHeaders = [];
    if (cfg.columns.includes('score')) dynamicHeaders.push(`<th>Điểm ${cfg.label}</th>`);
    if (cfg.columns.includes('rating')) dynamicHeaders.push(`<th>Xếp loại ${cfg.label}</th>`);
    if (cfg.columns.includes('retestScore')) dynamicHeaders.push('<th>Điểm sau thi lại</th>');
    if (cfg.columns.includes('retestRating')) dynamicHeaders.push('<th>Xếp loại sau thi lại</th>');

    thead.innerHTML = `
        <th>STT</th>
        <th>Mã HS</th>
        <th>Họ tên</th>
        <th>Lớp</th>
        ${dynamicHeaders.join('')}
        <th>Nhận xét VNEDU</th>
        <th>Thao tác</th>
    `;

    tbody.innerHTML = list.map((s, idx) => {
        const studentScores = APP_STATE.scores[s.id] || {};
        const sc = studentScores[subject] || {
            giuaKy1: '', cuoiKy1: null, xepLoaiCuoiKy1: '',
            giuaKy2: '', cuoiKy2: null, xepLoaiCuoiKy2: '',
            cuoiKy2SauThiLai: null, xepLoaiCuoiKy2SauThiLai: '',
            competence: '', quality: '',
            nhanXetGk1: '', nhanXetCk1: '', nhanXetGk2: '', nhanXetCk2: ''
        };

        const ratingOptions = (value) => gkOptions
            .map(opt => `<option value="${opt}" ${opt === value ? 'selected' : ''}>${opt || ''}</option>`)
            .join('');
        const numberInput = (field, value, label) => `
            <td>
                <input type="number" min="0" max="10" step="0.5"
                    aria-label="${label}"
                    value="${value !== null && value !== undefined ? value : ''}"
                    style="width:76px;"
                    onchange="updateScore('${s.id}','${field}',this.value)">
            </td>`;
        const ratingSelect = (field, value, label) => `
            <td>
                <select aria-label="${label}" style="width:150px;"
                    onchange="updateScore('${s.id}','${field}',this.value)">
                    ${ratingOptions(value || '')}
                </select>
            </td>`;

        let periodCells = '';
        if (period === 'gk1') {
            periodCells += ratingSelect('giuaKy1', sc.giuaKy1, 'Xếp loại Giữa kỳ 1');
        } else if (period === 'ck1') {
            periodCells += numberInput('cuoiKy1', sc.cuoiKy1, 'Điểm Cuối kỳ 1');
            periodCells += ratingSelect('xepLoaiCuoiKy1', sc.xepLoaiCuoiKy1, 'Xếp loại Cuối kỳ 1');
        } else if (period === 'gk2') {
            periodCells += ratingSelect('giuaKy2', sc.giuaKy2, 'Xếp loại Giữa kỳ 2');
        } else if (period === 'ck2') {
            periodCells += numberInput('cuoiKy2', sc.cuoiKy2, 'Điểm Cuối kỳ 2');
            periodCells += ratingSelect('xepLoaiCuoiKy2', sc.xepLoaiCuoiKy2, 'Xếp loại Cuối kỳ 2');
            periodCells += numberInput('cuoiKy2SauThiLai', sc.cuoiKy2SauThiLai, 'Điểm sau thi lại');
            periodCells += ratingSelect('xepLoaiCuoiKy2SauThiLai', sc.xepLoaiCuoiKy2SauThiLai, 'Xếp loại sau thi lại');
        }

        const commentValue = escapeHtmlAttr(sc[cfg.commentField] || '');
        return `<tr>
            <td>${idx + 1}</td>
            <td>${s.id}</td>
            <td>${s.fullName}</td>
            <td>${s.class}</td>
            ${periodCells}
            <td>
                <textarea rows="2" style="min-width:260px;width:100%;resize:vertical;"
                    placeholder="Nhận xét ${cfg.label}"
                    onchange="updateScore('${s.id}','${cfg.commentField}',this.value)">${commentValue}</textarea>
            </td>
            <td><button class="btn btn-primary btn-sm" onclick="saveScore('${s.id}')"><i class="fas fa-save"></i></button></td>
        </tr>`;
    }).join('');
}

async function updateScore(studentId, field, value) {
    if (!requireEditPermission('cập nhật điểm')) { initScoreTable(); return; }
    const subject = APP_STATE.currentSubject;
    if (!APP_STATE.scores[studentId]) {
        APP_STATE.scores[studentId] = {};
    }
    if (!APP_STATE.scores[studentId][subject]) {
    APP_STATE.scores[studentId][subject] = {
        giuaKy1: '',
        cuoiKy1: null,
        giuaKy2: '',
        cuoiKy2: null,
        competence: '',
        quality: ''
    };
}
    const sc = APP_STATE.scores[studentId][subject];
    let updateData = {};

    if (field === 'giuaKy1' || field === 'giuaKy2') {
        sc[field] = value;
        updateData = { [field === 'giuaKy1' ? 'giua_ky_1' : 'giua_ky_2']: value };
    } else if (['nhanXetGk1','nhanXetCk1','nhanXetGk2','nhanXetCk2'].includes(field)) {
        sc[field] = value;
        const commentColumns = {
            nhanXetGk1:'nhan_xet_gk1', nhanXetCk1:'nhan_xet_ck1',
            nhanXetGk2:'nhan_xet_gk2', nhanXetCk2:'nhan_xet_ck2'
        };
        updateData = { [commentColumns[field]]: value };
    } else if (field === 'cuoiKy1' || field === 'cuoiKy2' || field === 'cuoiKy2SauThiLai') {
        const num = parseFloat(value);
        sc[field] = isNaN(num) ? null : num;
        const scoreColumns = {
            cuoiKy1: 'cuoi_ky_1',
            cuoiKy2: 'cuoi_ky_2',
            cuoiKy2SauThiLai: 'cuoi_ky_2_sau_thi_lai'
        };
        updateData = { [scoreColumns[field]]: isNaN(num) ? null : num };
    } else if (field === 'xepLoaiCuoiKy1' || field === 'xepLoaiCuoiKy2' || field === 'xepLoaiCuoiKy2SauThiLai') {
        sc[field] = value;
        const ratingColumns = {
            xepLoaiCuoiKy1: 'xep_loai_cuoi_ky_1',
            xepLoaiCuoiKy2: 'xep_loai_cuoi_ky_2',
            xepLoaiCuoiKy2SauThiLai: 'xep_loai_cuoi_ky_2_sau_thi_lai'
        };
        updateData = { [ratingColumns[field]]: value };
    } else if (field === 'competence' || field === 'quality') {
        if (!APP_STATE.scores[studentId]) APP_STATE.scores[studentId] = {};
        if (!APP_STATE.scores[studentId][subject]) {
            APP_STATE.scores[studentId][subject] = { giuaKy1: '', cuoiKy1: null, giuaKy2: '', cuoiKy2: null, competence: '', quality: '' };
        }
        APP_STATE.scores[studentId][subject][field] = value;
        const updatedSc = APP_STATE.scores[studentId][subject];

        const student = APP_STATE.students.find(s => s.id === studentId);
        if (!student) return;

        const { error: scoreError } = await supabase
            .from('app3_scores')
            .upsert({
                student_id: student.db_uuid,
                subject: subject,
                subject_id: getSubjectId(subject),
                giua_ky_1: updatedSc.giuaKy1 || '',
                cuoi_ky_1: updatedSc.cuoiKy1 !== null ? updatedSc.cuoiKy1 : null,
                giua_ky_2: updatedSc.giuaKy2 || '',
                cuoi_ky_2: updatedSc.cuoiKy2 !== null ? updatedSc.cuoiKy2 : null,
                competence: updatedSc.competence || '',
                quality: updatedSc.quality || ''
            }, { onConflict: 'student_id,subject' });

        if (scoreError) {
            console.error('Lỗi cập nhật bảng ĐIỂM:', scoreError);
            showToast('Lỗi lưu điểm: ' + scoreError.message, 'error');
            return;
        }

         student[field] = value;

        showToast(
            `Đã lưu ${field === 'competence' ? 'Năng lực' : 'Phẩm chất'} môn ${subject}!`,
            'success',
            1500
        );

        return;
    }
    const student = APP_STATE.students.find(s => s.id === studentId);
    if (!student) return;

    if (updateData && Object.keys(updateData).length) {
        const { error } = await supabase
            .from('app3_scores')
            .upsert({
                student_id: student.db_uuid,
                subject: subject,
                subject_id: getSubjectId(subject),
                ...updateData
            }, { onConflict: 'student_id,subject' });
        if (error) {
            showToast('Lỗi cập nhật điểm: ' + error.message, 'error');
        }
    }
}

function saveScore(studentId) {
    if (!requireEditPermission('lưu điểm')) return;
    showToast('Đã lưu điểm!');
    initScoreTable();
}

// ============================================================
// 11. ĐIỂM DANH (CRUD với Supabase)
// ============================================================
function renderAttendance() {
    const today = new Date().toISOString().split('T')[0];
    const attendanceClasses = hasAssignedScope() ? getAccessibleClassesForSubject('') : APP_STATE.classes;
    const classOptions = (attendanceClasses || []).map(c => `<option value="${c.name}">${c.name}</option>`).join('');

    return `
        <section class="attendance-pro-page">
            <div class="attendance-pro-header">
                <div class="attendance-pro-title">
                    <span class="attendance-title-icon"><i class="fas fa-clipboard-check"></i></span>
                    <div>
                        <span class="attendance-kicker">THEO DÕI CHUYÊN CẦN</span>
                        <h2>Điểm danh học sinh</h2>
                        <p>Chọn lớp và ngày để cập nhật nhanh tình trạng chuyên cần của học sinh.</p>
                    </div>
                </div>
                <button class="btn btn-success attendance-export-btn" onclick="exportAttendanceExcel()">
                    <i class="fas fa-file-excel"></i> Xuất Excel
                </button>
            </div>

            <div class="attendance-filter-card">
                <div class="attendance-filter-item">
                    <label>Chọn lớp</label>
                    <select id="attendanceClass" onchange="loadAttendance()">${classOptions}</select>
                </div>
                <div class="attendance-filter-item">
                    <label>Ngày điểm danh</label>
                    <input type="date" id="attendanceDate" value="${today}" onchange="loadAttendance()">
                </div>
                <button class="btn btn-primary attendance-save-btn" onclick="saveAttendance()">
                    <i class="fas fa-save"></i> Lưu điểm danh
                </button>
            </div>

            <div class="attendance-stats-card">
                <div class="attendance-stats-head">
                    <div>
                        <span class="attendance-list-icon"><i class="fas fa-chart-column"></i></span>
                        <div>
                            <h3>Thống kê chuyên cần</h3>
                            <p>Xem Có mặt, Vắng/Phép, Không phép và Muộn theo tuần, tháng hoặc năm học.</p>
                        </div>
                    </div>
                    <div class="attendance-stats-controls">
                        <select id="attendanceStatsPeriod" aria-label="Khoảng thống kê">
                            <option value="week">Tuần</option>
                            <option value="month" selected>Tháng</option>
                            <option value="schoolyear">Năm học</option>
                        </select>
                        <button type="button" class="btn btn-primary" onclick="loadAttendanceStats()">
                            <i class="fas fa-chart-simple"></i> Xem thống kê
                        </button>
                        <button type="button" class="btn btn-success" onclick="exportAttendanceStatsExcel()">
                            <i class="fas fa-file-excel"></i> Xuất Excel thống kê
                        </button>
                    </div>
                </div>
                <div id="attendanceStatsResult" class="attendance-stats-result">
                    <div class="attendance-stats-placeholder">
                        <i class="fas fa-chart-line"></i>
                        <span>Chọn lớp, ngày tham chiếu và khoảng thời gian rồi bấm <b>Xem thống kê</b>.</span>
                    </div>
                </div>
            </div>

            <div class="attendance-list-card">
                <div class="attendance-list-head">
                    <div>
                        <span class="attendance-list-icon"><i class="fas fa-users"></i></span>
                        <div>
                            <h3>Danh sách điểm danh</h3>
                            <p>Có mặt là trạng thái mặc định; thay đổi từng học sinh khi cần.</p>
                        </div>
                    </div>
                    <div class="attendance-status-guide attendance-filter-buttons" aria-label="Lọc trạng thái điểm danh">
                        <button type="button" class="attendance-filter-chip active" data-filter="all" onclick="filterAttendanceStatus('all', this)">
                            <i class="fas fa-users"></i> Tất cả
                        </button>
                        <button type="button" class="attendance-filter-chip" data-filter="present" onclick="filterAttendanceStatus('present', this)">
                            <i class="fas fa-circle"></i> Có mặt
                        </button>
                        <button type="button" class="attendance-filter-chip" data-filter="absent" onclick="filterAttendanceStatus('absent', this)">
                            <i class="fas fa-circle"></i> Vắng / Phép
                        </button>
                        <button type="button" class="attendance-filter-chip" data-filter="late" onclick="filterAttendanceStatus('late', this)">
                            <i class="fas fa-circle"></i> Muộn
                        </button>
                    </div>
                </div>
                <div id="attendanceTableWrapper" class="attendance-table-body">
                    <div class="attendance-empty-state">
                        <i class="fas fa-calendar-check"></i>
                        <strong>Chọn lớp và ngày để xem danh sách</strong>
                        <span>Danh sách học sinh và trạng thái điểm danh sẽ hiển thị tại đây.</span>
                    </div>
                </div>
            </div>
        </section>
    `;
}

async function loadAttendance() {
    const clsName = document.getElementById('attendanceClass').value;
    const date = document.getElementById('attendanceDate').value;
    const wrapper = document.getElementById('attendanceTableWrapper');
    if (!clsName || !date) {
        wrapper.innerHTML = '<div class="attendance-empty-state"><i class="fas fa-calendar-check"></i><strong>Vui lòng chọn lớp và ngày</strong><span>Chọn đầy đủ thông tin phía trên để tải danh sách.</span></div>';
        return;
    }

    const classObj = APP_STATE.classes.find(c => c.name === clsName);
    if (!classObj) {
        wrapper.innerHTML = '<div class="attendance-empty-state"><i class="fas fa-circle-exclamation"></i><strong>Lớp không tồn tại</strong><span>Vui lòng chọn lại lớp từ danh sách.</span></div>';
        return;
    }

    const students = APP_STATE.students.filter(s => s.class === clsName);
    if (students.length === 0) {
        wrapper.innerHTML = '<div class="attendance-empty-state"><i class="fas fa-user-slash"></i><strong>Lớp này chưa có học sinh</strong><span>Chưa có dữ liệu học sinh để điểm danh.</span></div>';
        return;
    }

    const { data: records, error } = await supabase
        .from('app3_attendance')
        .select('*')
        .eq('class_id', classObj.id)
        .eq('attendance_date', date);

    if (error) {
        showToast('Lỗi tải điểm danh: ' + error.message, 'error');
        return;
    }

    const statusOptions = ['Có mặt', 'Vắng', 'Phép', 'Không phép', 'Muộn'];
    let html = `
        <div class="table-wrapper attendance-table-wrapper">
            <table class="attendance-table">
                <thead><tr><th>STT</th><th>Mã HS</th><th>Họ tên</th><th>Trạng thái</th></tr></thead>
                <tbody>
    `;
    students.forEach((s, idx) => {
        const record = records.find(r => r.student_id === s.db_uuid);
        const status = record ? record.status : 'Có mặt';
        const options = statusOptions.map(opt => `<option value="${opt}" ${opt === status ? 'selected' : ''}>${opt}</option>`).join('');
        html += `
            <tr class="attendance-student-row" data-attendance-status="${status}">
                <td>${idx + 1}</td>
                <td>${s.id}</td>
                <td>${s.fullName}</td>
                <td>
                    <select class="attendance-status" data-student="${s.db_uuid}" onchange="updateAttendanceStatus('${date}','${classObj.id}','${s.db_uuid}',this.value)">
                        ${options}
                    </select>
                </td>
            </tr>
        `;
    });
    html += `</tbody></table></div>`;
    wrapper.innerHTML = html;
    applyViewerReadOnlyUI();
}


function filterAttendanceStatus(filter, button) {
    const wrapper = document.getElementById('attendanceTableWrapper');
    if (!wrapper) return;

    const rows = wrapper.querySelectorAll('.attendance-student-row');
    rows.forEach(row => {
        const statusSelect = row.querySelector('.attendance-status');
        const status = statusSelect ? statusSelect.value : (row.dataset.attendanceStatus || 'Có mặt');

        let visible = true;
        if (filter === 'present') visible = status === 'Có mặt';
        if (filter === 'absent') visible = ['Vắng', 'Phép', 'Không phép'].includes(status);
        if (filter === 'late') visible = status === 'Muộn';

        row.style.display = visible ? '' : 'none';
    });

    document.querySelectorAll('.attendance-filter-chip').forEach(chip => {
        chip.classList.toggle('active', chip === button);
    });
}

async function updateAttendanceStatus(date, classId, studentUuid, status) {
    const changedSelect = document.querySelector(`.attendance-status[data-student="${studentUuid}"]`);
    if (changedSelect) {
        const changedRow = changedSelect.closest('.attendance-student-row');
        if (changedRow) changedRow.dataset.attendanceStatus = status;
    }

    if (!requireEditPermission('cập nhật điểm danh')) { loadAttendance(); return; }
    try {
        const { error } = await supabase
            .from('app3_attendance')
            .upsert({
                student_id: studentUuid,
                class_id: classId,
                attendance_date: date,
                status: status
            }, { onConflict: 'student_id,attendance_date' });
        if (error) throw error;
        showToast('Cập nhật trạng thái thành công!', 'success', 1500);
    } catch (err) {
        showToast('Lỗi cập nhật: ' + err.message, 'error');
    }
}

async function saveAttendance() {
    if (!requireEditPermission('lưu điểm danh')) return;

    const clsName = document.getElementById('attendanceClass')?.value;
    const date = document.getElementById('attendanceDate')?.value;
    const classObj = APP_STATE.classes.find(c => c.name === clsName);
    const selects = Array.from(document.querySelectorAll('#attendanceTableWrapper .attendance-status'));

    if (!classObj || !date || selects.length === 0) {
        showToast('Vui lòng chọn lớp, ngày và tải danh sách điểm danh trước khi lưu.', 'warning');
        return;
    }

    const payload = selects.map(select => ({
        student_id: select.dataset.student,
        class_id: classObj.id,
        attendance_date: date,
        status: select.value || 'Có mặt'
    }));

    try {
        const { error } = await supabase
            .from('app3_attendance')
            .upsert(payload, { onConflict: 'student_id,attendance_date' });
        if (error) throw error;

        showToast(`Đã lưu điểm danh ${payload.length} học sinh!`, 'success', 1800);
        await loadAttendance();
    } catch (err) {
        showToast('Lỗi lưu điểm danh: ' + err.message, 'error');
    }
}


function attendanceStatsRange(referenceDate, period) {
    const base = new Date(`${referenceDate}T12:00:00`);
    if (Number.isNaN(base.getTime())) return null;

    let start, end, label;
    if (period === 'week') {
        const day = base.getDay();
        const diffToMonday = day === 0 ? -6 : 1 - day;
        start = new Date(base);
        start.setDate(base.getDate() + diffToMonday);
        end = new Date(start);
        end.setDate(start.getDate() + 6);
        label = `Tuần ${start.toLocaleDateString('vi-VN')} – ${end.toLocaleDateString('vi-VN')}`;
    } else if (period === 'schoolyear') {
        const y = base.getMonth() >= 8 ? base.getFullYear() : base.getFullYear() - 1;
        start = new Date(y, 8, 1, 12, 0, 0);
        end = new Date(y + 1, 7, 31, 12, 0, 0);
        label = `Năm học ${y}–${y + 1}`;
    } else {
        start = new Date(base.getFullYear(), base.getMonth(), 1, 12, 0, 0);
        end = new Date(base.getFullYear(), base.getMonth() + 1, 0, 12, 0, 0);
        label = `Tháng ${base.getMonth() + 1}/${base.getFullYear()}`;
    }

    const iso = d => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };
    return { start: iso(start), end: iso(end), label };
}

async function loadAttendanceStats() {
    const result = document.getElementById('attendanceStatsResult');
    const clsName = document.getElementById('attendanceClass')?.value;
    const referenceDate = document.getElementById('attendanceDate')?.value;
    const period = document.getElementById('attendanceStatsPeriod')?.value || 'month';
    const classObj = APP_STATE.classes.find(c => c.name === clsName);

    if (!result) return;
    if (!classObj || !referenceDate) {
        result.innerHTML = '<div class="attendance-stats-placeholder"><i class="fas fa-circle-exclamation"></i><span>Vui lòng chọn lớp và ngày tham chiếu trước.</span></div>';
        return;
    }

    const range = attendanceStatsRange(referenceDate, period);
    if (!range) return;

    const formatAttendanceDate = (isoDate) => {
        const parts = String(isoDate || '').split('-');
        return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : String(isoDate || '');
    };

    result.innerHTML = '<div class="attendance-stats-placeholder"><i class="fas fa-spinner fa-spin"></i><span>Đang tổng hợp học sinh vắng và đi muộn...</span></div>';

    try {
        const { data: records, error } = await supabase
            .from('app3_attendance')
            .select('student_id,attendance_date,status')
            .eq('class_id', classObj.id)
            .gte('attendance_date', range.start)
            .lte('attendance_date', range.end)
            .order('attendance_date', { ascending: true });
        if (error) throw error;

        const students = APP_STATE.students
            .filter(s => s.class === clsName)
            .slice()
            .sort((a,b) => String(a.fullName||'').localeCompare(String(b.fullName||''), 'vi'));

        const studentMap = new Map(students.map(s => [String(s.db_uuid), s]));
        const specialRows = new Map();

        (records || []).forEach(r => {
            const status = String(r.status || '').trim();
            if (!['Vắng', 'Phép', 'Không phép', 'Muộn'].includes(status)) return;

            const key = String(r.student_id || '');
            const student = studentMap.get(key);
            if (!student) return;

            if (!specialRows.has(key)) {
                specialRows.set(key, {
                    student,
                    excusedDates: [],
                    unexcusedDates: [],
                    lateDates: []
                });
            }

            const row = specialRows.get(key);
            if (status === 'Không phép') row.unexcusedDates.push(r.attendance_date);
            else if (status === 'Muộn') row.lateDates.push(r.attendance_date);
            else row.excusedDates.push(r.attendance_date);
        });

        const rows = Array.from(specialRows.values()).map(r => {
            r.excusedDates = [...new Set(r.excusedDates)].sort();
            r.unexcusedDates = [...new Set(r.unexcusedDates)].sort();
            r.lateDates = [...new Set(r.lateDates)].sort();
            r.total = r.excusedDates.length + r.unexcusedDates.length + r.lateDates.length;
            return r;
        }).sort((a,b) => b.total - a.total || String(a.student.fullName||'').localeCompare(String(b.student.fullName||''), 'vi'));

        const totals = rows.reduce((acc, r) => {
            acc.students += 1;
            acc.excused += r.excusedDates.length;
            acc.unexcused += r.unexcusedDates.length;
            acc.late += r.lateDates.length;
            return acc;
        }, { students:0, excused:0, unexcused:0, late:0 });

        const dateListHtml = (dates, type) => {
            if (!dates.length) return '<span class="attendance-no-event">—</span>';
            return `<div class="attendance-date-list">${dates.map(d =>
                `<span class="attendance-date-chip ${type}"><i class="fas fa-calendar-day"></i>${formatAttendanceDate(d)}</span>`
            ).join('')}</div>`;
        };

        if (rows.length === 0) {
            result.innerHTML = `
                <div class="attendance-stats-summary">
                    <div class="attendance-stats-caption">
                        <strong>${range.label}</strong>
                        <span>${clsName}</span>
                    </div>
                </div>
                <div class="attendance-stats-empty">
                    <i class="fas fa-user-check"></i>
                    <strong>Không có học sinh vắng hoặc đi muộn</strong>
                    <span>Trong ${range.label.toLowerCase()}, chưa ghi nhận trường hợp Vắng/Phép, Không phép hoặc Muộn.</span>
                </div>`;
            return;
        }

        const tableRows = rows.map((r, idx) => `
            <tr>
                <td>${idx + 1}</td>
                <td>${publicEscape(r.student.id || '')}</td>
                <td class="attendance-stats-name">${publicEscape(r.student.fullName || '')}</td>
                <td>${dateListHtml(r.excusedDates, 'is-excused')}</td>
                <td>${dateListHtml(r.unexcusedDates, 'is-unexcused')}</td>
                <td>${dateListHtml(r.lateDates, 'is-late')}</td>
                <td><span class="attendance-event-total">${r.total}</span></td>
            </tr>`).join('');

        result.innerHTML = `
            <div class="attendance-stats-summary">
                <div class="attendance-stats-caption">
                    <strong>${range.label}</strong>
                    <span>${clsName} · Chỉ hiển thị học sinh có Vắng/Phép, Không phép hoặc Muộn</span>
                </div>
                <div class="attendance-stats-cards attendance-special-summary">
                    <div class="attendance-stat-card is-students"><i class="fas fa-users"></i><div><span>Học sinh cần theo dõi</span><strong>${totals.students}</strong></div></div>
                    <div class="attendance-stat-card is-absent"><i class="fas fa-user-clock"></i><div><span>Vắng / Phép</span><strong>${totals.excused}</strong></div></div>
                    <div class="attendance-stat-card is-unexcused"><i class="fas fa-user-xmark"></i><div><span>Không phép</span><strong>${totals.unexcused}</strong></div></div>
                    <div class="attendance-stat-card is-late"><i class="fas fa-clock"></i><div><span>Muộn</span><strong>${totals.late}</strong></div></div>
                </div>
            </div>
            <div class="table-wrapper attendance-stats-table-wrap">
                <table class="attendance-stats-table attendance-special-table">
                    <thead>
                        <tr>
                            <th>STT</th>
                            <th>Mã HS</th>
                            <th>Họ tên</th>
                            <th>Ngày vắng / phép</th>
                            <th>Ngày không phép</th>
                            <th>Ngày đi muộn</th>
                            <th>Tổng</th>
                        </tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>
            <div class="attendance-stats-note">
                <i class="fas fa-circle-info"></i>
                Mỗi ngày được hiển thị theo định dạng <b>ngày/tháng/năm</b>. Học sinh có nhiều lần vắng hoặc muộn sẽ hiển thị đầy đủ tất cả ngày trong khoảng thống kê đã chọn.
            </div>`;
    } catch (err) {
        result.innerHTML = `<div class="attendance-stats-placeholder"><i class="fas fa-triangle-exclamation"></i><span>Lỗi thống kê: ${publicEscape(err.message || String(err))}</span></div>`;
    }
}


async function exportAttendanceStatsExcel() {
    const clsName = document.getElementById('attendanceClass')?.value;
    const referenceDate = document.getElementById('attendanceDate')?.value;
    const period = document.getElementById('attendanceStatsPeriod')?.value || 'month';
    const classObj = APP_STATE.classes.find(c => c.name === clsName);

    if (!classObj || !referenceDate) {
        showToast('Vui lòng chọn lớp và ngày tham chiếu trước khi xuất thống kê.', 'warning');
        return;
    }

    const range = attendanceStatsRange(referenceDate, period);
    if (!range) {
        showToast('Không xác định được khoảng thời gian thống kê.', 'warning');
        return;
    }

    try {
        const { data: records, error } = await supabase
            .from('app3_attendance')
            .select('student_id,attendance_date,status')
            .eq('class_id', classObj.id)
            .gte('attendance_date', range.start)
            .lte('attendance_date', range.end)
            .order('attendance_date', { ascending: true });

        if (error) throw error;

        const students = APP_STATE.students
            .filter(s => s.class === clsName)
            .slice()
            .sort((a,b) => String(a.fullName||'').localeCompare(String(b.fullName||''), 'vi'));

        const studentMap = new Map(students.map(s => [String(s.db_uuid), s]));
        const rowsMap = new Map();

        (records || []).forEach(r => {
            const status = String(r.status || '').trim();
            if (!['Vắng', 'Phép', 'Không phép', 'Muộn'].includes(status)) return;

            const key = String(r.student_id || '');
            const student = studentMap.get(key);
            if (!student) return;

            if (!rowsMap.has(key)) {
                rowsMap.set(key, {
                    student,
                    excusedDates: [],
                    unexcusedDates: [],
                    lateDates: []
                });
            }

            const row = rowsMap.get(key);
            if (status === 'Không phép') row.unexcusedDates.push(r.attendance_date);
            else if (status === 'Muộn') row.lateDates.push(r.attendance_date);
            else row.excusedDates.push(r.attendance_date);
        });

        const formatDateExcel = isoDate => {
            const parts = String(isoDate || '').split('-');
            return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : String(isoDate || '');
        };

        const rows = Array.from(rowsMap.values()).map((r, index) => {
            const excused = [...new Set(r.excusedDates)].sort();
            const unexcused = [...new Set(r.unexcusedDates)].sort();
            const late = [...new Set(r.lateDates)].sort();

            return {
                'STT': index + 1,
                'Mã HS': r.student.id || '',
                'Họ tên': r.student.fullName || '',
                'Lớp': clsName,
                'Ngày vắng/phép': excused.map(formatDateExcel).join(', '),
                'Ngày không phép': unexcused.map(formatDateExcel).join(', '),
                'Ngày đi muộn': late.map(formatDateExcel).join(', '),
                'Tổng số lần': excused.length + unexcused.length + late.length
            };
        }).sort((a,b) =>
            (b['Tổng số lần'] - a['Tổng số lần']) ||
            String(a['Họ tên']).localeCompare(String(b['Họ tên']), 'vi')
        );

        if (rows.length === 0) {
            showToast(`Không có học sinh vắng, không phép hoặc muộn trong ${range.label.toLowerCase()}.`, 'warning');
            return;
        }

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(rows);

        ws['!cols'] = [
            { wch: 6 },
            { wch: 14 },
            { wch: 28 },
            { wch: 10 },
            { wch: 28 },
            { wch: 28 },
            { wch: 28 },
            { wch: 12 }
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'ThongKeChuyenCan');

        const safeLabel = range.label
            .replace(/\//g, '-')
            .replace(/[–—]/g, '-')
            .replace(/\s+/g, '_');

        XLSX.writeFile(wb, `ThongKeChuyenCan_${clsName}_${safeLabel}.xlsx`);
        showToast('Xuất Excel thống kê chuyên cần thành công!', 'success', 1800);

    } catch (err) {
        showToast('Lỗi xuất Excel thống kê: ' + (err.message || String(err)), 'error');
    }
}

function exportAttendanceExcel() {
    const cls = document.getElementById('attendanceClass')?.value;
    const date = document.getElementById('attendanceDate')?.value;
    if (!cls || !date) {
        showToast('Vui lòng chọn lớp và ngày trước khi xuất.', 'warning');
        return;
    }

    const records = APP_STATE.attendance.find(a => a.class === cls && a.date === date);
    if (!records || records.records.length === 0) {
        showToast('Ngày đang chọn chưa có dữ liệu điểm danh. Muốn xuất Tuần/Tháng/Năm học, hãy dùng nút “Xuất Excel thống kê” bên dưới.', 'warning');
        return;
    }

    const data = records.records.map(r => {
        const student = APP_STATE.students.find(s => s.id === r.studentId);
        return {
            'Mã HS': r.studentId,
            'Họ tên': student ? student.fullName : 'Không xác định',
            'Lớp': cls,
            'Ngày': date,
            'Trạng thái': r.status
        };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'DiemDanh');
    XLSX.writeFile(wb, `DiemDanh_${cls}_${date}.xlsx`);
    showToast('Xuất Excel điểm danh theo ngày thành công!', 'success', 1800);
}

// ============================================================
// 12. QUẢN LÝ KHEN THƯỞNG (CRUD)
// ============================================================
function renderRewards() {
    const rewards = APP_STATE.rewards || [];
    const studentMap = Object.fromEntries((APP_STATE.students || []).map(s => [s.db_uuid, s.fullName]));
    return `
        <section class="rewards-pro-page">
            <div class="rewards-pro-header">
                <div class="rewards-pro-title">
                    <span class="rewards-title-icon"><i class="fas fa-medal"></i></span>
                    <div>
                        <span class="rewards-kicker">GHI NHẬN THÀNH TÍCH</span>
                        <h2>Khen thưởng</h2>
                        <p>Quản lý các thành tích, biểu dương và khen thưởng của học sinh theo lớp và môn học.</p>
                    </div>
                </div>
                <div class="rewards-header-actions">
                    <button class="btn btn-primary btn-sm" onclick="openAddReward()">
                        <i class="fas fa-plus"></i> Thêm khen thưởng
                    </button>
                    <button class="btn btn-success btn-sm" onclick="exportRewards()">
                        <i class="fas fa-file-excel"></i> Xuất Excel
                    </button>
                </div>
            </div>

            <div class="rewards-summary-card">
                <div class="rewards-summary-icon"><i class="fas fa-award"></i></div>
                <div>
                    <span>Tổng số khen thưởng</span>
                    <strong>${rewards.length}</strong>
                </div>
                <div class="rewards-summary-note">
                    <i class="fas fa-circle-info"></i>
                    <span>Dữ liệu được lưu theo đúng lớp, môn và học sinh.</span>
                </div>
            </div>

            <div class="rewards-table-card">
                <div class="rewards-table-heading">
                    <span class="rewards-table-icon"><i class="fas fa-list-check"></i></span>
                    <div>
                        <h3>Danh sách khen thưởng</h3>
                        <p>Theo dõi nội dung, ngày ghi nhận và người quyết định.</p>
                    </div>
                </div>

                <div class="table-wrapper rewards-table-wrapper">
                    <table class="rewards-table">
                        <thead>
                            <tr>
                                <th>STT</th>
                                <th>Lớp</th>
                                <th>Môn</th>
                                <th>Học sinh</th>
                                <th>Ngày</th>
                                <th>Nội dung</th>
                                <th>Người quyết định</th>
                                <th>Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rewards.length === 0
                                ? '<tr><td colspan="8" class="text-center text-muted rewards-empty">Chưa có khen thưởng nào.</td></tr>'
                                : rewards.map((r, i) => `<tr>
                                    <td>${i + 1}</td>
                                    <td>${getContextClassName(r.classId)}</td>
                                    <td><span class="reward-subject-badge">${r.subject || 'Dữ liệu cũ'}</span></td>
                                    <td class="reward-student-name">${studentMap[r.studentId] || 'Không xác định'}</td>
                                    <td>${formatDate(r.date)}</td>
                                    <td class="reward-content-cell">${r.content}</td>
                                    <td>${r.decisionBy || ''}</td>
                                    <td class="text-center">
                                        <button class="btn-icon reward-delete-btn" onclick="deleteReward('${r.id}')" title="Xóa khen thưởng">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    </td>
                                </tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>`;
}

function openAddReward() {
    if (!requireEditPermission('thêm khen thưởng')) return;
    const classes = APP_STATE.classes || [];
    const modalPromise = showModal('Thêm khen thưởng', `
        <div class="form-group"><label>Lớp *</label><select id="rewardClass"><option value="">-- Chọn lớp --</option>${classes.map(cls => `<option value="${cls.id}">${cls.name}</option>`).join('')}</select></div>
        <div class="form-group"><label>Môn học *</label><select id="rewardSubject" disabled><option value="">-- Chọn môn --</option></select></div>
        <div class="form-group"><label>Chọn học sinh *</label><select id="rewardStudent" disabled><option value="">-- Chọn học sinh --</option></select></div>
        <div class="form-group"><label>Ngày</label><input type="date" id="rewardDate" value="${new Date().toISOString().split('T')[0]}"></div>
        <div class="form-group"><label>Nội dung khen thưởng *</label><textarea id="rewardContent" placeholder="VD: Đạt giải nhất văn nghệ..."></textarea></div>
        <div class="form-group"><label>Người quyết định</label><input type="text" id="rewardDecision" value="${APP_STATE.settings?.teacherName || APP_STATE.currentUserDisplayName || ''}"></div>
    `, 'Thêm', 'Hủy');

    setupClassSubjectStudentSelectors({classSelectId:'rewardClass', subjectSelectId:'rewardSubject', studentSelectId:'rewardStudent'});

    modalPromise.then(async confirmed => {
        if (!confirmed) return;
        const classId = document.getElementById('rewardClass')?.value;
        const subjectId = document.getElementById('rewardSubject')?.value;
        const studentUuid = document.getElementById('rewardStudent')?.value;
        const date = document.getElementById('rewardDate')?.value;
        const content = document.getElementById('rewardContent')?.value.trim();
        const decision = document.getElementById('rewardDecision')?.value.trim();
        const subjectObj = (APP_STATE.subjectCatalog || []).find(subject => subject.id === subjectId);
        const student = APP_STATE.students.find(s => s.db_uuid === studentUuid);
        if (!classId || !subjectId || !studentUuid || !content || !subjectObj || !student) {
            showToast('Vui lòng chọn đầy đủ Lớp, Môn, Học sinh và nhập nội dung!', 'error');
            return;
        }
        try {
            const { data: newReward, error } = await supabase.from('app3_rewards').insert({
                student_id: studentUuid, class_id: classId, subject_id: subjectId, subject: subjectObj.name,
                date, content, decision_by: decision || null
            }).select().single();
            if (error) throw error;
            APP_STATE.rewards.unshift({
                id:newReward.id, studentId:newReward.student_id, classId:newReward.class_id,
                subjectId:newReward.subject_id, subject:newReward.subject, date:newReward.date,
                content:newReward.content, decisionBy:newReward.decision_by
            });
            showToast('Thêm khen thưởng thành công!');
            renderPage('rewards');
        } catch (err) { showToast('Lỗi thêm: ' + err.message, 'error'); }
    });
}

async function deleteReward(id) {
    if (!requireEditPermission('xóa khen thưởng')) return;
    if (!APP_STATE.rewards.find(rew => rew.id === id)) return;
    const confirmed = await showModal('Xóa khen thưởng', 'Bạn có chắc muốn xóa khen thưởng này?', 'Xóa', 'Hủy');
    if (!confirmed) return;
    try {
        const { error } = await supabase.from('app3_rewards').delete().eq('id', id);
        if (error) throw error;
        APP_STATE.rewards = APP_STATE.rewards.filter(rew => rew.id !== id);
        showToast('Đã xóa!', 'warning'); renderPage('rewards');
    } catch (err) { showToast('Lỗi xóa: ' + err.message, 'error'); }
}

// ============================================================
// 13. QUẢN LÝ KỶ LUẬT (CRUD)
// ============================================================
function renderDisciplines() {
    const disciplines = APP_STATE.disciplines || [];
    const studentMap = Object.fromEntries((APP_STATE.students || []).map(s => [s.db_uuid, s.fullName]));

    return `
        <section class="disciplines-pro-page">
            <div class="disciplines-header">
                <div class="disciplines-title">
                    <span class="disciplines-title-icon"><i class="fas fa-gavel"></i></span>
                    <div>
                        <span class="disciplines-kicker">QUẢN LÝ RÈN LUYỆN</span>
                        <h2>Kỷ luật</h2>
                        <p>Theo dõi các trường hợp vi phạm, nội dung xử lý và người quyết định.</p>
                    </div>
                </div>
                <div class="disciplines-header-actions">
                    <button class="btn btn-primary btn-sm" onclick="openAddDiscipline()">
                        <i class="fas fa-plus"></i> Thêm kỷ luật
                    </button>
                    <button class="btn btn-success btn-sm" onclick="exportDisciplines()">
                        <i class="fas fa-file-excel"></i> Xuất Excel
                    </button>
                </div>
            </div>

            <div class="disciplines-summary-card">
                <div class="disciplines-summary-icon"><i class="fas fa-list-check"></i></div>
                <div>
                    <span>Tổng số bản ghi kỷ luật</span>
                    <strong>${disciplines.length}</strong>
                </div>
            </div>

            <div class="disciplines-table-card">
                <div class="disciplines-table-heading">
                    <span class="disciplines-table-icon"><i class="fas fa-table-list"></i></span>
                    <div>
                        <h3>Danh sách kỷ luật</h3>
                        <p>Danh sách được quản lý theo lớp, môn học và từng học sinh.</p>
                    </div>
                </div>

                <div class="table-wrapper disciplines-table-wrapper">
                    <table class="disciplines-table">
                        <thead>
                            <tr>
                                <th>STT</th><th>Lớp</th><th>Môn</th><th>Học sinh</th><th>Ngày</th>
                                <th>Nội dung</th><th>Người quyết định</th><th>Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${disciplines.length === 0
                                ? '<tr><td colspan="8" class="text-center text-muted disciplines-empty">Chưa có kỷ luật nào.</td></tr>'
                                : disciplines.map((d, i) => `
                                    <tr>
                                        <td>${i + 1}</td>
                                        <td>${getContextClassName(d.classId)}</td>
                                        <td><span class="disciplines-subject-badge">${d.subject || 'Dữ liệu cũ'}</span></td>
                                        <td class="disciplines-student-name">${studentMap[d.studentId] || 'Không xác định'}</td>
                                        <td>${formatDate(d.date)}</td>
                                        <td class="disciplines-content">${d.content}</td>
                                        <td>${d.decisionBy || ''}</td>
                                        <td class="text-center">
                                            <button class="btn-icon disciplines-delete-btn" onclick="deleteDiscipline('${d.id}')" title="Xóa kỷ luật">
                                                <i class="fas fa-trash"></i>
                                            </button>
                                        </td>
                                    </tr>
                                `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>`;
}

function openAddDiscipline() {
    if (!requireEditPermission('thêm kỷ luật')) return;
    const classes = APP_STATE.classes || [];
    const modalPromise = showModal('Thêm kỷ luật', `
        <div class="form-group"><label>Lớp *</label><select id="disciplineClass"><option value="">-- Chọn lớp --</option>${classes.map(cls => `<option value="${cls.id}">${cls.name}</option>`).join('')}</select></div>
        <div class="form-group"><label>Môn học *</label><select id="disciplineSubject" disabled><option value="">-- Chọn môn --</option></select></div>
        <div class="form-group"><label>Chọn học sinh *</label><select id="disciplineStudent" disabled><option value="">-- Chọn học sinh --</option></select></div>
        <div class="form-group"><label>Ngày</label><input type="date" id="disciplineDate" value="${new Date().toISOString().split('T')[0]}"></div>
        <div class="form-group"><label>Nội dung kỷ luật *</label><textarea id="disciplineContent" placeholder="VD: Đi học muộn..."></textarea></div>
        <div class="form-group"><label>Người quyết định</label><input type="text" id="disciplineDecision" value="${APP_STATE.settings?.teacherName || APP_STATE.currentUserDisplayName || ''}"></div>
    `, 'Thêm', 'Hủy');

    setupClassSubjectStudentSelectors({classSelectId:'disciplineClass', subjectSelectId:'disciplineSubject', studentSelectId:'disciplineStudent'});

    modalPromise.then(async confirmed => {
        if (!confirmed) return;
        const classId = document.getElementById('disciplineClass')?.value;
        const subjectId = document.getElementById('disciplineSubject')?.value;
        const studentUuid = document.getElementById('disciplineStudent')?.value;
        const date = document.getElementById('disciplineDate')?.value;
        const content = document.getElementById('disciplineContent')?.value.trim();
        const decision = document.getElementById('disciplineDecision')?.value.trim();
        const subjectObj = (APP_STATE.subjectCatalog || []).find(subject => subject.id === subjectId);
        const student = APP_STATE.students.find(s => s.db_uuid === studentUuid);
        if (!classId || !subjectId || !studentUuid || !content || !subjectObj || !student) {
            showToast('Vui lòng chọn đầy đủ Lớp, Môn, Học sinh và nhập nội dung!', 'error');
            return;
        }
        try {
            const { data: newDis, error } = await supabase.from('app3_disciplines').insert({
                student_id: studentUuid, class_id: classId, subject_id: subjectId, subject: subjectObj.name,
                date, content, decision_by: decision || null
            }).select().single();
            if (error) throw error;
            APP_STATE.disciplines.unshift({
                id:newDis.id, studentId:newDis.student_id, classId:newDis.class_id,
                subjectId:newDis.subject_id, subject:newDis.subject, date:newDis.date,
                content:newDis.content, decisionBy:newDis.decision_by
            });
            showToast('Thêm kỷ luật thành công!'); renderPage('disciplines');
        } catch (err) { showToast('Lỗi thêm: ' + err.message, 'error'); }
    });
}

async function deleteDiscipline(id) {
    if (!requireEditPermission('xóa kỷ luật')) return;
    if (!APP_STATE.disciplines.find(dis => dis.id === id)) return;
    const confirmed = await showModal('Xóa kỷ luật', 'Bạn có chắc muốn xóa kỷ luật này?', 'Xóa', 'Hủy');
    if (!confirmed) return;
    try {
        const { error } = await supabase.from('app3_disciplines').delete().eq('id', id);
        if (error) throw error;
        APP_STATE.disciplines = APP_STATE.disciplines.filter(dis => dis.id !== id);
        showToast('Đã xóa!', 'warning'); renderPage('disciplines');
    } catch (err) { showToast('Lỗi xóa: ' + err.message, 'error'); }
}

// ============================================================
// 14. QUẢN LÝ FILE (Upload/Download với Supabase Storage)
// ============================================================
// BƯỚC 151.21: Nhận diện loại file từ phần mở rộng để hiển thị rõ ràng,
// không phụ thuộc file_type cũ trong database (ví dụ chỉ lưu "application").
function getFileDisplayInfo(file) {
    const name = String(file?.name || '');
    const ext = (name.includes('.') ? name.split('.').pop() : '').toLowerCase();

    const groups = {
        xls:  { label: 'Excel', icon: 'fa-file-excel', className: 'file-kind-excel' },
        xlsx: { label: 'Excel', icon: 'fa-file-excel', className: 'file-kind-excel' },
        doc:  { label: 'Word', icon: 'fa-file-word', className: 'file-kind-word' },
        docx: { label: 'Word', icon: 'fa-file-word', className: 'file-kind-word' },
        pdf:  { label: 'PDF', icon: 'fa-file-pdf', className: 'file-kind-pdf' },
        ppt:  { label: 'PowerPoint', icon: 'fa-file-powerpoint', className: 'file-kind-powerpoint' },
        pptx: { label: 'PowerPoint', icon: 'fa-file-powerpoint', className: 'file-kind-powerpoint' },
        jpg:  { label: 'Hình ảnh', icon: 'fa-file-image', className: 'file-kind-image' },
        jpeg: { label: 'Hình ảnh', icon: 'fa-file-image', className: 'file-kind-image' },
        png:  { label: 'Hình ảnh', icon: 'fa-file-image', className: 'file-kind-image' },
        gif:  { label: 'Hình ảnh', icon: 'fa-file-image', className: 'file-kind-image' },
        webp: { label: 'Hình ảnh', icon: 'fa-file-image', className: 'file-kind-image' },
        txt:  { label: 'Văn bản', icon: 'fa-file-lines', className: 'file-kind-text' },
        csv:  { label: 'CSV', icon: 'fa-file-csv', className: 'file-kind-text' },
        zip:  { label: 'ZIP', icon: 'fa-file-zipper', className: 'file-kind-archive' },
        rar:  { label: 'RAR', icon: 'fa-file-zipper', className: 'file-kind-archive' }
    };

    return groups[ext] || {
        label: ext ? ext.toUpperCase() : (file?.type || 'File'),
        icon: 'fa-file',
        className: 'file-kind-other'
    };
}

function renderFiles() {
    const files = APP_STATE.files;
    if (!Array.isArray(files)) {
        APP_STATE.files = [];
    }

    return `
        <section class="files-pro-page">
            <div class="files-pro-header">
                <div class="files-pro-title">
                    <span class="files-title-icon"><i class="fas fa-folder-open"></i></span>
                    <div>
                        <span class="files-kicker">KHO TÀI LIỆU</span>
                        <h2>Quản lý file</h2>
                        <p>Lưu trữ và quản lý tài liệu dùng trong hệ thống. Mỗi file tối đa 20MB.</p>
                    </div>
                </div>
                <button class="btn btn-primary btn-sm files-upload-btn" onclick="openUploadFile()">
                    <i class="fas fa-upload"></i> Tải file lên
                </button>
            </div>

            <div class="files-summary-row">
                <div class="files-summary-card">
                    <span class="files-summary-icon"><i class="fas fa-file"></i></span>
                    <div><span>Tổng số file</span><strong>${files.length}</strong></div>
                </div>
                <div class="files-summary-card">
                    <span class="files-summary-icon"><i class="fas fa-hard-drive"></i></span>
                    <div><span>Dung lượng đã dùng</span><strong>${calculateTotalSize()} <small>/ 100MB</small></strong></div>
                </div>
            </div>

            <div class="files-table-card">
                <div class="files-table-heading">
                    <span class="files-table-icon"><i class="fas fa-list"></i></span>
                    <div>
                        <h3>Danh sách tài liệu</h3>
                        <p>Xem, tải xuống, sửa thông tin hoặc xóa các file đã lưu.</p>
                    </div>
                </div>

                <div class="table-wrapper files-table-wrapper">
                    <table class="files-table">
                        <thead><tr>
                            <th>STT</th>
                            <th>Tên file</th>
                            <th>Loại</th>
                            <th>Dung lượng</th>
                            <th>Ngày tải</th>
                            <th>Mô tả</th>
                            <th>Thao tác</th>
                        </tr></thead>
                        <tbody>
                            ${files.length === 0
                                ? '<tr><td colspan="7" class="text-center text-muted files-empty">Chưa có file nào.</td></tr>'
                                : files.map((f, i) => {
                                    const fileInfo = getFileDisplayInfo(f);
                                    return `
                                    <tr>
                                        <td>${i + 1}</td>
                                        <td>
                                            <div class="file-name-cell">
                                                <span class="file-kind-icon ${fileInfo.className}" title="${fileInfo.label}">
                                                    <i class="fas ${fileInfo.icon}"></i>
                                                </span>
                                                <span class="file-name-text">${f.name}</span>
                                            </div>
                                        </td>
                                        <td><span class="file-type-badge ${fileInfo.className}"><i class="fas ${fileInfo.icon}"></i> ${fileInfo.label}</span></td>
                                        <td>${f.size}</td>
                                        <td>${formatDate(f.uploadDate)}</td>
                                        <td class="files-description">${f.desc || ''}</td>
                                        <td>
                                            <div class="table-actions file-actions">
                                                ${f.url ? `<button class="btn-icon file-action-view" onclick="viewFile('${f.id}')" title="Xem trực tiếp" aria-label="Xem trực tiếp"><i class="fas fa-eye"></i></button>` : `<span class="text-muted file-action-disabled" title="File mẫu không có dữ liệu"><i class="fas fa-eye-slash"></i></span>`}
                                                <button class="btn-icon file-action-download" onclick="downloadFile('${f.id}')" title="Tải xuống" aria-label="Tải xuống"><i class="fas fa-download"></i></button>
                                                <button class="btn-icon file-action-edit" onclick="editFile('${f.id}')" title="Sửa thông tin" aria-label="Sửa thông tin"><i class="fas fa-pen"></i></button>
                                                <button class="btn-icon file-action-delete" onclick="deleteFile('${f.id}')" title="Xóa file" aria-label="Xóa file"><i class="fas fa-trash"></i></button>
                                            </div>
                                        </td>
                                    </tr>`;
                                }).join('')}
                        </tbody>
                    </table>
                </div>

                <div class="files-capacity-note">
                    <i class="fas fa-circle-info"></i>
                    <span>Tổng dung lượng đã dùng: <strong>${calculateTotalSize()}</strong> / 100MB · Mỗi file tối đa 20MB</span>
                </div>
            </div>
        </section>
    `;
}

function calculateTotalSize() {
    let totalBytes = 0;
    APP_STATE.files.forEach(f => {
        const sizeStr = f.size;
        if (sizeStr) {
            const num = parseFloat(sizeStr);
            if (!isNaN(num)) {
                if (sizeStr.includes('MB')) totalBytes += num * 1024 * 1024;
                else if (sizeStr.includes('KB')) totalBytes += num * 1024;
                else totalBytes += num;
            }
        }
    });
    const mb = (totalBytes / (1024 * 1024)).toFixed(2);
    return mb + ' MB';
}


async function ensureValidSupabaseSessionForUpload() {
    try {
        // 1. Đọc session cục bộ trước.
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        const currentSession = sessionData?.session || null;
        if (!currentSession?.user) {
            return {
                ok: false,
                reason: 'NO_SESSION',
                message: 'Phiên đăng nhập không còn tồn tại. Vui lòng đăng nhập lại.'
            };
        }

        // 2. Refresh chủ động trước khi upload.
        // Cách này tránh dùng token cũ/hết hạn để INSERT vào bảng có RLS.
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
            return {
                ok: false,
                reason: 'REFRESH_FAILED',
                message: 'Phiên đăng nhập đã hết hạn hoặc không còn hợp lệ. Vui lòng đăng nhập lại.'
            };
        }

        const refreshedSession = refreshData?.session || null;
        const user = refreshedSession?.user || currentSession.user;

        if (!user?.id) {
            return {
                ok: false,
                reason: 'NO_USER',
                message: 'Không xác định được tài khoản đang đăng nhập. Vui lòng đăng nhập lại.'
            };
        }

        // Đồng bộ lại vài biến trạng thái đang dùng trong app.
        APP_STATE.currentUserId = user.id;
        APP_STATE.currentUserEmail = user.email || APP_STATE.currentUserEmail || '';

        return {
            ok: true,
            session: refreshedSession || currentSession,
            user
        };
    } catch (err) {
        console.error('Không thể kiểm tra phiên đăng nhập trước khi upload:', err);
        return {
            ok: false,
            reason: 'AUTH_CHECK_ERROR',
            message: 'Không thể kiểm tra phiên đăng nhập. Vui lòng đăng nhập lại.'
        };
    }
}

async function openUploadFile() {
    if (!requireEditPermission('tải file lên')) return;
    const totalMB = parseFloat(calculateTotalSize());
    const MAX_TOTAL_MB = 100;
    if (totalMB >= MAX_TOTAL_MB) {
        showToast(`Dung lượng đã đạt giới hạn ${MAX_TOTAL_MB}MB. Vui lòng xóa bớt file cũ.`, 'error');
        return;
    }

    showModal('Tải file lên', `
        <div class="form-group"><label>Chọn file (tối đa 20MB)</label><input type="file" id="fileInput" style="padding:0.5rem;"></div>
        <div class="form-group"><label>Mô tả (không bắt buộc)</label><input type="text" id="fileDesc" placeholder="Ghi chú..."></div>
        <div class="text-muted" style="font-size:0.8rem; margin-top:0.5rem;">
            <i class="fas fa-info-circle"></i> Dung lượng còn trống: ${(MAX_TOTAL_MB - totalMB).toFixed(2)} MB
        </div>
    `, 'Tải lên', 'Hủy').then(async confirmed => {
        if (confirmed) {
            const input = document.getElementById('fileInput');
            if (!input.files || input.files.length === 0) {
                showToast('Vui lòng chọn file!', 'error');
                return;
            }
            const file = input.files[0];
            const MAX_FILE_SIZE = 20 * 1024 * 1024;
            if (file.size > MAX_FILE_SIZE) {
                showToast('File quá lớn! Chỉ hỗ trợ file tối đa 20MB.', 'error');
                return;
            }

            try {
                // BƯỚC 151.44.2: xác thực/refresh session trước khi upload.
                const authCheck = await ensureValidSupabaseSessionForUpload();
                if (!authCheck.ok) {
                    showToast(authCheck.message, 'error', 3500);
                    return;
                }
                const uploadUserId = authCheck.user.id;

                // BƯỚC 151.19: Storage key chỉ dùng ký tự an toàn.
                // Giữ nguyên tên gốc có dấu trong app3_files.file_name để hiển thị/tải xuống.
                const rawExt = file.name.includes('.') ? file.name.split('.').pop() : '';
                const safeExt = String(rawExt || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
                const uniquePart = (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)).replace(/[^a-zA-Z0-9-]/g, '').slice(0, 36);
                const storageFileName = `${Date.now()}_${uniquePart}${safeExt ? `.${safeExt}` : ''}`;
                const filePath = `documents/${storageFileName}`;

                const { data: uploadData, error: uploadErr } = await supabase.storage
                    .from('app3-files')
                    .upload(filePath, file, { cacheControl: '3600' });
                if (uploadErr) throw uploadErr;

                const { data: urlData } = supabase.storage
                    .from('app3-files')
                    .getPublicUrl(filePath);

                const { data: fileMeta, error: metaErr } = await supabase
                    .from('app3_files')
                    .insert({
                        file_name: file.name,
                        file_path: filePath,
                        file_url: urlData.publicUrl,
                        file_type: file.type.split('/')[0] || 'unknown',
                        file_size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
                        description: document.getElementById('fileDesc').value.trim() || '',
                        uploaded_by: uploadUserId
                    })
                    .select()
                    .single();
                if (metaErr) {
                    // Metadata không ghi được => xóa file Storage vừa upload để tránh file mồ côi.
                    try {
                        await supabase.storage.from('app3-files').remove([filePath]);
                    } catch (cleanupErr) {
                        console.warn('Không thể dọn file Storage sau khi metadata lỗi:', cleanupErr);
                    }
                    throw metaErr;
                }

                APP_STATE.files.unshift({
                    id: fileMeta.id,
                    name: fileMeta.file_name,
                    type: fileMeta.file_type,
                    size: fileMeta.file_size,
                    uploadDate: fileMeta.created_at,
                    desc: fileMeta.description,
                    path: fileMeta.file_path,
                    url: fileMeta.file_url
                });
                showToast('Tải file thành công!');
                renderPage('files');
            } catch (err) {
                const message = String(err?.message || err || '');
                if (/row-level security|403|jwt|token|not authenticated|permission/i.test(message)) {
                    showToast(
                        'Phiên đăng nhập hoặc quyền Supabase không còn hợp lệ. Vui lòng đăng nhập lại rồi thử tải file.',
                        'error',
                        4500
                    );
                } else {
                    showToast('Lỗi tải file: ' + message, 'error');
                }
            }
        }
    });
}


let pdfJsLoadPromise = null;

async function ensurePdfJsLoaded() {
    if (window.pdfjsLib) return window.pdfjsLib;
    if (pdfJsLoadPromise) return pdfJsLoadPromise;

    pdfJsLoadPromise = new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-pdfjs-loader="true"]');
        if (existing) {
            existing.addEventListener('load', () => resolve(window.pdfjsLib));
            existing.addEventListener('error', reject);
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        script.async = true;
        script.dataset.pdfjsLoader = 'true';

        script.onload = () => {
            try {
                if (!window.pdfjsLib) throw new Error('PDF.js chưa khởi tạo.');
                window.pdfjsLib.GlobalWorkerOptions.workerSrc =
                    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                resolve(window.pdfjsLib);
            } catch (err) {
                reject(err);
            }
        };
        script.onerror = () => reject(new Error('Không tải được thư viện PDF.js.'));
        document.head.appendChild(script);
    });

    try {
        return await pdfJsLoadPromise;
    } catch (err) {
        pdfJsLoadPromise = null;
        throw err;
    }
}

async function renderPdfIntoContainer(fileUrl, fileName) {
    const container = document.getElementById('pdfPreviewContainer');
    if (!container) return;

    try {
        const pdfjsLib = await ensurePdfJsLoaded();

        container.innerHTML = `
            <div class="text-center" style="padding:2rem 1rem;">
                <i class="fas fa-spinner fa-spin" style="font-size:2rem; color:var(--primary);"></i>
                <p style="margin-top:1rem;">Đang đọc PDF...</p>
            </div>`;

        const response = await fetch(fileUrl, { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const bytes = new Uint8Array(await response.arrayBuffer());
        const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;

        container.innerHTML = `
            <div id="pdfPagesWrap"
                 style="display:flex; flex-direction:column; gap:14px; align-items:center; width:100%;">
            </div>`;

        const pagesWrap = document.getElementById('pdfPagesWrap');
        if (!pagesWrap) return;

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
            const page = await pdf.getPage(pageNumber);

            const baseViewport = page.getViewport({ scale: 1 });
            const maxWidth = Math.max(320, (container.clientWidth || 760) - 24);
            const scale = Math.min(1.6, maxWidth / baseViewport.width);
            const viewport = page.getViewport({ scale });

            const pageBox = document.createElement('div');
            pageBox.style.cssText =
                'width:100%; display:flex; flex-direction:column; align-items:center; gap:6px;';

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d', { alpha: false });

            canvas.width = Math.floor(viewport.width);
            canvas.height = Math.floor(viewport.height);
            canvas.style.cssText =
                'max-width:100%; height:auto; background:#fff; box-shadow:0 1px 5px rgba(0,0,0,.28); border-radius:4px;';

            const label = document.createElement('div');
            label.textContent = `Trang ${pageNumber} / ${pdf.numPages}`;
            label.style.cssText =
                'font-size:.78rem; color:var(--text-muted); margin-top:2px;';

            pageBox.appendChild(canvas);
            pageBox.appendChild(label);
            pagesWrap.appendChild(pageBox);

            await page.render({
                canvasContext: ctx,
                viewport
            }).promise;
        }
    } catch (err) {
        console.error('Không thể render PDF bằng PDF.js:', err);
        container.innerHTML = `
            <div class="text-center" style="padding:2.5rem 1rem;">
                <i class="fas fa-file-pdf" style="font-size:3rem; color:#ef4444;"></i>
                <p style="margin-top:1rem;"><strong>Không thể hiển thị PDF trực tiếp.</strong></p>
                <p class="text-muted">Bạn vẫn có thể tải file xuống để mở.</p>
            </div>`;
    }
}

function viewFile(id) {
    const file = APP_STATE.files.find(f => f.id === id);
    if (!file) {
        showToast('Không tìm thấy file!', 'error');
        return;
    }
    if (!file.url) {
        showToast('File này không có đường dẫn xem trước.', 'warning');
        return;
    }

    const ext = file.name.split('.').pop().toLowerCase();
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(ext);
    const isPDF = ext === 'pdf';
    const isText = ['txt', 'csv', 'log', 'md', 'json', 'xml'].includes(ext);
    const isOffice = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext);

    let contentHTML = '';
    if (isImage) {
        contentHTML = `
            <div style="text-align:center;">
                <img src="${file.url}" style="max-width:100%; max-height:68vh; display:block; margin:auto; object-fit:contain;">
                <div style="margin-top:1rem;">
                    <button class="btn btn-primary" onclick="downloadFile('${file.id}')"><i class="fas fa-download"></i> Tải xuống</button>
                </div>
            </div>`;
    } else if (isPDF) {
        contentHTML = `
            <div id="pdfPreviewContainer"
                 style="width:100%; max-height:68vh; min-height:520px; overflow:auto; padding:10px; background:rgba(15,23,42,.18); border-radius:8px;">
                <div class="text-center" style="padding:3rem 1rem;">
                    <i class="fas fa-spinner fa-spin" style="font-size:2rem; color:var(--primary);"></i>
                    <p style="margin-top:1rem;">Đang tải PDF để xem trực tiếp...</p>
                </div>
            </div>
            <div class="text-center" style="margin-top:0.75rem;">
                <button class="btn btn-primary" onclick="downloadFile('${file.id}')"><i class="fas fa-download"></i> Tải xuống</button>
            </div>`;

        showModal('Xem trước file', contentHTML, 'Đóng', '').then(() => {});
        renderPdfIntoContainer(file.url, file.name);
        return;
    } else if (isOffice) {
        // BƯỚC 151.20: Word/Excel/PowerPoint xem trực tiếp bằng Microsoft Office Online Viewer.
        // file.url là public URL của Supabase Storage nên Office Viewer có thể truy cập để hiển thị.
        const officeViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(file.url)}`;
        contentHTML = `
            <div style="width:100%;">
                <iframe src="${officeViewerUrl}"
                        title="Xem trước ${file.name.replace(/"/g, '&quot;')}"
                        style="width:100%; height:68vh; min-height:520px; border:1px solid var(--border); border-radius:8px; background:#fff;"
                        allowfullscreen></iframe>
                <div class="text-center" style="margin-top:0.75rem;">
                    <button class="btn btn-primary" onclick="downloadFile('${file.id}')"><i class="fas fa-download"></i> Tải xuống</button>
                </div>
                <p class="text-muted text-center" style="font-size:0.78rem; margin-top:0.5rem;">
                    Nếu tài liệu chưa hiện ngay, vui lòng chờ vài giây để Office Online tải bản xem trước.
                </p>
            </div>`;
    } else if (isText) {
        try {
            fetch(file.url)
                .then(res => res.text())
                .then(text => {
                    document.querySelector('#modalBody pre')?.remove();
                    const pre = document.createElement('pre');
                    pre.style.cssText = 'white-space:pre-wrap; max-height:400px; overflow-y:auto; background:#f5f5f5; padding:1rem; border-radius:4px;';
                    pre.textContent = text;
                    document.getElementById('modalBody').appendChild(pre);
                })
                .catch(() => {
                    showToast('Không thể tải nội dung file.', 'error');
                });
            contentHTML = `<p>Đang tải nội dung...</p><div class="text-center" style="margin-top:0.75rem;"><button class="btn btn-primary" onclick="downloadFile('${file.id}')"><i class="fas fa-download"></i> Tải xuống</button></div>`;
        } catch(e) {
            contentHTML = `<p class="text-muted">Không thể hiển thị nội dung file này.</p>`;
        }
    } else {
        contentHTML = `
            <div class="text-center" style="padding:2rem 0;">
                <i class="fas fa-file" style="font-size:4rem; color:var(--primary);"></i>
                <p style="margin-top:1rem;"><strong>${file.name}</strong></p>
                <p class="text-muted">Không thể xem trước loại file này. Vui lòng tải xuống để mở.</p>
                <button class="btn btn-primary" onclick="downloadFile('${file.id}')"><i class="fas fa-download"></i> Tải xuống</button>
            </div>
        `;
    }
    showModal('Xem trước file', contentHTML, 'Đóng', '');
}

function downloadFile(id) {
    const file = APP_STATE.files.find(f => f.id === id);
    if (!file) return;
    if (!file.url) {
        showToast('File này không có đường dẫn tải.', 'warning');
        return;
    }
    const a = document.createElement('a');
    a.href = file.url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast(`Đang tải file: ${file.name}`, 'info');
}

function editFile(id) {
    if (!requireEditPermission('sửa file')) return;
    const file = APP_STATE.files.find(f => f.id === id);
    if (!file) return;
    showModal('Sửa file', `
        <div class="form-group"><label>Tên file</label><input type="text" id="editFileName" value="${file.name}"></div>
        <div class="form-group"><label>Mô tả</label><input type="text" id="editFileDesc" value="${file.desc || ''}"></div>
    `, 'Cập nhật', 'Hủy').then(async confirmed => {
        if (confirmed) {
            const newName = document.getElementById('editFileName').value.trim();
            const newDesc = document.getElementById('editFileDesc').value.trim();
            if (!newName) {
                showToast('Tên file không được để trống.', 'error');
                return;
            }
            try {
                const { error } = await supabase
                    .from('app3_files')
                    .update({
                        file_name: newName,
                        description: newDesc
                    })
                    .eq('id', id);
                if (error) throw error;
                file.name = newName;
                file.desc = newDesc;
                showToast('Cập nhật file thành công!');
                renderPage('files');
            } catch (err) {
                showToast('Lỗi cập nhật: ' + err.message, 'error');
            }
        }
    });
}

async function deleteFile(id) {
    if (!requireEditPermission('xóa file')) return;
    const file = APP_STATE.files.find(f => f.id === id);
    if (!file) return;
    const confirmed = await showModal('Xóa file', `Bạn có chắc muốn xóa file <strong>${file.name}</strong>?`, 'Xóa', 'Hủy');
    if (confirmed) {
        try {
            if (file.path) {
                const { error: storageErr } = await supabase.storage
                    .from('app3-files')
                    .remove([file.path]);
                if (storageErr) console.warn('Không thể xóa file trong storage:', storageErr);
            }
            const { error } = await supabase
                .from('app3_files')
                .delete()
                .eq('id', id);
            if (error) throw error;

            APP_STATE.files = APP_STATE.files.filter(f => f.id !== id);
            showToast('Đã xóa file!', 'warning');
            renderPage('files');
        } catch (err) {
            showToast('Lỗi xóa file: ' + err.message, 'error');
        }
    }
}

// ============================================================
// 15. THỐNG KÊ (dùng dữ liệu từ APP_STATE)
// ============================================================
function renderStatistics() {
    const statSubject =
        APP_STATE.statSubject ||
        APP_STATE.studentSubject ||
        APP_STATE.currentSubject ||
        APP_STATE.subjectCatalog?.[0]?.name ||
        SUBJECTS[0] ||
        'Tin học';

    APP_STATE.statSubject = statSubject;

    const statAccessibleClasses = getAccessibleClassesForSubject(statSubject);
    const statAllowedClassIds = new Set(statAccessibleClasses.map(c => c.id));
    const statClass = APP_STATE.statClass || '';

    let statStudents = APP_STATE.students.filter(student => statAllowedClassIds.has(student.class_id));
    if (statClass) statStudents = statStudents.filter(student => student.class === statClass);

    const statSubjectId = getSubjectId(statSubject);
    const statClassObj = statClass ? APP_STATE.classes.find(c => c.name === statClass) : null;
    const matchesStatScope = item => {
        const classMatched = !statClass || item.classId === statClassObj?.id;
        const subjectMatched = !statSubjectId || item.subjectId === statSubjectId || item.subject === statSubject;
        return classMatched && subjectMatched;
    };

    const statRewards = (APP_STATE.rewards || []).filter(matchesStatScope);
    const statDisciplines = (APP_STATE.disciplines || []).filter(matchesStatScope);

    let competenceEvaluated = 0;
    let qualityEvaluated = 0;

    statStudents.forEach(student => {
        const subjectScore = APP_STATE.scores[student.id]?.[statSubject];
        if (subjectScore?.competence?.trim()) competenceEvaluated++;
        if (subjectScore?.quality?.trim()) qualityEvaluated++;
    });

    const competenceNotEvaluated = statStudents.length - competenceEvaluated;
    const qualityNotEvaluated = statStudents.length - qualityEvaluated;

    return `
        <section class="statistics-pro-page">
            <div class="statistics-header">
                <div class="statistics-title">
                    <span class="statistics-title-icon"><i class="fas fa-chart-bar"></i></span>
                    <div>
                        <span class="statistics-kicker">TỔNG HỢP DỮ LIỆU</span>
                        <h2>Thống kê chi tiết</h2>
                        <p>Theo dõi số liệu học sinh, đánh giá, khen thưởng và kỷ luật theo môn/lớp.</p>
                    </div>
                </div>
                <button class="btn btn-success btn-sm statistics-export-btn" onclick="exportAdvancedReport()">
                    <i class="fas fa-file-excel"></i> Xuất báo cáo nâng cao
                </button>
            </div>

            <div class="statistics-filter-card">
                <div class="statistics-filter-item">
                    <label>Môn thống kê</label>
                    <select id="statSubjectSelect" onchange="switchStatSubject(this.value)">
                        ${
                            getVisibleSubjectNames()
                            .map(subject => `
                                <option value="${subject}" ${
                                    subject === (
                                        APP_STATE.statSubject ||
                                        APP_STATE.studentSubject ||
                                        APP_STATE.currentSubject ||
                                        SUBJECTS[0]
                                    ) ? 'selected' : ''
                                }>${subject}</option>
                            `).join('')
                        }
                    </select>
                </div>

                <div class="statistics-filter-item">
                    <label>Lớp báo cáo</label>
                    <select id="advancedReportClass" onchange="refreshAdvancedStatistics()">
                        <option value="">Tất cả lớp</option>
                        ${statAccessibleClasses.map(c => `<option value="${c.name}" ${c.name === statClass ? 'selected' : ''}>${c.name}</option>`).join('')}
                    </select>
                </div>

                <div class="statistics-filter-item">
                    <label>Môn báo cáo</label>
                    <select id="advancedReportSubject">
                        ${getVisibleSubjectNames().map(name => `<option value="${name}" ${name === statSubject ? 'selected' : ''}>${name}</option>`).join('')}
                    </select>
                </div>
            </div>

            <div class="statistics-summary-grid">
                <div class="statistics-summary-card summary-students">
                    <span class="statistics-summary-icon"><i class="fas fa-user-graduate"></i></span>
                    <div><span>Tổng học sinh</span><strong>${statStudents.length}</strong></div>
                </div>
                <div class="statistics-summary-card summary-classes">
                    <span class="statistics-summary-icon"><i class="fas fa-school"></i></span>
                    <div><span>Số lớp</span><strong>${statClass ? 1 : statAccessibleClasses.length}</strong></div>
                </div>
                <div class="statistics-summary-card summary-rewards">
                    <span class="statistics-summary-icon"><i class="fas fa-medal"></i></span>
                    <div><span>Khen thưởng</span><strong>${statRewards.length}</strong></div>
                </div>
                <div class="statistics-summary-card summary-disciplines">
                    <span class="statistics-summary-icon"><i class="fas fa-gavel"></i></span>
                    <div><span>Kỷ luật</span><strong>${statDisciplines.length}</strong></div>
                </div>
            </div>

            <div class="statistics-chart-grid">
                <div class="statistics-chart-card">
                    <div class="statistics-chart-head"><span>Học sinh theo khối</span><i class="fas fa-chart-column"></i></div>
                    <div class="statistics-chart-canvas"><canvas id="statGradeChart"></canvas></div>
                </div>
                <div class="statistics-chart-card">
                    <div class="statistics-chart-head"><span>Cơ cấu giới tính</span><i class="fas fa-venus-mars"></i></div>
                    <div class="statistics-chart-canvas"><canvas id="statGenderChart"></canvas></div>
                </div>
                <div class="statistics-chart-card">
                    <div class="statistics-chart-head"><span>Năng lực - ${statSubject}</span><i class="fas fa-brain"></i></div>
                    <div class="statistics-chart-canvas"><canvas id="statCompetenceChart"></canvas></div>
                </div>
                <div class="statistics-chart-card">
                    <div class="statistics-chart-head"><span>Phẩm chất - ${statSubject}</span><i class="fas fa-star"></i></div>
                    <div class="statistics-chart-canvas"><canvas id="statQualityChart"></canvas></div>
                </div>
            </div>

            <div class="statistics-eval-grid">
                <div class="statistics-eval-card eval-done">
                    <span>Đã đánh giá NL</span>
                    <strong>${competenceEvaluated}</strong>
                    <small>${statSubject}</small>
                </div>
                <div class="statistics-eval-card eval-pending">
                    <span>Chưa đánh giá NL</span>
                    <strong>${competenceNotEvaluated}</strong>
                    <small>${statSubject}</small>
                </div>
                <div class="statistics-eval-card eval-done">
                    <span>Đã đánh giá PC</span>
                    <strong>${qualityEvaluated}</strong>
                    <small>${statSubject}</small>
                </div>
                <div class="statistics-eval-card eval-pending">
                    <span>Chưa đánh giá PC</span>
                    <strong>${qualityNotEvaluated}</strong>
                    <small>${statSubject}</small>
                </div>
            </div>
        </section>
    `;
}
function refreshAdvancedStatistics() {
    APP_STATE.statClass = document.getElementById('advancedReportClass')?.value || '';
    renderPage('statistics');
}

function switchStatSubject(subject) {
    const availableSubjects =
        APP_STATE.subjectCatalog?.length
            ? APP_STATE.subjectCatalog.map(item => item.name)
            : SUBJECTS;

    if (!availableSubjects.includes(subject)) return;

    APP_STATE.statSubject = subject;


    // Cập nhật lại biểu đồ theo môn vừa chọn
    renderPage('statistics');
}
function initStatCharts() {
    const statSubject =
        APP_STATE.statSubject ||
        APP_STATE.studentSubject ||
        APP_STATE.currentSubject ||
        APP_STATE.subjectCatalog?.[0]?.name ||
        SUBJECTS[0] ||
        'Tin học';
    const statClass = APP_STATE.statClass || '';
    const allowedClassIds = new Set(getAccessibleClassesForSubject(statSubject).map(c => c.id));
    let statStudents = APP_STATE.students.filter(student => allowedClassIds.has(student.class_id));
    if (statClass) statStudents = statStudents.filter(student => student.class === statClass);

    const grades = ['1', '2', '3', '4', '5'];
    const counts = grades.map(g => statStudents.filter(s => s.grade === g).length);
    if (chartInstances.statGrade) chartInstances.statGrade.destroy();
    chartInstances.statGrade = new Chart(document.getElementById('statGradeChart'), {
        type: 'bar',
        data: {
            labels: ['Khối 1', 'Khối 2', 'Khối 3', 'Khối 4', 'Khối 5'],
            datasets: [{
    label: 'Số học sinh',
    data: counts,
    backgroundColor: ['#60a5fa', '#a78bfa', '#34d399', '#fbbf24', '#fb7185'],
    borderRadius: 6
}]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });

    const male = statStudents.filter(s => s.gender === 'Nam').length;
    const female = statStudents.length - male;
    if (chartInstances.statGender) chartInstances.statGender.destroy();
    chartInstances.statGender = new Chart(document.getElementById('statGenderChart'), {
        type: 'doughnut',
        data: {
            labels: ['Nam', 'Nữ'],
            datasets: [{ data: [male, female], backgroundColor: ['#2563eb', '#ec4899'], borderWidth: 2 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });

APP_STATE.statSubject = statSubject;

const compMap = {};

statStudents.forEach(s => {
    const val =
        APP_STATE.scores[s.id]?.[statSubject]?.competence ||
        'Chưa xếp';

        compMap[val] = (compMap[val] || 0) + 1;
});

const compLabels = Object.keys(compMap);
const compValues = Object.values(compMap);
const colors = ['#16a34a', '#2563eb', '#f59e0b', '#dc2626', '#94a3b8'];

if (chartInstances.statCompetence) {
    chartInstances.statCompetence.destroy();
}

chartInstances.statCompetence = new Chart(
    document.getElementById('statCompetenceChart'),
    {
        type: 'pie',
        data: {
            labels: compLabels,
            datasets: [{
                data: compValues,
                backgroundColor: colors.slice(0, compLabels.length),
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: `Năng lực - ${statSubject}`,
                    font: {
                        size: 16,
                        weight: 'bold'
                    }
                },
                legend: {
                    position: 'bottom'
                }
            }
        }
    }
);
// Biểu đồ Phẩm chất theo môn
const qualityMap = {};

statStudents.forEach(s => {
    const val =
        APP_STATE.scores[s.id]?.[statSubject]?.quality ||
        'Chưa xếp';

    qualityMap[val] = (qualityMap[val] || 0) + 1;
});

const qualityLabels = Object.keys(qualityMap);
const qualityValues = Object.values(qualityMap);

if (chartInstances.statQuality) {
    chartInstances.statQuality.destroy();
}

chartInstances.statQuality = new Chart(
    document.getElementById('statQualityChart'),
    {
        type: 'pie',
        data: {
            labels: qualityLabels,
            datasets: [{
                data: qualityValues,
                backgroundColor: colors.slice(0, qualityLabels.length),
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: `Phẩm chất - ${statSubject}`,
                    font: {
                        size: 16,
                        weight: 'bold'
                    }
                },
                legend: {
                    position: 'bottom'
                }
            }
        }
    }
);
}

// ============================================================
// 16. TÌM KIẾM, CÀI ĐẶT, IN ẤN (giữ nguyên)
// ============================================================
function renderSearch() {
    return `
        <section class="search-pro-page">
            <div class="search-pro-header">
                <div class="search-pro-title">
                    <span class="search-title-icon"><i class="fas fa-search"></i></span>
                    <div>
                        <span class="search-kicker">TRA CỨU HỌC SINH</span>
                        <h2>Tìm kiếm nâng cao</h2>
                        <p>Tìm nhanh theo mã học sinh, họ tên, lớp, khối, năng lực hoặc phẩm chất.</p>
                    </div>
                </div>
            </div>

            <div class="search-filter-card">
                <div class="search-filter-item">
                    <label>Môn học</label>
                    <select id="searchSubjectSelect" onchange="switchSearchSubject(this.value)">
                        ${
                            getVisibleSubjectNames()
                            .map(subject => `
                                <option value="${subject}" ${
                                    subject === (
                                        APP_STATE.searchSubject ||
                                        APP_STATE.studentSubject ||
                                        APP_STATE.currentSubject ||
                                        SUBJECTS[0]
                                    ) ? 'selected' : ''
                                }>
                                    ${subject}
                                </option>
                            `).join('')
                        }
                    </select>
                </div>

                <div class="search-filter-item search-filter-keyword">
                    <label>Từ khóa</label>
                    <div class="search-keyword-wrap">
                        <i class="fas fa-magnifying-glass"></i>
                        <input type="text" id="globalSearch" placeholder="Nhập từ khóa..." oninput="globalSearch()">
                    </div>
                </div>

                <div class="search-filter-item">
                    <label>Tìm theo</label>
                    <select id="searchField" onchange="globalSearch()">
                        <option value="all">Tất cả</option>
                        <option value="id">Mã HS</option>
                        <option value="fullName">Họ tên</option>
                        <option value="class">Lớp</option>
                        <option value="grade">Khối</option>
                        <option value="competence">Năng lực</option>
                        <option value="quality">Phẩm chất</option>
                    </select>
                </div>

                <button class="btn btn-primary search-submit-btn" onclick="globalSearch()">
                    <i class="fas fa-search"></i>
                    <span>Tìm kiếm</span>
                </button>
            </div>

            <div class="search-results-card">
                <div class="search-results-head">
                    <div>
                        <span class="search-results-icon"><i class="fas fa-list-check"></i></span>
                        <div>
                            <h3>Kết quả tìm kiếm</h3>
                            <p>Kết quả sẽ hiển thị theo môn học và tiêu chí đang chọn.</p>
                        </div>
                    </div>
                </div>
                <div id="searchResults" class="search-results-body">
                    <div class="search-empty-state">
                        <i class="fas fa-magnifying-glass"></i>
                        <strong>Nhập từ khóa để tìm kiếm</strong>
                        <span>Hệ thống sẽ lọc trực tiếp trong dữ liệu học sinh hiện có.</span>
                    </div>
                </div>
            </div>
        </section>
    `;
}
function switchSearchSubject(subject) {
    const availableSubjects =
        APP_STATE.subjectCatalog?.length
            ? APP_STATE.subjectCatalog.map(item => item.name)
            : SUBJECTS;

    if (!availableSubjects.includes(subject)) return;

    APP_STATE.searchSubject = subject;

    globalSearch();
}
function globalSearch() {
    const kw =
        document.getElementById('globalSearch')?.value?.toLowerCase() || '';

    const field =
        document.getElementById('searchField')?.value || 'all';

    const container =
        document.getElementById('searchResults');

    if (!container) return;

    if (!kw) {
        container.innerHTML =
            '<div class="search-empty-state"><i class="fas fa-magnifying-glass"></i><strong>Nhập từ khóa để tìm kiếm</strong><span>Hệ thống sẽ lọc trực tiếp trong dữ liệu học sinh hiện có.</span></div>';
        return;
    }

    // Xác định môn học đang được chọn tại trang Tìm kiếm
    const searchSubject =
        APP_STATE.searchSubject ||
        APP_STATE.studentSubject ||
        APP_STATE.currentSubject ||
        APP_STATE.subjectCatalog?.[0]?.name ||
        SUBJECTS[0] ||
        'Tin học';

    APP_STATE.searchSubject = searchSubject;

    // Tìm kiếm học sinh
    const results = APP_STATE.students.filter(s => {
        const subjectScore =
            APP_STATE.scores[s.id]?.[searchSubject] || {};

        const competence =
            subjectScore.competence || '';

        const quality =
            subjectScore.quality || '';

        // Tìm trong tất cả các trường
        if (field === 'all') {
            return (
                String(s.fullName || '').toLowerCase().includes(kw) ||
                String(s.id || '').toLowerCase().includes(kw) ||
                String(s.class || '').toLowerCase().includes(kw) ||
                String(s.grade || '').toLowerCase().includes(kw) ||
                competence.toLowerCase().includes(kw) ||
                quality.toLowerCase().includes(kw)
            );
        }

        // Tìm riêng theo Năng lực
        if (field === 'competence') {
            return competence.toLowerCase().includes(kw);
        }

        // Tìm riêng theo Phẩm chất
        if (field === 'quality') {
            return quality.toLowerCase().includes(kw);
        }

        // Các trường thông tin học sinh khác giữ nguyên logic
        return String(s[field] || '')
            .toLowerCase()
            .includes(kw);
    });

    if (results.length === 0) {
        container.innerHTML =
            '<div class="search-empty-state search-empty-none"><i class="fas fa-circle-info"></i><strong>Không tìm thấy kết quả</strong><span>Hãy thử từ khóa khác hoặc thay đổi tiêu chí tìm kiếm.</span></div>';
        return;
    }

    // Hiển thị kết quả theo đúng môn đang chọn
    container.innerHTML = `
        <div class="table-wrapper">
            <table>
                <thead>
                    <tr>
                        <th>STT</th>
                        <th>Mã HS</th>
                        <th>Họ tên</th>
                        <th>Lớp</th>
                        <th>Năng lực - ${searchSubject}</th>
                        <th>Phẩm chất - ${searchSubject}</th>
                        <th>Trạng thái</th>
                    </tr>
                </thead>

                <tbody>
                    ${results.map((s, i) => {
                        const subjectScore =
                            APP_STATE.scores[s.id]?.[searchSubject] || {};

                        return `
                            <tr>
                                <td>${i + 1}</td>
                                <td>${s.id}</td>
                                <td>${s.fullName}</td>
                                <td>${s.class}</td>
                                <td>${displayText(subjectScore.competence)}</td>
                                <td>${displayText(subjectScore.quality)}</td>
                                <td>${getStatusBadge(s.status)}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>

        <div class="search-result-summary"><i class="fas fa-circle-check"></i><span>Tìm thấy <strong>${results.length}</strong> kết quả</span><span class="search-result-subject">Môn: <strong>${searchSubject}</strong></span></div>
    `;
}

function renderPublicContentManager() {
    if (!isAdmin()) {
        return `<div class="card"><h3 class="card-title"><i class="fas fa-lock"></i> Nội dung website công khai</h3><p class="text-muted">Chỉ tài khoản Admin mới được quản trị nội dung công khai.</p></div>`;
    }
    return `
      <div class="public-manager-page">
        <div class="public-manager-hero">
          <div class="public-manager-title-icon"><i class="fas fa-globe"></i></div>
          <div>
            <span class="public-manager-kicker">QUẢN LÝ NỘI DUNG</span>
            <h2>Nội dung website công khai</h2>
            <p>Quản lý và cập nhật Tin tức, Tài liệu, Hình ảnh, Video, Thông báo và Liên kết hiển thị trên cổng thông tin điện tử nhà trường.</p>
          </div>
          <button class="public-manager-open-site" onclick="showPublicSite()"><i class="fas fa-arrow-up-right-from-square"></i> Xem website</button>
        </div>
        <div class="public-admin-tabs public-manager-tabs">
          <button class="btn btn-primary" data-public-admin-tab="post" onclick="showPublicContentEditor('post')"><i class="fas fa-newspaper"></i> Quản lý Tin tức</button>
          <button class="btn btn-secondary" data-public-admin-tab="document" onclick="showPublicContentEditor('document')"><i class="fas fa-file-lines"></i> Quản lý Tài liệu</button>
          <button class="btn btn-secondary" data-public-admin-tab="media" onclick="showPublicMediaEditor()"><i class="fas fa-photo-film"></i> Hình ảnh & Video</button>
          <button class="btn btn-secondary" data-public-admin-tab="announcement" onclick="showPublicAnnouncementEditor()"><i class="fas fa-bullhorn"></i> Thông báo</button>
          <button class="btn btn-secondary" data-public-admin-tab="link" onclick="showPublicLinkEditor()"><i class="fas fa-link"></i> Liên kết website</button>
        </div>
        <div id="publicContentAdminPanel" class="public-content-admin-panel public-manager-panel"><p class="text-muted">Đang tải nội dung...</p></div>
      </div>`;
}

function initPublicContentManager() {
    if (isAdmin()) showPublicContentEditor('post');
}

function setPublicManagerActiveTab(type) {
    document.querySelectorAll('[data-public-admin-tab]').forEach(btn => {
        const active = btn.dataset.publicAdminTab === type;
        btn.classList.toggle('btn-primary', active);
        btn.classList.toggle('btn-secondary', !active);
        btn.classList.toggle('active', active);
    });
}


function healthStatusBadge(status) {
    const map = {
        ok: { icon: 'fa-circle-check', text: 'Đạt', color: '#16a34a', bg: 'rgba(22,163,74,.12)' },
        warn: { icon: 'fa-triangle-exclamation', text: 'Cảnh báo', color: '#d97706', bg: 'rgba(217,119,6,.12)' },
        error: { icon: 'fa-circle-xmark', text: 'Lỗi', color: '#dc2626', bg: 'rgba(220,38,38,.12)' }
    };
    const item = map[status] || map.warn;
    return `<span style="display:inline-flex;align-items:center;gap:5px;padding:4px 8px;border-radius:999px;background:${item.bg};color:${item.color};font-weight:700;font-size:.78rem;">
        <i class="fas ${item.icon}"></i> ${item.text}
    </span>`;
}

function renderHealthCheckRows(results) {
    if (!Array.isArray(results) || results.length === 0) {
        return '<p class="text-muted">Chưa có kết quả kiểm tra.</p>';
    }

    return `
        <div style="overflow:auto;">
            <table style="width:100%;min-width:680px;">
                <thead>
                    <tr>
                        <th style="width:190px;">Hạng mục</th>
                        <th style="width:110px;">Trạng thái</th>
                        <th>Chi tiết</th>
                    </tr>
                </thead>
                <tbody>
                    ${results.map(item => `
                        <tr>
                            <td><strong>${escapeHtml(item.name)}</strong></td>
                            <td>${healthStatusBadge(item.status)}</td>
                            <td>${escapeHtml(item.detail || '')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>`;
}

async function runAdminHealthCheck() {
    if (!requireAdminPermission('kiểm tra sức khỏe hệ thống')) return;

    const panel = document.getElementById('adminHealthCheckResult');
    const summary = document.getElementById('adminHealthCheckSummary');
    const button = document.getElementById('btnRunHealthCheck');
    if (!panel || !summary) return;

    if (button) {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang kiểm tra...';
    }

    panel.innerHTML = `
        <div class="text-center" style="padding:1.4rem;">
            <i class="fas fa-spinner fa-spin" style="font-size:1.8rem;color:var(--primary);"></i>
            <p style="margin-top:.7rem;">Đang kiểm tra Auth, Supabase, Storage và thư viện...</p>
        </div>`;
    summary.innerHTML = '';

    const results = [];
    const push = (name, status, detail) => results.push({ name, status, detail });

    try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        const session = data?.session;
        if (session?.user?.id) {
            const email = session.user.email || APP_STATE.currentUserEmail || '';
            push('Auth / Session', 'ok', `Đã đăng nhập${email ? `: ${email}` : ''}`);
        } else {
            push('Auth / Session', 'error', 'Không tìm thấy phiên đăng nhập Supabase.');
        }
    } catch (err) {
        push('Auth / Session', 'error', err?.message || 'Không thể kiểm tra session.');
    }

    if (APP_STATE.userAccessLoaded && APP_STATE.currentUserActive !== false) {
        push(
            'Phân quyền hiện tại',
            'ok',
            `Vai trò: ${APP_STATE.currentUserRole || 'không rõ'} · Phạm vi: ${APP_STATE.currentUserAccessScope || 'không rõ'}`
        );
    } else {
        push('Phân quyền hiện tại', 'warn', 'Trạng thái phân quyền trong APP_STATE chưa được nạp đầy đủ.');
    }

    const tableChecks = [
        ['app3_subjects', 'Danh mục môn'],
        ['app3_classes', 'Lớp'],
        ['app3_students', 'Học sinh'],
        ['app3_scores', 'Điểm'],
        ['app3_attendance', 'Điểm danh'],
        ['app3_rewards', 'Khen thưởng'],
        ['app3_disciplines', 'Kỷ luật'],
        ['app3_learning_comments', 'Nhận xét học tập'],
        ['app3_files', 'File'],
        ['app3_settings', 'Cài đặt'],
        ['app3_user_roles', 'Vai trò người dùng'],
        ['app3_teacher_assignments', 'Phân công giáo viên']
    ];

    for (const [table, label] of tableChecks) {
        try {
            const { error } = await supabase
                .from(table)
                .select('*', { head: true, count: 'exact' });
            if (error) throw error;
            push(`Bảng ${label}`, 'ok', `${table}: truy cập đọc thành công.`);
        } catch (err) {
            push(`Bảng ${label}`, 'error', `${table}: ${err?.message || 'không truy cập được'}`);
        }
    }

    try {
        const { data, error } = await supabase.storage
            .from('app3-files')
            .list('documents', { limit: 1, offset: 0 });

        if (error) throw error;
        push(
            'Storage app3-files',
            'ok',
            `Bucket truy cập được${Array.isArray(data) ? ` · tìm thấy ${data.length} mục trong phép thử` : ''}.`
        );
    } catch (err) {
        push('Storage app3-files', 'error', err?.message || 'Không truy cập được bucket app3-files.');
    }

    const libraryChecks = [
        ['Chart.js', typeof window.Chart !== 'undefined'],
        ['SheetJS / XLSX', typeof window.XLSX !== 'undefined'],
        ['ExcelJS', typeof window.ExcelJS !== 'undefined']
    ];

    libraryChecks.forEach(([name, loaded]) => {
        push(
            name,
            loaded ? 'ok' : 'error',
            loaded ? 'Thư viện đã được nạp.' : 'Không tìm thấy thư viện trong window.'
        );
    });

    if (window.pdfjsLib) {
        push('PDF.js', 'ok', 'PDF.js đã được nạp và sẵn sàng.');
    } else {
        push('PDF.js', 'warn', 'Chưa nạp ở thời điểm kiểm tra; thư viện sẽ tự tải khi mở PDF.');
    }

    const studentCount = Array.isArray(APP_STATE.students) ? APP_STATE.students.length : 0;
    const classCount = Array.isArray(APP_STATE.classes) ? APP_STATE.classes.length : 0;
    const subjectCount = Array.isArray(APP_STATE.subjectCatalog) ? APP_STATE.subjectCatalog.length : 0;

    push(
        'Dữ liệu đang nạp',
        studentCount > 0 && classCount > 0 && subjectCount > 0 ? 'ok' : 'warn',
        `${studentCount} học sinh · ${classCount} lớp · ${subjectCount} môn đang hiển thị.`
    );

    const okCount = results.filter(x => x.status === 'ok').length;
    const warnCount = results.filter(x => x.status === 'warn').length;
    const errorCount = results.filter(x => x.status === 'error').length;

    let overall = 'ok';
    if (errorCount > 0) overall = 'error';
    else if (warnCount > 0) overall = 'warn';

    summary.innerHTML = `
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:.8rem;">
            ${healthStatusBadge(overall)}
            <strong>${okCount} đạt · ${warnCount} cảnh báo · ${errorCount} lỗi</strong>
            <span class="text-muted" style="font-size:.8rem;">Kiểm tra chỉ đọc, không thay đổi dữ liệu.</span>
        </div>`;

    panel.innerHTML = renderHealthCheckRows(results);

    if (button) {
        button.disabled = false;
        button.innerHTML = '<i class="fas fa-stethoscope"></i> Kiểm tra lại';
    }
}

function renderSettings() {
    const settings = APP_STATE.settings;
    const admin = isAdmin();
    const subjects = APP_STATE.allSubjectCatalog?.length
        ? APP_STATE.allSubjectCatalog
        : SUBJECT_CONFIG.map(subject => ({ ...subject, grades: [1,2,3,4,5], active: true }));

    const subjectRows = admin ? subjects.map(subject => {
        const grades = Array.isArray(subject.grades) ? subject.grades.map(String) : [];
        return `
            <tr>
                <td>
                    <strong>${subject.name}</strong>
                    <div class="text-muted settings-subject-id">${subject.id}</div>
                </td>
                <td>
                    <div class="subject-grade-list">
                        ${[1,2,3,4,5].map(g => `
                            <label class="settings-grade-chip">
                                <input type="checkbox" class="subject-grade" data-subject-id="${subject.id}" value="${g}" ${grades.includes(String(g)) ? 'checked' : ''}>
                                <span>Khối ${g}</span>
                            </label>
                        `).join('')}
                    </div>
                </td>
                <td>
                    <label class="switch-inline settings-switch">
                        <input type="checkbox" id="subjectActive_${subject.id}" ${subject.active !== false ? 'checked' : ''}>
                        <span>${subject.active !== false ? 'Đang bật' : 'Đang tắt'}</span>
                    </label>
                </td>
                <td>
                    <button class="btn btn-primary btn-sm settings-subject-save" onclick="saveSubjectConfig('${subject.id}')">
                        <i class="fas fa-save"></i> Lưu
                    </button>
                </td>
            </tr>`;
    }).join('') : '';

    const roleLabel = isTeacher() ? 'Giáo viên' : (isViewer() ? 'Chỉ xem' : 'Admin');
    const scopeLabel = APP_STATE.currentUserAccessScope === 'assigned' ? 'Theo phân công Môn – Lớp' : 'Tất cả';

    return `
        <section class="settings-pro-page">
            <div class="settings-pro-header">
                <div class="settings-pro-title">
                    <span class="settings-title-icon"><i class="fas fa-cog"></i></span>
                    <div>
                        <span class="settings-kicker">${admin ? 'CẤU HÌNH HỆ THỐNG' : 'TÀI KHOẢN CÁ NHÂN'}</span>
                        <h2>Cài đặt</h2>
                        <p>${admin ? 'Quản lý thông tin trường, giao diện, môn học, sao lưu và bảo mật tài khoản.' : 'Xem thông tin quyền truy cập và quản lý mật khẩu tài khoản của bạn.'}</p>
                    </div>
                </div>
                ${admin ? `
                <button class="btn btn-primary btn-sm settings-save-main" onclick="saveSettings()">
                    <i class="fas fa-save"></i> Lưu cài đặt
                </button>` : ''}
            </div>

            ${admin ? `
            <div class="settings-section-card">
                <div class="settings-section-head">
                    <span class="settings-section-icon"><i class="fas fa-school"></i></span>
                    <div>
                        <h3>Thông tin chung</h3>
                        <p>Các thông tin hiển thị trong hệ thống và giao diện quản trị.</p>
                    </div>
                </div>
                <div class="settings-section-body">
                    <div class="settings-form-grid">
                        <div class="form-group">
                            <label>Tên trường</label>
                            <input type="text" id="setSchoolName" value="${settings.schoolName || ''}">
                        </div>
                        <div class="form-group">
                            <label>Năm học</label>
                            <input type="text" id="setSchoolYear" value="${settings.schoolYear || ''}">
                        </div>
                        <div class="form-group">
                            <label>Giáo viên</label>
                            <input type="text" id="setTeacherName" value="${settings.teacherName || ''}">
                        </div>
                        <div class="form-group">
                            <label>Giao diện</label>
                            <select id="setTheme">
                                <option value="light" ${settings.theme === 'light' ? 'selected' : ''}>Sáng</option>
                                <option value="dark" ${settings.theme === 'dark' ? 'selected' : ''}>Tối</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <div class="settings-section-card">
                <div class="settings-section-head">
                    <span class="settings-section-icon"><i class="fas fa-book"></i></span>
                    <div>
                        <h3>Quản lý môn học</h3>
                        <p>Bật/tắt môn và chọn các khối lớp áp dụng. Dữ liệu cũ vẫn được giữ khi tắt môn.</p>
                    </div>
                </div>
                <div class="settings-section-body settings-subject-body">
                    <div class="table-wrapper settings-subject-table-wrapper">
                        <table class="settings-subject-table">
                            <thead>
                                <tr><th>Môn học</th><th>Khối áp dụng</th><th>Trạng thái</th><th>Thao tác</th></tr>
                            </thead>
                            <tbody>${subjectRows}</tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div class="settings-section-card settings-public-card">
                <div class="settings-public-shortcut">
                    <span class="settings-public-icon"><i class="fas fa-globe"></i></span>
                    <div>
                        <h3>Nội dung website công khai</h3>
                        <p>Quản trị Tin tức, Tài liệu, Hình ảnh & Video, Thông báo và Liên kết trong module riêng.</p>
                    </div>
                    <button class="btn btn-primary btn-sm" onclick="renderPage('public-content')">
                        <i class="fas fa-arrow-up-right-from-square"></i> Mở module nội dung
                    </button>
                </div>
            </div>

            <div class="settings-section-card">
                <div class="settings-section-head">
                    <span class="settings-section-icon"><i class="fas fa-database"></i></span>
                    <div>
                        <h3>Sao lưu & khôi phục</h3>
                        <p>Bảo vệ dữ liệu bằng sao lưu JSON hoặc khôi phục khi cần.</p>
                    </div>
                </div>
                <div class="settings-section-body">
                    <div class="settings-backup-actions">
                        <button id="backupJsonBtn" class="btn btn-success" onclick="backupAllData()">
                            <i class="fas fa-download"></i> Sao lưu JSON
                        </button>
                        <button class="btn btn-warning" onclick="document.getElementById('mergeBackupInput').click()">
                            <i class="fas fa-code-merge"></i> Hợp nhất JSON
                        </button>
                        <button class="btn btn-danger" onclick="document.getElementById('fullRestoreBackupInput').click()">
                            <i class="fas fa-rotate-left"></i> Khôi phục toàn bộ
                        </button>
                        <input type="file" id="mergeBackupInput" accept=".json" style="display:none" onchange="mergeBackupData(event)">
                        <input type="file" id="fullRestoreBackupInput" accept=".json" style="display:none" onchange="fullRestoreBackupData(event)">
                    </div>
                    <div class="settings-note">
                        <i class="fas fa-circle-info"></i>
                        <span><strong>Hợp nhất JSON:</strong> ghi đè/thêm theo khóa hiện có, không xóa dữ liệu mới. <strong>Khôi phục toàn bộ:</strong> đưa dữ liệu nghiệp vụ về snapshot trong file backup.</span>
                    </div>
                </div>
            </div>

            <div class="settings-section-card">
                <div class="settings-section-head">
                    <span class="settings-section-icon"><i class="fas fa-users-cog"></i></span>
                    <div>
                        <h3>Người dùng & phân quyền</h3>
                        <p>Quản lý vai trò và phạm vi truy cập của tài khoản hệ thống.</p>
                    </div>
                </div>
                <div class="settings-section-body">
                    <div id="userRolePanel">
                        <p class="text-muted">Đang kiểm tra cấu hình phân quyền...</p>
                    </div>
                </div>
            </div>

            <div class="settings-section-card">
                <div class="settings-section-head">
                    <span class="settings-section-icon"><i class="fas fa-heart-pulse"></i></span>
                    <div>
                        <h3>Health Check hệ thống</h3>
                        <p>Kiểm tra Auth, Supabase, các bảng chính, Storage và thư viện. Chỉ đọc, không tự sửa dữ liệu.</p>
                    </div>
                    <button id="btnRunHealthCheck" class="btn btn-primary btn-sm settings-health-btn" onclick="runAdminHealthCheck()">
                        <i class="fas fa-stethoscope"></i> Kiểm tra hệ thống
                    </button>
                </div>
                <div class="settings-section-body">
                    <div id="adminHealthCheckSummary"></div>
                    <div id="adminHealthCheckResult"></div>
                </div>
            </div>
            ` : `
            <div class="settings-section-card">
                <div class="settings-section-head">
                    <span class="settings-section-icon"><i class="fas fa-user-shield"></i></span>
                    <div>
                        <h3>Tài khoản hiện tại</h3>
                        <p>Thông tin quyền do Admin cấp. Tài khoản này không có quyền thay đổi cấu hình hệ thống.</p>
                    </div>
                </div>
                <div class="settings-section-body">
                    <div class="settings-form-grid">
                        <div class="form-group"><label>Tài khoản</label><input type="text" value="${escapeRoleHtml(APP_STATE.currentUserEmail || '')}" disabled></div>
                        <div class="form-group"><label>Vai trò</label><input type="text" value="${roleLabel}" disabled></div>
                        <div class="form-group"><label>Phạm vi</label><input type="text" value="${scopeLabel}" disabled></div>
                    </div>
                </div>
            </div>`}

            <div class="settings-section-card">
                <div class="settings-section-head">
                    <span class="settings-section-icon"><i class="fas fa-key"></i></span>
                    <div>
                        <h3>Đổi mật khẩu</h3>
                        <p>Mật khẩu mới phải có ít nhất 6 ký tự.</p>
                    </div>
                </div>
                <div class="settings-section-body">
                    <div class="settings-password-grid">
                        <div class="form-group">
                            <label>Mật khẩu mới</label>
                            <input type="password" id="newPassword" placeholder="••••••••">
                        </div>
                        <div class="form-group">
                            <label>Xác nhận mật khẩu</label>
                            <input type="password" id="confirmPassword" placeholder="••••••••">
                        </div>
                    </div>
                    <button class="btn btn-warning settings-password-btn" onclick="changePassword()">
                        <i class="fas fa-key"></i> Đổi mật khẩu
                    </button>
                </div>
            </div>
        </section>`;
}

function initSettings() {
    if (isAdmin()) loadUserRolePanel();
}
function initSearch() {}

async function saveSettings() {
    if (!requireAdminPermission('lưu cấu hình hệ thống')) return;
    const settings = APP_STATE.settings;
    settings.schoolName = document.getElementById('setSchoolName').value.trim();
    settings.schoolYear = document.getElementById('setSchoolYear').value.trim();
    settings.teacherName = document.getElementById('setTeacherName').value.trim();
    settings.theme = document.getElementById('setTheme').value;
    if (settings.theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        APP_STATE.darkMode = true;
    } else {
        document.documentElement.removeAttribute('data-theme');
        APP_STATE.darkMode = false;
    }
    try {
        const { error } = await supabase
            .from('app3_settings')
            .upsert({
                config_id: 1,
                school_name: settings.schoolName,
                school_year: settings.schoolYear,
                teacher_name: settings.teacherName,
                theme: settings.theme,
                logo_url: settings.logo || ''
            }, { onConflict: 'config_id' });
        if (error) throw error;
        showToast('Đã lưu cài đặt!');
    } catch (err) {
        showToast('Lỗi lưu cài đặt: ' + err.message, 'error');
    }
}

function changePassword() {
    const pwd = document.getElementById('newPassword').value;
    const confirm = document.getElementById('confirmPassword').value;
    if (!pwd || pwd.length < 6) { showToast('Mật khẩu phải có ít nhất 6 ký tự.', 'error'); return; }
    if (pwd !== confirm) { showToast('Mật khẩu xác nhận không khớp.', 'error'); return; }
    supabase.auth.updateUser({ password: pwd })
        .then(({ error }) => {
            if (error) throw error;
            showToast('Đổi mật khẩu thành công!');
        })
        .catch(err => showToast('Lỗi đổi mật khẩu: ' + err.message, 'error'));
}

function printStudents() {
    window.print();
}

async function printStudent(id) {
    const s = APP_STATE.students.find(st => st.id === id);
    if (!s) return;
    await ensureStudentAvatar(s);
    const subject =
    APP_STATE.studentSubject ||
    APP_STATE.subjectCatalog?.[0]?.name ||
    SUBJECTS[0];
const evaluation = APP_STATE.scores?.[s.id]?.[subject] || {};
const competence = evaluation.competence || '';
const quality = evaluation.quality || '';
    const avatarSrc = (s.avatar && s.avatar.startsWith('data:image')) ? s.avatar : DEFAULT_AVATAR;
    const win = window.open('', '_blank');
    win.document.write(`
        <html>
        <head>
            <title>Hồ sơ học sinh</title>
            <style>
                body {
                    font-family: 'Times New Roman', Times, serif;
                    padding: 2rem;
                    margin: 0;
                    background: #fff;
                    color: #000;
                }
                .container {
                    max-width: 800px;
                    margin: 0 auto;
                    border: 1px solid #ccc;
                    padding: 2rem;
                    border-radius: 8px;
                    box-shadow: 0 0 10px rgba(0,0,0,0.1);
                }
                .header {
                    display: flex;
                    align-items: center;
                    gap: 2rem;
                    border-bottom: 2px solid #2563eb;
                    padding-bottom: 1rem;
                    margin-bottom: 1.5rem;
                }
                .avatar {
                    width: 120px;
                    height: 120px;
                    border-radius: 50%;
                    object-fit: cover;
                    border: 3px solid #2563eb;
                    flex-shrink: 0;
                }
                .info {
                    flex: 1;
                }
                .info h1 {
                    margin: 0 0 0.25rem 0;
                    font-size: 1.8rem;
                    color: #1e293b;
                }
                .info .sub {
                    font-size: 1rem;
                    color: #475569;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 1rem;
                }
                td {
                    padding: 0.5rem 0.3rem;
                    border-bottom: 1px solid #e2e8f0;
                }
                .label {
                    font-weight: 600;
                    width: 40%;
                    color: #334155;
                }
                .value {
                    width: 60%;
                    color: #0f172a;
                }
                .footer {
                    margin-top: 2rem;
                    text-align: center;
                    font-size: 0.85rem;
                    color: #94a3b8;
                    border-top: 1px solid #e2e8f0;
                    padding-top: 1rem;
                }
                @media print {
                    body { padding: 0.5in; }
                    .container { border: none; box-shadow: none; padding: 0; }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <img src="${avatarSrc}" alt="Avatar" class="avatar" onerror="this.style.display='none'">
                    <div class="info">
                        <h1>${s.fullName}</h1>
                        <div class="sub"><strong>Mã HS:</strong> ${s.id} &nbsp;|&nbsp; <strong>Lớp:</strong> ${s.class} &nbsp;|&nbsp; <strong>Khối:</strong> ${s.grade}</div>
                        <div class="sub" style="margin-top:0.25rem;">
                            <span style="display:inline-block;background:#dbeafe;padding:0.1rem 0.6rem;border-radius:12px;font-size:0.8rem;">${s.status}</span>
                        </div>
                    </div>
                </div>

                <table>
                    <tr><td class="label">Ngày sinh</td><td class="value">${formatDate(s.dob)}</td></tr>
                    <tr><td class="label">Giới tính</td><td class="value">${s.gender}</td></tr>
                    <tr><td class="label">Địa chỉ</td><td class="value">${s.address || ''}</td></tr>
                    <tr><td class="label">Số điện thoại</td><td class="value">${s.phone || ''}</td></tr>
                    <tr><td class="label">Email</td><td class="value">${s.email || ''}</td></tr>
                    <tr><td class="label">Môn đánh giá</td><td class="value">${subject}</td></tr>
<tr><td class="label">Năng lực</td><td class="value">${displayText(competence) || 'Chưa đánh giá'}</td></tr>
<tr><td class="label">Phẩm chất</td><td class="value">${displayText(quality) || 'Chưa đánh giá'}</td></tr>
                    <tr><td class="label">Trạng thái</td><td class="value">${s.status}</td></tr>
                    <tr><td class="label">Ngày nhập học</td><td class="value">${formatDate(s.enrollmentDate)}</td></tr>
                    <tr><td class="label">Tên cha</td><td class="value">${s.fatherName || ''}</td></tr>
                    <tr><td class="label">Tên mẹ</td><td class="value">${s.motherName || ''}</td></tr>
                    <tr><td class="label">SĐT phụ huynh</td><td class="value">${s.parentPhone || ''}</td></tr>
                    <tr><td class="label">Ghi chú</td><td class="value">${s.note || ''}</td></tr>
                </table>

                <div class="footer">
                    &copy; ${new Date().getFullYear()} Trường Tiểu học-Trung học Cơ sở & Trung học phổ thông Lại Sơn_Phân hiệu trường Tiểu học Trần Quốc Toản - Hệ thống QLHS
                </div>
            </div>
            <script>
                window.onload = function() {
                    window.print();
                };
            <\/script>
        </body>
        </html>
    `);
    win.document.close();
}

// ============================================================
// 17. CÁC HÀM XUẤT EXCEL BỔ SUNG
// ============================================================
function exportClassList() {
    const cls = document.getElementById('exportClassSelect')?.value;
    if (!cls) {
        showToast('Vui lòng chọn lớp để xuất.', 'warning');
        return;
    }
    const students = APP_STATE.students.filter(s => s.class === cls);
    if (students.length === 0) {
        showToast('Lớp này chưa có học sinh.', 'warning');
        return;
    }
    const subject =
    APP_STATE.studentSubject ||
    APP_STATE.currentSubject ||
    APP_STATE.subjectCatalog?.[0]?.name ||
    SUBJECTS[0] ||
    'Tin học';
    const data = students.map(s => {
    const subjectScore =
        APP_STATE.scores[s.id]?.[subject] || {};

    return {
        'Mã HS': s.id,
        'Họ tên': s.fullName,
        'Ngày sinh': s.dob,
        'Giới tính': s.gender,
        'Lớp': s.class,
        'Khối': s.grade,
        'Địa chỉ': s.address,
        'SĐT': s.phone,
        'Email': s.email,
        'Năng lực': subjectScore.competence || '',
        'Phẩm chất': subjectScore.quality || '',
        'Trạng thái': s.status,
        'Tên cha': s.fatherName || '',
        'Tên mẹ': s.motherName || '',
        'SĐT phụ huynh': s.parentPhone || '',
        'Ngày nhập học': s.enrollmentDate || '',
        'Ghi chú': s.note || ''
    };
});
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'DanhSachLop');
    XLSX.writeFile(wb, `Danh_sach_lop_${cls}_${new Date().toISOString().slice(0,10)}.xlsx`);
    showToast(`Xuất danh sách lớp ${cls} thành công!`);
}

function exportScoreClass() {
    const cls = document.getElementById('exportScoreClass')?.value;
    const subject = APP_STATE.currentSubject;

    if (!cls) {
        showToast('Vui lòng chọn lớp để xuất điểm.', 'warning');
        return;
    }
    const students = APP_STATE.students.filter(s => s.class === cls);
    if (students.length === 0) {
        showToast('Lớp này chưa có học sinh.', 'warning');
        return;
    }
    const data = students.map(s => {
        const sc = APP_STATE.scores[s.id]?.[subject] || {
    giuaKy1: '',
    cuoiKy1: null,
    giuaKy2: '',
    cuoiKy2: null,
    competence: '',
    quality: ''
};
        return {
            'Mã HS': s.id,
            'Họ tên': s.fullName,
            'Lớp': s.class,
            'Giữa kỳ 1': sc.giuaKy1,
            'Cuối kỳ 1': sc.cuoiKy1 !== null ? sc.cuoiKy1 : '',
            'Giữa kỳ 2': sc.giuaKy2,
            'Cuối kỳ 2': sc.cuoiKy2 !== null ? sc.cuoiKy2 : '',
            'Năng lực': sc.competence || '',
            'Phẩm chất': sc.quality || ''
        };
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, `Diem_${subject}`);
    XLSX.writeFile(wb, `Diem_${subject}_lop_${cls}_${new Date().toISOString().slice(0,10)}.xlsx`);
    showToast(`Xuất điểm môn ${subject} lớp ${cls} thành công!`);
}

function exportRewards() {
    if (APP_STATE.rewards.length === 0) {
        showToast('Chưa có dữ liệu khen thưởng.', 'warning');
        return;
    }
    const studentMap = Object.fromEntries(APP_STATE.students.map(s => [s.db_uuid, s.fullName]));
    const data = APP_STATE.rewards.map(r => ({
        'Lớp': getContextClassName(r.classId),
        'Môn': r.subject || 'Dữ liệu cũ',
        'Học sinh': studentMap[r.studentId] || 'Không xác định',
        'Ngày': r.date,
        'Nội dung': r.content,
        'Người quyết định': r.decisionBy
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'KhenThuong');
    XLSX.writeFile(wb, `Khen_thuong_${new Date().toISOString().slice(0,10)}.xlsx`);
    showToast('Xuất khen thưởng thành công!');
}

function exportDisciplines() {
    if (APP_STATE.disciplines.length === 0) {
        showToast('Chưa có dữ liệu kỷ luật.', 'warning');
        return;
    }
    const studentMap = Object.fromEntries(APP_STATE.students.map(s => [s.db_uuid, s.fullName]));
    const data = APP_STATE.disciplines.map(d => ({
        'Lớp': getContextClassName(d.classId),
        'Môn': d.subject || 'Dữ liệu cũ',
        'Học sinh': studentMap[d.studentId] || 'Không xác định',
        'Ngày': d.date,
        'Nội dung': d.content,
        'Người quyết định': d.decisionBy
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'KyLuat');
    XLSX.writeFile(wb, `Ky_luat_${new Date().toISOString().slice(0,10)}.xlsx`);
    showToast('Xuất kỷ luật thành công!');
}



// ============================================================
// 20. NAVIGATION & LOGIN (Supabase Auth)
// ============================================================
function initNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function() {
            const page = this.dataset.page;
            if (!page) return;
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            this.classList.add('active');
            renderPage(page);
            if (window.innerWidth <= 768) {
                document.getElementById('sidebar').classList.remove('open');
            }
        });
    });

    document.getElementById('toggleSidebar').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('collapsed');
    });

    document.getElementById('toggleSidebarMobile').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
    });

    document.getElementById('darkModeToggle').addEventListener('click', () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        if (isDark) {
            document.documentElement.removeAttribute('data-theme');
            APP_STATE.settings.theme = 'light';
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            APP_STATE.settings.theme = 'dark';
        }
        localStorage.setItem('settings', JSON.stringify(APP_STATE.settings));
        APP_STATE.darkMode = !isDark;
        const icon = document.querySelector('#darkModeToggle i');
        if (icon) {
            icon.className = isDark ? 'fas fa-moon' : 'fas fa-sun';
        }
        // Theme cá nhân của Teacher/Viewer chỉ lưu trên trình duyệt; không ghi đè cấu hình toàn hệ thống.
        if (isAdmin()) {
            supabase.from('app3_settings').upsert({
                config_id: 1,
                theme: APP_STATE.settings.theme
            }, { onConflict: 'config_id' }).then(({ error }) => {
                if (error) console.warn('Không thể lưu theme:', error);
            });
        }
    });
}

// ============================================================
// WEBSITE PUBLIC - BƯỚC 147.3: TIN TỨC + ẢNH ĐẠI DIỆN TỪ MÁY
// ============================================================
const PUBLIC_POST_IMAGE_BUCKET = 'app3-public-post-images';
const PUBLIC_POST_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const PUBLIC_MEDIA_BUCKET = 'app3-public-media';
const PUBLIC_MEDIA_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const PUBLIC_MEDIA_VIDEO_MAX_BYTES = 1024 * 1024 * 1024; // 1 GB
let PUBLIC_POST_CACHE = [];
let PUBLIC_NEWS_CATEGORY = 'Tất cả';
let PUBLIC_MEDIA_CACHE = [];
function publicEscape(value) {
    return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}
function publicDate(value) {
    if (!value) return '';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('vi-VN');
}
function publicSafeImageUrl(value) {
    const url = String(value || '').trim();
    if (!url) return '';
    if (/^(https?:\/\/|\/|\.\/|assets\/|data:image\/)/i.test(url)) return publicEscape(url);
    return '';
}
let PUBLIC_HERO_INDEX = 0;
let PUBLIC_HERO_TIMER = null;
const PUBLIC_HERO_STATIC_SLIDES = [
    { src:'assets/banners/banner-01-truong-hoc-lai-son.webp', title:'Lại Sơn - Phân hiệu Trần Quốc Toản' },
    { src:'assets/banners/banner-02-uom-mam-uoc-mo.webp', title:'Nơi ươm mầm những ước mơ' },
    { src:'assets/banners/banner-03-vi-hoc-sinh-than-yeu.webp', title:'Vì học sinh thân yêu' },
    { src:'assets/banners/banner-04-uom-mam-hanh-phuc.webp', title:'Ươm mầm hạnh phúc' },
    { src:'assets/banners/banner-05-truong-hoc-than-thien.webp', title:'Trường học thân thiện' },
    { src:'assets/banners/banner-06-hoc-hom-nay-vung-tuong-lai.webp', title:'Học hôm nay - Vững tương lai' },
    { src:'assets/banners/banner-07-tri-thuc-tuong-lai.webp', title:'Tri thức hôm nay - Tương lai ngày mai' },
    { src:'assets/banners/banner-08-sang-tao-phat-trien.webp', title:'Sáng tạo - Phát triển' }
];
function setPublicHeroSlide(index=0){
    const slides=[...document.querySelectorAll('#publicHeroSlides .public-hero-slide')];
    const dots=[...document.querySelectorAll('#publicHeroDots [data-hero-dot]')];
    if(!slides.length) return;
    PUBLIC_HERO_INDEX=(Number(index)+slides.length)%slides.length;
    slides.forEach((el,i)=>{
        el.classList.toggle('active',i===PUBLIC_HERO_INDEX);
    });
    dots.forEach((el,i)=>el.classList.toggle('active',i===PUBLIC_HERO_INDEX));
}
function startPublicHeroTimer(){
    if(PUBLIC_HERO_TIMER) clearInterval(PUBLIC_HERO_TIMER);
    const count=document.querySelectorAll('#publicHeroSlides .public-hero-slide').length;
    if(count>1) PUBLIC_HERO_TIMER=setInterval(()=>setPublicHeroSlide(PUBLIC_HERO_INDEX+1),7200);
}
function setupPublicHero(_images=[]){
    const slidesBox=document.getElementById('publicHeroSlides');
    const dotsBox=document.getElementById('publicHeroDots');
    if(!slidesBox||!dotsBox) return;

    // BƯỚC 150.7: banner độc lập. Không lấy ảnh từ Thư viện ảnh / app3_public_media.
    const slides=PUBLIC_HERO_STATIC_SLIDES;
    slidesBox.innerHTML=slides.map((item,i)=>`
        <figure class="public-hero-slide ${i===0?'active':''}" data-hero-index="${i}">
            <img class="public-hero-main" src="${item.src}" alt="${publicEscape(item.title)}" ${i?'loading="lazy"':'fetchpriority="high"'} decoding="async">
        </figure>`).join('');
    dotsBox.innerHTML=slides.map((_,i)=>`<button type="button" class="${i===0?'active':''}" data-hero-dot="${i}" aria-label="Banner ${i+1}"></button>`).join('');
    PUBLIC_HERO_INDEX=0;
    dotsBox.querySelectorAll('[data-hero-dot]').forEach(btn=>btn.addEventListener('click',()=>{setPublicHeroSlide(Number(btn.dataset.heroDot));startPublicHeroTimer();}));
    const prev=document.getElementById('publicHeroPrev'), next=document.getElementById('publicHeroNext');
    if(prev) prev.onclick=()=>{setPublicHeroSlide(PUBLIC_HERO_INDEX-1);startPublicHeroTimer();};
    if(next) next.onclick=()=>{setPublicHeroSlide(PUBLIC_HERO_INDEX+1);startPublicHeroTimer();};
    startPublicHeroTimer();
}
function updatePublicTodayLabel(){
    const el=document.getElementById('publicTodayLabel');
    if(!el) return;
    const now=new Date();
    el.textContent=now.toLocaleDateString('vi-VN',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'});
}
function publicPostThumb(post, compact=false) {
    const imageUrl = publicSafeImageUrl(post.image_url);
    if (imageUrl) return `<div class="${compact?'news-mini-thumb':'news-thumb news-thumb-image'}"><img src="${imageUrl}" alt="${publicEscape(post.title || 'Tin tức')}" loading="lazy"><span>${publicEscape(post.category || 'TIN TỨC')}</span></div>`;
    if (compact) return `<div class="news-mini-icon"><i class="fas fa-bullhorn"></i></div>`;
    return `<div class="news-thumb"><i class="fas fa-school-flag"></i><span>${publicEscape(post.category || 'TIN TỨC')}</span></div>`;
}
function publicPostExcerpt(post, max=145){
    const text=String(post.summary||post.content||'').replace(/\s+/g,' ').trim();
    return text.length>max ? text.slice(0,max).trimEnd()+'…' : text;
}
function renderPublicNews(posts=PUBLIC_POST_CACHE){
    const grid=document.getElementById('publicNewsGrid');
    const toolbar=document.getElementById('publicNewsToolbar');
    if(!grid) return;
    const all=Array.isArray(posts)?posts:[];
    const categories=['Tất cả',...new Set(all.map(x=>String(x.category||'Tin tức').trim()).filter(Boolean))];
    if(PUBLIC_NEWS_CATEGORY!=='Tất cả'&&!categories.includes(PUBLIC_NEWS_CATEGORY)) PUBLIC_NEWS_CATEGORY='Tất cả';
    if(toolbar){
        toolbar.innerHTML=`<div class="public-news-filter-label"><i class="fas fa-filter"></i><span>Chuyên mục</span></div><div class="public-news-filter-chips">${categories.map(cat=>`<button type="button" class="${cat===PUBLIC_NEWS_CATEGORY?'active':''}" onclick="setPublicNewsCategory('${publicEscape(cat).replace(/'/g,'&#39;')}')">${publicEscape(cat)}</button>`).join('')}</div><span class="public-news-count">${all.length} bài viết</span>`;
    }
    const filtered=PUBLIC_NEWS_CATEGORY==='Tất cả'?all:all.filter(x=>String(x.category||'Tin tức').trim()===PUBLIC_NEWS_CATEGORY);
    if(!filtered.length){
        grid.innerHTML='<div class="public-empty-state"><i class="fas fa-newspaper"></i><strong>Chưa có tin trong chuyên mục này</strong><span>Vui lòng chọn chuyên mục khác hoặc quay lại Tất cả.</span></div>';
        return;
    }
    const [first,...rest]=filtered;
    grid.innerHTML=`<article class="news-card news-featured public-post-clickable" role="button" tabindex="0" onclick="openPublicPostDetail('${first.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openPublicPostDetail('${first.id}')}" aria-label="Xem bài ${publicEscape(first.title)}">${publicPostThumb(first)}<div class="news-body"><div class="news-meta-row"><span>${publicEscape(first.category||'TIN TỨC')}</span><small><i class="far fa-calendar"></i> ${publicDate(first.published_at||first.created_at)}</small></div><h3>${publicEscape(first.title)}</h3><p>${publicEscape(publicPostExcerpt(first,190))}</p><span class="news-read-more">Đọc chi tiết <i class="fas fa-arrow-right"></i></span></div></article><div class="news-side-list">${rest.map(item=>`<article class="news-mini public-post-clickable" role="button" tabindex="0" onclick="openPublicPostDetail('${item.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openPublicPostDetail('${item.id}')}" aria-label="Xem bài ${publicEscape(item.title)}">${publicPostThumb(item,true)}<div class="news-mini-copy"><div class="news-mini-meta"><span>${publicEscape(item.category||'TIN TỨC')}</span><small>${publicDate(item.published_at||item.created_at)}</small></div><h3>${publicEscape(item.title)}</h3><p>${publicEscape(publicPostExcerpt(item,105))}</p><b>Đọc tin <i class="fas fa-chevron-right"></i></b></div></article>`).join('')}</div>`;
}
function setPublicNewsCategory(category='Tất cả'){
    PUBLIC_NEWS_CATEGORY=String(category||'Tất cả');
    renderPublicNews(PUBLIC_POST_CACHE);
}
let PUBLIC_DOCUMENT_CACHE=[];
let PUBLIC_DOCUMENT_CATEGORY='Tất cả';
let PUBLIC_DOCUMENT_SEARCH='';
function publicDocumentIcon(item={}){
    const text=String(item.file_url||'').split('?')[0].toLowerCase();
    if(text.endsWith('.pdf')) return 'fa-file-pdf';
    if(/\.(doc|docx)$/.test(text)) return 'fa-file-word';
    if(/\.(xls|xlsx|csv)$/.test(text)) return 'fa-file-excel';
    if(/\.(ppt|pptx)$/.test(text)) return 'fa-file-powerpoint';
    if(/\.(zip|rar|7z)$/.test(text)) return 'fa-file-zipper';
    return 'fa-file-lines';
}
function publicDocumentType(item={}){
    const text=String(item.file_url||'').split('?')[0].toLowerCase();
    if(text.endsWith('.pdf')) return 'PDF';
    if(/\.(doc|docx)$/.test(text)) return 'WORD';
    if(/\.(xls|xlsx|csv)$/.test(text)) return 'EXCEL';
    if(/\.(ppt|pptx)$/.test(text)) return 'POWERPOINT';
    if(/\.(zip|rar|7z)$/.test(text)) return 'TỆP NÉN';
    return 'TÀI LIỆU';
}
function renderPublicDocuments(items=PUBLIC_DOCUMENT_CACHE){
    const grid=document.getElementById('publicDocumentGrid'), toolbar=document.getElementById('publicDocumentToolbar');
    if(!grid) return;
    const all=Array.isArray(items)?items:[];
    const categories=['Tất cả',...new Set(all.map(x=>String(x.category||'Tài liệu').trim()).filter(Boolean))];
    if(PUBLIC_DOCUMENT_CATEGORY!=='Tất cả'&&!categories.includes(PUBLIC_DOCUMENT_CATEGORY)) PUBLIC_DOCUMENT_CATEGORY='Tất cả';
    const q=PUBLIC_DOCUMENT_SEARCH.trim().toLocaleLowerCase('vi');
    const filtered=all.filter(x=>{
        const cat=String(x.category||'Tài liệu').trim();
        const okCat=PUBLIC_DOCUMENT_CATEGORY==='Tất cả'||cat===PUBLIC_DOCUMENT_CATEGORY;
        const hay=[x.title,x.description,x.category].map(v=>String(v||'').toLocaleLowerCase('vi')).join(' ');
        return okCat&&(!q||hay.includes(q));
    });
    if(toolbar) toolbar.innerHTML=`<div class="public-document-search"><i class="fas fa-magnifying-glass"></i><input type="search" value="${publicEscape(PUBLIC_DOCUMENT_SEARCH)}" placeholder="Tìm tài liệu..." oninput="setPublicDocumentSearch(this.value)" aria-label="Tìm tài liệu"></div><div class="public-document-filter-chips">${categories.map(cat=>`<button type="button" class="${cat===PUBLIC_DOCUMENT_CATEGORY?'active':''}" onclick="setPublicDocumentCategory('${publicEscape(cat).replace(/'/g,'&#39;')}')">${publicEscape(cat)}</button>`).join('')}</div><span class="public-document-count">${filtered.length}/${all.length} tài liệu</span>`;
    if(!filtered.length){grid.innerHTML='<div class="public-empty-state"><i class="fas fa-folder-open"></i><strong>Không tìm thấy tài liệu phù hợp</strong><span>Hãy đổi từ khóa hoặc chọn chuyên mục khác.</span></div>';return;}
    grid.innerHTML=filtered.map(item=>{
        const url=publicSafeExternalUrl(item.file_url||'');
        const cat=publicEscape(item.category||'Tài liệu');
        const title=publicEscape(item.title||'Tài liệu');
        const rawDescription=String(item.description||'Tài liệu công khai của nhà trường.').trim();
        const description=publicEscape(rawDescription);
        const hasMore=rawDescription.length>220;
        return `<article class="public-document-card"><div class="public-document-icon"><i class="fas ${publicDocumentIcon(item)}"></i></div><div class="public-document-copy"><div class="public-document-meta"><span>${cat}</span><small>${publicDocumentType(item)} · ${publicDate(item.created_at)}</small></div><h3>${title}</h3><p class="public-document-description${hasMore?' is-collapsible':''}">${description}</p>${hasMore?`<button type="button" class="public-document-more" onclick="togglePublicDocumentPreview(this)"><span>Xem thêm</span><i class="fas fa-chevron-down"></i></button>`:''}</div><div class="public-document-actions">${url?`<a class="public-doc-link" href="${url}" target="_blank" rel="noopener"><i class="fas fa-arrow-up-right-from-square"></i> Mở tài liệu</a><a class="public-doc-download" href="${url}" download target="_blank" rel="noopener" aria-label="Tải ${title}"><i class="fas fa-download"></i></a>`:'<span class="public-doc-unavailable"><i class="fas fa-clock"></i> Đang cập nhật tệp</span>'}</div></article>`;
    }).join('');
}

function togglePublicDocumentPreview(button){
    const card=button?.closest('.public-document-card');
    const description=card?.querySelector('.public-document-description');
    if(!description) return;
    const expanded=description.classList.toggle('is-expanded');
    button.classList.toggle('is-expanded',expanded);
    const label=button.querySelector('span');
    if(label) label.textContent=expanded?'Thu gọn':'Xem thêm';
    button.setAttribute('aria-expanded',expanded?'true':'false');
}

function setPublicDocumentCategory(category='Tất cả'){PUBLIC_DOCUMENT_CATEGORY=String(category||'Tất cả');renderPublicDocuments();}
function setPublicDocumentSearch(value=''){PUBLIC_DOCUMENT_SEARCH=String(value||'');renderPublicDocuments();}

async function loadPublicWebsiteContent() {
    const newsGrid = document.getElementById('publicNewsGrid');
    const docGrid = document.getElementById('publicDocumentGrid');
    const galleryGrid = document.getElementById('publicGalleryGrid');
    const videoGrid = document.getElementById('publicVideoGrid');

    try {
        const [postsRes, docsRes] = await Promise.all([
            supabase.from('app3_public_posts').select('*').eq('is_published', true).order('published_at', { ascending:false }).limit(12),
            supabase.from('app3_public_documents').select('*').eq('is_published', true).order('created_at', { ascending:false }).limit(6)
        ]);
        if (postsRes.error) throw postsRes.error;
        if (docsRes.error) throw docsRes.error;
        const posts = postsRes.data || [];
        const docs = docsRes.data || [];
        PUBLIC_POST_CACHE = posts;
        if (newsGrid) {
            if (!posts.length) newsGrid.innerHTML = '<div class="public-empty-state"><i class="fas fa-newspaper"></i><strong>Chưa có tin tức công khai</strong><span>Nội dung sẽ được cập nhật bởi nhà trường.</span></div>';
            else renderPublicNews(posts);
        }
        PUBLIC_DOCUMENT_CACHE = docs;
        if (docGrid) {
            if (!docs.length) docGrid.innerHTML = '<div class="public-empty-state"><i class="fas fa-folder-open"></i><strong>Chưa có tài liệu công khai</strong><span>Tài liệu sẽ được cập nhật bởi nhà trường.</span></div>';
            else renderPublicDocuments(docs);
        }
    } catch (err) {
        console.warn('Không thể tải nội dung website công khai:', err);
        if (newsGrid) newsGrid.innerHTML = '<div class="public-empty-state"><i class="fas fa-circle-exclamation"></i><strong>Chưa tải được tin tức</strong><span>Hãy kiểm tra cấu hình Supabase.</span></div>';
        if (docGrid) docGrid.innerHTML = '<div class="public-empty-state"><i class="fas fa-circle-exclamation"></i><strong>Chưa tải được tài liệu</strong><span>Hãy kiểm tra cấu hình Supabase.</span></div>';
    }

    try {
        const mediaRes = await supabase.from('app3_public_media').select('*').eq('is_published', true).order('sort_order', { ascending:true }).order('created_at', { ascending:false }).limit(1000);
        if (mediaRes.error) throw mediaRes.error;
        const media = mediaRes.data || [];
        PUBLIC_MEDIA_CACHE = media;
        const publicImages = media.filter(x => x.media_type === 'image');
        renderPublicGallery(publicImages);
        setupPublicHero(publicImages);
        renderPublicVideos(media.filter(x => x.media_type === 'video' || x.media_type === 'youtube'));
    } catch (err) {
        console.warn('Chưa tải được thư viện ảnh/video công khai:', err);
        if (galleryGrid) galleryGrid.innerHTML = '<div class="public-empty-state"><i class="fas fa-images"></i><strong>Thư viện ảnh chưa được kích hoạt</strong><span>Admin chạy SQL Bước 149.5 một lần để bật chức năng.</span></div>';
        if (videoGrid) videoGrid.innerHTML = '<div class="public-empty-state"><i class="fas fa-circle-play"></i><strong>Thư viện video chưa được kích hoạt</strong><span>Admin chạy SQL Bước 149.5 một lần để bật chức năng.</span></div>';
    }

    await loadPublicUtilityContent();
    startPublicLiveClock();
}

function publicYouTubeId(url='') {
    const text=String(url||'').trim();
    if(!text) return '';
    // Cho phép dán trực tiếp video ID 11 ký tự.
    if(/^[A-Za-z0-9_-]{11}$/.test(text)) return text;
    try{
        const u=new URL(text.startsWith('http')?text:`https://${text}`);
        const host=u.hostname.toLowerCase().replace(/^www\./,'');
        if(host==='youtu.be') return (u.pathname.split('/').filter(Boolean)[0]||'').slice(0,11);
        if(host.endsWith('youtube.com')){
            const v=u.searchParams.get('v');
            if(v) return v.slice(0,11);
            const parts=u.pathname.split('/').filter(Boolean);
            const i=parts.findIndex(x=>['shorts','embed','live'].includes(x.toLowerCase()));
            if(i>=0 && parts[i+1]) return parts[i+1].slice(0,11);
        }
    }catch{}
    const m=text.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?[^#]*v=|shorts\/|embed\/|live\/))([A-Za-z0-9_-]{6,})/i);
    return m?m[1].slice(0,11):'';
}
function publicYouTubeWatchUrl(value=''){
    const id=publicYouTubeId(value);
    return id?`https://www.youtube.com/watch?v=${id}`:'';
}
function publicSafeMediaUrl(value) {
    const url=String(value||'').trim();
    if(!url) return '';
    if(/^(https?:\/\/|\/|\.\/|assets\/)/i.test(url)) return publicEscape(url);
    return '';
}
let PUBLIC_GALLERY_CATEGORY='Tất cả';
let PUBLIC_GALLERY_VISIBLE=[];
let PUBLIC_GALLERY_INDEX=0;
function renderPublicGallery(items=[]) {
    const grid=document.getElementById('publicGalleryGrid');
    const toolbar=document.getElementById('publicGalleryToolbar');
    if(!grid) return;

    const all=(Array.isArray(items)?items:[])
        .filter(x=>x&&x.media_type==='image');

    const categories=['Tất cả',...new Set(
        all.map(x=>String(x.category||'Khác').trim()).filter(Boolean)
    )];

    if(PUBLIC_GALLERY_CATEGORY!=='Tất cả'&&!categories.includes(PUBLIC_GALLERY_CATEGORY)){
        PUBLIC_GALLERY_CATEGORY='Tất cả';
    }

    const filtered=PUBLIC_GALLERY_CATEGORY==='Tất cả'
        ? all
        : all.filter(x=>String(x.category||'Khác').trim()===PUBLIC_GALLERY_CATEGORY);

    PUBLIC_GALLERY_VISIBLE=filtered.filter(x=>publicSafeMediaUrl(x.media_url));

    if(toolbar){
        toolbar.innerHTML=`
            <div class="public-gallery-filter-label">
                <i class="fas fa-images"></i>
                <span>Album / chuyên mục</span>
            </div>
            <div class="public-gallery-filter-chips">
                ${categories.map(cat=>`
                    <button type="button"
                            class="${cat===PUBLIC_GALLERY_CATEGORY?'active':''}"
                            onclick="setPublicGalleryCategory('${publicEscape(cat).replace(/'/g,'&#39;')}')">
                        ${publicEscape(cat)}
                    </button>
                `).join('')}
            </div>
            <span class="public-gallery-count">
                <i class="far fa-images"></i> ${PUBLIC_GALLERY_VISIBLE.length} ảnh
            </span>`;
    }

    // Xóa nút cũ nếu render lại theo chuyên mục
    document.getElementById('publicGallerySeeAllWrap')?.remove();

    if(!PUBLIC_GALLERY_VISIBLE.length){
        grid.innerHTML=`
            <div class="public-empty-state">
                <i class="fas fa-camera-retro"></i>
                <strong>Chưa có hình ảnh trong chuyên mục này</strong>
                <span>Hãy chọn chuyên mục khác hoặc quay lại Tất cả.</span>
            </div>`;
        return;
    }

    const previewItems=PUBLIC_GALLERY_VISIBLE.slice(0,4);

    grid.innerHTML=previewItems.map(item=>{
        const url=publicSafeMediaUrl(item.media_url);
        const title=publicEscape(item.title||'Hoạt động nhà trường');
        const cat=publicEscape(item.category||'Hoạt động');
        return `
            <figure class="public-gallery-card public-gallery-preview-card"
                    role="button"
                    tabindex="0"
                    onclick="openPublicMediaModal('${item.id}')"
                    onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openPublicMediaModal('${item.id}')}">
                <img src="${url}" alt="${title}" loading="lazy">
                <figcaption>
                    <b>${title}</b>
                    <span><i class="far fa-folder-open"></i> ${cat}</span>
                    <i class="fas fa-arrow-up-right-from-square public-gallery-card-arrow"></i>
                </figcaption>
            </figure>`;
    }).join('');

    if(PUBLIC_GALLERY_VISIBLE.length>4){
        grid.insertAdjacentHTML('afterend',`
            <div id="publicGallerySeeAllWrap" class="public-gallery-see-all-wrap">
                <button type="button" class="public-gallery-see-all-btn" onclick="openPublicGalleryAll()">
                    <i class="far fa-images"></i>
                    <span>Xem tất cả ${PUBLIC_GALLERY_VISIBLE.length} ảnh</span>
                    <i class="fas fa-arrow-right"></i>
                </button>
            </div>`);
    }
}

function openPublicGalleryAll(){
    const items=Array.isArray(PUBLIC_GALLERY_VISIBLE)?PUBLIC_GALLERY_VISIBLE:[];
    if(!items.length) return;

    document.getElementById('publicGalleryAllModal')?.remove();

    const modal=document.createElement('div');
    modal.id='publicGalleryAllModal';
    modal.className='public-gallery-all-modal';
    modal.innerHTML=`
        <div class="public-gallery-all-backdrop" data-gallery-close></div>
        <div class="public-gallery-all-shell" role="dialog" aria-modal="true" aria-label="Tất cả hình ảnh">
            <div class="public-gallery-all-head">
                <div>
                    <strong>KHOẢNH KHẮC</strong>
                    <span>${items.length} ảnh trong chuyên mục hiện tại</span>
                </div>
                <button type="button" class="public-gallery-all-close" data-gallery-close aria-label="Đóng">
                    <i class="fas fa-xmark"></i>
                </button>
            </div>
            <div class="public-gallery-all-grid">
                ${items.map(item=>{
                    const url=publicSafeMediaUrl(item.media_url);
                    if(!url) return '';
                    const title=publicEscape(item.title||'Hình ảnh hoạt động');
                    const cat=publicEscape(item.category||'Hoạt động');
                    return `
                        <button type="button"
                                class="public-gallery-all-item"
                                data-gallery-image-id="${item.id}">
                            <span class="public-gallery-all-thumb">
                                <img src="${url}" alt="${title}" loading="lazy">
                            </span>
                            <span class="public-gallery-all-caption">
                                <b>${title}</b>
                                <small><i class="far fa-folder-open"></i> ${cat}</small>
                            </span>
                        </button>`;
                }).join('')}
            </div>
        </div>`;

    modal.addEventListener('click',(event)=>{
        const closeTarget=event.target.closest('[data-gallery-close]');
        if(closeTarget){
            closePublicGalleryAll();
            return;
        }

        const imageButton=event.target.closest('[data-gallery-image-id]');
        if(imageButton){
            const id=imageButton.dataset.galleryImageId;
            closePublicGalleryAll();
            openPublicMediaModal(id);
        }
    });

    document.body.appendChild(modal);
    document.body.classList.add('public-modal-open');
}

function closePublicGalleryAll(){
    document.getElementById('publicGalleryAllModal')?.remove();
    document.body.classList.remove('public-modal-open');
}

function setPublicGalleryCategory(category='Tất cả'){
    PUBLIC_GALLERY_CATEGORY=String(category||'Tất cả');
    renderPublicGallery(PUBLIC_MEDIA_CACHE.filter(x=>x.media_type==='image'));
}
function showPublicGalleryImage(index){
    if(!PUBLIC_GALLERY_VISIBLE.length) return;
    PUBLIC_GALLERY_INDEX=(Number(index)+PUBLIC_GALLERY_VISIBLE.length)%PUBLIC_GALLERY_VISIBLE.length;
    const item=PUBLIC_GALLERY_VISIBLE[PUBLIC_GALLERY_INDEX];
    const body=document.getElementById('publicMediaModalBody'); if(!body)return;
    const url=publicSafeMediaUrl(item.media_url); if(!url)return;
    body.innerHTML=`<div class="public-gallery-viewer"><img src="${url}" alt="${publicEscape(item.title||'Hình ảnh hoạt động')}"><button class="public-gallery-nav prev" onclick="stepPublicGallery(-1)" aria-label="Ảnh trước"><i class="fas fa-chevron-left"></i></button><button class="public-gallery-nav next" onclick="stepPublicGallery(1)" aria-label="Ảnh tiếp theo"><i class="fas fa-chevron-right"></i></button></div><div class="public-media-modal-caption"><div class="public-gallery-modal-meta"><span>${PUBLIC_GALLERY_INDEX+1} / ${PUBLIC_GALLERY_VISIBLE.length}</span>${item.category?`<span><i class="far fa-folder-open"></i> ${publicEscape(item.category)}</span>`:''}</div><strong>${publicEscape(item.title||'Hình ảnh hoạt động')}</strong>${item.description?`<p>${publicEscape(item.description)}</p>`:''}</div>`;
}
function stepPublicGallery(delta){ showPublicGalleryImage(PUBLIC_GALLERY_INDEX+Number(delta||0)); }

function publicVideoMime(url=''){
    const clean=String(url||'').split('?')[0].toLowerCase();
    if(clean.endsWith('.webm')) return 'video/webm';
    if(clean.endsWith('.mov')) return 'video/quicktime';
    return 'video/mp4';
}
function publicVideoError(el){
    const box=el?.closest('.public-video-frame');
    if(!box) return;
    const link=el?.dataset?.fallback||'';
    box.innerHTML=`<div class="public-video-fallback"><i class="fas fa-triangle-exclamation"></i><strong>Trình duyệt chưa phát được video này</strong><span>Nếu tệp là MOV/HEVC, hãy đổi sang MP4 H.264 + AAC để phát ổn định trên web.</span>${link?`<a class="btn btn-primary btn-sm" href="${link}" target="_blank" rel="noopener"><i class="fas fa-up-right-from-square"></i> Mở video</a>`:''}</div>`;
}
let PUBLIC_VIDEO_CATEGORY='Tất cả';
let PUBLIC_VIDEO_VISIBLE=[];
function publicVideoPoster(item){
    if(item?.thumbnail_url) return publicSafeMediaUrl(item.thumbnail_url);
    if(item?.media_type==='youtube'){
        const id=publicYouTubeId(item.media_url);
        return id?`https://img.youtube.com/vi/${id}/maxresdefault.jpg`:'';
    }
    return '';
}
function renderPublicVideos(items=[]) {
    const grid=document.getElementById('publicVideoGrid');
    const toolbar=document.getElementById('publicVideoToolbar');
    if(!grid) return;
    const all=(Array.isArray(items)?items:[]).filter(x=>x&&(x.media_type==='video'||x.media_type==='youtube'));
    const categories=['Tất cả',...new Set(all.map(x=>String(x.category||'Khác').trim()).filter(Boolean))];
    if(PUBLIC_VIDEO_CATEGORY!=='Tất cả'&&!categories.includes(PUBLIC_VIDEO_CATEGORY)) PUBLIC_VIDEO_CATEGORY='Tất cả';
    PUBLIC_VIDEO_VISIBLE=PUBLIC_VIDEO_CATEGORY==='Tất cả'?all:all.filter(x=>String(x.category||'Khác').trim()===PUBLIC_VIDEO_CATEGORY);
    if(toolbar) toolbar.innerHTML=`<div class="public-video-filter-label"><i class="fas fa-clapperboard"></i><span>Chuyên mục video</span></div><div class="public-video-filter-chips">${categories.map(cat=>`<button type="button" class="${cat===PUBLIC_VIDEO_CATEGORY?'active':''}" onclick="setPublicVideoCategory('${publicEscape(cat).replace(/'/g,'&#39;')}')">${publicEscape(cat)}</button>`).join('')}</div><span class="public-video-count">${PUBLIC_VIDEO_VISIBLE.length} video</span>`;
    if(!PUBLIC_VIDEO_VISIBLE.length){
        grid.innerHTML='<div class="public-empty-state"><i class="fas fa-circle-play"></i><strong>Chưa có video trong chuyên mục này</strong><span>Hãy chọn chuyên mục khác hoặc quay lại Tất cả.</span></div>';
        return;
    }
    grid.innerHTML=PUBLIC_VIDEO_VISIBLE.slice(0,16).map((item,idx)=>{
        const title=publicEscape(item.title||'Video hoạt động');
        const cat=publicEscape(item.category||'Hoạt động');
        let poster=publicVideoPoster(item);
        if(item.media_type==='youtube'){
            const id=publicYouTubeId(item.media_url); if(!id)return '';
            const fallback=`https://img.youtube.com/vi/${id}/hqdefault.jpg`;
            return `<article class="public-video-card public-video-clickable ${idx===0?'public-video-featured':''}" role="button" tabindex="0" onclick="openPublicVideoModal('${item.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openPublicVideoModal('${item.id}')}" aria-label="Xem ${title}"><div class="public-video-cover"><img src="${poster}" alt="Ảnh bìa ${title}" loading="lazy" onerror="this.onerror=null;this.src='${fallback}'"><span class="public-video-play"><i class="fas fa-play"></i></span><span class="public-video-source youtube"><i class="fab fa-youtube"></i> YouTube</span></div><div class="public-video-info"><small><i class="far fa-folder-open"></i> ${cat}</small><h3>${title}</h3>${item.description?`<p>${publicEscape(item.description)}</p>`:''}<span class="public-video-open-link">Xem video <i class="fas fa-arrow-right"></i></span></div></article>`;
        }
        const url=publicSafeMediaUrl(item.media_url); if(!url)return '';
        return `<article class="public-video-card public-video-clickable ${idx===0?'public-video-featured':''}" role="button" tabindex="0" onclick="openPublicVideoModal('${item.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openPublicVideoModal('${item.id}')}" aria-label="Xem ${title}"><div class="public-video-cover ${poster?'':'no-poster'}">${poster?`<img src="${poster}" alt="Ảnh bìa ${title}" loading="lazy">`:`<video preload="metadata" muted playsinline><source src="${url}" type="${publicVideoMime(item.media_url)}"></video>`}<span class="public-video-play"><i class="fas fa-play"></i></span><span class="public-video-source"><i class="fas fa-video"></i> Video</span></div><div class="public-video-info"><small><i class="far fa-folder-open"></i> ${cat}</small><h3>${title}</h3>${item.description?`<p>${publicEscape(item.description)}</p>`:''}<span class="public-video-open-link">Xem video <i class="fas fa-arrow-right"></i></span></div></article>`;
    }).join('');
}
function setPublicVideoCategory(category='Tất cả'){
    PUBLIC_VIDEO_CATEGORY=String(category||'Tất cả');
    renderPublicVideos(PUBLIC_MEDIA_CACHE.filter(x=>x.media_type==='video'||x.media_type==='youtube'));
}
function openPublicVideoModal(id){
    const modal=document.getElementById('publicVideoModal'), body=document.getElementById('publicVideoModalBody');
    const item=PUBLIC_MEDIA_CACHE.find(x=>String(x.id)===String(id));
    if(!modal||!body||!item)return;
    const title=publicEscape(item.title||'Video hoạt động'), cat=publicEscape(item.category||'Hoạt động');
    if(item.media_type==='youtube'){
        const yid=publicYouTubeId(item.media_url); if(!yid)return;
        const watch=`https://www.youtube.com/watch?v=${yid}`;
        const thumb=`https://img.youtube.com/vi/${yid}/maxresdefault.jpg`;
        const fallback=`https://img.youtube.com/vi/${yid}/hqdefault.jpg`;
        body.innerHTML=`<div class="public-video-modal-player youtube-modal"><img src="${thumb}" alt="Ảnh bìa ${title}" onerror="this.onerror=null;this.src='${fallback}'"><a href="${watch}" target="_blank" rel="noopener" class="public-video-modal-youtube"><i class="fab fa-youtube"></i><span>Phát trên YouTube</span></a></div><div class="public-video-modal-copy"><small><i class="fab fa-youtube"></i> YouTube · ${cat}</small><h2>${title}</h2>${item.description?`<p>${publicEscape(item.description)}</p>`:''}<a class="btn btn-primary" href="${watch}" target="_blank" rel="noopener"><i class="fab fa-youtube"></i> Xem trên YouTube</a></div>`;
    }else{
        const url=publicSafeMediaUrl(item.media_url); if(!url)return;
        body.innerHTML=`<div class="public-video-modal-player"><video controls autoplay playsinline preload="metadata" data-fallback="${url}" onerror="publicVideoError(this)"><source src="${url}" type="${publicVideoMime(item.media_url)}">Trình duyệt không hỗ trợ video.</video></div><div class="public-video-modal-copy"><small><i class="fas fa-video"></i> Video · ${cat}</small><h2>${title}</h2>${item.description?`<p>${publicEscape(item.description)}</p>`:''}<a class="btn btn-secondary" href="${url}" target="_blank" rel="noopener"><i class="fas fa-up-right-from-square"></i> Mở tệp video</a></div>`;
    }
    modal.classList.remove('hidden'); modal.setAttribute('aria-hidden','false'); document.body.classList.add('public-modal-open');
}
function closePublicVideoModal(){
    const modal=document.getElementById('publicVideoModal'), body=document.getElementById('publicVideoModalBody');
    if(body){ const v=body.querySelector('video'); if(v){v.pause();v.removeAttribute('src');} body.innerHTML=''; }
    if(modal){modal.classList.add('hidden');modal.setAttribute('aria-hidden','true');}
    document.body.classList.remove('public-modal-open');
}
function openPublicMediaModal(id){
    const modal=document.getElementById('publicMediaModal');
    if(!modal) return;
    let idx=PUBLIC_GALLERY_VISIBLE.findIndex(x=>x.id===id);
    if(idx<0){ PUBLIC_GALLERY_VISIBLE=PUBLIC_MEDIA_CACHE.filter(x=>x.media_type==='image'&&publicSafeMediaUrl(x.media_url)); idx=PUBLIC_GALLERY_VISIBLE.findIndex(x=>x.id===id); }
    if(idx<0) return;
    showPublicGalleryImage(idx);
    modal.classList.remove('hidden'); modal.setAttribute('aria-hidden','false'); document.body.classList.add('public-modal-open');
}
function closePublicMediaModal(){
    const modal=document.getElementById('publicMediaModal'); if(!modal)return;
    modal.classList.add('hidden'); modal.setAttribute('aria-hidden','true'); document.body.classList.remove('public-modal-open');
}

async function openPublicPostDetail(id) {
    const modal = document.getElementById('publicPostModal');
    const body = document.getElementById('publicPostModalBody');
    if (!modal || !body || !id) return;
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden','false');
    document.body.classList.add('public-modal-open');
    body.innerHTML = '<div class="public-post-loading"><i class="fas fa-spinner fa-spin"></i> Đang tải bài viết...</div>';
    let post = PUBLIC_POST_CACHE.find(x => x.id === id);
    if (!post || post.content === undefined || post.image_url === undefined) {
        const {data,error} = await supabase.from('app3_public_posts').select('*').eq('id',id).maybeSingle();
        if (error || !data) {
            body.innerHTML = `<div class="public-post-error"><i class="fas fa-circle-exclamation"></i><h3>Không mở được bài viết</h3><p>${publicEscape(error?.message || 'Bài viết không tồn tại hoặc chưa được công khai.')}</p><button class="btn btn-primary" onclick="closePublicPostDetail()">Đóng</button></div>`;
            return;
        }
        post = data;
    }
    const related = PUBLIC_POST_CACHE.filter(x => x.id !== post.id).slice(0,3);
    const imageUrl = publicSafeImageUrl(post.image_url);
    const content = String(post.content || post.summary || '').trim();
    const paragraphs = content ? content.split(/\n{2,}|\r?\n/).filter(Boolean).map(t=>`<p>${publicEscape(t)}</p>`).join('') : '<p>Nội dung bài viết đang được cập nhật.</p>';
    body.innerHTML = `<article class="public-post-detail">
        <button class="public-post-back" onclick="closePublicPostDetail()"><i class="fas fa-arrow-left"></i> Quay lại trang chủ</button>
        <div class="public-post-meta"><span>${publicEscape(post.category || 'TIN TỨC')}</span><small><i class="far fa-calendar"></i> ${publicDate(post.published_at || post.created_at)}</small></div>
        <h1>${publicEscape(post.title)}</h1>
        ${post.summary ? `<p class="public-post-lead">${publicEscape(post.summary)}</p>` : ''}
        ${imageUrl ? `<figure class="public-post-hero"><img src="${imageUrl}" alt="${publicEscape(post.title)}"></figure>` : ''}
        <div class="public-post-content">${paragraphs}</div>
        ${related.length ? `<aside class="public-related-posts"><div class="public-related-heading"><span>TIN LIÊN QUAN</span><h2>Có thể bạn quan tâm</h2></div><div class="public-related-grid">${related.map(x=>`<button type="button" onclick="openPublicPostDetail('${x.id}')"><small>${publicEscape(x.category || 'TIN TỨC')} · ${publicDate(x.published_at)}</small><strong>${publicEscape(x.title)}</strong><span>${publicEscape(x.summary || '')}</span></button>`).join('')}</div></aside>` : ''}
    </article>`;
    setTimeout(()=>modal.querySelector('.public-post-back')?.focus(),30);
}
function closePublicPostDetail() {
    const modal = document.getElementById('publicPostModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden','true');
    document.body.classList.remove('public-modal-open');
}
async function showPublicContentEditor(type='post') {
    if (!isAdmin()) return;
    setPublicManagerActiveTab(type);
    const panel=document.getElementById('publicContentAdminPanel'); if(!panel) return;
    const isPost=type==='post', table=isPost?'app3_public_posts':'app3_public_documents';
    panel.innerHTML='<p class="text-muted"><i class="fas fa-spinner fa-spin"></i> Đang tải...</p>';
    const {data,error}=await supabase.from(table).select('*').order('created_at',{ascending:false});
    if(error){panel.innerHTML=`<p class="text-danger">Lỗi: ${publicEscape(error.message)}</p>`;return;}
    panel.innerHTML=`<div class="public-admin-form">
      <input type="hidden" id="publicEditId"><input type="hidden" id="publicEditType" value="${type}">
      <div class="form-grid"><div class="form-group"><label>Tiêu đề</label><input id="publicEditTitle" placeholder="Nhập tiêu đề"></div><div class="form-group"><label>Nhóm</label><input id="publicEditCategory" placeholder="Ví dụ: THÔNG BÁO"></div></div>
      <div class="form-group"><label>${isPost?'Tóm tắt ngắn':'Mô tả'}</label><textarea id="publicEditDescription" rows="3" placeholder="${isPost?'Nội dung ngắn hiển thị trên thẻ tin ở trang chủ.':''}"></textarea></div>
      ${isPost?`<div class="form-group"><label>Nội dung đầy đủ bài viết</label><textarea id="publicEditContent" rows="8" placeholder="Nhập nội dung chi tiết. Có thể xuống dòng để chia đoạn."></textarea></div>
      <div class="form-group public-image-upload-group">
        <label>Ảnh đại diện</label>
        <input id="publicEditImageUrl" type="hidden" data-original-url="" data-remove="false">
        <div class="public-image-upload-box">
          <div id="publicImagePreview" class="public-image-preview empty"><i class="fas fa-image"></i><span>Chưa chọn ảnh</span></div>
          <div class="public-image-upload-actions">
            <label class="btn btn-secondary btn-sm public-image-file-label"><i class="fas fa-upload"></i> Chọn ảnh từ máy<input id="publicEditImageFile" type="file" accept="image/jpeg,image/png,image/webp" onchange="handlePublicPostImageSelection(this)"></label>
            <button type="button" class="btn btn-secondary btn-sm" onclick="clearPublicPostImage()"><i class="fas fa-xmark"></i> Bỏ ảnh</button>
            <small>JPG, PNG hoặc WebP · tối đa 5 MB</small>
          </div>
        </div>
      </div>`:`<div class="form-group"><label>Liên kết tài liệu (URL)</label><input id="publicEditUrl" type="url" placeholder="https://..."></div>`}
      <label class="switch-inline"><input type="checkbox" id="publicEditPublished" checked> <span>Công khai trên website</span></label>
      <div class="flex gap-2 mt-2"><button class="btn btn-primary btn-sm" onclick="savePublicContent()"><i class="fas fa-save"></i> Lưu</button><button class="btn btn-secondary btn-sm" onclick="resetPublicContentForm()">Làm mới</button></div>
    </div><div class="table-wrapper mt-2"><table><thead><tr><th>Tiêu đề</th><th>Nhóm</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${(data||[]).map(x=>`<tr><td><strong>${publicEscape(x.title)}</strong></td><td>${publicEscape(x.category||'')}</td><td>${x.is_published?'Công khai':'Đang ẩn'}</td><td><button class="btn btn-primary btn-sm" onclick='editPublicContent(${JSON.stringify(JSON.stringify(x))},"${type}")'><i class="fas fa-pen"></i></button> <button class="btn btn-danger btn-sm" onclick="deletePublicContent('${x.id}','${type}')"><i class="fas fa-trash"></i></button></td></tr>`).join('')||'<tr><td colspan="4" class="text-muted">Chưa có dữ liệu.</td></tr>'}</tbody></table></div>`;
}
function setPublicPostImagePreview(url='') {
    const box=document.getElementById('publicImagePreview');
    if(!box) return;
    const safe=publicSafeImageUrl(url);
    if(safe){
        box.classList.remove('empty');
        box.innerHTML=`<img src="${safe}" alt="Xem trước ảnh đại diện">`;
    }else{
        box.classList.add('empty');
        box.innerHTML='<i class="fas fa-image"></i><span>Chưa chọn ảnh</span>';
    }
}
function handlePublicPostImageSelection(input){
    const file=input?.files?.[0];
    if(!file) return;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)){
        showToast('Chỉ chấp nhận ảnh JPG, PNG hoặc WebP.','error');
        input.value=''; return;
    }
    if(file.size>PUBLIC_POST_IMAGE_MAX_BYTES){
        showToast('Ảnh vượt quá 5 MB. Vui lòng chọn ảnh nhỏ hơn.','error');
        input.value=''; return;
    }
    const hidden=document.getElementById('publicEditImageUrl');
    if(hidden) hidden.dataset.remove='false';
    const reader=new FileReader();
    reader.onload=()=>setPublicPostImagePreview(reader.result);
    reader.readAsDataURL(file);
}
function clearPublicPostImage(){
    const hidden=document.getElementById('publicEditImageUrl');
    const file=document.getElementById('publicEditImageFile');
    if(hidden){ hidden.value=''; hidden.dataset.remove='true'; }
    if(file) file.value='';
    setPublicPostImagePreview('');
    showToast('Ảnh sẽ được xóa khi bạn bấm Lưu.','info');
}
function publicPostStoragePathFromUrl(url){
    try{
        const marker=`/storage/v1/object/public/${PUBLIC_POST_IMAGE_BUCKET}/`;
        const text=String(url||'');
        const idx=text.indexOf(marker);
        return idx<0?'':decodeURIComponent(text.slice(idx+marker.length).split('?')[0]);
    }catch{return '';}
}
async function uploadPublicPostImage(file){
    if(!file) return '';
    const {data:userData,error:userError}=await supabase.auth.getUser();
    if(userError||!userData?.user) throw new Error('Phiên đăng nhập không hợp lệ.');
    const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';
    const base=(file.name.replace(/\.[^.]+$/,'')||'anh').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,50)||'anh';
    const path=`posts/${userData.user.id}/${Date.now()}-${base}.${ext}`;
    const {error}=await supabase.storage.from(PUBLIC_POST_IMAGE_BUCKET).upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type});
    if(error) throw error;
    const {data}=supabase.storage.from(PUBLIC_POST_IMAGE_BUCKET).getPublicUrl(path);
    if(!data?.publicUrl) throw new Error('Không lấy được URL công khai của ảnh.');
    return data.publicUrl;
}
async function removePublicPostStoredImage(url){
    const path=publicPostStoragePathFromUrl(url);
    if(!path) return;
    const {error}=await supabase.storage.from(PUBLIC_POST_IMAGE_BUCKET).remove([path]);
    if(error) console.warn('Không thể xóa ảnh cũ khỏi Storage:',error);
}
function editPublicContent(json,type){
    const x=JSON.parse(json);
    document.getElementById('publicEditId').value=x.id||'';
    document.getElementById('publicEditTitle').value=x.title||'';
    document.getElementById('publicEditCategory').value=x.category||'';
    document.getElementById('publicEditDescription').value=x.summary||x.description||'';
    document.getElementById('publicEditPublished').checked=x.is_published!==false;
    if(type==='post'){
        document.getElementById('publicEditContent').value=x.content||'';
        const imageHidden=document.getElementById('publicEditImageUrl');
        imageHidden.value=x.image_url||'';
        imageHidden.dataset.originalUrl=x.image_url||'';
        imageHidden.dataset.remove='false';
        const file=document.getElementById('publicEditImageFile'); if(file) file.value='';
        setPublicPostImagePreview(x.image_url||'');
    }else document.getElementById('publicEditUrl').value=x.file_url||'';
}
function resetPublicContentForm(){const type=document.getElementById('publicEditType')?.value||'post';showPublicContentEditor(type);}
async function savePublicContent(){
    if(!isAdmin())return;
    const type=document.getElementById('publicEditType').value,id=document.getElementById('publicEditId').value,title=document.getElementById('publicEditTitle').value.trim(),category=document.getElementById('publicEditCategory').value.trim(),description=document.getElementById('publicEditDescription').value.trim(),is_published=document.getElementById('publicEditPublished').checked;
    if(!title){showToast('Vui lòng nhập tiêu đề.','error');return;}
    const table=type==='post'?'app3_public_posts':'app3_public_documents';
    let payload={title,category,is_published,updated_at:new Date().toISOString()};
    let oldImageUrl='';
    let uploadedImageUrl='';
    if(type==='post'){
        payload.summary=description;
        payload.content=document.getElementById('publicEditContent').value.trim()||null;
        const imageHidden=document.getElementById('publicEditImageUrl');
        oldImageUrl=imageHidden?.dataset?.originalUrl?.trim()||imageHidden?.value?.trim()||'';
        const removeImage=imageHidden?.dataset?.remove==='true';
        const imageFile=document.getElementById('publicEditImageFile')?.files?.[0]||null;
        if(imageFile){
            try{
                showToast('Đang tải ảnh đại diện...','info');
                uploadedImageUrl=await uploadPublicPostImage(imageFile);
                payload.image_url=uploadedImageUrl;
            }catch(err){
                showToast('Không tải được ảnh: '+(err?.message||err),'error');
                return;
            }
        }else payload.image_url=removeImage?null:(imageHidden?.value?.trim()||oldImageUrl||null);
        if(!id) payload.published_at=new Date().toISOString();
    }else{
        payload.description=description;
        payload.file_url=document.getElementById('publicEditUrl').value.trim()||null;
    }
    const q=id?supabase.from(table).update(payload).eq('id',id):supabase.from(table).insert(payload);
    const {error}=await q;
    if(error){
        if(uploadedImageUrl) await removePublicPostStoredImage(uploadedImageUrl);
        showToast('Lỗi lưu nội dung: '+error.message,'error');return;
    }
    if(type==='post' && oldImageUrl){
        const imageHidden=document.getElementById('publicEditImageUrl');
        const removeImage=imageHidden?.dataset?.remove==='true';
        if((uploadedImageUrl && oldImageUrl!==uploadedImageUrl) || removeImage) await removePublicPostStoredImage(oldImageUrl);
    }
    showToast('Đã lưu nội dung website!');
    await showPublicContentEditor(type);
    await loadPublicWebsiteContent();
}
async function deletePublicContent(id,type){
    if(!isAdmin()||!confirm('Xóa nội dung này?'))return;
    const table=type==='post'?'app3_public_posts':'app3_public_documents';
    let imageUrl='';
    if(type==='post'){
        const {data}=await supabase.from(table).select('image_url').eq('id',id).maybeSingle();
        imageUrl=data?.image_url||'';
    }
    const {error}=await supabase.from(table).delete().eq('id',id);
    if(error){showToast('Lỗi xóa: '+error.message,'error');return;}
    if(imageUrl) await removePublicPostStoredImage(imageUrl);
    showToast('Đã xóa nội dung.');
    await showPublicContentEditor(type);
    await loadPublicWebsiteContent();
}


// ============================================================
// WEBSITE PUBLIC - BƯỚC 149.8: THÔNG BÁO + LIÊN KẾT WEBSITE ĐỘNG
// ============================================================
const PUBLIC_LINK_ICON_WHITELIST = new Set(['school','landmark','book-open','globe','video','graduation-cap','link','building-columns','cloud','file-lines']);
function publicLinkIcon(value='link') {
    const icon=String(value||'link').trim().replace(/^fa[srb]?\s+fa-/,'').replace(/^fa-/,'');
    return PUBLIC_LINK_ICON_WHITELIST.has(icon)?icon:'link';
}
function publicSafeExternalUrl(value='') {
    const text=String(value||'').trim();
    if(!text) return '';
    try {
        const u=new URL(text);
        if(!['http:','https:'].includes(u.protocol)) return '';
        return publicEscape(u.href);
    } catch { return ''; }
}

let PUBLIC_LIVE_CLOCK_TIMER = null;

function updatePublicLiveClock(){
    const el = document.getElementById('publicLiveClock');
    if(!el) return;
    const now = new Date();
    const time = new Intl.DateTimeFormat('vi-VN', {
        hour:'2-digit',
        minute:'2-digit',
        second:'2-digit',
        hour12:false
    }).format(now);
    el.innerHTML = `<i class="far fa-clock"></i> ${time}`;
}

function startPublicLiveClock(){
    if(PUBLIC_LIVE_CLOCK_TIMER){
        clearInterval(PUBLIC_LIVE_CLOCK_TIMER);
        PUBLIC_LIVE_CLOCK_TIMER = null;
    }
    updatePublicLiveClock();
    PUBLIC_LIVE_CLOCK_TIMER = setInterval(updatePublicLiveClock, 1000);
}

function renderPublicAnnouncements(items=[]) {
    const box=document.getElementById('publicAnnouncementList');
    if(!box) return;
    const list=(items||[]).slice(0,3);
    if(!list.length){
        box.innerHTML='<span class="u-utility-empty">Chưa có thông báo mới.</span>';
        return;
    }
    box.innerHTML=list.map(x=>{
        const href=publicSafeExternalUrl(x.link_url);
        const tag=x.is_pinned?'<i class="fas fa-thumbtack" title="Đã ghim"></i>':'';
        const body=`<span class="u-announcement-title">${tag}${publicEscape(x.title||'Thông báo')}</span><small>${publicDate(x.published_at||x.created_at)}</small>`;
        return href?`<a class="u-announcement-item" href="${href}" target="_blank" rel="noopener noreferrer">${body}</a>`:`<div class="u-announcement-item">${body}</div>`;
    }).join('');
}
let PUBLIC_QUICK_LINKS_TIMER=null;
let PUBLIC_QUICK_LINKS_INDEX=0;
let PUBLIC_QUICK_LINKS_DATA=[];

function publicQuickLinkHTML(x){
    return `<a href="${publicSafeExternalUrl(x.url)}" target="_blank" rel="noopener noreferrer">
        <i class="fas fa-${publicLinkIcon(x.icon)}"></i>
        <span>${publicEscape(x.title||'Liên kết')}</span>
    </a>`;
}

function paintPublicQuickLinks(){
    const quick=document.getElementById('publicQuickLinks');
    if(!quick) return;

    const list=PUBLIC_QUICK_LINKS_DATA;
    if(!list.length){
        quick.innerHTML='<span class="u-utility-empty">Chưa có liên kết.</span>';
        return;
    }

    // Với <=3 liên kết: hiển thị tĩnh.
    if(list.length<=3){
        quick.innerHTML=`<div class="u-quick-links-static">
            ${list.map(publicQuickLinkHTML).join('')}
        </div>`;
        return;
    }

    // Nhân đôi toàn bộ danh sách để tạo vòng lặp cuộn liên tục, không giật.
    const content=list.map(publicQuickLinkHTML).join('');
    quick.innerHTML=`
        <div class="u-quick-links-marquee">
            <div class="u-quick-links-marquee-track">
                <div class="u-quick-links-marquee-group">${content}</div>
                <div class="u-quick-links-marquee-group" aria-hidden="true">${content}</div>
            </div>
        </div>`;
}

function startPublicQuickLinksRotation(){
    // Giữ tên hàm để không ảnh hưởng logic gọi cũ.
    // Hiệu ứng chuyển sang CSS animation liên tục.
    if(PUBLIC_QUICK_LINKS_TIMER){
        clearInterval(PUBLIC_QUICK_LINKS_TIMER);
        PUBLIC_QUICK_LINKS_TIMER=null;
    }
    paintPublicQuickLinks();
}

function renderPublicLinks(items=[]) {
    const grid=document.getElementById('publicLinksGrid');
    const list=(items||[]).filter(x=>publicSafeExternalUrl(x.url));
    if(grid){
        if(!list.length) grid.innerHTML='<div class="public-empty-state"><i class="fas fa-link"></i><strong>Chưa có liên kết công khai</strong><span>Admin có thể thêm các website giáo dục hữu ích.</span></div>';
        else grid.innerHTML=list.map((x,idx)=>{
            const href=publicSafeExternalUrl(x.url), icon=publicLinkIcon(x.icon);
            const tone=['blue','green','orange','purple','pink','cyan'][idx%6];
            return `<a class="public-link-card tone-${tone}" href="${href}" target="_blank" rel="noopener noreferrer">
                <span class="public-link-icon"><i class="fas fa-${icon}"></i></span>
                <span class="public-link-copy">
                    <b>${publicEscape(x.title||'Liên kết')}</b>
                    <span>${publicEscape(x.description||'Mở website')}</span>
                </span>
                <span class="public-link-arrow" aria-hidden="true"><i class="fas fa-arrow-right"></i></span>
            </a>`;
        }).join('');
    }
    PUBLIC_QUICK_LINKS_DATA=list;
    PUBLIC_QUICK_LINKS_INDEX=0;
    startPublicQuickLinksRotation();
}
function renderPublicUtilityFallback(){
    renderPublicLinks([
        {title:'VNEDU',description:'Hệ thống đang sử dụng của nhà trường',url:'https://ucnnzccazsgdkiengiang.vnedu.vn/v5/',icon:'school'},
        {title:'Bộ Giáo dục và Đào tạo',description:'Cổng thông tin điện tử',url:'https://moet.gov.vn/',icon:'landmark'}
    ]);
    renderPublicAnnouncements([]);
}
async function loadPublicUtilityContent(){
    try{
        const [annRes,linkRes]=await Promise.all([
            supabase.from('app3_public_announcements').select('*').eq('is_published',true).order('is_pinned',{ascending:false}).order('sort_order',{ascending:true}).order('published_at',{ascending:false}).limit(8),
            supabase.from('app3_public_links').select('*').eq('is_published',true).order('sort_order',{ascending:true}).order('created_at',{ascending:false}).limit(20)
        ]);
        if(annRes.error) throw annRes.error;
        if(linkRes.error) throw linkRes.error;
        renderPublicAnnouncements(annRes.data||[]);
        renderPublicLinks(linkRes.data||[]);
    }catch(err){
        console.warn('Chưa tải được thông báo/liên kết công khai:',err);
        renderPublicUtilityFallback();
    }
}
function publicAdminLoadError(panel,error,feature){
    panel.innerHTML=`<div class="public-empty-state"><i class="fas fa-database"></i><strong>Chưa kích hoạt ${publicEscape(feature)}</strong><span>Hãy chạy SQL Bước 149.8 trong Supabase trước. ${publicEscape(error?.message||'')}</span></div>`;
}
async function showPublicAnnouncementEditor(){
    if(!isAdmin()) return;
    setPublicManagerActiveTab('announcement');
    const panel=document.getElementById('publicContentAdminPanel'); if(!panel)return;
    panel.innerHTML='<p class="text-muted"><i class="fas fa-spinner fa-spin"></i> Đang tải thông báo...</p>';
    const {data,error}=await supabase.from('app3_public_announcements').select('*').order('is_pinned',{ascending:false}).order('sort_order',{ascending:true}).order('created_at',{ascending:false});
    if(error){publicAdminLoadError(panel,error,'Thông báo công khai');return;}
    panel.innerHTML=`<div class="public-admin-form">
      <input type="hidden" id="publicAnnouncementEditId">
      <div class="form-grid"><div class="form-group"><label>Tiêu đề thông báo</label><input id="publicAnnouncementTitle" placeholder="Ví dụ: Thông báo họp phụ huynh"></div><div class="form-group"><label>Thứ tự</label><input id="publicAnnouncementSort" type="number" min="0" step="1" value="0"></div></div>
      <div class="form-group"><label>Nội dung ngắn</label><textarea id="publicAnnouncementContent" rows="3" placeholder="Thông tin ngắn gọn hiển thị cho người xem"></textarea></div>
      <div class="form-group"><label>Liên kết chi tiết (không bắt buộc)</label><input id="publicAnnouncementUrl" type="url" placeholder="https://..."></div>
      <div class="form-grid"><label class="switch-inline"><input type="checkbox" id="publicAnnouncementPinned"> <span>Ghim lên đầu</span></label><label class="switch-inline"><input type="checkbox" id="publicAnnouncementPublished" checked> <span>Công khai trên website</span></label></div>
      <div class="flex gap-2 mt-2"><button class="btn btn-primary btn-sm" onclick="savePublicAnnouncement()"><i class="fas fa-save"></i> Lưu thông báo</button><button class="btn btn-secondary btn-sm" onclick="showPublicAnnouncementEditor()">Làm mới</button></div>
    </div><div class="table-wrapper mt-2"><table><thead><tr><th>Thông báo</th><th>Ghim</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${(data||[]).map(x=>`<tr><td><strong>${publicEscape(x.title||'')}</strong><br><small>${publicEscape(x.content||'')}</small></td><td>${x.is_pinned?'Có':'Không'}</td><td>${x.is_published?'Công khai':'Đang ẩn'}</td><td><button class="btn btn-primary btn-sm" onclick='editPublicAnnouncement(${JSON.stringify(JSON.stringify(x))})'><i class="fas fa-pen"></i></button> <button class="btn btn-danger btn-sm" onclick="deletePublicAnnouncement('${x.id}')"><i class="fas fa-trash"></i></button></td></tr>`).join('')||'<tr><td colspan="4" class="text-muted">Chưa có thông báo.</td></tr>'}</tbody></table></div>`;
}
function editPublicAnnouncement(json){
    const x=JSON.parse(json);
    document.getElementById('publicAnnouncementEditId').value=x.id||'';
    document.getElementById('publicAnnouncementTitle').value=x.title||'';
    document.getElementById('publicAnnouncementContent').value=x.content||'';
    document.getElementById('publicAnnouncementUrl').value=x.link_url||'';
    document.getElementById('publicAnnouncementSort').value=Number(x.sort_order)||0;
    document.getElementById('publicAnnouncementPinned').checked=!!x.is_pinned;
    document.getElementById('publicAnnouncementPublished').checked=x.is_published!==false;
}
async function savePublicAnnouncement(){
    if(!isAdmin())return;
    const id=document.getElementById('publicAnnouncementEditId')?.value||'';
    const title=document.getElementById('publicAnnouncementTitle')?.value.trim()||'';
    const content=document.getElementById('publicAnnouncementContent')?.value.trim()||'';
    const typedUrl=document.getElementById('publicAnnouncementUrl')?.value.trim()||'';
    if(!title){showToast('Vui lòng nhập tiêu đề thông báo.','error');return;}
    if(typedUrl&&!publicSafeExternalUrl(typedUrl)){showToast('Liên kết thông báo phải bắt đầu bằng http:// hoặc https://','error');return;}
    const payload={title,content:content||null,link_url:typedUrl||null,is_pinned:!!document.getElementById('publicAnnouncementPinned')?.checked,is_published:!!document.getElementById('publicAnnouncementPublished')?.checked,sort_order:parseInt(document.getElementById('publicAnnouncementSort')?.value||'0',10)||0,updated_at:new Date().toISOString()};
    if(!id) payload.published_at=new Date().toISOString();
    const q=id?supabase.from('app3_public_announcements').update(payload).eq('id',id):supabase.from('app3_public_announcements').insert(payload);
    const {error}=await q;
    if(error){showToast('Lỗi lưu thông báo: '+error.message,'error');return;}
    showToast('Đã lưu thông báo công khai!'); await showPublicAnnouncementEditor(); await loadPublicUtilityContent();
}
async function deletePublicAnnouncement(id){
    if(!isAdmin()||!confirm('Xóa thông báo này?'))return;
    const {error}=await supabase.from('app3_public_announcements').delete().eq('id',id);
    if(error){showToast('Lỗi xóa thông báo: '+error.message,'error');return;}
    showToast('Đã xóa thông báo.'); await showPublicAnnouncementEditor(); await loadPublicUtilityContent();
}
async function showPublicLinkEditor(){
    if(!isAdmin())return;
    setPublicManagerActiveTab('link');
    const panel=document.getElementById('publicContentAdminPanel'); if(!panel)return;
    panel.innerHTML='<p class="text-muted"><i class="fas fa-spinner fa-spin"></i> Đang tải liên kết...</p>';
    const {data,error}=await supabase.from('app3_public_links').select('*').order('sort_order',{ascending:true}).order('created_at',{ascending:false});
    if(error){publicAdminLoadError(panel,error,'Liên kết website');return;}
    panel.innerHTML=`<div class="public-admin-form">
      <input type="hidden" id="publicLinkEditId">
      <div class="form-grid"><div class="form-group"><label>Tên website</label><input id="publicLinkTitle" placeholder="Ví dụ: VNEDU"></div><div class="form-group"><label>Biểu tượng</label><select id="publicLinkIcon"><option value="school">Trường học</option><option value="landmark">Cơ quan</option><option value="book-open">Học liệu</option><option value="graduation-cap">Giáo dục</option><option value="globe">Website</option><option value="video">Video</option><option value="cloud">Dịch vụ trực tuyến</option><option value="link">Liên kết</option></select></div></div>
      <div class="form-group"><label>Mô tả</label><input id="publicLinkDescription" placeholder="Mô tả ngắn về website"></div>
      <div class="form-group"><label>Đường dẫn</label><input id="publicLinkUrl" type="url" placeholder="https://..."></div>
      <div class="form-grid"><div class="form-group"><label>Thứ tự</label><input id="publicLinkSort" type="number" min="0" step="1" value="0"></div><label class="switch-inline"><input type="checkbox" id="publicLinkPublished" checked> <span>Công khai trên website</span></label></div>
      <div class="flex gap-2 mt-2"><button class="btn btn-primary btn-sm" onclick="savePublicLink()"><i class="fas fa-save"></i> Lưu liên kết</button><button class="btn btn-secondary btn-sm" onclick="showPublicLinkEditor()">Làm mới</button></div>
    </div><div class="table-wrapper mt-2"><table><thead><tr><th>Website</th><th>URL</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${(data||[]).map(x=>`<tr><td><strong><i class="fas fa-${publicLinkIcon(x.icon)}"></i> ${publicEscape(x.title||'')}</strong><br><small>${publicEscape(x.description||'')}</small></td><td><a href="${publicSafeExternalUrl(x.url)||'#'}" target="_blank" rel="noopener">Mở</a></td><td>${x.is_published?'Công khai':'Đang ẩn'}</td><td><button class="btn btn-primary btn-sm" onclick='editPublicLink(${JSON.stringify(JSON.stringify(x))})'><i class="fas fa-pen"></i></button> <button class="btn btn-danger btn-sm" onclick="deletePublicLink('${x.id}')"><i class="fas fa-trash"></i></button></td></tr>`).join('')||'<tr><td colspan="4" class="text-muted">Chưa có liên kết.</td></tr>'}</tbody></table></div>`;
}
function editPublicLink(json){
    const x=JSON.parse(json);
    document.getElementById('publicLinkEditId').value=x.id||'';
    document.getElementById('publicLinkTitle').value=x.title||'';
    document.getElementById('publicLinkDescription').value=x.description||'';
    document.getElementById('publicLinkUrl').value=x.url||'';
    document.getElementById('publicLinkIcon').value=publicLinkIcon(x.icon);
    document.getElementById('publicLinkSort').value=Number(x.sort_order)||0;
    document.getElementById('publicLinkPublished').checked=x.is_published!==false;
}
async function savePublicLink(){
    if(!isAdmin())return;
    const id=document.getElementById('publicLinkEditId')?.value||'';
    const title=document.getElementById('publicLinkTitle')?.value.trim()||'';
    const url=document.getElementById('publicLinkUrl')?.value.trim()||'';
    if(!title){showToast('Vui lòng nhập tên website.','error');return;}
    if(!publicSafeExternalUrl(url)){showToast('Đường dẫn website phải bắt đầu bằng http:// hoặc https://','error');return;}
    const payload={title,description:document.getElementById('publicLinkDescription')?.value.trim()||null,url,icon:publicLinkIcon(document.getElementById('publicLinkIcon')?.value),sort_order:parseInt(document.getElementById('publicLinkSort')?.value||'0',10)||0,is_published:!!document.getElementById('publicLinkPublished')?.checked,updated_at:new Date().toISOString()};
    const q=id?supabase.from('app3_public_links').update(payload).eq('id',id):supabase.from('app3_public_links').insert(payload);
    const {error}=await q;
    if(error){showToast('Lỗi lưu liên kết: '+error.message,'error');return;}
    showToast('Đã lưu liên kết website!'); await showPublicLinkEditor(); await loadPublicUtilityContent();
}
async function deletePublicLink(id){
    if(!isAdmin()||!confirm('Xóa liên kết website này?'))return;
    const {error}=await supabase.from('app3_public_links').delete().eq('id',id);
    if(error){showToast('Lỗi xóa liên kết: '+error.message,'error');return;}
    showToast('Đã xóa liên kết.'); await showPublicLinkEditor(); await loadPublicUtilityContent();
}

// ============================================================
// WEBSITE PUBLIC - BƯỚC 149.5: QUẢN LÝ HÌNH ẢNH / VIDEO / YOUTUBE
// ============================================================
function publicMediaStoragePathFromUrl(url){
    try{
        const marker=`/storage/v1/object/public/${PUBLIC_MEDIA_BUCKET}/`;
        const text=String(url||''); const idx=text.indexOf(marker);
        return idx<0?'':decodeURIComponent(text.slice(idx+marker.length).split('?')[0]);
    }catch{return '';}
}
async function uploadPublicVideoResumable(path,file){
    const {data:sessionData,error:sessionError}=await supabase.auth.getSession();
    const token=sessionData?.session?.access_token;
    if(sessionError||!token) throw new Error('Phiên đăng nhập không hợp lệ.');
    let tus;
    try{ tus=await import('https://cdn.jsdelivr.net/npm/tus-js-client@4/+esm'); }
    catch(e){ throw new Error('Không tải được bộ tải video dung lượng lớn. Hãy kiểm tra Internet rồi thử lại.'); }
    const endpoint='https://ohmwphdeeldmlxuuknny.supabase.co/storage/v1/upload/resumable';
    return await new Promise((resolve,reject)=>{
        const upload=new tus.Upload(file,{
            endpoint,
            retryDelays:[0,3000,5000,10000,20000],
            headers:{authorization:`Bearer ${token}`,'x-upsert':'false'},
            uploadDataDuringCreation:true,
            removeFingerprintOnSuccess:true,
            metadata:{bucketName:PUBLIC_MEDIA_BUCKET,objectName:path,contentType:file.type||'video/mp4',cacheControl:'3600'},
            chunkSize:6*1024*1024,
            onError:(err)=>reject(err),
            onProgress:(sent,total)=>{
                const pct=total?Math.round(sent*100/total):0;
                const hint=document.getElementById('publicMediaTypeHint');
                if(hint) hint.textContent=`Đang tải video: ${pct}% (${Math.round(sent/1024/1024)} / ${Math.round(total/1024/1024)} MB)`;
            },
            onSuccess:()=>resolve(true)
        });
        upload.findPreviousUploads().then(prev=>{if(prev?.length)upload.resumeFromPreviousUpload(prev[0]);upload.start();}).catch(()=>upload.start());
    });
}
async function uploadPublicMediaFile(file,mediaType){
    if(!file) return '';
    const allowedImage=['image/jpeg','image/png','image/webp','image/gif'];
    const allowedVideo=['video/mp4','video/webm','video/quicktime'];
    if(mediaType==='image' && !allowedImage.includes(file.type)) throw new Error('Ảnh chỉ hỗ trợ JPG, PNG, WebP hoặc GIF.');
    if(mediaType==='video' && !allowedVideo.includes(file.type)) throw new Error('Video chỉ hỗ trợ MP4, WebM hoặc MOV.');
    if(mediaType==='image' && file.size>PUBLIC_MEDIA_IMAGE_MAX_BYTES) throw new Error('Ảnh vượt quá 10 MB.');
    if(mediaType==='video' && file.size>PUBLIC_MEDIA_VIDEO_MAX_BYTES) throw new Error(`Video vượt quá giới hạn 1 GB (tệp hiện tại khoảng ${Math.ceil(file.size/1024/1024)} MB).`);
    const {data:userData,error:userError}=await supabase.auth.getUser();
    if(userError||!userData?.user) throw new Error('Phiên đăng nhập không hợp lệ.');
    const ext=(file.name.split('.').pop()||(mediaType==='image'?'jpg':'mp4')).toLowerCase().replace(/[^a-z0-9]/g,'');
    const base=(file.name.replace(/\.[^.]+$/,'')||mediaType).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,50)||mediaType;
    const folder=mediaType==='image'?'images':'videos';
    const path=`${folder}/${userData.user.id}/${Date.now()}-${base}.${ext}`;
    if(mediaType==='video' && file.size>=6*1024*1024){
        await uploadPublicVideoResumable(path,file);
    }else{
        const {error}=await supabase.storage.from(PUBLIC_MEDIA_BUCKET).upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type});
        if(error) throw error;
    }
    const {data}=supabase.storage.from(PUBLIC_MEDIA_BUCKET).getPublicUrl(path);
    if(!data?.publicUrl) throw new Error('Không lấy được URL công khai.');
    return data.publicUrl;
}
async function removePublicMediaStoredFile(url){
    const path=publicMediaStoragePathFromUrl(url); if(!path)return;
    const {error}=await supabase.storage.from(PUBLIC_MEDIA_BUCKET).remove([path]);
    if(error) console.warn('Không thể xóa media cũ khỏi Storage:',error);
}
function mediaTypeLabel(type){return type==='image'?'Hình ảnh':type==='youtube'?'YouTube':'Video';}
function updatePublicMediaFormByType(){
    const type=document.getElementById('publicMediaType')?.value||'image';
    const urlGroup=document.getElementById('publicMediaUrlGroup');
    const fileGroup=document.getElementById('publicMediaFileGroup');
    const hint=document.getElementById('publicMediaTypeHint');
    if(urlGroup) urlGroup.style.display=(type==='youtube'||type==='video')?'block':'none';
    if(fileGroup) fileGroup.style.display=(type==='image'||type==='video')?'block':'none';
    const input=document.getElementById('publicMediaFile');
    if(input){
        input.accept=type==='image'?'image/jpeg,image/png,image/webp,image/gif':'video/mp4,video/webm,video/quicktime';
        input.multiple=(type==='image' && !document.getElementById('publicMediaEditId')?.value);
    }
    if(hint) hint.textContent=type==='image'?(document.getElementById('publicMediaEditId')?.value?'Chọn 1 ảnh mới nếu muốn thay ảnh hiện tại (tối đa 10 MB).':'Có thể chọn nhiều ảnh cùng lúc; mỗi ảnh tối đa 10 MB. Tiêu đề chung sẽ tự thêm số thứ tự khi có nhiều ảnh.') : type==='youtube'?'Dán liên kết YouTube; website sẽ tự lấy ảnh bìa video.':'Có thể tải MP4/WebM/MOV (tối đa 1 GB) hoặc dán URL video trực tiếp. Video lớn dùng tải lên resumable.';
}
async function showPublicMediaEditor(){
    if(!isAdmin())return;
    setPublicManagerActiveTab('media');
    const panel=document.getElementById('publicContentAdminPanel'); if(!panel)return;
    panel.innerHTML='<p class="text-muted"><i class="fas fa-spinner fa-spin"></i> Đang tải thư viện...</p>';
    const {data,error}=await supabase.from('app3_public_media').select('*').order('sort_order',{ascending:true}).order('created_at',{ascending:false});
    if(error){panel.innerHTML=`<div class="public-empty-state"><i class="fas fa-database"></i><strong>Chưa kích hoạt thư viện ảnh/video</strong><span>Hãy chạy SQL Bước 149.5 trong Supabase trước. ${publicEscape(error.message)}</span></div>`;return;}
    panel.innerHTML=`<div class="public-admin-form">
      <input type="hidden" id="publicMediaEditId"><input type="hidden" id="publicMediaOriginalUrl">
      <div class="form-grid">
        <div class="form-group"><label>Loại nội dung</label><select id="publicMediaType" onchange="updatePublicMediaFormByType()"><option value="image">Hình ảnh</option><option value="video">Video tải lên / URL</option><option value="youtube">YouTube</option></select></div>
        <div class="form-group"><label>Album / Nhóm</label><input id="publicMediaCategory" placeholder="Ví dụ: Hoạt động học sinh"></div>
      </div>
      <div class="form-group"><label>Tiêu đề</label><input id="publicMediaTitle" placeholder="Nhập tiêu đề ảnh hoặc video"></div>
      <div class="form-group"><label>Mô tả</label><textarea id="publicMediaDescription" rows="3" placeholder="Mô tả ngắn (không bắt buộc)"></textarea></div>
      <div id="publicMediaUrlGroup" class="form-group" style="display:none"><label>Liên kết YouTube / Video</label><input id="publicMediaUrl" type="url" placeholder="https://..."></div>
      <div id="publicMediaFileGroup" class="form-group public-image-upload-group">
        <label>Tệp từ máy / điện thoại</label>
        <label class="btn btn-secondary btn-sm public-image-file-label"><i class="fas fa-upload"></i> Chọn tệp<input id="publicMediaFile" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple></label>
        <small id="publicMediaTypeHint" class="public-media-hint">Có thể chọn nhiều ảnh cùng lúc; mỗi ảnh tối đa 10 MB.</small>
      </div>
      <div class="form-grid"><div class="form-group"><label>Thứ tự</label><input id="publicMediaSortOrder" type="number" value="0" min="0" step="1"></div><div class="form-group"><label>Hiển thị</label><label class="switch-inline"><input type="checkbox" id="publicMediaPublished" checked> <span>Công khai trên website</span></label></div></div>
      <div class="flex gap-2 mt-2"><button class="btn btn-primary btn-sm" onclick="savePublicMedia()"><i class="fas fa-save"></i> Lưu</button><button class="btn btn-secondary btn-sm" onclick="resetPublicMediaForm()">Làm mới</button></div>
    </div>

    <div class="public-media-manager-toolbar mt-2">
      <div class="public-media-manager-summary"><i class="fas fa-images"></i><strong>${(data||[]).filter(x=>x.media_type==='image').length} ảnh</strong><span>· ${(data||[]).length} mục trong thư viện</span></div>
      <div class="public-media-manager-actions">
        <label class="public-media-select-all-label"><input type="checkbox" id="publicMediaSelectAll" onchange="togglePublicMediaSelectAll(this.checked)"><span>Chọn tất cả</span></label>
        <button id="publicMediaBulkDeleteBtn" class="btn btn-danger btn-sm" onclick="deleteSelectedPublicMedia()" disabled><i class="fas fa-trash"></i> Xóa đã chọn <span id="publicMediaSelectedCount">(0)</span></button>
      </div>
    </div>

    <div class="table-wrapper public-media-manager-table"><table><thead><tr><th class="public-media-check-col"></th><th class="public-media-preview-col">Ảnh xem trước</th><th>Loại</th><th>Tiêu đề</th><th>Nhóm</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${(data||[]).map(x=>`<tr><td class="public-media-check-col"><input class="public-media-select" type="checkbox" value="${publicEscape(String(x.id||''))}" onchange="updatePublicMediaBulkState()"></td><td class="public-media-preview-col">${publicMediaAdminPreview(x)}</td><td>${mediaTypeLabel(x.media_type)}</td><td><strong>${publicEscape(x.title||'')}</strong></td><td>${publicEscape(x.category||'')}</td><td>${x.is_published?'Công khai':'Đang ẩn'}</td><td class="public-media-row-actions"><button class="btn btn-primary btn-sm" onclick='editPublicMedia(${JSON.stringify(JSON.stringify(x))})' title="Chỉnh sửa"><i class="fas fa-pen"></i></button> <button class="btn btn-danger btn-sm" onclick="deletePublicMedia('${x.id}')" title="Xóa"><i class="fas fa-trash"></i></button></td></tr>`).join('')||'<tr><td colspan="7" class="text-muted">Chưa có hình ảnh/video.</td></tr>'}</tbody></table></div>`;
    updatePublicMediaFormByType();
    updatePublicMediaBulkState();
}
function publicMediaAdminPreview(item){
    if(!item) return '<span class="public-media-preview-placeholder"><i class="fas fa-photo-film"></i></span>';
    if(item.media_type==='image' && item.media_url){
        const src=publicEscape(item.media_url);
        const alt=publicEscape(item.title||'Ảnh');
        return `<button type="button" class="public-media-thumb-button" onclick="window.open('${src}','_blank','noopener')" title="Mở ảnh gốc"><img class="public-media-admin-thumb" src="${src}" alt="${alt}" loading="lazy" onerror="this.closest('button').innerHTML='<span class=&quot;public-media-preview-placeholder&quot;><i class=&quot;fas fa-image&quot;></i></span>'"></button>`;
    }
    if(item.media_type==='youtube'){
        const yid=publicYouTubeId(item.media_url||'');
        if(yid){
            const src=`https://i.ytimg.com/vi/${yid}/mqdefault.jpg`;
            return `<span class="public-media-thumb-button is-video"><img class="public-media-admin-thumb" src="${src}" alt="YouTube" loading="lazy"><i class="fab fa-youtube public-media-thumb-badge"></i></span>`;
        }
    }
    return `<span class="public-media-preview-placeholder is-video"><i class="fas fa-play"></i></span>`;
}
function getSelectedPublicMediaIds(){return Array.from(document.querySelectorAll('.public-media-select:checked')).map(el=>el.value).filter(Boolean);}
function updatePublicMediaBulkState(){
    const all=Array.from(document.querySelectorAll('.public-media-select'));
    const selected=all.filter(el=>el.checked);
    const selectAll=document.getElementById('publicMediaSelectAll');
    const btn=document.getElementById('publicMediaBulkDeleteBtn');
    const count=document.getElementById('publicMediaSelectedCount');
    if(count) count.textContent=`(${selected.length})`;
    if(btn) btn.disabled=selected.length===0;
    if(selectAll){selectAll.checked=all.length>0&&selected.length===all.length;selectAll.indeterminate=selected.length>0&&selected.length<all.length;}
}
function togglePublicMediaSelectAll(checked){document.querySelectorAll('.public-media-select').forEach(el=>{el.checked=!!checked;});updatePublicMediaBulkState();}
async function deleteSelectedPublicMedia(){
    if(!isAdmin())return;
    const ids=getSelectedPublicMediaIds();
    if(!ids.length){showToast('Chưa chọn ảnh/video để xóa.','warning');return;}
    if(!confirm(`Xóa vĩnh viễn ${ids.length} mục đã chọn khỏi thư viện website?`))return;
    const btn=document.getElementById('publicMediaBulkDeleteBtn');const oldHtml=btn?.innerHTML;
    if(btn){btn.disabled=true;btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Đang xóa...';}
    try{
        const {data:rows,error:readError}=await supabase.from('app3_public_media').select('id,media_url').in('id',ids);if(readError)throw readError;
        const {error:deleteError}=await supabase.from('app3_public_media').delete().in('id',ids);if(deleteError)throw deleteError;
        for(const url of (rows||[]).map(x=>x.media_url).filter(Boolean)){try{await removePublicMediaStoredFile(url);}catch(err){console.warn('Không xóa được tệp Storage:',url,err);}}
        showToast(`Đã xóa ${ids.length} mục khỏi thư viện.`,'success');
        await showPublicMediaEditor();await loadPublicWebsiteContent();
    }catch(err){showToast('Lỗi xóa hàng loạt: '+(err?.message||err),'error');if(btn){btn.disabled=false;btn.innerHTML=oldHtml||'<i class="fas fa-trash"></i> Xóa đã chọn';}}
}

function editPublicMedia(json){
    const x=JSON.parse(json);
    document.getElementById('publicMediaEditId').value=x.id||'';
    document.getElementById('publicMediaOriginalUrl').value=x.media_url||'';
    document.getElementById('publicMediaType').value=x.media_type||'image';
    document.getElementById('publicMediaTitle').value=x.title||'';
    document.getElementById('publicMediaCategory').value=x.category||'';
    document.getElementById('publicMediaDescription').value=x.description||'';
    document.getElementById('publicMediaUrl').value=(x.media_type==='youtube'||x.media_type==='video')?(x.media_url||''):'';
    document.getElementById('publicMediaSortOrder').value=Number.isFinite(Number(x.sort_order))?Number(x.sort_order):0;
    document.getElementById('publicMediaPublished').checked=x.is_published!==false;
    const file=document.getElementById('publicMediaFile'); if(file)file.value='';
    updatePublicMediaFormByType();
}
function resetPublicMediaForm(){showPublicMediaEditor();}
async function savePublicMedia(){
    if(!isAdmin())return;
    const id=document.getElementById('publicMediaEditId')?.value||'';
    const media_type=document.getElementById('publicMediaType')?.value||'image';
    const title=document.getElementById('publicMediaTitle')?.value.trim()||'';
    const category=document.getElementById('publicMediaCategory')?.value.trim()||'';
    const description=document.getElementById('publicMediaDescription')?.value.trim()||'';
    const is_published=!!document.getElementById('publicMediaPublished')?.checked;
    const sort_order=parseInt(document.getElementById('publicMediaSortOrder')?.value||'0',10)||0;
    const oldUrl=document.getElementById('publicMediaOriginalUrl')?.value.trim()||'';
    const typedUrl=document.getElementById('publicMediaUrl')?.value.trim()||'';
    const files=Array.from(document.getElementById('publicMediaFile')?.files||[]);
    const file=files[0]||null;
    if(!title){showToast('Vui lòng nhập tiêu đề.','error');return;}
    if(media_type==='youtube' && !publicYouTubeId(typedUrl||oldUrl)){showToast('Liên kết YouTube chưa đúng. Hỗ trợ youtube.com, youtu.be, Shorts và Live.','error');return;}
    if(media_type==='image' && !files.length && !oldUrl){showToast('Vui lòng chọn ảnh.','error');return;}
    if(media_type==='video' && !file && !typedUrl && !oldUrl){showToast('Vui lòng chọn video hoặc nhập URL video.','error');return;}

    // BƯỚC 151.12: thêm nhiều ảnh website cùng lúc. Chỉ áp dụng khi tạo mới Hình ảnh.
    if(media_type==='image' && !id && files.length>1){
        const uploadedUrls=[];
        try{
            for(let i=0;i<files.length;i++){
                showToast(`Đang tải ảnh ${i+1}/${files.length}...`,'info');
                const url=await uploadPublicMediaFile(files[i],'image');
                uploadedUrls.push(url);
                const itemTitle=files.length>1?`${title} (${i+1})`:title;
                const payload={media_type:'image',title:itemTitle,category:category||null,description:description||null,media_url:url,is_published,sort_order:sort_order+i,updated_at:new Date().toISOString()};
                const {error}=await supabase.from('app3_public_media').insert(payload);
                if(error){await removePublicMediaStoredFile(url);uploadedUrls.pop();throw error;}
            }
        }catch(err){
            showToast(`Đã thêm ${uploadedUrls.length}/${files.length} ảnh. Lỗi ở ảnh tiếp theo: `+(err?.message||err),'error');
            await showPublicMediaEditor(); await loadPublicWebsiteContent();
            return;
        }
        showToast(`Đã thêm thành công ${files.length} hình ảnh lên website!`,'success');
        await showPublicMediaEditor(); await loadPublicWebsiteContent();
        return;
    }

    let uploaded='';
    try{
        if(file){showToast(media_type==='image'?'Đang tải ảnh...':'Đang tải video...','info');uploaded=await uploadPublicMediaFile(file,media_type);}
    }catch(err){showToast('Không tải được tệp: '+(err?.message||err),'error');return;}
    const media_url=uploaded || (media_type==='youtube'?(typedUrl||oldUrl):(typedUrl||oldUrl));
    const payload={media_type,title,category:category||null,description:description||null,media_url,is_published,sort_order,updated_at:new Date().toISOString()};
    const q=id?supabase.from('app3_public_media').update(payload).eq('id',id):supabase.from('app3_public_media').insert(payload);
    const {error}=await q;
    if(error){if(uploaded)await removePublicMediaStoredFile(uploaded);showToast('Lỗi lưu ảnh/video: '+error.message,'error');return;}
    if(uploaded && oldUrl && oldUrl!==uploaded) await removePublicMediaStoredFile(oldUrl);
    showToast('Đã cập nhật ảnh/video trên website!');
    await showPublicMediaEditor(); await loadPublicWebsiteContent();
}
async function deletePublicMedia(id){
    if(!isAdmin()||!confirm('Xóa hình ảnh/video này?'))return;
    const {data}=await supabase.from('app3_public_media').select('media_url').eq('id',id).maybeSingle();
    const {error}=await supabase.from('app3_public_media').delete().eq('id',id);
    if(error){showToast('Lỗi xóa: '+error.message,'error');return;}
    if(data?.media_url) await removePublicMediaStoredFile(data.media_url);
    showToast('Đã xóa hình ảnh/video.'); await showPublicMediaEditor(); await loadPublicWebsiteContent();
}

// ============================================================
// WEBSITE PUBLIC - BƯỚC 140
// ============================================================
function getRealtimeSchoolYear(date = new Date()) {
    const y = date.getFullYear();
    const month = date.getMonth();
    const startYear = month >= 8 ? y : y - 1; // đổi năm học từ 01/09
    return `${startYear}-${startYear + 1}`;
}

function showPublicSite() {
    const publicSite = document.getElementById('publicSite');
    const loginScreen = document.getElementById('loginScreen');
    const app = document.getElementById('app');
    if (publicSite) publicSite.classList.remove('hidden');
    if (loginScreen) {
        loginScreen.classList.add('hidden');
        loginScreen.style.display = 'none';
    }
    if (app) app.classList.add('hidden');
    document.body.classList.remove('app-open');
}

function showLoginFromPublic() {
    const loginScreen = document.getElementById('loginScreen');
    if (!loginScreen) return;
    loginScreen.classList.remove('hidden');
    loginScreen.style.display = 'flex';
    setTimeout(() => document.getElementById('loginUsername')?.focus(), 80);
}

function showAuthenticatedApp() {
    const publicSite = document.getElementById('publicSite');
    const loginScreen = document.getElementById('loginScreen');
    const app = document.getElementById('app');
    if (publicSite) publicSite.classList.add('hidden');
    if (loginScreen) {
        loginScreen.classList.add('hidden');
        loginScreen.style.display = 'none';
    }
    if (app) app.classList.remove('hidden');
    document.body.classList.add('app-open');
    applyRoleBasedNavigation();
}



// ============================================================
// BƯỚC 151.49.3E.3 - THỐNG KÊ LƯỢT TRUY CẬP
// Website công khai: chỉ hiện Tổng lượt.
// Admin Dashboard: Tổng / Hôm nay / 7 ngày / 30 ngày + biểu đồ theo ngày.
// ============================================================
function formatVisitNumber(value) {
    return new Intl.NumberFormat('vi-VN').format(Number(value) || 0);
}

async function loadPublicVisitCount() {
    const badge = document.getElementById('publicVisitBadge');
    const target = document.getElementById('publicVisitTotal');
    if (!target) return;

    try {
        const { data, error } = await supabase.rpc('app3_public_visit_total');
        if (error) throw error;

        const total = Number(data ?? 0);
        target.textContent = formatVisitNumber(total);
        if (badge) badge.classList.add('is-ready');
    } catch (err) {
        console.warn('Không thể tải tổng lượt truy cập:', err);
        target.textContent = '0';
        if (badge) badge.classList.add('is-ready');
    }
}

function getLocalDayStart(date = new Date()) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatVisitDayKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function formatVisitDayLabel(date) {
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
}

async function fetchVisitRowsSince(startDate) {
    const rows = [];
    const pageSize = 1000;
    let from = 0;

    while (true) {
        const { data, error } = await supabase
            .from('app3_site_visits')
            .select('created_at')
            .gte('created_at', startDate.toISOString())
            .order('created_at', { ascending: true })
            .range(from, from + pageSize - 1);

        if (error) throw error;

        const batch = data || [];
        rows.push(...batch);

        if (batch.length < pageSize) break;
        from += pageSize;
    }

    return rows;
}

async function loadAdminVisitStats() {
    const panel = document.getElementById('adminVisitStats');
    if (!panel) return;

    // Dashboard có thể render trước khi quyền tài khoản nạp xong.
    // Chờ quyền rồi mới quyết định hiện/ẩn thống kê.
    if (!APP_STATE.userAccessLoaded) {
        await loadCurrentUserAccess();
    }

    if (!isAdmin()) {
        panel.hidden = true;
        return;
    }

    panel.hidden = false;

    const totalEl = document.getElementById('visitStatTotal');
    const todayEl = document.getElementById('visitStatToday');
    const weekEl = document.getElementById('visitStat7Days');
    const monthEl = document.getElementById('visitStat30Days');
    const statusEl = document.getElementById('visitStatsStatus');

    try {
        if (statusEl) statusEl.textContent = 'Đang cập nhật dữ liệu...';

        const now = new Date();
        const todayStart = getLocalDayStart(now);

        const start30 = new Date(todayStart);
        start30.setDate(start30.getDate() - 29);

        const start7 = new Date(todayStart);
        start7.setDate(start7.getDate() - 6);

        const [{ count: totalCount, error: totalError }, rows] = await Promise.all([
            supabase
                .from('app3_site_visits')
                .select('id', { count: 'exact', head: true }),
            fetchVisitRowsSince(start30)
        ]);

        if (totalError) throw totalError;

        let todayCount = 0;
        let sevenDayCount = 0;
        const dailyCounts = {};

        for (let i = 0; i < 30; i++) {
            const day = new Date(start30);
            day.setDate(start30.getDate() + i);
            dailyCounts[formatVisitDayKey(day)] = 0;
        }

        rows.forEach(row => {
            const visitDate = new Date(row.created_at);
            if (Number.isNaN(visitDate.getTime())) return;

            if (visitDate >= todayStart) todayCount++;
            if (visitDate >= start7) sevenDayCount++;

            const key = formatVisitDayKey(visitDate);
            if (Object.prototype.hasOwnProperty.call(dailyCounts, key)) {
                dailyCounts[key]++;
            }
        });

        if (totalEl) totalEl.textContent = formatVisitNumber(totalCount || 0);
        if (todayEl) todayEl.textContent = formatVisitNumber(todayCount);
        if (weekEl) weekEl.textContent = formatVisitNumber(sevenDayCount);
        if (monthEl) monthEl.textContent = formatVisitNumber(rows.length);

        const canvas = document.getElementById('chartSiteVisits');
        if (canvas && typeof Chart !== 'undefined') {
            if (chartInstances.siteVisits) {
                chartInstances.siteVisits.destroy();
            }

            const labels = [];
            const values = [];
            for (let i = 0; i < 30; i++) {
                const day = new Date(start30);
                day.setDate(start30.getDate() + i);
                labels.push(formatVisitDayLabel(day));
                values.push(dailyCounts[formatVisitDayKey(day)] || 0);
            }

            chartInstances.siteVisits = new Chart(canvas, {
                type: 'line',
                data: {
                    labels,
                    datasets: [{
                        label: 'Lượt truy cập',
                        data: values,
                        borderWidth: 2,
                        tension: 0.32,
                        fill: true,
                        pointRadius: 2,
                        pointHoverRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: context => ` ${formatVisitNumber(context.parsed.y)} lượt`
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { precision: 0 }
                        },
                        x: {
                            ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 10 }
                        }
                    }
                }
            });
        }

        if (statusEl) {
            statusEl.innerHTML = `<i class="far fa-clock"></i> Cập nhật lúc ${now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
        }
    } catch (err) {
        console.warn('Không thể tải thống kê lượt truy cập:', err);
        if (statusEl) statusEl.textContent = 'Không tải được dữ liệu lượt truy cập.';
    }
}


// ============================================================
// BƯỚC 151.49.3E.2 - GHI NHẬN LƯỢT TRUY CẬP WEBSITE CÔNG KHAI
// ============================================================
async function recordPublicSiteVisit() {
    try {
        const storageKey = 'app3_public_visit_session_v1';

        // Trong cùng một tab/phiên: refresh hoặc chuyển mục không tăng lượt mới.
        if (sessionStorage.getItem(storageKey)) return;

        const sessionKey = window.crypto?.randomUUID
            ? window.crypto.randomUUID()
            : `visit_${Date.now()}_${Math.random().toString(36).slice(2)}`;

        const { error } = await supabase
            .from('app3_site_visits')
            .insert({
                session_key: sessionKey,
                page_path: window.location.pathname || '/'
            });

        if (error) {
            console.warn('Không thể ghi nhận lượt truy cập website:', error);
            return;
        }

        // Chỉ đánh dấu sau khi Supabase ghi thành công.
        sessionStorage.setItem(storageKey, sessionKey);
    } catch (err) {
        console.warn('Lỗi ghi nhận lượt truy cập website:', err);
    }
}

function initPublicWebsite() {
    updatePublicTodayLabel();
    setupPublicHero([]);
    loadPublicWebsiteContent();
    recordPublicSiteVisit().finally(loadPublicVisitCount);
    // BƯỚC 150.3.1: Một luồng mở hệ thống dùng chung cho desktop + mobile.
    // Dùng event delegation để nút vẫn hoạt động ổn định trên Safari/Chrome mobile
    // và cả khi giao diện công khai được render/cập nhật lại.
    const openSystemFromPublic = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                const accessOk = await loadCurrentUserAccess();
                if (!accessOk) return;
                showAuthenticatedApp();
                await loadAllData();
                renderPage('dashboard');
                return;
            }
        } catch (e) {
            console.warn('Không thể kiểm tra phiên đăng nhập:', e);
        }
        showLoginFromPublic();
    };

    document.addEventListener('click', (event) => {
        const btn = event.target.closest?.('[data-open-login]');
        if (!btn) return;
        event.preventDefault();
        openSystemFromPublic();
    });

    document.getElementById('loginCloseBtn')?.addEventListener('click', showPublicSite);
    document.getElementById('loginScreen')?.addEventListener('click', (e) => {
        if (e.target?.id === 'loginScreen') showPublicSite();
    });

    // BƯỚC 150.6: menu website tối ưu cho điện thoại/tablet.
    const publicMobileMenuBtn = document.getElementById('publicMobileMenuBtn');
    const publicMobileMenu = document.getElementById('publicMobileMenu');
    const publicMobileMenuClose = document.getElementById('publicMobileMenuClose');
    const setPublicMobileMenu = (open) => {
        if (!publicMobileMenu) return;
        publicMobileMenu.classList.toggle('open', open);
        publicMobileMenu.setAttribute('aria-hidden', open ? 'false' : 'true');
        publicMobileMenuBtn?.setAttribute('aria-expanded', open ? 'true' : 'false');
        document.body.classList.toggle('public-menu-open', open);
    };
    publicMobileMenuBtn?.addEventListener('click', () => setPublicMobileMenu(!publicMobileMenu?.classList.contains('open')));
    publicMobileMenuClose?.addEventListener('click', () => setPublicMobileMenu(false));
    publicMobileMenu?.addEventListener('click', (event) => {
        if (event.target === publicMobileMenu) setPublicMobileMenu(false);
        if (event.target.closest?.('a[href^="#"]')) setPublicMobileMenu(false);
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && publicMobileMenu?.classList.contains('open')) setPublicMobileMenu(false);
    });

    // Kéo xuống đúng vị trí sau header sticky; đồng thời tránh URL hash nhảy giật trên mobile.
    document.querySelectorAll('#publicSite a[href^="#"]').forEach((link) => {
        link.addEventListener('click', (event) => {
            const href = link.getAttribute('href');
            if (!href || href === '#') return;
            const target = document.querySelector(href);
            if (!target) return;
            event.preventDefault();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            history.replaceState(null, '', href);
        });
    });

    const menuBtn = document.getElementById('siteMenuToggle');
    const nav = document.getElementById('siteNav');
    menuBtn?.addEventListener('click', () => nav?.classList.toggle('open'));
    nav?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => nav.classList.remove('open')));

    // BƯỚC 142: Banner tự động 3 nội dung, vẫn giữ phong cách giao diện đã duyệt.
    const heroSlides = [
        {
            eyebrow: '<i class="fas fa-sparkles"></i> Nền tảng quản lý giáo dục hiện đại',
            title: 'HỆ THỐNG<br><span>QUẢN LÝ HỌC SINH</span>',
            description: 'Giải pháp quản lý toàn diện, trực quan và hiệu quả; hỗ trợ giáo viên theo dõi học sinh, đánh giá, điểm danh và báo cáo trong một hệ thống thống nhất.'
        },
        {
            eyebrow: '<i class="fas fa-chart-line"></i> Theo dõi học sinh khoa học và trực quan',
            title: 'DỮ LIỆU<br><span>THỐNG NHẤT & DỄ THEO DÕI</span>',
            description: 'Quản lý hồ sơ, điểm đánh giá, chuyên cần, nhận xét và báo cáo theo lớp - môn học với quy trình rõ ràng, thuận tiện cho giáo viên.'
        },
        {
            eyebrow: '<i class="fas fa-user-shield"></i> Phân quyền theo đúng phạm vi giảng dạy',
            title: 'AN TOÀN<br><span>LINH HOẠT & CHUYÊN NGHIỆP</span>',
            description: 'Hỗ trợ Admin, Teacher và Viewer; kiểm soát truy cập theo lớp và môn học để dữ liệu được sử dụng đúng vai trò trong nhà trường.'
        }
    ];
    let heroSlideIndex = 0;
    let heroSlideTimer = null;
    const heroCopy = document.querySelector('.hero-copy');
    const heroEyebrow = document.getElementById('heroEyebrow');
    const heroTitle = document.getElementById('heroTitle');
    const heroDescription = document.getElementById('heroDescription');
    const heroDots = [...document.querySelectorAll('[data-hero-slide]')];
    const renderHeroSlide = (index) => {
        heroSlideIndex = (index + heroSlides.length) % heroSlides.length;
        const slide = heroSlides[heroSlideIndex];
        heroCopy?.classList.add('hero-changing');
        setTimeout(() => {
            if (heroEyebrow) heroEyebrow.innerHTML = slide.eyebrow;
            if (heroTitle) heroTitle.innerHTML = slide.title;
            if (heroDescription) heroDescription.textContent = slide.description;
            heroDots.forEach((dot, i) => dot.classList.toggle('active', i === heroSlideIndex));
            heroCopy?.classList.remove('hero-changing');
        }, 180);
    };
    const restartHeroTimer = () => {
        clearInterval(heroSlideTimer);
        heroSlideTimer = setInterval(() => renderHeroSlide(heroSlideIndex + 1), 6500);
    };
    document.getElementById('heroPrev')?.addEventListener('click', () => { renderHeroSlide(heroSlideIndex - 1); restartHeroTimer(); });
    document.getElementById('heroNext')?.addEventListener('click', () => { renderHeroSlide(heroSlideIndex + 1); restartHeroTimer(); });
    heroDots.forEach((dot, i) => dot.addEventListener('click', () => { renderHeroSlide(i); restartHeroTimer(); }));
    restartHeroTimer();

    // Menu active theo vị trí cuộn + nút về đầu trang.
    const siteHeader = document.querySelector('.site-header');
    const backToTop = document.getElementById('publicBackToTop');
    const navLinks = [...document.querySelectorAll('#publicSite .public-desktop-nav a[href^="#"], #publicSite .u-side-nav a[href^="#"], #publicSite .public-mobile-menu a[href^="#"]')];
    const updatePublicScrollUI = () => {
        const y = window.scrollY || 0;
        siteHeader?.classList.toggle('scrolled', y > 10);
        backToTop?.classList.toggle('show', y > 500);
        let activeId = 'trang-chu';
        navLinks.forEach(link => {
            const id = link.getAttribute('href')?.slice(1);
            const section = id ? document.getElementById(id) : null;
            if (section && section.getBoundingClientRect().top <= 130) activeId = id;
        });
        navLinks.forEach(link => link.classList.toggle('active', link.getAttribute('href') === '#' + activeId));
    };
    window.addEventListener('scroll', updatePublicScrollUI, { passive: true });
    updatePublicScrollUI();
    backToTop?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

    // BƯỚC 148.5.8: cố định năm học hiện hành trên website công khai.
    // Không đọc schoolYear cũ từ localStorage để tránh 2025-2026 ghi đè nội dung mới.
    const publicSchoolYearEl = document.getElementById('publicSchoolYear');
    if (publicSchoolYearEl) publicSchoolYearEl.textContent = getRealtimeSchoolYear();

    // Đồng bộ lại cấu hình cục bộ để các lần mở sau không còn giữ năm học cũ.
    try {
        const localSettings = JSON.parse(localStorage.getItem('settings') || '{}');
        localSettings.schoolName = 'Trường Tiểu học-Trung học Cơ sở & Trung học phổ thông Lại Sơn_Phân hiệu trường Tiểu học Trần Quốc Toản';
        localSettings.schoolYear = '2026-2027';
        localStorage.setItem('settings', JSON.stringify(localSettings));
    } catch (_) {}
}

function initLogin() {
    document.getElementById('loginForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value.trim();
        if (!username || !password) {
            showToast('Vui lòng nhập đầy đủ thông tin.', 'error');
            return;
        }
        showLoading();
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: username,
                password: password
            });
            if (error) throw error;
            const accessOk = await loadCurrentUserAccess();
            if (!accessOk) return;
            showAuthenticatedApp();
            if (document.getElementById('rememberMe').checked) {
                localStorage.setItem('remembered', 'true');
            }
            showToast('Đăng nhập thành công!');
            await loadAllData();
            renderPage('dashboard');
        } catch (err) {
            showToast('Đăng nhập thất bại: ' + err.message, 'error');
        } finally {
            hideLoading();
        }
    });

    document.getElementById('togglePassword').addEventListener('click', function() {
        const input = document.getElementById('loginPassword');
        const icon = this.querySelector('i');
        if (input.type === 'password') {
            input.type = 'text';
            icon.className = 'fas fa-eye-slash';
        } else {
            input.type = 'password';
            icon.className = 'fas fa-eye';
        }
    });

    document.getElementById('forgotPassword').addEventListener('click', function(e) {
        e.preventDefault();
        const email = prompt('Nhập email để đặt lại mật khẩu:');
        if (email) {
            supabase.auth.resetPasswordForEmail(email)
                .then(({ error }) => {
                    if (error) throw error;
                    showToast('Email đặt lại mật khẩu đã được gửi.', 'info');
                })
                .catch(err => showToast('Lỗi: ' + err.message, 'error'));
        }
    });

    document.getElementById('logoutBtn').addEventListener('click', async function() {
        await supabase.auth.signOut();
        APP_STATE.currentUserId = null;
        APP_STATE.currentUserEmail = '';
        APP_STATE.currentUserDisplayName = '';
        APP_STATE.currentUserRole = 'teacher';
        APP_STATE.currentUserActive = false;
        APP_STATE.currentUserAccessScope = 'all';
        APP_STATE.currentUserAssignments = [];
        APP_STATE.userAccessLoaded = false;
        showPublicSite();
        showToast('Đã đăng xuất.', 'info');
    });

    // BƯỚC 141: Khi tải lại trang luôn ưu tiên hiển thị website công khai.
    // Nếu phiên đăng nhập vẫn còn, người dùng chỉ cần bấm "Vào hệ thống" để vào app
    // mà không phải đăng nhập lại. Không tự động che mất trang chủ.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
        showPublicSite();
        if (session) {
            await loadCurrentUserAccess();
            const headerBtn = document.querySelector('.site-login-btn[data-open-login]');
            if (headerBtn) headerBtn.innerHTML = '<i class="fas fa-right-to-bracket"></i> Vào hệ thống';
        }
    });

    document.getElementById('publicHomeBtn')?.addEventListener('click', () => {
        showPublicSite();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// ============================================================
// 21. KHỞI ĐỘNG
// ============================================================


// ============================================================
// 18. NÂNG CẤP QUẢN TRỊ: MÔN HỌC, BÁO CÁO, IMPORT, BACKUP, PHÂN QUYỀN
// ============================================================
async function saveSubjectConfig(subjectId) {
    // Cấu hình danh mục môn học là quyền quản trị hệ thống: chỉ Admin được phép thay đổi.
    if (!isAdmin()) {
        showToast('Chỉ tài khoản Admin được thay đổi cấu hình môn học.', 'error');
        return;
    }
    const source = APP_STATE.allSubjectCatalog.find(s => s.id === subjectId);
    if (!source) return;
    const grades = [...document.querySelectorAll(`.subject-grade[data-subject-id="${subjectId}"]:checked`)].map(el => Number(el.value));
    const active = !!document.getElementById(`subjectActive_${subjectId}`)?.checked;
    if (!grades.length) { showToast('Mỗi môn phải áp dụng ít nhất một khối.', 'error'); return; }
    try {
        const { error } = await supabase.from('app3_subjects').update({ grades, active, updated_at: new Date().toISOString() }).eq('id', subjectId);
        if (error) throw error;
        source.grades = grades; source.active = active;
        APP_STATE.subjectCatalog = APP_STATE.allSubjectCatalog.filter(s => s.active !== false);
        const activeNames = APP_STATE.subjectCatalog.map(s => s.name);
        ['currentSubject','studentSubject','statSubject','searchSubject'].forEach(key => {
            if (APP_STATE[key] && !activeNames.includes(APP_STATE[key])) APP_STATE[key] = activeNames[0] || '';
        });
        showToast(`Đã cập nhật môn ${source.name}!`);
        renderPage('settings');
    } catch (err) { showToast('Không thể cập nhật môn học: ' + err.message, 'error'); }
}

function getAdvancedReportRows() {
    const subject = document.getElementById('advancedReportSubject')?.value || APP_STATE.statSubject || APP_STATE.currentSubject;
    const className = document.getElementById('advancedReportClass')?.value || '';
    return APP_STATE.students.filter(s => !className || s.class === className).map(s => {
        const sc = APP_STATE.scores[s.id]?.[subject] || {};
        return {'Mã HS':s.id,'Họ tên':s.fullName,'Lớp':s.class,'Khối':s.grade,'Môn':subject,'Giữa kỳ 1':sc.giuaKy1||'','Cuối kỳ 1':sc.cuoiKy1??'','Giữa kỳ 2':sc.giuaKy2||'','Cuối kỳ 2':sc.cuoiKy2??'','Năng lực':sc.competence||'','Phẩm chất':sc.quality||''};
    });
}
function exportAdvancedReport() {
    const rows = getAdvancedReportRows();
    if (!rows.length) { showToast('Không có dữ liệu để xuất.', 'warning'); return; }
    const wb=XLSX.utils.book_new(), ws=XLSX.utils.json_to_sheet(rows); XLSX.utils.book_append_sheet(wb,ws,'Bao cao');
    XLSX.writeFile(wb,`Bao_cao_${rows[0]['Môn']}_${new Date().toISOString().slice(0,10)}.xlsx`);
}
function downloadScoreImportTemplate() {
    const subject = APP_STATE.currentSubject;
    const className = document.getElementById('exportScoreClass')?.value || '';

    if (!className) {
        showToast('Vui lòng chọn lớp trước khi tải mẫu nhập điểm.', 'warning');
        return;
    }

    const classStudents = APP_STATE.students.filter(s => s.class === className);
    if (!classStudents.length) {
        showToast(`Không có học sinh trong lớp ${className}.`, 'warning');
        return;
    }

    const rows = classStudents.map(s => {
        const sc = APP_STATE.scores[s.id]?.[subject] || {};
        return {
            'Mã HS': s.id,
            'Họ tên': s.fullName,
            'Lớp': s.class,
            'Môn': subject,
            'Giữa kỳ 1': sc.giuaKy1 || '',
            'Cuối kỳ 1': sc.cuoiKy1 ?? '',
            'Giữa kỳ 2': sc.giuaKy2 || '',
            'Cuối kỳ 2': sc.cuoiKy2 ?? '',
            'Năng lực': sc.competence || '',
            'Phẩm chất': sc.quality || ''
        };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, subject.slice(0, 31));
    const safeClass = className.replace(/[^a-zA-Z0-9À-ỹ_-]/g, '_');
    const safeSubject = subject.replace(/[^a-zA-Z0-9À-ỹ_-]/g, '_');
    XLSX.writeFile(wb, `Mau_nhap_diem_${safeSubject}_${safeClass}.xlsx`);
}

async function importScoresExcel(event) {
    if (!requireEditPermission('import điểm')) { if (event?.target) event.target.value = ''; return; }
    const file = event.target.files?.[0];
    if (!file) return;

    try {
        const selectedClass = document.getElementById('exportScoreClass')?.value || '';
        if (!selectedClass) {
            throw new Error('Vui lòng chọn đúng lớp trước khi nhập điểm Excel.');
        }

        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
        const subject = APP_STATE.currentSubject;
        const subjectId = getSubjectId(subject);
        const payload = [];
        const invalidRows = [];

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const excelRow = i + 2;
            const code = String(row['Mã HS'] || '').trim();
            const rowClass = String(row['Lớp'] || '').trim();
            const rowSubject = String(row['Môn'] || '').trim();
            const st = APP_STATE.students.find(s => String(s.id) === code);

            if (!code || !st?.db_uuid) {
                invalidRows.push(`dòng ${excelRow}: Mã HS không hợp lệ`);
                continue;
            }
            if (st.class !== selectedClass || rowClass !== selectedClass) {
                invalidRows.push(`dòng ${excelRow}: học sinh/lớp không khớp lớp ${selectedClass}`);
                continue;
            }
            if (rowSubject && rowSubject !== subject) {
                invalidRows.push(`dòng ${excelRow}: môn trong file là ${rowSubject}, không phải ${subject}`);
                continue;
            }

            payload.push({
                student_id: st.db_uuid,
                subject,
                subject_id: subjectId,
                giua_ky_1: String(row['Giữa kỳ 1'] || ''),
                cuoi_ky_1: row['Cuối kỳ 1'] === '' ? null : Number(row['Cuối kỳ 1']),
                giua_ky_2: String(row['Giữa kỳ 2'] || ''),
                cuoi_ky_2: row['Cuối kỳ 2'] === '' ? null : Number(row['Cuối kỳ 2']),
                competence: String(row['Năng lực'] || ''),
                quality: String(row['Phẩm chất'] || '')
            });
        }

        if (invalidRows.length) {
            throw new Error(`File có ${invalidRows.length} dòng không hợp lệ. ${invalidRows.slice(0, 3).join('; ')}${invalidRows.length > 3 ? '; ...' : ''}`);
        }
        if (!payload.length) throw new Error('Không tìm thấy dữ liệu điểm hợp lệ trong file.');

        const { error } = await supabase
            .from('app3_scores')
            .upsert(payload, { onConflict: 'student_id,subject' });
        if (error) throw error;

        showToast(`Đã nhập ${payload.length} dòng điểm môn ${subject} - lớp ${selectedClass}!`);
        await loadAllData();
        renderPage('scores');
    } catch (err) {
        showToast('Lỗi nhập điểm Excel: ' + err.message, 'error');
    } finally {
        event.target.value = '';
    }
}
// BƯỚC 151.11: backup mới dùng V2 và bao gồm đầy đủ 5 bảng nội dung website công khai.
const BACKUP_FORMAT = 'QLHS_BACKUP_V2';
const LEGACY_BACKUP_FORMAT = 'QLHS_BACKUP_V1';
const LEGACY_BACKUP_TABLES=['app3_subjects','app3_classes','app3_students','app3_scores','app3_attendance','app3_rewards','app3_disciplines','app3_learning_comments','app3_files','app3_settings','app3_public_posts','app3_public_documents','app3_public_announcements','app3_public_links'];
const BACKUP_TABLES=[...LEGACY_BACKUP_TABLES,'app3_public_media'];

// BƯỚC 151.11.4: tránh treo 14/15 khi sao lưu app3_students có avatar base64.
// 1) Lấy 1 dòng mẫu để tự nhận biết cấu trúc bảng, rồi tải toàn bộ cột TRỪ avatar_url trong một request nhẹ.
// 2) Tải riêng id + avatar_url theo lô nhỏ TUẦN TỰ, tránh dồn nhiều response base64 cùng lúc.
// 3) Ghép avatar trở lại từng học sinh trước khi tạo JSON => backup vẫn đầy đủ dữ liệu.
function backupDelay(ms){
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function backupQueryWithTimeout(query, label, timeoutMs = 20000, retries = 1){
    let lastError = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const result = await Promise.race([
                Promise.resolve(query()),
                new Promise((_, reject) => setTimeout(() => reject(new Error(`${label}: quá thời gian ${Math.round(timeoutMs/1000)} giây`)), timeoutMs))
            ]);
            if (result?.error) throw new Error(`${label}: ${result.error.message}`);
            return result;
        } catch (err) {
            lastError = err;
            if (attempt < retries) await backupDelay(250);
        }
    }
    throw lastError;
}

async function fetchBackupStudents(onProgress){
    const sampleResult = await backupQueryWithTimeout(
        () => supabase.from('app3_students').select('*').limit(1),
        'app3_students (đọc cấu trúc)'
    );
    const sample = sampleResult.data?.[0] || null;
    if (!sample) {
        if (onProgress) onProgress(0, 0);
        return [];
    }

    // Tự lấy mọi cột hiện có, chỉ loại avatar_url khỏi request lớn.
    const baseColumns = Object.keys(sample).filter(key => key !== 'avatar_url');
    if (!baseColumns.includes('id')) throw new Error('app3_students: không tìm thấy cột id');

    const baseResult = await backupQueryWithTimeout(
        () => supabase.from('app3_students').select(baseColumns.join(',')).order('id', { ascending: true }),
        'app3_students (dữ liệu không ảnh)'
    );
    const students = baseResult.data || [];
    const total = students.length;
    if (!total) {
        if (onProgress) onProgress(0, 0);
        return [];
    }

    const byId = new Map(students.map(row => [String(row.id), row]));

    // BƯỚC 151.11.5: chỉ tải những học sinh thực sự có ảnh.
    // Trước đây chia theo toàn bộ 443 học sinh, nên chỉ cần một lô có vài ảnh base64 lớn
    // cũng có thể vượt timeout. Nay lọc avatar_url khác null/rỗng và giảm lô còn 5 ảnh.
    const countResult = await backupQueryWithTimeout(
        () => supabase
            .from('app3_students')
            .select('id', { count: 'exact', head: true })
            .not('avatar_url', 'is', null)
            .neq('avatar_url', ''),
        'app3_students (đếm ảnh)',
        30000,
        1
    );
    const avatarTotal = Number(countResult.count || 0);
    const avatarPageSize = 5;
    let avatarLoaded = 0;

    if (onProgress) onProgress(0, avatarTotal, total);

    for (let from = 0; from < avatarTotal; from += avatarPageSize) {
        const to = Math.min(from + avatarPageSize - 1, avatarTotal - 1);
        const pageResult = await backupQueryWithTimeout(
            () => supabase
                .from('app3_students')
                .select('id, avatar_url')
                .not('avatar_url', 'is', null)
                .neq('avatar_url', '')
                .order('id', { ascending: true })
                .range(from, to),
            `app3_students (ảnh ${from + 1}-${to + 1}/${avatarTotal})`,
            60000,
            2
        );
        const pageRows = pageResult.data || [];
        for (const avatarRow of pageRows) {
            const target = byId.get(String(avatarRow.id));
            if (target) target.avatar_url = avatarRow.avatar_url ?? null;
        }
        avatarLoaded = Math.min(to + 1, avatarTotal);
        if (onProgress) onProgress(avatarLoaded, avatarTotal, total);
        // Nhường một nhịp cho trình duyệt để UI cập nhật tiến độ.
        await backupDelay(0);
    }

    // Bảo đảm khóa avatar_url luôn tồn tại trong JSON kể cả dữ liệu trống.
    for (const row of students) {
        if (!Object.prototype.hasOwnProperty.call(row, 'avatar_url')) row.avatar_url = null;
    }
    return students;
}

async function fetchBackupTable(table, onProgress){
    if (table === 'app3_students') return fetchBackupStudents(onProgress);
    const { data, error } = await supabase.from(table).select('*');
    if (error) throw new Error(`${table}: ${error.message}`);
    return data || [];
}

async function backupAllData(){
    if (!requireAdminPermission('sao lưu dữ liệu')) return;

    const button = document.getElementById('backupJsonBtn');
    const originalHtml = button?.innerHTML || '';
    if (button) {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang sao lưu...';
    }
    showToast('Đang tạo file sao lưu, vui lòng chờ...', 'info', 3000);

    try {
        const backup = { format: BACKUP_FORMAT, created_at: new Date().toISOString(), tables: {} };
        let completed = 0;

        // Các bảng chạy song song; riêng Học sinh được chia lô để tải avatar nhanh hơn.
        const results = await Promise.all(BACKUP_TABLES.map(async table => {
            const rows = await fetchBackupTable(table, (loaded, avatarTotal, studentTotal) => {
                if (button && table === 'app3_students') {
                    button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Ảnh HS ${loaded}/${avatarTotal || 0}`;
                    if (loaded === 0 && avatarTotal === 0 && studentTotal) {
                        button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Đang xử lý ${studentTotal} HS`;
                    }
                }
            });
            completed += 1;
            if (button) {
                button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Đang sao lưu ${completed}/${BACKUP_TABLES.length}`;
            }
            return [table, rows];
        }));
        for (const [table, rows] of results) backup.tables[table] = rows;

        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `QLHS_backup_${new Date().toISOString().slice(0,10)}.json`;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        a.remove();
        // Không thu hồi URL ngay lập tức để tránh trình duyệt hủy tải xuống.
        setTimeout(() => URL.revokeObjectURL(url), 1500);

        showToast('Sao lưu dữ liệu thành công!', 'success', 2500);
    } catch (err) {
        console.error('BACKUP ERROR:', err);
        showToast('Lỗi sao lưu: ' + (err?.message || err), 'error', 5000);
    } finally {
        if (button) {
            button.disabled = false;
            button.innerHTML = originalHtml;
        }
    }
}
function validateBackupFile(backup) {
    if (!backup || !backup.tables || typeof backup.tables !== 'object') {
        throw new Error('File sao lưu không đúng cấu trúc.');
    }
    const isV2 = backup.format === BACKUP_FORMAT;
    const isLegacyV1 = backup.format === LEGACY_BACKUP_FORMAT;
    if (!isV2 && !isLegacyV1) {
        throw new Error(`File sao lưu không đúng định dạng ${BACKUP_FORMAT} hoặc ${LEGACY_BACKUP_FORMAT}.`);
    }
    const requiredTables = isV2 ? BACKUP_TABLES : LEGACY_BACKUP_TABLES;
    const missing = requiredTables.filter(table => !Array.isArray(backup.tables[table]));
    if (missing.length) throw new Error(`File sao lưu thiếu dữ liệu bảng: ${missing.join(', ')}`);
    const summaryTables = isV2 ? BACKUP_TABLES : LEGACY_BACKUP_TABLES;
    const legacyNote = isLegacyV1 ? '\n\nLưu ý: đây là backup V1 cũ, chưa có app3_public_media; dữ liệu Thư viện ảnh/video hiện tại sẽ được giữ nguyên khi Full Restore.' : '';
    return summaryTables.map(table => `${table}: ${backup.tables[table].length}`).join('\n') + legacyNote;
}
async function mergeBackupData(event){
    if (!requireAdminPermission('hợp nhất dữ liệu sao lưu')) { if (event?.target) event.target.value = ''; return; }
    const file=event.target.files?.[0];if(!file)return;
    try{
        const backup=JSON.parse(await file.text());
        const summary=validateBackupFile(backup);
        const ok=await showModal('Xác nhận hợp nhất dữ liệu',`File: ${file.name}\nTạo lúc: ${backup.created_at||'Không rõ'}\n\n${summary}\n\nDữ liệu trong file sẽ được ghi đè/thêm theo khóa hiện có. Dữ liệu khác KHÔNG bị xóa.`,`Hợp nhất`,`Hủy`);
        if(!ok)return;
        const order=['app3_classes','app3_students','app3_subjects','app3_scores','app3_attendance','app3_rewards','app3_disciplines','app3_learning_comments','app3_files','app3_settings','app3_public_posts','app3_public_documents','app3_public_announcements','app3_public_links','app3_public_media'];
        for(const table of order){const rows=backup.tables[table]||[];if(!rows.length)continue;const opts=table==='app3_scores'?{onConflict:'student_id,subject'}:undefined;const q=opts?supabase.from(table).upsert(rows,opts):supabase.from(table).upsert(rows);const {error}=await q;if(error)throw new Error(`${table}: ${error.message}`);}
        showToast('Hợp nhất dữ liệu thành công!');await loadAllData();renderPage('settings');
    }catch(err){showToast('Lỗi hợp nhất dữ liệu: '+err.message,'error');}finally{event.target.value='';}
}
async function fullRestoreBackupData(event){
    if (!requireAdminPermission('khôi phục toàn bộ dữ liệu')) { if (event?.target) event.target.value = ''; return; }
    const file=event.target.files?.[0];if(!file)return;
    try{
        const backup=JSON.parse(await file.text());
        const summary=validateBackupFile(backup);
        const ok=await showModal('CẢNH BÁO: Khôi phục toàn bộ',`File: ${file.name}\nTạo lúc: ${backup.created_at||'Không rõ'}\n\n${summary}\n\nCác bảng nghiệp vụ sẽ trở về đúng snapshot này. Bản ghi tạo sau thời điểm backup và không có trong file SẼ BỊ XÓA. Thao tác được chạy trong một transaction Supabase.`,`Khôi phục toàn bộ`,`Hủy`);
        if(!ok)return;
        const {data,error}=await supabase.rpc('app3_full_restore_backup',{p_backup:backup,p_confirmation:'FULL_RESTORE'});
        if(error)throw error;
        showToast('Khôi phục toàn bộ thành công!');
        await loadAllData();renderPage('settings');
    }catch(err){showToast('Lỗi khôi phục toàn bộ: '+err.message,'error');}finally{event.target.value='';}
}
// Tương thích với tên hàm cũ nếu có nơi khác còn gọi.
const restoreAllData = mergeBackupData;
function escapeRoleHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getAssignmentPairKey(subjectId, classId) {
    return `${subjectId}::${classId}`;
}

function renderAssignmentMatrix(userId, assignmentRows = []) {
    const selected = new Set(
        assignmentRows
            .filter(row => row.active !== false)
            .map(row => getAssignmentPairKey(row.subject_id, row.class_id))
    );

    const subjects = (APP_STATE.subjectCatalog || []).filter(subject => subject.active !== false);
    const classes = APP_STATE.classes || [];

    if (!subjects.length || !classes.length) {
        return '<p class="text-muted">Chưa có đủ danh mục môn học hoặc lớp để phân công.</p>';
    }

    const header = classes.map(cls => `<th style="text-align:center;white-space:nowrap">${escapeRoleHtml(cls.name)}</th>`).join('');
    const rows = subjects.map(subject => {
        const allowedGrades = Array.isArray(subject.grades) ? subject.grades.map(String) : [];
        const cells = classes.map(cls => {
            const classGrade = String(cls.grade ?? '');
            const validPair = !allowedGrades.length || allowedGrades.includes(classGrade);
            if (!validPair) {
                return '<td style="text-align:center"><span class="text-muted" title="Môn này không áp dụng cho khối của lớp">—</span></td>';
            }
            const key = getAssignmentPairKey(subject.id, cls.id);
            const checked = selected.has(key) ? 'checked' : '';
            return `<td style="text-align:center"><input type="checkbox" data-assignment-user="${userId}" data-subject-id="${subject.id}" data-class-id="${cls.id}" ${checked} title="${escapeRoleHtml(subject.name)} - ${escapeRoleHtml(cls.name)}"></td>`;
        }).join('');
        return `<tr><td style="white-space:nowrap"><strong>${escapeRoleHtml(subject.name)}</strong></td>${cells}</tr>`;
    }).join('');

    return `
        <div class="assignment-toolbar" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px">
            <strong>Phân công Môn – Lớp</strong>
            <button type="button" class="btn btn-secondary btn-sm" onclick="setAllAssignments('${userId}', true)">Chọn tất cả hợp lệ</button>
            <button type="button" class="btn btn-secondary btn-sm" onclick="setAllAssignments('${userId}', false)">Bỏ chọn</button>
            <span class="text-muted" style="font-size:.82rem">Dấu — là cặp môn/lớp không thuộc khối áp dụng của môn.</span>
        </div>
        <div class="table-wrapper" style="max-height:420px;overflow:auto">
            <table class="assignment-matrix" style="font-size:.82rem">
                <thead><tr><th style="position:sticky;left:0;z-index:2">Môn học</th>${header}</tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;
}

function toggleAssignmentPanel(userId) {
    const row = document.getElementById(`assignmentRow_${userId}`);
    if (!row) return;
    row.style.display = row.style.display === 'none' ? 'table-row' : 'none';
}

function handleAccessScopeChange(userId) {
    const scope = document.getElementById(`scope_${userId}`)?.value || 'all';
    const button = document.getElementById(`assignmentBtn_${userId}`);
    const row = document.getElementById(`assignmentRow_${userId}`);
    if (button) button.disabled = scope !== 'assigned';
    if (row && scope !== 'assigned') row.style.display = 'none';
}

function setAllAssignments(userId, checked) {
    document.querySelectorAll(`input[data-assignment-user="${userId}"]`).forEach(input => {
        input.checked = checked;
    });
}

async function loadUserRolePanel(){
    // Danh sách người dùng/phân quyền là dữ liệu quản trị: không tải đối với Teacher/Viewer.
    if (!isAdmin()) return;
    const panel = document.getElementById('userRolePanel');
    if (!panel) return;
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            panel.innerHTML = '<p class="text-muted">Chưa xác định người dùng đăng nhập.</p>';
            return;
        }

        const { data, error } = await supabase
            .from('app3_user_roles')
            .select('user_id,email,display_name,role,active,access_scope')
            .order('email');
        if (error) throw error;

        const roles = data || [];
        const me = roles.find(r => r.user_id === user.id);
        if (me) {
            APP_STATE.currentUserRole = ['admin', 'teacher', 'viewer'].includes(me.role) ? me.role : 'viewer';
            APP_STATE.currentUserActive = me.active === true;
            APP_STATE.currentUserId = me.user_id;
            APP_STATE.currentUserEmail = me.email || user.email || '';
            APP_STATE.currentUserDisplayName = (me.display_name || '').trim() || APP_STATE.currentUserEmail;
            APP_STATE.currentUserAccessScope = me.access_scope === 'assigned' ? 'assigned' : 'all';
            APP_STATE.userAccessLoaded = true;
            updateCurrentUserHeader();
        }

        if (APP_STATE.currentUserRole !== 'admin') {
            panel.innerHTML = `<p>Vai trò hiện tại: <strong>${escapeRoleHtml(APP_STATE.currentUserRole)}</strong></p><p class="text-muted">Chỉ tài khoản admin được thay đổi phân quyền và phân công Môn – Lớp.</p>`;
            return;
        }

        const { data: assignmentData, error: assignmentError } = await supabase
            .from('app3_teacher_assignments')
            .select('id,user_id,subject_id,class_id,active');
        if (assignmentError) throw assignmentError;
        const assignments = assignmentData || [];

        const body = roles.map(r => {
            const scope = r.access_scope === 'assigned' ? 'assigned' : 'all';
            const userAssignments = assignments.filter(a => a.user_id === r.user_id);
            return `
                <tr>
                    <td>${escapeRoleHtml(r.email || '')}</td>
                    <td><input type="text" id="roleName_${r.user_id}" value="${escapeRoleHtml(r.display_name || '')}" style="min-width:150px"></td>
                    <td>
                        <select id="role_${r.user_id}">
                            <option value="admin" ${r.role === 'admin' ? 'selected' : ''}>admin</option>
                            <option value="teacher" ${r.role === 'teacher' ? 'selected' : ''}>teacher</option>
                            <option value="viewer" ${r.role === 'viewer' ? 'selected' : ''}>viewer</option>
                        </select>
                    </td>
                    <td>
                        <select id="scope_${r.user_id}" onchange="handleAccessScopeChange('${r.user_id}')">
                            <option value="all" ${scope === 'all' ? 'selected' : ''}>Tất cả</option>
                            <option value="assigned" ${scope === 'assigned' ? 'selected' : ''}>Theo phân công</option>
                        </select>
                    </td>
                    <td style="text-align:center"><input type="checkbox" id="roleActive_${r.user_id}" ${r.active !== false ? 'checked' : ''}></td>
                    <td style="white-space:nowrap">
                        <button id="assignmentBtn_${r.user_id}" class="btn btn-secondary btn-sm" onclick="toggleAssignmentPanel('${r.user_id}')" ${scope !== 'assigned' ? 'disabled' : ''}><i class="fas fa-chalkboard-teacher"></i> Phân công</button>
                        <button class="btn btn-primary btn-sm" onclick="saveUserRole('${r.user_id}')"><i class="fas fa-save"></i> Lưu</button>
                        ${r.user_id !== user.id ? `<button id="deleteUserBtn_${r.user_id}" class="btn btn-danger btn-sm" onclick="deleteSystemUser('${r.user_id}', '${escapeRoleHtml(r.email || '')}')" title="Xóa tài khoản không còn sử dụng"><i class="fas fa-trash-alt"></i> Xóa</button>` : ''}
                    </td>
                </tr>
                <tr id="assignmentRow_${r.user_id}" style="display:none">
                    <td colspan="6" style="padding:12px;background:rgba(127,127,127,.06)">${renderAssignmentMatrix(r.user_id, userAssignments)}</td>
                </tr>`;
        }).join('');

        panel.innerHTML = `
            <div class="account-create-card">
                <div class="account-create-head">
                    <div class="account-create-icon"><i class="fas fa-user-plus"></i></div>
                    <div>
                        <h4>Tạo tài khoản giáo viên</h4>
                        <p>Tạo tài khoản đăng nhập mới. Sau khi tạo, có thể dùng nút <strong>Phân công</strong> bên dưới để chọn Môn – Lớp.</p>
                    </div>
                </div>

                <form id="createTeacherAccountForm" class="account-create-form" onsubmit="createTeacherAccount(event)">
                    <div class="form-group">
                        <label for="newTeacherDisplayName">Họ và tên</label>
                        <input id="newTeacherDisplayName" type="text" maxlength="120" placeholder="Ví dụ: Nguyễn Văn A" required autocomplete="off">
                    </div>

                    <div class="form-group">
                        <label for="newTeacherEmail">Email đăng nhập</label>
                        <input id="newTeacherEmail" type="email" maxlength="180" placeholder="giaovien@truong.edu.vn" required autocomplete="off">
                    </div>

                    <div class="form-group">
                        <label for="newTeacherPassword">Mật khẩu ban đầu</label>
                        <div class="account-password-wrap">
                            <input id="newTeacherPassword" type="password" minlength="8" maxlength="72" placeholder="Tối thiểu 8 ký tự" required autocomplete="new-password">
                            <button type="button" class="account-password-toggle" onclick="toggleNewTeacherPassword()" aria-label="Hiện hoặc ẩn mật khẩu">
                                <i class="far fa-eye"></i>
                            </button>
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="newTeacherRole">Vai trò</label>
                        <select id="newTeacherRole">
                            <option value="teacher" selected>Giáo viên</option>
                            <option value="viewer">Chỉ xem</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label for="newTeacherScope">Phạm vi</label>
                        <select id="newTeacherScope">
                            <option value="assigned" selected>Theo phân công</option>
                            <option value="all">Tất cả môn/lớp</option>
                        </select>
                    </div>

                    <div class="account-create-action">
                        <button id="btnCreateTeacherAccount" type="submit" class="btn btn-primary">
                            <i class="fas fa-user-plus"></i> Tạo tài khoản
                        </button>
                    </div>
                </form>

                <div class="account-create-note">
                    <i class="fas fa-shield-halved"></i>
                    <span>Việc tạo tài khoản được xử lý qua hàm bảo mật phía Supabase; khóa quản trị không được đưa vào mã nguồn website.</span>
                </div>
            </div>

            <p>Vai trò hiện tại: <strong>${escapeRoleHtml(APP_STATE.currentUserRole)}</strong></p>
            <p class="text-muted" style="font-size:.84rem">Phạm vi <strong>Tất cả</strong>: được truy cập toàn bộ môn/lớp theo vai trò. <strong>Theo phân công</strong>: chỉ các cặp Môn – Lớp được Admin chọn.</p>
            <div class="table-wrapper">
                <table>
                    <thead><tr><th>Email</th><th>Tên hiển thị</th><th>Vai trò</th><th>Phạm vi</th><th>Hoạt động</th><th>Thao tác</th></tr></thead>
                    <tbody>${body}</tbody>
                </table>
            </div>`;
    } catch(err) {
        console.error('LOAD USER ROLE PANEL ERROR:', err);
        panel.innerHTML = `<p class="text-muted">Không tải được cấu hình phân quyền: ${escapeRoleHtml(err.message || err)}</p>`;
    }
}


function toggleNewTeacherPassword() {
    const input = document.getElementById('newTeacherPassword');
    const icon = document.querySelector('.account-password-toggle i');
    if (!input) return;

    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';

    if (icon) {
        icon.className = show ? 'far fa-eye-slash' : 'far fa-eye';
    }
}

async function createTeacherAccount(event) {
    event?.preventDefault();

    if (!isAdmin()) {
        showToast('Chỉ Admin được tạo tài khoản giáo viên.', 'warning');
        return;
    }

    const displayName = document.getElementById('newTeacherDisplayName')?.value.trim() || '';
    const email = document.getElementById('newTeacherEmail')?.value.trim().toLowerCase() || '';
    const password = document.getElementById('newTeacherPassword')?.value || '';
    const role = document.getElementById('newTeacherRole')?.value === 'viewer' ? 'viewer' : 'teacher';
    const accessScope = document.getElementById('newTeacherScope')?.value === 'all' ? 'all' : 'assigned';
    const button = document.getElementById('btnCreateTeacherAccount');

    if (!displayName || !email || !password) {
        showToast('Vui lòng nhập đầy đủ họ tên, email và mật khẩu.', 'warning');
        return;
    }

    if (password.length < 8) {
        showToast('Mật khẩu ban đầu phải có ít nhất 8 ký tự.', 'warning');
        return;
    }

    const originalHtml = button?.innerHTML;
    if (button) {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang tạo...';
    }

    try {
        const { data, error } = await supabase.functions.invoke('rapid-action', {
            body: {
                email,
                password,
                display_name: displayName,
                role,
                access_scope: accessScope
            }
        });

        if (error) throw error;
        if (!data?.ok) throw new Error(data?.error || 'Không tạo được tài khoản.');

        showToast(`Đã tạo tài khoản ${email} thành công!`, 'success', 2200);

        const form = document.getElementById('createTeacherAccountForm');
        if (form) form.reset();

        await loadUserRolePanel();
    } catch (err) {
        console.error('CREATE TEACHER ACCOUNT ERROR:', err);

        let message = err?.message || String(err);
        if (/Failed to send a request|FunctionsHttpError|404/i.test(message)) {
            message = 'Chưa triển khai hàm Supabase app3-create-user hoặc hàm đang lỗi.';
        }

        showToast('Lỗi tạo tài khoản: ' + message, 'error', 3500);
    } finally {
        if (button) {
            button.disabled = false;
            button.innerHTML = originalHtml || '<i class="fas fa-user-plus"></i> Tạo tài khoản';
        }
    }
}

async function deleteSystemUser(userId, email) {
    if (!isAdmin()) {
        showToast('Chỉ Admin được xóa tài khoản.', 'warning');
        return;
    }

    if (!userId || userId === APP_STATE.currentUserId) {
        showToast('Không thể xóa tài khoản Admin đang đăng nhập.', 'warning');
        return;
    }

    const safeEmail = String(email || '').trim();
    const confirmed = window.confirm(
        `Bạn có chắc muốn XÓA tài khoản này?\n\n${safeEmail || userId}\n\n` +
        'Tài khoản đăng nhập, phân quyền và các phân công Môn – Lớp của tài khoản này sẽ bị xóa.\n' +
        'Dữ liệu học sinh, điểm, điểm danh và dữ liệu nghiệp vụ khác không bị xóa.'
    );
    if (!confirmed) return;

    const button = document.getElementById(`deleteUserBtn_${userId}`);
    const originalHtml = button?.innerHTML;
    if (button) {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xóa...';
    }

    try {
        const { data, error } = await supabase.functions.invoke('app3-delete-user', {
            body: { user_id: userId }
        });

        if (error) throw error;
        if (!data?.ok) throw new Error(data?.error || 'Không xóa được tài khoản.');

        showToast(`Đã xóa tài khoản ${safeEmail || ''} thành công!`, 'success', 2400);
        await loadUserRolePanel();
    } catch (err) {
        console.error('DELETE SYSTEM USER ERROR:', err);
        let message = err?.message || String(err);
        if (/Failed to send a request|FunctionsHttpError|404/i.test(message)) {
            message = 'Chưa triển khai hàm Supabase app3-delete-user hoặc hàm đang lỗi.';
        }
        showToast('Lỗi xóa tài khoản: ' + message, 'error', 4000);
    } finally {
        if (button && document.body.contains(button)) {
            button.disabled = false;
            button.innerHTML = originalHtml || '<i class="fas fa-trash-alt"></i> Xóa';
        }
    }
}

async function saveUserRole(userId){
    if (APP_STATE.currentUserRole !== 'admin') return;
    try {
        const role = document.getElementById(`role_${userId}`)?.value || 'teacher';
        const active = !!document.getElementById(`roleActive_${userId}`)?.checked;
        const displayName = document.getElementById(`roleName_${userId}`)?.value.trim() || '';
        const accessScope = document.getElementById(`scope_${userId}`)?.value === 'assigned' ? 'assigned' : 'all';

        const { error: roleError } = await supabase
            .from('app3_user_roles')
            .update({
                role,
                active,
                display_name: displayName,
                access_scope: accessScope,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', userId);
        if (roleError) throw roleError;

        if (accessScope === 'assigned') {
            const selected = Array.from(document.querySelectorAll(`input[data-assignment-user="${userId}"]:checked`))
                .map(input => ({
                    user_id: userId,
                    subject_id: input.dataset.subjectId,
                    class_id: input.dataset.classId,
                    active: true,
                    updated_at: new Date().toISOString()
                }));

            const { error: deleteError } = await supabase
                .from('app3_teacher_assignments')
                .delete()
                .eq('user_id', userId);
            if (deleteError) throw deleteError;

            if (selected.length) {
                const { error: insertError } = await supabase
                    .from('app3_teacher_assignments')
                    .insert(selected);
                if (insertError) throw insertError;
            }
        }

        if (userId === APP_STATE.currentUserId) {
            APP_STATE.userAccessLoaded = false;
            await loadCurrentUserAccess(true);
        }

        showToast(accessScope === 'assigned' ? 'Đã lưu vai trò và phân công Môn – Lớp!' : 'Đã lưu vai trò với phạm vi Tất cả!');
        await loadUserRolePanel();
    } catch(err) {
        console.error('SAVE USER ROLE ERROR:', err);
        showToast('Lỗi phân quyền/phân công: ' + err.message, 'error');
    }
}

window.createTeacherAccount = createTeacherAccount;
window.toggleNewTeacherPassword = toggleNewTeacherPassword;
window.loadCurrentUserAccess = loadCurrentUserAccess;
window.isAdmin = isAdmin;
window.isTeacher = isTeacher;
window.isViewer = isViewer;
window.canManageSystem = canManageSystem;
window.canEditData = canEditData;
window.applyRoleBasedNavigation = applyRoleBasedNavigation;
window.isActiveUser = isActiveUser;

document.addEventListener('DOMContentLoaded', function() {
    initPublicWebsite();
    initLogin();
    initNavigation();

    if (APP_STATE.darkMode) {
        const icon = document.querySelector('#darkModeToggle i');
        if (icon) icon.className = 'fas fa-sun';
    }

    window.openAddStudent = openAddStudent;
    
// ============================================================
// BƯỚC 148 - ĐỒNG BỘ EXCEL THEO CÁC MẪU VNEDU ĐƯỢC CUNG CẤP
// ============================================================
const VNEDU_CLASS_PREFIX = {"1A1":"5004653421","1A2":"5004661241","2A1":"5004506061","3C":"5004506241","3A1":"5004506161","3A2":"5004506961","3B1":"5004506201","3B2":"5004506221","4B":"5004506301","4C":"5004506341","4A1":"5004506261","4A2":"5004506281","5B":"5004506401","5C":"5004506441","5A1":"5004506361","5A2":"5004506381"};
const VNEDU_PREFIX_STORAGE_KEY='app3_vnedu_class_prefixes_v1'; // 150.4.4: hỗ trợ tự học mã cho các lớp 1-2 mới
try{
    const learned=JSON.parse(localStorage.getItem(VNEDU_PREFIX_STORAGE_KEY)||'{}');
    if(learned&&typeof learned==='object')Object.assign(VNEDU_CLASS_PREFIX,learned);
}catch(_){}
function rememberVnEduClassPrefix(cls,prefix){
    cls=normalizeVnEduText(cls).toUpperCase(); prefix=normalizeVnEduText(prefix);
    if(!/^[1-5][A-Z0-9]+$/.test(cls)||!/^[0-9]+$/.test(prefix))return false;
    VNEDU_CLASS_PREFIX[cls]=prefix;
    try{localStorage.setItem(VNEDU_PREFIX_STORAGE_KEY,JSON.stringify(VNEDU_CLASS_PREFIX));}catch(_){}
    return true;
}
function getVnEduClassFromHeaderRows(rows){
    for(const row of (rows||[]).slice(0,8)){
        const text=(row||[]).map(normalizeVnEduText).join(' ');
        const m=text.match(/(?:Khối\s*[1-5]\s*-\s*)?Lớp\s*:?\s*([1-5][A-Za-z0-9]+)/i);
        if(m)return m[1].toUpperCase();
    }
    return '';
}
function parseVnEduDate(v){
    if(!v) return '';
    if(typeof v==='number'){ const d=new Date((v-25569)*86400*1000); return isNaN(d)?'':d.toISOString().slice(0,10); }
    const s=String(v).trim(),m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if(m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
    const d=new Date(s); return isNaN(d)?'':d.toISOString().slice(0,10);
}
function splitVnEduName(n){ const p=normalizeVnEduText(n).split(' ').filter(Boolean); return p.length<2?[n,'']:[p.slice(0,-1).join(' '),p.at(-1)]; }
const VNEDU_SUBJECT_MAP = {
    'tieng_viet': { name: 'Tiếng Việt', code: '50' },
    'toan': { name: 'Toán', code: '51' },
    'khoa_hoc': { name: 'Khoa học', code: '52' },
    'lich_su_dia_li': { name: 'Lịch sử và Địa lí', code: '53' },
    'dao_duc': { name: 'Đạo đức', code: '56' },
    'tu_nhien_xa_hoi': { name: 'Tự nhiên và Xã hội', code: '57' },
    'am_nhac': { name: 'Âm nhạc', code: '58' },
    'mi_thuat': { name: 'Mĩ thuật', code: '59' },
    'giao_duc_the_chat': { name: 'Giáo dục thể chất', code: '97' },
    'hoat_dong_trai_nghiem': { name: 'Hoạt động trải nghiệm', code: '98' },
    'cong_nghe': { name: 'Công nghệ', code: '107' },
    'ngoai_ngu_1': { name: 'Ngoại ngữ 1', code: '110' },
    'tin_hoc': { name: 'Tin học', code: '113' }
};
const VNEDU_SUBJECT_BY_CODE = Object.fromEntries(Object.values(VNEDU_SUBJECT_MAP).map(x => [x.code, x.name]));
function getVnEduSubjectEntry(subject){
    const raw=normalizeVnEduText(subject).toLowerCase();
    const direct=Object.values(VNEDU_SUBJECT_MAP).find(x=>normalizeVnEduText(x.name).toLowerCase()===raw);
    if(direct)return direct;
    const id=String(subject||'').trim();
    if(VNEDU_SUBJECT_MAP[id])return VNEDU_SUBJECT_MAP[id];
    return null;
}
function getVnEduSubjectCode(subject){ return getVnEduSubjectEntry(subject)?.code||''; }
function getVnEduSubjectNameByCode(code){ return VNEDU_SUBJECT_BY_CODE[String(code)]||''; }
function getVnEduPeriodMeta(p){ return {
 gk1:{semester:'1',token:'gk1',title:'HỌC KỲ 1 - GIỮA KỲ 1',rating:'XL GK1'},
 ck1:{semester:'1',token:'ck1',title:'HỌC KỲ 1 - CUỐI KỲ 1',score:'KT CK1',rating:'XL CK1'},
 gk2:{semester:'2',token:'gk2',title:'HỌC KỲ 2 - GIỮA KỲ 2',rating:'XL GK2'},
 ck2:{semester:'2',token:'ck2',title:'HỌC KỲ 2 - CUỐI KỲ 2',score:'KT CK2',rating:'XL CK2',retestScore:'KT CK2 (Sau thi lại)',retestRating:'XL CK2 (Sau thi lại)'}
}[p]; }


// ============================================================
// BƯỚC 151.24 - PREVIEW CẬP NHẬT HỌC SINH TỪ VNEDU
// Chỉ đọc + đối chiếu. KHÔNG ghi Supabase ở bước này.
// ============================================================

function normalizeVnEduStudentKeyText(value) {
    return normalizeVnEduText(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

function normalizeVnEduCompareDate(value) {
    const parsed = parseVnEduDate(value);
    return parsed || normalizeVnEduText(value);
}

function getVnEduRowValue(row, index) {
    return index >= 0 ? row?.[index] : '';
}

function combineVnEduAddress(row) {
    return [10, 11, 12, 13]
        .map(i => normalizeVnEduText(row?.[i]))
        .filter(Boolean)
        .join(', ');
}

function parseVnEduStudentSheet(rows, sheetName, sourceFileName) {
    let cls = '';
    for (const row of rows.slice(0, 8)) {
        const m = row.map(normalizeVnEduText).join(' ').match(/Lớp\s*:\s*([1-5][A-Za-z0-9]+)/i);
        if (m) {
            cls = m[1].toUpperCase();
            break;
        }
    }
    if (!cls && /^[1-5][A-Za-z0-9]+$/i.test(sheetName)) cls = sheetName.toUpperCase();

    const headerRowIndex = rows.findIndex(row =>
        row.some(v => /^Mã học sinh$/i.test(normalizeVnEduText(v)))
        && row.some(v => /^Họ và tên$/i.test(normalizeVnEduText(v)))
    );
    if (headerRowIndex < 0) return [];

    const header = (rows[headerRowIndex] || []).map(v => normalizeVnEduText(v).toLowerCase());
    const findCol = (patterns, fallback = -1) => {
        const idx = header.findIndex(x => patterns.some(p => p.test(x)));
        return idx >= 0 ? idx : fallback;
    };

    const codeCol = findCol([/^mã học sinh$/i], 1);
    const nameCol = findCol([/^họ và tên$/i, /^họ tên$/i], 5);
    const dobCol = findCol([/^ngày sinh$/i], 6);
    const enrollmentCol = findCol([/^ngày vào trường$/i], 7);
    const genderCol = findCol([/^giới tính$/i], 8);
    const fatherCol = findCol([/^tên cha$/i], 35);
    const motherCol = findCol([/^tên mẹ$/i], 38);
    const parentPhoneCol = findCol([/^điện thoại sll$/i], 41);
    const studentPhoneCol = findCol([/^điện thoại hs$/i], 45);
    const emailCol = findCol([/^email sll$/i], 42);
    const noteCol = findCol([/^ghi chú$/i], 48);

    const result = [];
    for (let r = headerRowIndex + 1; r < rows.length; r++) {
        const row = rows[r] || [];
        const code = normalizeVnEduText(getVnEduRowValue(row, codeCol));
        const fullName = normalizeVnEduText(getVnEduRowValue(row, nameCol));

        // Bỏ các dòng trống / tiêu đề phụ / dòng tổng.
        if (!code && !fullName) continue;
        if (!/^\d+$/.test(code) || !fullName) {
            result.push({
                source_file: sourceFileName,
                source_sheet: sheetName,
                source_row: r + 1,
                student_code: code,
                full_name: fullName,
                class_name: cls,
                _invalid: true,
                _invalid_reason: !code ? 'Thiếu mã học sinh' : (!/^\d+$/.test(code) ? 'Mã học sinh không hợp lệ' : 'Thiếu họ tên')
            });
            continue;
        }

        const genderRaw = normalizeVnEduText(getVnEduRowValue(row, genderCol)).toLowerCase();
        const gender =
            genderRaw === 'x' || genderRaw === 'nữ' || genderRaw === 'nu' || genderRaw === 'female'
                ? 'Nữ'
                : (genderRaw === 'nam' || genderRaw === 'male' ? 'Nam' : normalizeVnEduText(getVnEduRowValue(row, genderCol)));

        result.push({
            source_file: sourceFileName,
            source_sheet: sheetName,
            source_row: r + 1,
            student_code: code,
            full_name: fullName,
            dob: parseVnEduDate(getVnEduRowValue(row, dobCol)) || null,
            gender,
            class_name: cls,
            grade: cls ? cls.charAt(0) : '',
            // Các trường dưới đây đã được đọc sẵn để dùng cho bước nhập thật sau này.
            enrollment_date: parseVnEduDate(getVnEduRowValue(row, enrollmentCol)) || null,
            address: combineVnEduAddress(row),
            father_name: normalizeVnEduText(getVnEduRowValue(row, fatherCol)),
            mother_name: normalizeVnEduText(getVnEduRowValue(row, motherCol)),
            parent_phone: normalizeVnEduText(getVnEduRowValue(row, parentPhoneCol)),
            phone: normalizeVnEduText(getVnEduRowValue(row, studentPhoneCol)),
            email: normalizeVnEduText(getVnEduRowValue(row, emailCol)),
            note: normalizeVnEduText(getVnEduRowValue(row, noteCol)),
            // Giữ toàn bộ 49 cột gốc để phục vụ thiết kế import/export chuẩn ở bước sau.
            _raw49: row.slice(0, 49)
        });
    }

    return result;
}

async function parseVnEduStudentFiles(files) {
    const parsed = [];
    for (const file of files) {
        const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), {
            type: 'array',
            cellDates: false
        });
        for (const sheetName of wb.SheetNames) {
            if (/bia/i.test(sheetName)) continue;
            const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
                header: 1,
                defval: '',
                raw: true
            });
            parsed.push(...parseVnEduStudentSheet(rows, sheetName, file.name));
        }
    }
    return parsed;
}

function compareVnEduStudentCore(existing, incoming) {
    const changes = [];

    const checks = [
        ['Họ tên', normalizeVnEduText(existing.fullName), normalizeVnEduText(incoming.full_name)],
        ['Ngày sinh', normalizeVnEduCompareDate(existing.dob), normalizeVnEduCompareDate(incoming.dob)],
        ['Giới tính', normalizeVnEduText(existing.gender), normalizeVnEduText(incoming.gender)],
        ['Lớp', normalizeVnEduText(existing.class).toUpperCase(), normalizeVnEduText(incoming.class_name).toUpperCase()],
        ['Khối', normalizeVnEduText(existing.grade), normalizeVnEduText(incoming.grade)]
    ];

    for (const [label, oldValue, newValue] of checks) {
        if (String(oldValue || '') !== String(newValue || '')) {
            changes.push({ field: label, oldValue: oldValue || '', newValue: newValue || '' });
        }
    }
    return changes;
}

function formatVnEduPreviewChanges(changes) {
    if (!changes?.length) return '<span class="vnedu-preview-muted">Không thay đổi dữ liệu chính</span>';
    return changes.map(change =>
        `<div class="vnedu-preview-change"><strong>${escapeHtml(change.field)}:</strong> ` +
        `<span class="old">${escapeHtml(change.oldValue || '—')}</span>` +
        `<i class="fas fa-arrow-right"></i>` +
        `<span class="new">${escapeHtml(change.newValue || '—')}</span></div>`
    ).join('');
}

async function getExistingAvatarFlags(studentCodes) {
    const flags = new Map();
    const codes = [...new Set(studentCodes.filter(Boolean))];
    if (!codes.length) return flags;

    // Chia nhỏ để tránh tải một response base64 quá lớn.
    const chunkSize = 25;
    for (let i = 0; i < codes.length; i += chunkSize) {
        const chunk = codes.slice(i, i + chunkSize);
        const { data, error } = await supabase
            .from('app3_students')
            .select('student_code, avatar_url')
            .in('student_code', chunk);

        if (error) {
            console.warn('Không kiểm tra được ảnh học sinh trong preview VNEDU:', error);
            continue;
        }
        for (const row of (data || [])) {
            const avatar = normalizeVnEduText(row.avatar_url);
            const hasRealAvatar = !!avatar && avatar !== normalizeVnEduText(DEFAULT_AVATAR);
            flags.set(String(row.student_code), hasRealAvatar);
        }
    }
    return flags;
}

async function buildVnEduStudentPreview(parsedRows) {
    const currentStudents = APP_STATE.students || [];
    const byCode = new Map(currentStudents.map(s => [String(s.id || ''), s]));

    const byNameDob = new Map();
    currentStudents.forEach(student => {
        const key = `${normalizeVnEduStudentKeyText(student.fullName)}|${normalizeVnEduCompareDate(student.dob)}`;
        if (!byNameDob.has(key)) byNameDob.set(key, []);
        byNameDob.get(key).push(student);
    });

    const duplicateCodes = new Set();
    const seenCodes = new Set();
    for (const row of parsedRows) {
        const code = String(row.student_code || '');
        if (!code) continue;
        if (seenCodes.has(code)) duplicateCodes.add(code);
        else seenCodes.add(code);
    }

    // Cần biết trạng thái ảnh của cả học sinh trong VNEDU lẫn học sinh chỉ có ở App.
    const incomingCodes = parsedRows
        .map(row => String(row.student_code || ''))
        .filter(Boolean);
    const currentCodes = currentStudents
        .map(student => String(student.id || ''))
        .filter(Boolean);
    const avatarFlags = await getExistingAvatarFlags([...incomingCodes, ...currentCodes]);

    const items = parsedRows.map(row => {
        if (row._invalid) {
            return {
                ...row,
                status: 'check',
                statusLabel: 'Cần kiểm tra',
                reason: row._invalid_reason,
                hasAvatar: false,
                changes: []
            };
        }

        const code = String(row.student_code);
        if (duplicateCodes.has(code)) {
            return {
                ...row,
                status: 'check',
                statusLabel: 'Cần kiểm tra',
                reason: 'Mã học sinh xuất hiện nhiều lần trong các file đã chọn',
                hasAvatar: avatarFlags.get(code) === true,
                changes: []
            };
        }

        const existing = byCode.get(code);
        if (existing) {
            const changes = compareVnEduStudentCore(existing, row);
            return {
                ...row,
                status: changes.length ? 'update' : 'same',
                statusLabel: changes.length ? 'Cần cập nhật' : 'Không đổi',
                reason: '',
                existingStudent: existing,
                hasAvatar: avatarFlags.get(code) === true,
                changes
            };
        }

        const fallbackKey = `${normalizeVnEduStudentKeyText(row.full_name)}|${normalizeVnEduCompareDate(row.dob)}`;
        const fallbackMatches = byNameDob.get(fallbackKey) || [];
        if (fallbackMatches.length) {
            return {
                ...row,
                status: 'check',
                statusLabel: 'Cần kiểm tra',
                reason: `Không khớp mã HS nhưng trùng Họ tên + Ngày sinh với ${fallbackMatches.map(s => s.id).join(', ')}`,
                hasAvatar: fallbackMatches.some(s => avatarFlags.get(String(s.id)) === true),
                changes: []
            };
        }

        return {
            ...row,
            status: 'new',
            statusLabel: 'Học sinh mới',
            reason: '',
            hasAvatar: false,
            changes: []
        };
    });

    // Học sinh đang có trong App nhưng không xuất hiện trong bộ VNEDU đã chọn.
    // Chỉ hiển thị để rà soát, tuyệt đối không tự xóa.
    const validIncomingCodeSet = new Set(
        parsedRows
            .filter(row => !row._invalid && row.student_code)
            .map(row => String(row.student_code))
    );

    const appOnly = currentStudents
        .filter(student => {
            const code = String(student.id || '');
            return code && !validIncomingCodeSet.has(code);
        })
        .map(student => ({
            student_code: String(student.id || ''),
            full_name: student.fullName || '',
            dob: student.dob || '',
            gender: student.gender || '',
            class_name: student.class || '',
            grade: student.grade || '',
            hasAvatar: avatarFlags.get(String(student.id || '')) === true,
            existingStudent: student
        }))
        .sort((a, b) =>
            String(a.class_name).localeCompare(String(b.class_name), 'vi')
            || String(a.full_name).localeCompare(String(b.full_name), 'vi')
        );

    return { items, appOnly };
}
function getVnEduPreviewSummary(items) {
    const count = status => items.filter(item => item.status === status).length;
    return {
        total: items.length,
        newCount: count('new'),
        updateCount: count('update'),
        sameCount: count('same'),
        checkCount: count('check'),
        keepAvatarCount: items.filter(item => item.hasAvatar).length
    };
}

function renderVnEduUpdateDetails(items) {
    const updates = items.filter(item => item.status === 'update');
    if (!updates.length) {
        return `
            <div class="vnedu-detail-empty">
                <i class="fas fa-circle-check"></i>
                Không có học sinh nào cần cập nhật thông tin chính.
            </div>`;
    }

    return updates.map(item => `
        <div class="vnedu-update-card">
            <div class="vnedu-update-card-head">
                <div>
                    <strong>${escapeHtml(item.full_name || '—')}</strong>
                    <span>Mã HS: ${escapeHtml(item.student_code || '—')} · Lớp ${escapeHtml(item.class_name || '—')}</span>
                </div>
                ${item.hasAvatar
                    ? '<span class="vnedu-avatar-keep"><i class="fas fa-image"></i> Giữ ảnh hiện có</span>'
                    : '<span class="vnedu-preview-muted">Không phát hiện ảnh hiện có</span>'}
            </div>
            <div class="vnedu-update-card-body">
                ${formatVnEduPreviewChanges(item.changes)}
            </div>
        </div>
    `).join('');
}

function renderVnEduAppOnlyDetails(appOnly) {
    if (!appOnly.length) {
        return `
            <div class="vnedu-detail-empty">
                <i class="fas fa-circle-check"></i>
                Không có học sinh nào chỉ tồn tại trong App.
            </div>`;
    }

    const rows = appOnly.map((item, index) => `
        <tr>
            <td>${index + 1}</td>
            <td><strong>${escapeHtml(item.student_code || '—')}</strong></td>
            <td>${escapeHtml(item.full_name || '—')}</td>
            <td>${escapeHtml(item.dob || '—')}</td>
            <td>${escapeHtml(item.gender || '—')}</td>
            <td><strong>${escapeHtml(item.class_name || '—')}</strong></td>
            <td>${item.hasAvatar
                ? '<span class="vnedu-avatar-keep"><i class="fas fa-image"></i> Giữ ảnh hiện có</span>'
                : '<span class="vnedu-preview-muted">Không phát hiện ảnh hiện có</span>'}</td>
            <td><span class="vnedu-app-only-safe"><i class="fas fa-shield-halved"></i> Không tự xóa</span></td>
        </tr>
    `).join('');

    return `
        <div class="vnedu-app-only-note">
            <i class="fas fa-triangle-exclamation"></i>
            <div>
                <strong>${appOnly.length} học sinh đang có trong App nhưng không xuất hiện trong bộ VNEDU đã chọn.</strong>
                <span>BƯỚC 151.25 chỉ liệt kê để kiểm tra. Hệ thống không xóa, không chuyển trạng thái và không thay đổi ảnh của các học sinh này.</span>
            </div>
        </div>
        <div class="vnedu-preview-table-wrap vnedu-app-only-table-wrap">
            <table class="vnedu-preview-table">
                <thead>
                    <tr>
                        <th>STT</th>
                        <th>Mã HS</th>
                        <th>Họ và tên</th>
                        <th>Ngày sinh</th>
                        <th>Giới tính</th>
                        <th>Lớp App</th>
                        <th>Ảnh</th>
                        <th>Xử lý</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;
}

function renderVnEduStudentPreview(previewData, sourceFileCount) {
    const items = previewData?.items || [];
    const appOnly = previewData?.appOnly || [];
    const summary = getVnEduPreviewSummary(items);
    const order = { check: 0, new: 1, update: 2, same: 3 };
    const sorted = [...items].sort((a, b) =>
        (order[a.status] ?? 9) - (order[b.status] ?? 9)
        || String(a.class_name || '').localeCompare(String(b.class_name || ''), 'vi')
        || String(a.full_name || '').localeCompare(String(b.full_name || ''), 'vi')
    );

    const rows = sorted.map((item, index) => {
        const statusClass = `vnedu-status-${item.status}`;
        const avatarText = item.hasAvatar
            ? '<span class="vnedu-avatar-keep"><i class="fas fa-image"></i> Giữ ảnh hiện có</span>'
            : (item.status === 'new'
                ? '<span class="vnedu-preview-muted">Học sinh mới - chưa có ảnh</span>'
                : '<span class="vnedu-preview-muted">Không phát hiện ảnh hiện có</span>');

        let detail = '';
        if (item.status === 'update') detail = formatVnEduPreviewChanges(item.changes);
        else if (item.status === 'check') detail = `<span class="vnedu-check-reason">${escapeHtml(item.reason || 'Cần kiểm tra thủ công')}</span>`;
        else if (item.status === 'new') detail = '<span class="vnedu-preview-muted">Sẽ tạo mới ở bước nhập thật sau khi bạn xác nhận.</span>';
        else detail = '<span class="vnedu-preview-muted">Thông tin chính đang khớp với hệ thống.</span>';

        return `
            <tr>
                <td>${index + 1}</td>
                <td><strong>${escapeHtml(item.student_code || '—')}</strong></td>
                <td>${escapeHtml(item.full_name || '—')}</td>
                <td>${escapeHtml(item.dob || '—')}</td>
                <td>${escapeHtml(item.gender || '—')}</td>
                <td><strong>${escapeHtml(item.class_name || '—')}</strong></td>
                <td><span class="vnedu-preview-status ${statusClass}">${escapeHtml(item.statusLabel)}</span></td>
                <td>${avatarText}</td>
                <td>${detail}</td>
            </tr>`;
    }).join('');

    return `
        <div class="vnedu-preview-wrap">
            <div class="vnedu-preview-note">
                <i class="fas fa-shield-halved"></i>
                <div>
                    <strong>BƯỚC 151.26 - xem trước trước khi cập nhật thật.</strong>
                    <span>Đã đọc ${sourceFileCount} file VNEDU. Chỉ khi bạn bấm “Cập nhật dữ liệu” ở bước xác nhận tiếp theo thì Supabase mới được ghi. Ảnh học sinh cũ vẫn được bảo vệ.</span>
                </div>
            </div>

            <div class="vnedu-preview-summary">
                <div class="vnedu-summary-card"><small>Tổng VNEDU</small><strong>${summary.total}</strong></div>
                <div class="vnedu-summary-card is-new"><small>Học sinh mới</small><strong>${summary.newCount}</strong></div>
                <div class="vnedu-summary-card is-update"><small>Cần cập nhật</small><strong>${summary.updateCount}</strong></div>
                <div class="vnedu-summary-card is-same"><small>Không đổi</small><strong>${summary.sameCount}</strong></div>
                <div class="vnedu-summary-card is-check"><small>Cần kiểm tra</small><strong>${summary.checkCount}</strong></div>
                <div class="vnedu-summary-card is-avatar"><small>Giữ ảnh hiện có</small><strong>${summary.keepAvatarCount}</strong></div>
                <div class="vnedu-summary-card is-app-only"><small>Chỉ có trong App</small><strong>${appOnly.length}</strong></div>
            </div>

            <section class="vnedu-detail-section">
                <div class="vnedu-detail-title">
                    <i class="fas fa-pen-to-square"></i>
                    <div>
                        <strong>Chi tiết học sinh cần cập nhật (${summary.updateCount})</strong>
                        <span>Hiển thị chính xác từng trường App hiện tại → VNEDU.</span>
                    </div>
                </div>
                <div class="vnedu-update-list">
                    ${renderVnEduUpdateDetails(items)}
                </div>
            </section>

            <section class="vnedu-detail-section">
                <div class="vnedu-detail-title">
                    <i class="fas fa-user-shield"></i>
                    <div>
                        <strong>Học sinh chỉ có trong App (${appOnly.length})</strong>
                        <span>Dùng để rà soát học sinh cũ/chuyển trường/nghỉ học. Bước này không tự xóa bất kỳ em nào.</span>
                    </div>
                </div>
                ${renderVnEduAppOnlyDetails(appOnly)}
            </section>

            <section class="vnedu-detail-section">
                <div class="vnedu-detail-title">
                    <i class="fas fa-table-list"></i>
                    <div>
                        <strong>Toàn bộ kết quả đối chiếu VNEDU (${summary.total})</strong>
                        <span>Danh sách đầy đủ để kiểm tra tổng thể trước khi cho phép cập nhật thật.</span>
                    </div>
                </div>
                <div class="vnedu-preview-table-wrap">
                    <table class="vnedu-preview-table">
                        <thead>
                            <tr>
                                <th>STT</th>
                                <th>Mã HS</th>
                                <th>Họ và tên</th>
                                <th>Ngày sinh</th>
                                <th>Giới tính</th>
                                <th>Lớp VNEDU</th>
                                <th>Phân loại</th>
                                <th>Ảnh</th>
                                <th>Chi tiết đối chiếu</th>
                            </tr>
                        </thead>
                        <tbody>${rows || '<tr><td colspan="9">Không có dữ liệu.</td></tr>'}</tbody>
                    </table>
                </div>
            </section>

            <div class="vnedu-preview-footer">
                <i class="fas fa-circle-info"></i>
                BƯỚC 151.26 cho phép cập nhật thật sau khi bạn kiểm tra Preview. Hệ thống chỉ thêm mới/cập nhật các dòng an toàn; không xóa học sinh cũ và không ghi đè ảnh.
            </div>
        </div>`;
}

// ============================================================
// BƯỚC 151.26 - GHI CẬP NHẬT HỌC SINH VNEDU VÀO SUPABASE
// Chỉ xử lý các dòng an toàn: new/update. Không xóa dữ liệu cũ.
// ============================================================

function getVnEduClassForWrite(className) {
    const name = normalizeVnEduText(className).toUpperCase();
    return (APP_STATE.allClasses || APP_STATE.classes || []).find(
        c => normalizeVnEduText(c.name).toUpperCase() === name
    ) || null;
}

function buildVnEduStudentInsertPayload(item) {
    const classObj = getVnEduClassForWrite(item.class_name);
    if (!classObj) {
        throw new Error(`Không tìm thấy lớp ${item.class_name || 'trống'} trong hệ thống`);
    }

    return {
        student_code: String(item.student_code),
        full_name: item.full_name || '',
        dob: item.dob || null,
        gender: item.gender || '',
        class_id: classObj.id,
        grade: item.grade || String(item.class_name || '').charAt(0) || '',
        address: item.address || '',
        phone: item.phone || '',
        email: item.email || '',
        father_name: item.father_name || '',
        mother_name: item.mother_name || '',
        parent_phone: item.parent_phone || '',
        enrollment_date: item.enrollment_date || null,
        status: 'Đang học',
        note: item.note || ''
    };
}

function chooseVnEduUpdateValue(incoming, existingValue) {
    const normalized = normalizeVnEduText(incoming);
    return normalized !== '' ? incoming : (existingValue ?? '');
}

function buildVnEduStudentUpdatePayload(item) {
    const existing = item.existingStudent;
    if (!existing) throw new Error(`Không tìm thấy học sinh hiện có: ${item.student_code}`);

    const classObj = getVnEduClassForWrite(item.class_name);
    if (!classObj) {
        throw new Error(`Không tìm thấy lớp ${item.class_name || 'trống'} trong hệ thống`);
    }

    // QUAN TRỌNG: payload UPDATE này cố ý không có trường ảnh và không có khóa UUID.
    return {
        full_name: chooseVnEduUpdateValue(item.full_name, existing.fullName),
        dob: item.dob || existing.dob || null,
        gender: chooseVnEduUpdateValue(item.gender, existing.gender),
        class_id: classObj.id,
        grade: chooseVnEduUpdateValue(item.grade, existing.grade),
        address: chooseVnEduUpdateValue(item.address, existing.address),
        phone: chooseVnEduUpdateValue(item.phone, existing.phone),
        email: chooseVnEduUpdateValue(item.email, existing.email),
        father_name: chooseVnEduUpdateValue(item.father_name, existing.fatherName),
        mother_name: chooseVnEduUpdateValue(item.mother_name, existing.motherName),
        parent_phone: chooseVnEduUpdateValue(item.parent_phone, existing.parentPhone),
        enrollment_date: item.enrollment_date || existing.enrollmentDate || null,
        status: existing.status || 'Đang học',
        note: chooseVnEduUpdateValue(item.note, existing.note)
    };
}

async function applyVnEduStudentUpdates(previewData, progressEl = null) {
    if (!isAdmin()) {
        throw new Error('Chỉ Admin được phép cập nhật học sinh hàng loạt từ VNEDU.');
    }

    const items = previewData?.items || [];
    const newItems = items.filter(item => item.status === 'new');
    const updateItems = items.filter(item => item.status === 'update');
    const checkItems = items.filter(item => item.status === 'check');

    const result = {
        inserted: 0,
        updated: 0,
        skippedSame: items.filter(item => item.status === 'same').length,
        skippedCheck: checkItems.length,
        errors: []
    };

    const tasks = [
        ...newItems.map(item => ({ type: 'insert', item })),
        ...updateItems.map(item => ({ type: 'update', item }))
    ];

    for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        const item = task.item;

        if (progressEl) {
            progressEl.textContent =
                `Đang cập nhật ${i + 1}/${tasks.length}: ${item.full_name || item.student_code}`;
        }

        try {
            if (task.type === 'insert') {
                const payload = buildVnEduStudentInsertPayload(item);

                const { error } = await supabase
                    .from('app3_students')
                    .insert([payload]);

                if (error) throw error;
                result.inserted++;
            } else {
                const payload = buildVnEduStudentUpdatePayload(item);

                const { error } = await supabase
                    .from('app3_students')
                    .update(payload)
                    .eq('student_code', String(item.student_code));

                if (error) throw error;
                result.updated++;
            }
        } catch (err) {
            console.error(`VNEDU ${task.type} lỗi`, item.student_code, item.full_name, err);
            result.errors.push({
                student_code: item.student_code,
                full_name: item.full_name,
                type: task.type,
                message: err?.message || String(err)
            });
        }
    }

    return result;
}

function renderVnEduImportResult(result, appOnlyCount = 0) {
    const errors = result.errors || [];
    const errorRows = errors.map((e, i) => `
        <tr>
            <td>${i + 1}</td>
            <td>${escapeHtml(e.student_code || '—')}</td>
            <td>${escapeHtml(e.full_name || '—')}</td>
            <td>${e.type === 'insert' ? 'Thêm mới' : 'Cập nhật'}</td>
            <td>${escapeHtml(e.message || 'Lỗi không xác định')}</td>
        </tr>
    `).join('');

    return `
        <div class="vnedu-import-result">
            <div class="vnedu-preview-note">
                <i class="fas fa-circle-check"></i>
                <div>
                    <strong>Đã hoàn tất cập nhật học sinh từ VNEDU.</strong>
                    <span>Ảnh và UUID của học sinh cũ được giữ nguyên. Học sinh chỉ có trong App không bị xóa.</span>
                </div>
            </div>

            <div class="vnedu-preview-summary">
                <div class="vnedu-summary-card is-new"><small>Đã thêm mới</small><strong>${result.inserted}</strong></div>
                <div class="vnedu-summary-card is-update"><small>Đã cập nhật</small><strong>${result.updated}</strong></div>
                <div class="vnedu-summary-card is-same"><small>Không đổi</small><strong>${result.skippedSame}</strong></div>
                <div class="vnedu-summary-card is-check"><small>Bỏ qua cần kiểm tra</small><strong>${result.skippedCheck}</strong></div>
                <div class="vnedu-summary-card is-app-only"><small>Chỉ có trong App</small><strong>${appOnlyCount}</strong></div>
                <div class="vnedu-summary-card ${errors.length ? 'is-check' : 'is-avatar'}"><small>Lỗi</small><strong>${errors.length}</strong></div>
            </div>

            ${errors.length ? `
                <div class="vnedu-detail-section">
                    <div class="vnedu-detail-title">
                        <i class="fas fa-triangle-exclamation"></i>
                        <div>
                            <strong>Các dòng chưa cập nhật được (${errors.length})</strong>
                            <span>Các học sinh này không bị xóa; có thể kiểm tra và nhập lại sau.</span>
                        </div>
                    </div>
                    <div class="vnedu-preview-table-wrap">
                        <table class="vnedu-preview-table">
                            <thead><tr><th>STT</th><th>Mã HS</th><th>Họ tên</th><th>Thao tác</th><th>Lỗi</th></tr></thead>
                            <tbody>${errorRows}</tbody>
                        </table>
                    </div>
                </div>
            ` : `
                <div class="vnedu-detail-empty">
                    <i class="fas fa-shield-check"></i>
                    Không có lỗi ghi dữ liệu.
                </div>
            `}
        </div>
    `;
}

async function confirmAndApplyVnEduStudents(previewData) {
    const summary = getVnEduPreviewSummary(previewData?.items || []);
    const appOnlyCount = previewData?.appOnly?.length || 0;

    if (summary.newCount === 0 && summary.updateCount === 0) {
        showToast('Không có học sinh mới hoặc dữ liệu cần cập nhật.', 'info', 3000);
        return;
    }

    const body = `
        <div class="vnedu-write-confirm">
            <div class="vnedu-preview-note">
                <i class="fas fa-database"></i>
                <div>
                    <strong>Xác nhận ghi dữ liệu VNEDU vào Supabase</strong>
                    <span>Thao tác này sẽ thêm ${summary.newCount} học sinh mới và cập nhật ${summary.updateCount} học sinh đã khớp mã.</span>
                </div>
            </div>
            <ul>
                <li><strong>Giữ nguyên UUID</strong> của học sinh cũ.</li>
                <li><strong>Không ghi đè ảnh</strong> của học sinh cũ.</li>
                <li>${summary.checkCount} dòng “Cần kiểm tra” sẽ được bỏ qua.</li>
                <li>${appOnlyCount} học sinh chỉ có trong App sẽ được giữ nguyên, không xóa.</li>
            </ul>
            <div id="vneduWriteProgress" class="vnedu-write-progress">Chưa bắt đầu ghi dữ liệu.</div>
        </div>
    `;

    const confirmed = await showModal(
        'Xác nhận cập nhật học sinh từ VNEDU',
        body,
        'Cập nhật dữ liệu',
        'Hủy'
    );

    if (!confirmed) return;

    showLoading();
    try {
        const progressEl = document.getElementById('vneduWriteProgress');
        const result = await applyVnEduStudentUpdates(previewData, progressEl);

        await loadAllData();
        hideLoading();

        await showModal(
            'Kết quả cập nhật VNEDU',
            renderVnEduImportResult(result, appOnlyCount),
            'Đóng',
            ''
        );

        renderPage('students');
    } catch (err) {
        hideLoading();
        console.error('Lỗi cập nhật học sinh VNEDU:', err);
        showToast('Lỗi cập nhật VNEDU: ' + (err?.message || err), 'error', 5000);
    }
}

async function importVnEduStudentWorkbook(event) {
    if (!requireEditPermission('xem trước cập nhật học sinh theo mẫu VNEDU')) {
        if (event?.target) event.target.value = '';
        return;
    }

    const files = [...(event?.target?.files || [])];
    if (!files.length) return;

    try {
        showLoading();

        const parsed = await parseVnEduStudentFiles(files);
        if (!parsed.length) throw new Error('Không tìm thấy học sinh đúng cấu trúc danh sách VNEDU.');

        const previewData = await buildVnEduStudentPreview(parsed);
        hideLoading();

        const confirmed = await showModal(
            'Xem trước cập nhật học sinh từ VNEDU',
            renderVnEduStudentPreview(previewData, files.length),
            'Tiếp tục',
            'Đóng'
        );

        if (confirmed) {
            await confirmAndApplyVnEduStudents(previewData);
        }
    } catch (err) {
        hideLoading();
        console.error(err);
        showToast('Lỗi xem trước danh sách VNEDU: ' + err.message, 'error', 5000);
    } finally {
        if (event?.target) event.target.value = '';
    }
}

// Danh sách 20 sheet đúng theo file gốc "Xuất các môn tôi dạy" mà người dùng cung cấp.
// N = Công nghệ (107), H = Tin học (113). Thứ tự được giữ nguyên như VNEDU.
const VNEDU_TEACHING_PAIRS = [
    ['Công nghệ','3C'], ['Công nghệ','3A1'], ['Công nghệ','3A2'], ['Công nghệ','3B1'], ['Công nghệ','3B2'],
    ['Tin học','3C'], ['Tin học','3B1'], ['Tin học','3B2'],
    ['Công nghệ','4B'], ['Công nghệ','4C'], ['Công nghệ','4A1'], ['Công nghệ','4A2'],
    ['Tin học','4B'], ['Tin học','4C'],
    ['Công nghệ','5B'], ['Công nghệ','5C'], ['Công nghệ','5A1'], ['Công nghệ','5A2'],
    ['Tin học','5B'], ['Tin học','5C']
];

function getVnEduSchoolYearParts(){
    const raw=normalizeVnEduText(APP_STATE.settings?.schoolYear||'2026-2027');
    const m=raw.match(/(20\d{2})\D+(20\d{2})/);
    return m?{start:m[1],end:m[2]}:{start:'2026',end:'2027'};
}
function getVnEduSheetName(subject,cls){
    const code=getVnEduSubjectCode(subject)||'MON';
    const c=String(cls||'').toLowerCase();
    // VNEDU nhận diện 2 phân môn Tin học & Công nghệ theo tên sheet gốc THVCN(H/N...).
    if(code==='113') return `THVCN(H${c}`.slice(0,31);
    if(code==='107') return `THVCN(N${c}`.slice(0,31);
    return `M${code}(${c}`.slice(0,31);
}

function getVnEduSubjectTitle(subject){
    const entry=getVnEduSubjectEntry(subject);
    // Phải giữ đúng tên môn mà VNEDU xuất ra; nếu chỉ ghi "TIN HỌC" VNEDU báo không tìm thấy môn.
    if(entry?.code==='113') return 'TIN HỌC VÀ CÔNG NGHỆ (TIN HỌC)';
    if(entry?.code==='107') return 'TIN HỌC VÀ CÔNG NGHỆ (CÔNG NGHỆ)';
    const name=entry?.name||normalizeVnEduText(subject)||'MÔN HỌC';
    return name.toLocaleUpperCase('vi-VN');
}

function getVnEduClassFromPrefix(prefix){
    return Object.entries(VNEDU_CLASS_PREFIX).find(([,p])=>String(p)===String(prefix))?.[0]||'';
}
function parseVnEduTechnicalCode(value){
    const s=normalizeVnEduText(value);
    const m=s.match(/^(\d+)-(50|51|52|53|56|57|58|59|97|98|107|110|113)-(1|2)-(gk1|ck1|gk2|ck2)-(20\d{2})$/i);
    if(!m)return null;
    const cls=getVnEduClassFromPrefix(m[1]);
    const subject=getVnEduSubjectNameByCode(m[2]);
    if(!subject)return null;
    return {raw:s,prefix:m[1],subjectCode:m[2],subject,semester:m[3],period:m[4].toLowerCase(),year:m[5],cls};
}
function getVnEduStudentScores(student,subject,period){
    const sc=APP_STATE.scores?.[student.id]?.[subject]||{};
    if(period==='gk1') return {comment:sc.nhanXetGk1||'',rating:toVnEduRating(sc.giuaKy1||'')};
    if(period==='ck1') return {comment:sc.nhanXetCk1||'',score:sc.cuoiKy1??'',rating:toVnEduRating(sc.xepLoaiCuoiKy1||'')};
    if(period==='gk2') return {comment:sc.nhanXetGk2||'',rating:toVnEduRating(sc.giuaKy2||'')};
    return {comment:sc.nhanXetCk2||'',score:sc.cuoiKy2??'',rating:toVnEduRating(sc.xepLoaiCuoiKy2||''),retestScore:sc.cuoiKy2SauThiLai??'',retestRating:toVnEduRating(sc.xepLoaiCuoiKy2SauThiLai||'')};
}
function styleVnEduWorksheet(ws,period,lastRow){
    const thin={style:'thin',color:{argb:'FF000000'}};
    const centered={vertical:'middle',horizontal:'center',wrapText:true};
    const left={vertical:'middle',horizontal:'left',wrapText:true};
    // Kích thước cột lấy theo workbook VNEDU gốc đã cung cấp.
    ws.getColumn(1).width=5.28; ws.getColumn(2).width=8.96; ws.getColumn(3).width=19.14; ws.getColumn(4).width=13.85; ws.getColumn(5).width=39.99;
    if(period==='gk1'||period==='gk2'){ws.getColumn(6).width=11.99;ws.getColumn(7).width=14.28;ws.getColumn(8).width=14.7;}
    else if(period==='ck1'){ws.getColumn(6).width=11.99;ws.getColumn(7).width=11.99;ws.getColumn(8).width=14.7;}
    else {for(let c=6;c<=9;c++)ws.getColumn(c).width=11.99;}
    ws.getColumn(9).width=ws.getColumn(9).width||11.42; ws.getColumn(10).width=11.42; ws.getColumn(11).width=11.42;
    ws.getRow(1).height=18.75; ws.getRow(2).height=15; ws.getRow(3).height=12.75; ws.getRow(4).height=32.25; ws.getRow(5).height=15.75; ws.getRow(6).height=12.75; ws.getRow(7).height=27.75;
    for(let r=8;r<=lastRow;r++)ws.getRow(r).height=12.8;
    ['A1','E1'].forEach(a=>{ws.getCell(a).font={name:'Arial',size:10};ws.getCell(a).alignment=centered;});
    ['A2','E2'].forEach(a=>{ws.getCell(a).font={name:'Arial',size:10,bold:true};ws.getCell(a).alignment=centered;});
    ws.getCell('A4').font={name:'Arial',size:11,bold:true}; ws.getCell('A4').alignment=centered;
    ws.getCell('A5').font={name:'Arial',size:10,bold:true}; ws.getCell('A5').alignment=centered;
    ws.getCell('B6').font={name:'Arial',size:8,color:{argb:'FF000000'}}; ws.getCell('B6').alignment=left; ws.getCell('B6').numFmt='@';
    // Tạo vùng A:K như file gốc; chỉ bảng dữ liệu thật có border.
    for(let r=7;r<=lastRow;r++)for(let c=1;c<=11;c++){
        const cell=ws.getCell(r,c); cell.font={name:'Arial',size:10,bold:r===7}; cell.alignment=(r===7||c===1||c===2||c>=6)?centered:left;
    }
    const dataLastCol=period==='ck2'?9:period==='ck1'?7:6;
    for(let r=7;r<=lastRow;r++)for(let c=1;c<=dataLastCol;c++)ws.getCell(r,c).border={top:thin,left:thin,bottom:thin,right:thin};
    ws.pageSetup={orientation:'landscape',paperSize:9,fitToPage:true,fitToWidth:1,fitToHeight:0,margins:{left:0.25,right:0.25,top:0.4,bottom:0.4,header:0.15,footer:0.15}};
    ws.views=[{showGridLines:true}];
}
function buildVnEduWorksheet(wb,cls,subject,period){
    const subjectCode=getVnEduSubjectCode(subject),prefix=VNEDU_CLASS_PREFIX[cls],meta=getVnEduPeriodMeta(period);
    if(!subjectCode||!prefix||!meta)return null;
    const students=APP_STATE.students.filter(s=>s.class===cls).slice().sort((a,b)=>String(a.id||'').localeCompare(String(b.id||''),undefined,{numeric:true}));
    if(!students.length)return null;
    const year=getVnEduSchoolYearParts();
    const ws=wb.addWorksheet(getVnEduSheetName(subject,cls));
    ws.mergeCells('A1:D1'); ws.getCell('A1').value='ỦY BAN NHÂN DÂN ĐẶC KHU KIÊN HẢI';
    ws.mergeCells('E1:G1'); ws.getCell('E1').value='CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM';
    ws.mergeCells('A2:D2'); ws.getCell('A2').value='TRƯỜNG TH TRẦN QUỐC TOẢN';
    ws.mergeCells('E2:G2'); ws.getCell('E2').value='Độc lập - Tự do - Hạnh phúc';
    ws.mergeCells('A4:G4'); ws.getCell('A4').value=`BẢNG ĐIỂM CHI TIẾT - MÔN ${getVnEduSubjectTitle(subject)} - ${meta.title} - NĂM HỌC ${year.start} - ${year.end}`;
    ws.mergeCells('A5:G5'); ws.getCell('A5').value=`Khối ${cls[0]} - Lớp ${cls}`;
    ws.getCell('B6').value=`${prefix}-${subjectCode}-${meta.semester}-${meta.token}-${year.start}`;
    ws.mergeCells('C7:D7');
    ws.getCell('A7').value='STT'; ws.getCell('B7').value='Mã học sinh'; ws.getCell('C7').value='Họ và tên'; ws.getCell('E7').value='Nhận xét';
    if(period==='gk1')ws.getCell('F7').value='XL GK1';
    if(period==='ck1'){ws.getCell('F7').value='KT CK1';ws.getCell('G7').value='XL CK1';}
    if(period==='gk2')ws.getCell('F7').value='XL GK2';
    if(period==='ck2'){ws.getCell('F7').value='KT CK2';ws.getCell('G7').value='XL CK2';ws.getCell('H7').value='KT CK2 (Sau thi lại)';ws.getCell('I7').value='XL CK2 (Sau thi lại)';}
    students.forEach((s,i)=>{
        const r=8+i,[ho,ten]=splitVnEduName(s.fullName),v=getVnEduStudentScores(s,subject,period);
        ws.getCell(r,1).value=i+1; ws.getCell(r,2).value=String(s.id||''); ws.getCell(r,2).numFmt='@'; ws.getCell(r,3).value=ho; ws.getCell(r,4).value=ten; ws.getCell(r,5).value=v.comment||'';
        if(period==='gk1'||period==='gk2')ws.getCell(r,6).value=v.rating||'';
        if(period==='ck1'){ws.getCell(r,6).value=v.score;ws.getCell(r,7).value=v.rating||'';}
        if(period==='ck2'){ws.getCell(r,6).value=v.score;ws.getCell(r,7).value=v.rating||'';ws.getCell(r,8).value=v.retestScore;ws.getCell(r,9).value=v.retestRating||'';}
    });
    styleVnEduWorksheet(ws,period,7+students.length);
    return ws;
}
async function downloadVnEduWorkbook(wb,filename,successMessage){
    const buf=await wb.xlsx.writeBuffer();
    const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);
    showToast(successMessage,'success');
}

async function exportVnEduScores(){
    const cls=document.getElementById('exportScoreClass')?.value||document.getElementById('scoreClass')?.value||'',period=document.getElementById('vneduPeriod')?.value||'gk1',subject=APP_STATE.currentSubject;
    if(!cls){showToast('Hãy chọn lớp trước khi xuất VNEDU.','warning');return;}
    if(!getVnEduSubjectCode(subject)){showToast('Môn đang chọn chưa có mã VNEDU đã xác minh.','warning');return;}
    if(!VNEDU_CLASS_PREFIX[cls]){showToast(`Chưa học được mã VNEDU của lớp ${cls}. Hãy nhập 1 file điểm VNEDU gốc của lớp này trước; ứng dụng sẽ tự ghi nhớ mã lớp rồi có thể xuất bình thường.`,'warning');return;}
    if(typeof ExcelJS==='undefined'){showToast('Chưa tải được thư viện ExcelJS. Hãy kiểm tra Internet và tải lại trang.','error');return;}
    try{
        const wb=new ExcelJS.Workbook();wb.creator='VNEDU compatible - Trường TH Trần Quốc Toản';wb.created=new Date();
        if(!buildVnEduWorksheet(wb,cls,subject,period))throw new Error('Không tạo được sheet VNEDU cho lớp đã chọn.');
        const y=getVnEduSchoolYearParts();
        await downloadVnEduWorkbook(wb,`VNEDU_${getVnEduSubjectCode(subject)}_${cls}_${period}_${y.start}.xlsx`,`Đã xuất VNEDU ${period.toUpperCase()} lớp ${cls} theo cấu trúc file gốc.`);
    }catch(err){console.error(err);showToast('Lỗi xuất VNEDU: '+err.message,'error');}
}

function getVnEduTeachingPairsForCurrentUser(){
    // BƯỚC 148.5.3: KHÔNG cố định số sheet. Nguồn ưu tiên là phân công môn-lớp của tài khoản hiện tại.
    // Áp dụng cho cả admin nếu admin cũng có phân công riêng; teacher/viewer assigned hoạt động như trước.
    const assignments=Array.isArray(APP_STATE.currentUserAssignments)?APP_STATE.currentUserAssignments:[];
    if(assignments.length){
        const bySubjectId=new Map((APP_STATE.subjectCatalog||[]).map(x=>[String(x.id),x.name]));
        const byClassId=new Map((APP_STATE.allClasses?.length?APP_STATE.allClasses:APP_STATE.classes||[]).map(x=>[String(x.id),x.name]));
        const pairs=[];
        for(const a of assignments){
            if(a.active===false)continue;
            const subject=bySubjectId.get(String(a.subject_id)),cls=byClassId.get(String(a.class_id));
            if(!subject||!cls)continue;
            // Chỉ xuất môn đã biết mã VNEDU; không tự đoán mã môn mới.
            if(!getVnEduSubjectCode(subject)||!VNEDU_CLASS_PREFIX[cls])continue;
            if(!pairs.some(x=>x[0]===subject&&x[1]===cls))pairs.push([subject,cls]);
        }
        if(pairs.length)return pairs;
    }

    // Tài khoản access_scope=assigned nhưng chưa có phân công hợp lệ: không tự sinh sheet ngoài phân công.
    if(hasAssignedScope())return [];

    // Admin/access all chưa khai báo phân công cá nhân: dùng hồ sơ VNEDU học được từ file mẫu gốc
    // để không phá luồng đang chạy. Khi admin có assignment, nhánh phía trên tự động thay thế danh sách này.
    return VNEDU_TEACHING_PAIRS.filter(([subject,cls])=>getAccessibleClassesForSubject(subject).some(c=>c.name===cls));
}
async function exportVnEduTeachingWorkbook(){
    if(typeof ExcelJS==='undefined'){showToast('Chưa tải được thư viện ExcelJS. Hãy kiểm tra Internet và tải lại trang.','error');return;}
    const period=document.getElementById('vneduPeriod')?.value||'gk1';
    const selectedSubject=APP_STATE.currentSubject;
    const selectedCode=getVnEduSubjectCode(selectedSubject);
    if(!selectedCode){showToast('Môn đang chọn chưa có mã VNEDU đã xác minh.','warning');return;}

    // BƯỚC 148.5.5: nút xuất trên trang Điểm phải tôn trọng môn đang chọn.
    // Ví dụ đang chọn Tin học thì chỉ tạo các sheet Tin học; không lẫn Công nghệ.
    const allPairs=getVnEduTeachingPairsForCurrentUser();
    const pairs=allPairs.filter(([subject])=>getVnEduSubjectCode(subject)===selectedCode);
    if(!pairs.length){
        showToast(`Không có phân công lớp nào của môn ${selectedSubject} có mã VNEDU hợp lệ để xuất.`,'warning');
        return;
    }
    try{
        const wb=new ExcelJS.Workbook();wb.creator='VNEDU compatible - Trường TH Trần Quốc Toản';wb.created=new Date();
        let count=0;for(const [subject,cls] of pairs)if(buildVnEduWorksheet(wb,cls,subject,period))count++;
        if(!count)throw new Error('Không có sheet nào được tạo.');
        const y=getVnEduSchoolYearParts();
        const safeSubject=Object.entries(VNEDU_SUBJECT_MAP).find(([,x])=>x.code===selectedCode)?.[0]||`mon_${selectedCode}`;
        await downloadVnEduWorkbook(wb,`so_diem_${safeSubject}_cac_lop_toi_day_${period}_${y.start}.xlsx`,`Đã xuất ${count} sheet môn ${selectedSubject} theo phân công VNEDU.`);
    }catch(err){console.error(err);showToast('Lỗi xuất các môn tôi dạy: '+err.message,'error');}
}

function collectVnEduImportRows(wb){
    const selectedPeriod=document.getElementById('vneduPeriod')?.value||'';
    const records=[],sheetStats=[],errors=[];
    let firstTarget=null;
    for(const sn of wb.SheetNames){
        const rows=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,defval:'',raw:true});
        if(!rows?.length)continue;
        const info=parseVnEduTechnicalCode(rows?.[5]?.[1]||rows?.[5]?.[0]||'');
        if(!info){errors.push(`${sn}: không đọc được mã kỹ thuật tại B6`);continue;}
        if(!info.cls){
            const detectedClass=getVnEduClassFromHeaderRows(rows);
            if(detectedClass&&rememberVnEduClassPrefix(detectedClass,info.prefix))info.cls=detectedClass;
        }
        if(!info.cls){errors.push(`${sn}: chưa xác định được lớp cho mã VNEDU ${info.prefix}`);continue;}
        if(selectedPeriod&&info.period!==selectedPeriod){errors.push(`${sn}: giai đoạn ${info.period.toUpperCase()} khác lựa chọn ${selectedPeriod.toUpperCase()}`);continue;}
        if(!firstTarget) firstTarget={sheet:sn,cls:info.cls,subject:info.subject,period:info.period};
        const h=rows.findIndex(r=>normalizeVnEduText(r?.[0]).toUpperCase()==='STT'&&/Mã học sinh/i.test(normalizeVnEduText(r?.[1])));
        if(h<0){errors.push(`${sn}: không tìm thấy hàng tiêu đề`);continue;}
        let sheetCount=0;
        for(let r=h+1;r<rows.length;r++){
            const row=rows[r],stt=normalizeVnEduText(row?.[0]),studentCode=normalizeVnEduText(row?.[1]);
            if(!/^\d+$/.test(stt)||!/^\d+$/.test(studentCode))continue;
            const st=APP_STATE.students.find(s=>String(s.id)===studentCode);
            if(!st){errors.push(`${sn}: không tìm thấy mã học sinh ${studentCode}`);continue;}
            if(st.class!==info.cls){errors.push(`${sn}: học sinh ${studentCode} đang thuộc ${st.class}, file ghi ${info.cls}`);continue;}
            const comment=normalizeVnEduText(row?.[4]);
            let hasValue=!!comment,p={student_id:st.db_uuid,subject:info.subject,subject_id:getSubjectId(info.subject)};
            if(info.period==='gk1'){
                const rating=normalizeVnEduRating(row?.[5]); if(rating)hasValue=true; p.giua_ky_1=rating;p.nhan_xet_gk1=comment;
            }else if(info.period==='ck1'){
                const score=row?.[5],rating=normalizeVnEduRating(row?.[6]); if(score!==''&&score!=null)hasValue=true;if(rating)hasValue=true;
                p.cuoi_ky_1=(score===''||score==null)?null:Number(score);p.xep_loai_cuoi_ky_1=rating;p.nhan_xet_ck1=comment;
            }else if(info.period==='gk2'){
                const rating=normalizeVnEduRating(row?.[5]); if(rating)hasValue=true;p.giua_ky_2=rating;p.nhan_xet_gk2=comment;
            }else if(info.period==='ck2'){
                const score=row?.[5],rating=normalizeVnEduRating(row?.[6]),retest=row?.[7],retestRating=normalizeVnEduRating(row?.[8]);
                if(score!==''&&score!=null||rating||retest!==''&&retest!=null||retestRating)hasValue=true;
                p.cuoi_ky_2=(score===''||score==null)?null:Number(score);p.xep_loai_cuoi_ky_2=rating;p.nhan_xet_ck2=comment;p.cuoi_ky_2_sau_thi_lai=(retest===''||retest==null)?null:Number(retest);p.xep_loai_cuoi_ky_2_sau_thi_lai=retestRating;
            }
            // An toàn: các dòng hoàn toàn trống không ghi đè dữ liệu đang có trong app.
            if(!hasValue)continue;
            records.push(p);sheetCount++;
        }
        sheetStats.push({sheet:sn,cls:info.cls,subject:info.subject,period:info.period,count:sheetCount});
    }
    return {records,sheetStats,errors,firstTarget};
}
async function writeVnEduImportRecords(records){
    let updated=0;
    for(let i=0;i<records.length;i+=100){
        const chunk=records.slice(i,i+100);
        const {error}=await supabase.from('app3_scores').upsert(chunk,{onConflict:'student_id,subject'});
        if(error)throw error;updated+=chunk.length;
    }
    return updated;
}
async function importVnEduWorkbookCore(file,modeLabel){
    const wb=XLSX.read(new Uint8Array(await file.arrayBuffer()),{type:'array'}),parsed=collectVnEduImportRows(wb);
    if(parsed.errors.length){
        const preview=parsed.errors.slice(0,6).join('\n');
        throw new Error(`${preview}${parsed.errors.length>6?`\n... và ${parsed.errors.length-6} lỗi khác`:''}`);
    }
    if(!parsed.sheetStats.length)throw new Error('Không tìm thấy sheet VNEDU hợp lệ.');
    // BƯỚC 150.4.6: file VNEDU gốc có thể hoàn toàn chưa có điểm/nhận xét.
    // Khi đó vẫn phải chấp nhận file để học mã kỹ thuật lớp, không báo lỗi.
    if(!parsed.records.length){
        const target=parsed.firstTarget||parsed.sheetStats[0]||null;
        if(target?.cls&&target?.sheet){
            // Mã lớp đã được rememberVnEduClassPrefix() ghi ngay khi đọc mã kỹ thuật + tiêu đề lớp.
            if(target?.subject) APP_STATE.currentSubject=target.subject;
            renderPage('scores');
            const periodEl=document.getElementById('vneduPeriod');
            const classEl=document.getElementById('scoreClass');
            const exportClassEl=document.getElementById('exportScoreClass');
            if(periodEl) periodEl.value=target.period||periodEl.value;
            if(classEl) classEl.value=target.cls||'';
            if(exportClassEl) exportClassEl.value=target.cls||'';
            initScoreTable();
            return {updated:0,target,sheetStats:parsed.sheetStats,learnedOnly:true};
        }
        throw new Error('File đúng cấu trúc VNEDU nhưng chưa xác định được lớp để ghi nhớ mã kỹ thuật.');
    }
    const summary=parsed.sheetStats.filter(x=>x.count>0).map(x=>`${x.sheet}: ${x.count}`).join('\n');
    if(!window.confirm(`${modeLabel}\n\nĐã đọc ${parsed.sheetStats.length} sheet, có ${parsed.records.length} dòng có dữ liệu.\n\n${summary}\n\nTiếp tục ghi vào hệ thống?`))return null;
    const updated=await writeVnEduImportRecords(parsed.records);

    // Ghi nhớ sheet có dữ liệu đầu tiên để sau khi reload tự mở đúng Môn - Lớp - Giai đoạn.
    const firstRecordStat=parsed.sheetStats.find(x=>x.count>0);
    const target=firstRecordStat?{cls:firstRecordStat.cls,subject:firstRecordStat.subject,period:firstRecordStat.period,sheet:firstRecordStat.sheet}:parsed.firstTarget;
    if(target?.subject) APP_STATE.currentSubject=target.subject;

    await loadAllData();
    renderPage('scores');

    // renderPage tạo lại các select nên đặt giá trị sau khi render.
    if(target){
        const periodEl=document.getElementById('vneduPeriod');
        const classEl=document.getElementById('scoreClass');
        const exportClassEl=document.getElementById('exportScoreClass');
        if(periodEl) periodEl.value=target.period||periodEl.value;
        if(classEl) classEl.value=target.cls||'';
        if(exportClassEl) exportClassEl.value=target.cls||'';
        initScoreTable();
    }

    return {updated,target,sheetStats:parsed.sheetStats};
}
async function importVnEduScoresExcel(event){
    if(!requireEditPermission('nhập điểm VNEDU')){if(event?.target)event.target.value='';return;}const file=event?.target?.files?.[0];if(!file)return;
    try{const result=await importVnEduWorkbookCore(file,'NHẬP VNEDU LỚP');
        if(result?.learnedOnly)showToast(`Đã học mã VNEDU của lớp ${result.target?.cls||''}. File chưa có điểm/nhận xét nên không có dữ liệu nào bị ghi đè. Bây giờ có thể Xuất VNEDU lớp này.`, 'success');
        else if(result?.updated)showToast(`Đã nhập ${result.updated} dòng VNEDU. Đang hiển thị ${result.target?.subject||''} - ${result.target?.cls||''} - ${(result.target?.period||'').toUpperCase()}.`,'success');}
    catch(err){console.error(err);showToast('Lỗi nhập điểm VNEDU: '+err.message,'error');}
    finally{if(event?.target)event.target.value='';}
}
async function importVnEduTeachingWorkbook(event){
    if(!requireEditPermission('nhập các môn tôi dạy từ VNEDU')){if(event?.target)event.target.value='';return;}const file=event?.target?.files?.[0];if(!file)return;
    try{const result=await importVnEduWorkbookCore(file,'NHẬP CÁC MÔN TÔI DẠY');
        if(result?.learnedOnly)showToast(`Đã học mã VNEDU của lớp ${result.target?.cls||''}. File chưa có điểm/nhận xét nên không cập nhật điểm.`, 'success');
        else if(result?.updated)showToast(`Đã nhập ${result.updated} dòng từ "Các môn tôi dạy". Đang mở ${result.target?.subject||''} - ${result.target?.cls||''} - ${(result.target?.period||'').toUpperCase()}.`,'success');}
    catch(err){console.error(err);showToast('Lỗi nhập các môn tôi dạy: '+err.message,'error');}
    finally{if(event?.target)event.target.value='';}
}

window.editStudent = editStudent;
    window.viewStudent = viewStudent;
    window.deleteStudent = deleteStudent;
    window.deleteSelectedStudents = deleteSelectedStudents;
    window.toggleStudent = toggleStudent;
    window.toggleSelectAll = toggleSelectAll;
    window.filterStudents = filterStudents;
    window.resetFilters = resetFilters;
    window.goStudentPage = goStudentPage;
    window.openAddClass = openAddClass;
    window.editClass = editClass;
    window.deleteClass = deleteClass;
    window.initStudentTable = initStudentTable;
    window.initClassTable = initClassTable;
    window.initScoreTable = initScoreTable;
    window.updateScore = updateScore;
    window.saveScore = saveScore;
    window.switchSubject = switchSubject;
    window.switchStudentSubject = switchStudentSubject;
    window.globalSearch = globalSearch;
    window.saveSettings = saveSettings;
    window.changePassword = changePassword;
    window.exportExcel = exportExcel;
    window.exportStudentPhotos = exportStudentPhotos;
    window.downloadSampleExcel = downloadSampleExcel;
    window.importExcel = importExcel;
    window.importVnEduStudentWorkbook = importVnEduStudentWorkbook;
    window.exportVnEduScores = exportVnEduScores;
    window.importVnEduScoresExcel = importVnEduScoresExcel;
    window.exportVnEduTeachingWorkbook = exportVnEduTeachingWorkbook;
    window.importVnEduTeachingWorkbook = importVnEduTeachingWorkbook;
    window.printStudents = printStudents;
    window.printStudent = printStudent;
    window.loadAttendance = loadAttendance;
    window.saveAttendance = saveAttendance;
    window.updateAttendanceStatus = updateAttendanceStatus;
    window.exportAttendanceExcel = exportAttendanceExcel;
    window.openAddReward = openAddReward;
    window.deleteReward = deleteReward;
    window.openAddDiscipline = openAddDiscipline;
    window.deleteDiscipline = deleteDiscipline;
    window.renderLearningComments = renderLearningComments;
    window.openAddLearningComment = openAddLearningComment;
    window.openUploadFile = openUploadFile;
    window.viewFile = viewFile;
    window.downloadFile = downloadFile;
    window.editFile = editFile;
    window.deleteFile = deleteFile;
    window.exportClassList = exportClassList;
    window.exportScoreClass = exportScoreClass;
    window.exportRewards = exportRewards;
    window.exportDisciplines = exportDisciplines;
    window.previewAvatar = previewAvatar;
    window.clearAvatar = clearAvatar;
    window.downloadAvatar = downloadAvatar;
    window.switchStatSubject = switchStatSubject;
    window.refreshAdvancedStatistics = refreshAdvancedStatistics;
    window.switchSearchSubject = switchSearchSubject;
    window.saveSubjectConfig = saveSubjectConfig;
    window.exportAdvancedReport = exportAdvancedReport;
    window.downloadScoreImportTemplate = downloadScoreImportTemplate;
    window.importScoresExcel = importScoresExcel;
    window.backupAllData = backupAllData;
    window.restoreAllData = restoreAllData;
    window.mergeBackupData = mergeBackupData;
    window.fullRestoreBackupData = fullRestoreBackupData;
    window.saveUserRole = saveUserRole;
    window.deleteSystemUser = deleteSystemUser;
    window.toggleAssignmentPanel = toggleAssignmentPanel;
    window.handleAccessScopeChange = handleAccessScopeChange;
    window.setAllAssignments = setAllAssignments;
    // ============================================================
    // FIX LOGIC CẢM ỨNG NÚT 3 GẠCH
    // ============================================================
    window.addEventListener('load', () => {
        const mobileBtn = document.getElementById('toggleSidebarMobile');
        const overlay = document.getElementById('sidebarOverlay');
        const sidebar = document.querySelector('.sidebar') || document.querySelector('aside');

        function toggleMenu(e) {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            if (sidebar) sidebar.classList.toggle('show');
            if (overlay) overlay.classList.toggle('show');
        }

        function closeMenu() {
            if (sidebar) sidebar.classList.remove('show');
            if (overlay) overlay.classList.remove('show');
        }

        if (mobileBtn) {
            mobileBtn.addEventListener('click', toggleMenu);
        }

        if (overlay) {
            overlay.addEventListener('click', closeMenu);
        }

        const navLinks = document.querySelectorAll('.sidebar a, aside a, .nav-item');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 992) closeMenu();
            });
        });
    });
});

// ============================================================
// CẤU HÌNH ĐĂNG NHẬP GOOGLE BẰNG SUPABASE
// ============================================================

function getSupabaseInstance() {
    if (window.supabaseClient) return window.supabaseClient;
    if (window.supabase && typeof window.supabase.auth === 'object') return window.supabase;
    if (typeof supabase !== 'undefined' && supabase.auth) return supabase;
    return null;
}

async function loginWithGoogle() {
    try {
        const client = getSupabaseInstance();
        if (!client) {
            alert("Lỗi: Chưa khởi tạo Supabase Client! Vui lòng kiểm tra lại cấu hình SDK.");
            return;
        }

        const { data, error } = await client.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin + window.location.pathname
            }
        });

        if (error) throw error;
    } catch (err) {
        console.error("Lỗi Google Auth:", err);
        alert("Đăng nhập bằng Google thất bại: " + err.message);
    }
}

async function checkAuthState() {
    try {
        const client = getSupabaseInstance();
        if (!client || !client.auth) return;

        const { data: { session } } = await client.auth.getSession();

        if (session && session.user) {
            const accessOk = await loadCurrentUserAccess();
            if (!accessOk) return;
            const user = session.user;
            const meta = user.user_metadata || {};

            // BƯỚC 141: Chỉ đồng bộ trạng thái người dùng, KHÔNG tự chuyển
            // khỏi website công khai khi trình duyệt còn session cũ.
            const headerBtn = document.querySelector('.site-login-btn[data-open-login]');
            if (headerBtn) headerBtn.innerHTML = '<i class="fas fa-right-to-bracket"></i> Vào hệ thống';

            const userNameEls = document.querySelectorAll('.user-name, #userName, .profile-name');
            userNameEls.forEach(el => {
                el.textContent = APP_STATE.currentUserDisplayName || meta.full_name || meta.name || user.email;
            });
        }
    } catch (e) {
        console.error("Lỗi kiểm tra session:", e);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    checkAuthState();

    const client = getSupabaseInstance();
    if (client && client.auth) {
        client.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' || session) {
                checkAuthState();
            }
        });
    }

    const googleBtn = document.getElementById('googleLoginBtn');
    if (googleBtn) {
        googleBtn.addEventListener('click', loginWithGoogle);
    }
});

window.showPublicContentEditor=showPublicContentEditor; window.savePublicContent=savePublicContent; window.editPublicContent=editPublicContent; window.deletePublicContent=deletePublicContent; window.resetPublicContentForm=resetPublicContentForm; window.openPublicPostDetail=openPublicPostDetail; window.closePublicPostDetail=closePublicPostDetail; window.handlePublicPostImageSelection=handlePublicPostImageSelection; window.clearPublicPostImage=clearPublicPostImage; window.showPublicMediaEditor=showPublicMediaEditor; window.updatePublicMediaFormByType=updatePublicMediaFormByType; window.savePublicMedia=savePublicMedia; window.editPublicMedia=editPublicMedia; window.deletePublicMedia=deletePublicMedia; window.resetPublicMediaForm=resetPublicMediaForm; window.openPublicMediaModal=openPublicMediaModal; window.closePublicMediaModal=closePublicMediaModal;

window.showPublicAnnouncementEditor=showPublicAnnouncementEditor; window.editPublicAnnouncement=editPublicAnnouncement; window.savePublicAnnouncement=savePublicAnnouncement; window.deletePublicAnnouncement=deletePublicAnnouncement; window.showPublicLinkEditor=showPublicLinkEditor; window.editPublicLink=editPublicLink; window.savePublicLink=savePublicLink; window.deletePublicLink=deletePublicLink;


// BƯỚC 149.11: Các hàm được gọi trực tiếp từ thuộc tính onclick trong HTML
// phải được công khai trên window vì script.js chạy dưới dạng ES module.
window.renderPage = renderPage;
window.saveStudentInline = saveStudentInline;


// Bước 150.4.8: giữ vòng quay hiển thị đúng khi xoay máy/thay đổi viewport trên mobile.
let wheelResizeTimer = null;
window.addEventListener('resize', () => {
    if (!document.getElementById('wheelCanvas')) return;
    clearTimeout(wheelResizeTimer);
    wheelResizeTimer = setTimeout(() => {
        if (resizeWheelCanvas()) drawWheel();
    }, 120);
});
window.addEventListener('orientationchange', () => {
    setTimeout(() => {
        if (document.getElementById('wheelCanvas') && resizeWheelCanvas()) drawWheel();
    }, 220);
});

window.publicVideoError = publicVideoError;
window.setPublicVideoCategory = setPublicVideoCategory; window.openPublicVideoModal = openPublicVideoModal; window.closePublicVideoModal = closePublicVideoModal;
window.setPublicNewsCategory = setPublicNewsCategory;
window.setPublicGalleryCategory = setPublicGalleryCategory; window.stepPublicGallery = stepPublicGallery;
window.openPublicGalleryAll = openPublicGalleryAll;
window.closePublicGalleryAll = closePublicGalleryAll;

// BƯỚC 150.3.1: hỗ trợ truy cập hệ thống trên thiết bị di động
window.showPublicSite = showPublicSite;
window.showLoginFromPublic = showLoginFromPublic;
window.showAuthenticatedApp = showAuthenticatedApp;

window.togglePublicDocumentPreview = togglePublicDocumentPreview;
window.setPublicDocumentCategory=setPublicDocumentCategory;
window.setPublicDocumentSearch=setPublicDocumentSearch;

// BƯỚC 151.49.2F-R2: export bộ lọc trạng thái cho inline onclick
window.filterAttendanceStatus = filterAttendanceStatus;
window.loadAttendanceStats = loadAttendanceStats;
window.exportAttendanceStatsExcel = exportAttendanceStatsExcel;


