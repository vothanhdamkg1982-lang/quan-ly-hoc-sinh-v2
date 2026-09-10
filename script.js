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
import { supabase } from './supabase.js';


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
// RENDER WHEEL UI
// ============================================================

function renderWheel() {
    return `
        <div class="wheel-page">
            <!-- Thanh điều khiển thu gọn trên 1 hàng -->
            <div class="card mb-2" style="padding: 0.6rem 1rem;">
                <div class="flex-between" style="flex-wrap: wrap; gap: 0.75rem;">
                    
                    <!-- Nhóm chọn lớp -->
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <i class="fas fa-dharmachakra" style="color: var(--primary); font-size: 1.2rem;"></i>
                        <select id="wheelClassSelect" onchange="onWheelClassChange()" style="padding: 0.35rem 0.6rem; font-weight: 600;">
                            <option value="">-- Chọn lớp --</option>
                            ${(hasAssignedScope() ? getAccessibleClassesForSubject('') : APP_STATE.classes).map(c => `
                                <option value="${c.id}" data-name="${c.name}">${c.name} - Khối ${c.grade}</option>
                            `).join('')}
                        </select>
                    </div>

                    <!-- Thống kê nhanh -->
                    <div style="display: flex; align-items: center; gap: 1.2rem; font-size: 0.9rem;">
                        <span>Tổng: <strong id="wheelStudentCount">0</strong></span>
                        <span style="color: var(--success);">Đã gọi: <strong id="wheelCalledCount">0</strong></span>
                        <span style="color: var(--primary);">Còn lại: <strong id="wheelRemainingCount">0</strong></span>
                    </div>

                    <!-- Tùy chọn & Thao tác -->
                    <div style="display: flex; align-items: center; gap: 0.6rem;">
                        <label style="display: flex; align-items: center; gap: 0.3rem; font-size: 0.85rem; cursor: pointer; margin: 0;">
                            <input type="checkbox" id="wheelPreventDuplicates" checked onchange="setWheelPreventDuplicates(this.checked)">
                            Không trùng
                        </label>
                        <button class="btn btn-secondary btn-sm" onclick="resetWheel()" title="Đặt lại lượt quay">
                            <i class="fas fa-undo"></i>
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="togglePresentationMode()">
                            <i class="fas fa-expand"></i> Trình chiếu
                        </button>
                        <!-- NÚT VỀ TRANG CHỦ -->
                        <button class="btn btn-primary btn-sm btn-home-mode" onclick="goHome()" title="Về trang chủ">
                            <i class="fas fa-home"></i> Trang chủ
                        </button>
                    </div>
                </div>
            </div>

            <!-- Khu vực Vòng quay -->
            <div class="wheel-container ${WHEEL_STATE.presentationMode ? 'presentation-mode' : ''}">
                <div class="wheel-stage">
                    <div class="wheel-wrapper">
                        <div id="wheelFallback" class="wheel-mobile-fallback" aria-hidden="true"><span>🎯</span></div>
                        <canvas id="wheelCanvas"></canvas>
                        <div class="wheel-pointer">▼</div>
                    </div>
                    <div class="wheel-controls-center">
                        <button class="btn btn-primary btn-lg" id="spinBtn" onclick="spinWheel()">
                            <i class="fas fa-play"></i> QUAY
                        </button>
                    </div>
                </div>

                <div class="wheel-sidebar">
                    <div class="wheel-result" id="wheelResult" style="display:none;">
                        <div class="result-header">🎉 CHÚC MỪNG!</div>
                        <div class="result-avatar">
                            <img id="winnerAvatar" src="${DEFAULT_AVATAR}" alt="Avatar">
                        </div>
                        <div class="result-name" id="winnerName">Nguyễn Văn A</div>
                        <div class="result-class" id="winnerClass">Lớp 3A</div>
                        <div class="result-actions">
                            <button class="btn btn-primary" onclick="spinWheel()">
                                <i class="fas fa-play"></i> Quay tiếp
                            </button>
                            <button class="btn btn-secondary" onclick="resetWheel()">
                                <i class="fas fa-undo"></i> Đặt lại
                            </button>
                        </div>
                    </div>

                    <div class="student-list-container">
                        <h4 style="margin-bottom: 0.5rem;"><i class="fas fa-users"></i> Danh sách tham gia</h4>
                        <div class="student-list-scroll" id="wheelStudentList">
                            <p class="text-muted">Vui lòng chọn lớp</p>
                        </div>
                    </div>
                </div>
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

function initWheel() {
    if (!resizeWheelCanvas()) return;

    if (WHEEL_STATE.selectedClassId) {
        loadWheelStudents(WHEEL_STATE.selectedClassId);
    } else {
        drawWheel();
    }
    updateWheelStats();

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

    const labels = list.map((student, i) => {
        const full = String(student?.fullName || student?.name || student?.student_name || `HS ${i + 1}`).trim();
        // Trên màn hình điện thoại ưu tiên 2 từ cuối để tên đủ lớn và dễ đọc.
        const parts = full.split(/\s+/).filter(Boolean);
        const shortName = parts.length > 2 ? parts.slice(-2).join(' ') : full;
        const angle = i * step + step / 2 - 90;
        return `<span class="wheel-fallback-label" style="--label-angle:${angle}deg" title="${escapeHtml(full)}">${escapeHtml(shortName)}</span>`;
    }).join('');

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
        
        const textRadius = radius * 0.65;
        const name = String(students[i]?.fullName || students[i]?.name || students[i]?.student_name || `HS ${i + 1}`);
        const displayName = name.length > 15 ? name.substring(0, 13) + '…' : name;
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
    
    console.log('🎉 WINNER:', winner.fullName);
    console.log('📸 Avatar URL:', winner.avatar || winner.avatar_url || 'Không có');
    
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

    // BƯỚC 151.5: vòng quay không cần tải ảnh cả lớp. Chỉ tải ảnh người trúng.
    ensureStudentAvatar(winner)
        .then(() => updateWinnerAvatar(winner))
        .catch(err => console.warn('[LAZY AVATAR] Không tải được ảnh người trúng:', err));
    
    // Cập nhật UI
    const resultDiv = document.getElementById('wheelResult');
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
        console.log('✅ Đã set avatar src:', avatarImg.src);
    }
    
    if (WHEEL_STATE.audioEnabled) {
        playCelebrationSound();
    }
    
    updateWheelStats();
    renderStudentList();
    createConfetti();
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

            console.log('USER ACCESS:', {
                email: APP_STATE.currentUserEmail,
                displayName: APP_STATE.currentUserDisplayName,
                role: APP_STATE.currentUserRole,
                active: APP_STATE.currentUserActive,
                accessScope: APP_STATE.currentUserAccessScope,
                assignments: APP_STATE.currentUserAssignments.length
            });

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
    console.log('ASSIGNMENTS REFRESH:', APP_STATE.currentUserAssignments);
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

    console.log('DISPLAY SCOPE:', {
        subjects: APP_STATE.subjectCatalog.map(s => s.name),
        classes: APP_STATE.classes.map(c => c.name),
        assignments: APP_STATE.currentUserAssignments
    });

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
        console.log('DANH MỤC MÔN HỌC:', APP_STATE.subjectCatalog.length);

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

        console.log('KIỂM TRA STUDENTS:', APP_STATE.students.length);

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
        console.log('Đã tải dữ liệu từ Supabase thành công!');
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
        <div class="card">
            <div class="flex-between mb-2">
                <div>
                    <h3 class="card-title"><i class="fas fa-book-open"></i> Nhận xét học tập</h3>
                    <p class="text-muted">Ghi nhận quá trình tiến bộ, cố gắng hoặc những điểm cần hỗ trợ của học sinh.</p>
                </div>
                <button class="btn btn-primary btn-sm" onclick="openAddLearningComment()">
                    <i class="fas fa-plus"></i> Thêm nhận xét
                </button>
            </div>
            <div class="form-group mb-2">
                <label for="learningCommentStudentFilter"><strong>Chọn học sinh</strong></label>
                <select id="learningCommentStudentFilter" onchange="filterLearningCommentsByStudent(this.value)">
                    <option value="">-- Tất cả học sinh --</option>
                    ${(APP_STATE.students || []).map(s => `<option value="${s.db_uuid}">${s.fullName}</option>`).join('')}
                </select>
            </div>
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>STT</th><th>Lớp</th><th>Môn</th><th>Học sinh</th><th>Thời điểm</th>
                            <th>Diễn biến</th><th>Nội dung</th><th>Thao tác</th>
                        </tr>
                    </thead>
                    <tbody id="learningCommentsTableBody">
                        ${comments.length === 0
                            ? '<tr><td colspan="8" class="text-center text-muted">Chưa có nhận xét học tập nào.</td></tr>'
                            : comments.map((c, index) => {
                                const student = studentMap.get(c.studentId);
                                return `
                                    <tr data-student-id="${c.studentId}">
                                        <td>${index + 1}</td>
                                        <td>${getContextClassName(c.classId)}</td>
                                        <td>${c.subject || '—'}</td>
                                        <td>${student ? student.fullName : 'Không xác định'}</td>
                                        <td>${c.commentDatetime ? new Date(c.commentDatetime).toLocaleString('vi-VN') : ''}</td>
                                        <td>${c.commentType || '—'}</td>
                                        <td>${c.content || ''}</td>
                                        <td class="text-center">
                                            <div class="action-buttons">
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
        </div>`;
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
// 4. RENDER PAGES
// ============================================================

function renderPage(page) {
    APP_STATE.currentPage = page;
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
        default: container.innerHTML = '<p>Trang không tồn tại.</p>';
    }
    setTimeout(() => {
        if (page === 'dashboard') initCharts();
        if (page === 'students') initStudentTable();
        if (page === 'classes') initClassTable();
        if (page === 'scores') initScoreTable();
        if (page === 'attendance') loadAttendance();
        if (page === 'settings') initSettings();
        if (page === 'public-content') initPublicContentManager();
        if (page === 'search') initSearch();
        if (page === 'statistics') initStatCharts();
        if (page === 'wheel') initWheel();
        applyViewerReadOnlyUI();
        if (isViewer() && page === 'attendance') {
            setTimeout(applyViewerReadOnlyUI, 120);
        }
    }, 50);
}

function getPageTitle(page) {
    const titles = {
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
        wheel: 'Vòng quay may mắn'
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
        <div class="stats-grid">
            <div class="stat-card"><div class="stat-icon"><i class="fas fa-user-graduate"></i></div><div class="stat-value">${total}</div><div class="stat-label">Tổng HS</div></div>
            <div class="stat-card"><div class="stat-icon"><i class="fas fa-chalkboard"></i></div><div class="stat-value">${classes.length}</div><div class="stat-label">Số lớp</div></div>
            <div class="stat-card"><div class="stat-icon"><i class="fas fa-male" style="color:#2563eb;"></i></div><div class="stat-value">${male}</div><div class="stat-label">Nam</div></div>
            <div class="stat-card"><div class="stat-icon"><i class="fas fa-female" style="color:#ec4899;"></i></div><div class="stat-value">${female}</div><div class="stat-label">Nữ</div></div>
        </div>
        <div class="chart-grid">
            <div class="chart-box"><canvas id="chartGender"></canvas></div>
            <div class="chart-box"><canvas id="chartClass"></canvas></div>
        </div>
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
            <button class="btn btn-secondary" onclick="exportExcel()"><i class="fas fa-download"></i> Xuất danh sách</button>
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
            <input type="file" id="vneduStudentImportInput" accept=".xlsx,.xls" style="display:none" onchange="importVnEduStudentWorkbook(event)">
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
        <div class="card">
            <div class="flex-between mb-2">
                <h3 class="card-title"><i class="fas fa-chalkboard-teacher"></i> Danh sách lớp</h3>
                <div class="flex gap-2">
                    <button class="btn btn-primary btn-sm" onclick="openAddClass()"><i class="fas fa-plus"></i> Thêm lớp</button>
                    <div class="flex gap-1" style="align-items:center;">
                        <select id="exportClassSelect" style="padding:0.3rem 0.6rem;border:1px solid var(--border);border-radius:4px;">
                            <option value="">Chọn lớp</option>
                            ${classOptions}
                        </select>
                        <button class="btn btn-success btn-sm" onclick="exportClassList()"><i class="fas fa-file-excel"></i> Xuất danh sách</button>
                    </div>
                </div>
            </div>
            <div class="table-wrapper">
                <table>
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
        <div class="card">
            <div class="flex-between mb-2">
                <h3 class="card-title"><i class="fas fa-pencil-alt"></i> Quản lý điểm</h3>
                <div class="flex gap-2" style="flex-wrap:wrap;">
                    <div class="form-group" style="margin:0; min-width:130px;">
                        <label style="font-size:0.75rem;">Chọn môn</label>
                        <select id="scoreSubject" onchange="switchSubject(this.value)" style="padding:0.3rem 0.6rem;">
                            ${subjectOptions}
                        </select>
                    </div>
                    <select id="exportScoreClass" style="padding:0.3rem 0.6rem;border:1px solid var(--border);border-radius:4px;">
                        <option value="">Chọn lớp</option>
                        ${classOptions}
                    </select>
                    <button class="btn btn-success btn-sm" onclick="exportScoreClass()"><i class="fas fa-file-excel"></i> Xuất điểm</button>
                    <button class="btn btn-secondary btn-sm" onclick="downloadScoreImportTemplate()"><i class="fas fa-download"></i> Mẫu nhập điểm</button>
                    <button class="btn btn-primary btn-sm" onclick="document.getElementById('scoreImportInput').click()"><i class="fas fa-file-import"></i> Nhập điểm Excel</button>
                    <input type="file" id="scoreImportInput" accept=".xlsx,.xls" style="display:none" onchange="importScoresExcel(event)">
                    <select id="vneduPeriod" onchange="initScoreTable()" style="padding:0.3rem 0.6rem;border:1px solid var(--border);border-radius:4px;">
                        <option value="gk1">VNEDU - Giữa kỳ 1</option><option value="ck1">VNEDU - Cuối kỳ 1</option>
                        <option value="gk2">VNEDU - Giữa kỳ 2</option><option value="ck2">VNEDU - Cuối kỳ 2</option>
                    </select>
                    <button class="btn btn-success btn-sm" onclick="exportVnEduScores()"><i class="fas fa-file-export"></i> Xuất VNEDU lớp</button>
                    <button class="btn btn-info btn-sm" onclick="document.getElementById('vneduScoreImportInput').click()"><i class="fas fa-file-import"></i> Nhập VNEDU lớp</button>
                    <input type="file" id="vneduScoreImportInput" accept=".xlsx,.xls" style="display:none" onchange="importVnEduScoresExcel(event)">
                    <button class="btn btn-success btn-sm" onclick="exportVnEduTeachingWorkbook()"><i class="fas fa-file-excel"></i> Xuất các môn tôi dạy</button>
                    <button class="btn btn-info btn-sm" onclick="document.getElementById('vneduTeachingImportInput').click()"><i class="fas fa-file-import"></i> Nhập các môn tôi dạy</button>
                    <input type="file" id="vneduTeachingImportInput" accept=".xlsx,.xls" style="display:none" onchange="importVnEduTeachingWorkbook(event)">
                </div>
            </div>
            <p class="text-muted mb-2">Nhập điểm cho môn <strong>${APP_STATE.currentSubject}</strong> theo Thông tư 27.</p>
            <div class="search-bar">
                <input type="text" id="scoreSearch" placeholder="Tìm học sinh..." oninput="initScoreTable()">
                <select id="scoreClass" onchange="initScoreTable()"><option value="">Tất cả lớp</option>${classOptions}</select>
            </div>
            <div class="table-wrapper">
                <table>
                    <thead><tr id="scoreTableHead"></tr></thead>
                    <tbody id="scoreTableBody"></tbody>
                </table>
            </div>
        </div>
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
        <div class="card">
            <div class="flex-between mb-2">
                <h3 class="card-title"><i class="fas fa-clipboard-check"></i> Điểm danh</h3>
                <button class="btn btn-success btn-sm" onclick="exportAttendanceExcel()"><i class="fas fa-file-excel"></i> Xuất Excel</button>
            </div>
            <div class="flex gap-2 mb-2" style="flex-wrap:wrap;">
                <div class="form-group" style="flex:1; min-width:150px;">
                    <label>Chọn lớp</label>
                    <select id="attendanceClass" onchange="loadAttendance()">${classOptions}</select>
                </div>
                <div class="form-group" style="flex:1; min-width:150px;">
                    <label>Ngày</label>
                    <input type="date" id="attendanceDate" value="${today}" onchange="loadAttendance()">
                </div>
                <div class="form-group" style="align-self:flex-end;">
                    <button class="btn btn-primary" onclick="saveAttendance()"><i class="fas fa-save"></i> Lưu điểm danh</button>
                </div>
            </div>
            <div id="attendanceTableWrapper">
                <p class="text-muted">Chọn lớp và ngày để xem danh sách điểm danh.</p>
            </div>
        </div>
    `;
}

async function loadAttendance() {
    const clsName = document.getElementById('attendanceClass').value;
    const date = document.getElementById('attendanceDate').value;
    const wrapper = document.getElementById('attendanceTableWrapper');
    if (!clsName || !date) {
        wrapper.innerHTML = '<p class="text-muted">Vui lòng chọn lớp và ngày.</p>';
        return;
    }

    const classObj = APP_STATE.classes.find(c => c.name === clsName);
    if (!classObj) {
        wrapper.innerHTML = '<p class="text-muted">Lớp không tồn tại.</p>';
        return;
    }

    const students = APP_STATE.students.filter(s => s.class === clsName);
    if (students.length === 0) {
        wrapper.innerHTML = '<p class="text-muted">Lớp này chưa có học sinh.</p>';
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
        <div class="table-wrapper">
            <table>
                <thead><tr><th>STT</th><th>Mã HS</th><th>Họ tên</th><th>Trạng thái</th></tr></thead>
                <tbody>
    `;
    students.forEach((s, idx) => {
        const record = records.find(r => r.student_id === s.db_uuid);
        const status = record ? record.status : 'Có mặt';
        const options = statusOptions.map(opt => `<option value="${opt}" ${opt === status ? 'selected' : ''}>${opt}</option>`).join('');
        html += `
            <tr>
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

async function updateAttendanceStatus(date, classId, studentUuid, status) {
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
    showToast('Đã lưu điểm danh!');
    loadAttendance();
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
        showToast('Không có dữ liệu điểm danh cho ngày và lớp này.', 'warning');
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
    showToast('Xuất Excel điểm danh thành công!');
}

// ============================================================
// 12. QUẢN LÝ KHEN THƯỞNG (CRUD)
// ============================================================
function renderRewards() {
    const rewards = APP_STATE.rewards || [];
    const studentMap = Object.fromEntries((APP_STATE.students || []).map(s => [s.db_uuid, s.fullName]));
    return `
        <div class="card">
            <div class="flex-between mb-2">
                <h3 class="card-title"><i class="fas fa-medal"></i> Khen thưởng</h3>
                <div class="flex gap-2">
                    <button class="btn btn-primary btn-sm" onclick="openAddReward()"><i class="fas fa-plus"></i> Thêm</button>
                    <button class="btn btn-success btn-sm" onclick="exportRewards()"><i class="fas fa-file-excel"></i> Xuất Excel</button>
                </div>
            </div>
            <div class="table-wrapper"><table>
                <thead><tr><th>STT</th><th>Lớp</th><th>Môn</th><th>Học sinh</th><th>Ngày</th><th>Nội dung</th><th>Người quyết định</th><th>Thao tác</th></tr></thead>
                <tbody>
                    ${rewards.length === 0 ? '<tr><td colspan="8" class="text-center text-muted">Chưa có khen thưởng nào.</td></tr>' :
                    rewards.map((r, i) => `<tr>
                        <td>${i + 1}</td><td>${getContextClassName(r.classId)}</td><td>${r.subject || 'Dữ liệu cũ'}</td>
                        <td>${studentMap[r.studentId] || 'Không xác định'}</td><td>${formatDate(r.date)}</td>
                        <td>${r.content}</td><td>${r.decisionBy || ''}</td>
                        <td><button class="btn-icon" onclick="deleteReward('${r.id}')" style="color:#dc2626;"><i class="fas fa-trash"></i></button></td>
                    </tr>`).join('')}
                </tbody>
            </table></div>
        </div>`;
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
        <div class="card">
            <div class="flex-between mb-2">
                <h3 class="card-title"><i class="fas fa-gavel"></i> Kỷ luật</h3>
                <div class="flex gap-2">
                    <button class="btn btn-primary btn-sm" onclick="openAddDiscipline()"><i class="fas fa-plus"></i> Thêm</button>
                    <button class="btn btn-success btn-sm" onclick="exportDisciplines()"><i class="fas fa-file-excel"></i> Xuất Excel</button>
                </div>
            </div>
            <div class="table-wrapper"><table>
                <thead><tr><th>STT</th><th>Lớp</th><th>Môn</th><th>Học sinh</th><th>Ngày</th><th>Nội dung</th><th>Người quyết định</th><th>Thao tác</th></tr></thead>
                <tbody>
                    ${disciplines.length === 0 ? '<tr><td colspan="8" class="text-center text-muted">Chưa có kỷ luật nào.</td></tr>' :
                    disciplines.map((d, i) => `<tr>
                        <td>${i + 1}</td><td>${getContextClassName(d.classId)}</td><td>${d.subject || 'Dữ liệu cũ'}</td>
                        <td>${studentMap[d.studentId] || 'Không xác định'}</td><td>${formatDate(d.date)}</td>
                        <td>${d.content}</td><td>${d.decisionBy || ''}</td>
                        <td><button class="btn-icon" onclick="deleteDiscipline('${d.id}')" style="color:#dc2626;"><i class="fas fa-trash"></i></button></td>
                    </tr>`).join('')}
                </tbody>
            </table></div>
        </div>`;
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
function renderFiles() {
    const files = APP_STATE.files;
    if (!Array.isArray(files)) {
        APP_STATE.files = [];
    }
    return `
        <div class="card">
            <div class="flex-between mb-2">
                <h3 class="card-title"><i class="fas fa-folder-open"></i> Quản lý file</h3>
                <button class="btn btn-primary btn-sm" onclick="openUploadFile()"><i class="fas fa-upload"></i> Tải lên</button>
            </div>
            <div class="table-wrapper">
                <table>
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
                        ${files.length === 0 ? '<tr><td colspan="7" class="text-center text-muted">Chưa có file nào.</td></tr>' :
                        files.map((f, i) => `
                            <tr>
                                <td>${i+1}</td>
                                <td>${f.name}</td>
                                <td>${f.type}</td>
                                <td>${f.size}</td>
                                <td>${formatDate(f.uploadDate)}</td>
                                <td>${f.desc || ''}</td>
                                <td>
                                    <div class="table-actions">
                                        ${f.url ? `<button class="btn-icon" onclick="viewFile('${f.id}')" title="Xem"><i class="fas fa-eye"></i></button>` : `<span class="text-muted" title="File mẫu không có dữ liệu"><i class="fas fa-eye-slash"></i></span>`}
                                        <button class="btn-icon" onclick="downloadFile('${f.id}')" title="Tải xuống"><i class="fas fa-download"></i></button>
                                        <button class="btn-icon" onclick="editFile('${f.id}')" title="Sửa"><i class="fas fa-edit"></i></button>
                                        <button class="btn-icon" onclick="deleteFile('${f.id}')" style="color:#dc2626;" title="Xóa"><i class="fas fa-trash"></i></button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div class="text-muted mt-2" style="font-size:0.8rem;">
                <i class="fas fa-info-circle"></i> Tổng dung lượng đã dùng: ${calculateTotalSize()} / 4MB. 
                <span class="text-muted">(Mỗi file tối đa 2MB)</span>
            </div>
        </div>
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

async function openUploadFile() {
    if (!requireEditPermission('tải file lên')) return;
    const totalMB = parseFloat(calculateTotalSize());
    const MAX_TOTAL_MB = 4;
    if (totalMB >= MAX_TOTAL_MB) {
        showToast(`Dung lượng đã đạt giới hạn ${MAX_TOTAL_MB}MB. Vui lòng xóa bớt file cũ.`, 'error');
        return;
    }

    showModal('Tải file lên', `
        <div class="form-group"><label>Chọn file (tối đa 2MB)</label><input type="file" id="fileInput" style="padding:0.5rem;"></div>
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
            const MAX_FILE_SIZE = 2 * 1024 * 1024;
            if (file.size > MAX_FILE_SIZE) {
                showToast('File quá lớn! Chỉ hỗ trợ file dưới 2MB.', 'error');
                return;
            }

            try {
                const fileExt = file.name.split('.').pop();
                const fileName = `${Date.now()}_${file.name}`;
                const filePath = `documents/${fileName}`;

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
                        uploaded_by: (await supabase.auth.getUser()).data.user?.id || null
                    })
                    .select()
                    .single();
                if (metaErr) throw metaErr;

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
                showToast('Lỗi tải file: ' + err.message, 'error');
            }
        }
    });
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

    let contentHTML = '';
    if (isImage) {
        contentHTML = `<img src="${file.url}" style="max-width:100%; max-height:500px; display:block; margin:auto;">`;
    } else if (isPDF) {
        contentHTML = `<iframe src="${file.url}" style="width:100%; height:500px; border:none;"></iframe>`;
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
            contentHTML = `<p>Đang tải nội dung...</p>`;
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

// Thống kê chỉ trên các lớp thực sự học môn đang chọn, kể cả tài khoản admin.
let statStudents = APP_STATE.students.filter(student => statAllowedClassIds.has(student.class_id));
if (statClass) statStudents = statStudents.filter(student => student.class === statClass);

// Khen thưởng / kỷ luật phải đi theo đúng lớp báo cáo và môn đang chọn.
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

    if (subjectScore?.competence?.trim()) {
        competenceEvaluated++;
    }

    if (subjectScore?.quality?.trim()) {
        qualityEvaluated++;
    }
});

const competenceNotEvaluated =
    statStudents.length - competenceEvaluated;

const qualityNotEvaluated =
    statStudents.length - qualityEvaluated;
    return `
        <div class="card">
            <h3 class="card-title"><i class="fas fa-chart-bar"></i> Thống kê chi tiết</h3>
            <div class="form-group" style="max-width: 300px; margin-bottom: 16px;">
    <label>Môn học</label>
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
                }>
                    ${subject}
                </option>
            `).join('')
        }
    </select>
</div>
            <div class="flex gap-2 mb-2" style="flex-wrap:wrap;align-items:end">
                <div class="form-group" style="margin:0;min-width:180px"><label>Lớp báo cáo</label><select id="advancedReportClass" onchange="refreshAdvancedStatistics()"><option value="">Tất cả lớp</option>${statAccessibleClasses.map(c => `<option value="${c.name}" ${c.name === statClass ? 'selected' : ''}>${c.name}</option>`).join('')}</select></div>
                <div class="form-group" style="margin:0;min-width:180px"><label>Môn báo cáo</label><select id="advancedReportSubject">${getVisibleSubjectNames().map(name=>`<option value="${name}" ${name===statSubject?'selected':''}>${name}</option>`).join('')}</select></div>
                <button class="btn btn-success" onclick="exportAdvancedReport()"><i class="fas fa-file-excel"></i> Xuất báo cáo nâng cao</button>
            </div>
            <div class="chart-grid">
    <div class="chart-box"><canvas id="statGradeChart"></canvas></div>
    <div class="chart-box"><canvas id="statGenderChart"></canvas></div>
    <div class="chart-box"><canvas id="statCompetenceChart"></canvas></div>
    <div class="chart-box"><canvas id="statQualityChart"></canvas></div>
</div>
            <div class="stats-grid mt-2">
                <div class="stat-card"><div class="stat-label">Tổng học sinh</div><div class="stat-value">${statStudents.length}</div></div>
                <div class="stat-card"><div class="stat-label">Số lớp</div><div class="stat-value">${statClass ? 1 : statAccessibleClasses.length}</div></div>
                <div class="stat-card"><div class="stat-label">Khen thưởng</div><div class="stat-value">${statRewards.length}</div></div>
                <div class="stat-card"><div class="stat-label">Kỷ luật</div><div class="stat-value">${statDisciplines.length}</div></div>
            </div>
            <div class="stats-grid mt-2">
    <div class="stat-card">
        <div class="stat-label">Đã đánh giá NL - ${statSubject}</div>
        <div class="stat-value">${competenceEvaluated}</div>
    </div>

    <div class="stat-card">
        <div class="stat-label">Chưa đánh giá NL - ${statSubject}</div>
        <div class="stat-value">${competenceNotEvaluated}</div>
    </div>

    <div class="stat-card">
        <div class="stat-label">Đã đánh giá PC - ${statSubject}</div>
        <div class="stat-value">${qualityEvaluated}</div>
    </div>

    <div class="stat-card">
        <div class="stat-label">Chưa đánh giá PC - ${statSubject}</div>
        <div class="stat-value">${qualityNotEvaluated}</div>
    </div>
</div>
        </div>
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

    console.log('MÔN THỐNG KÊ:', subject);

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
        <div class="card">
            <h3 class="card-title"><i class="fas fa-search"></i> Tìm kiếm nâng cao</h3>
            <div class="form-group" style="max-width: 300px; margin-bottom: 16px;">
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
            <div class="search-bar">
                <input type="text" id="globalSearch" placeholder="Nhập từ khóa..." oninput="globalSearch()">
                <select id="searchField" onchange="globalSearch()"><option value="all">Tất cả</option><option value="id">Mã HS</option><option value="fullName">Họ tên</option><option value="class">Lớp</option><option value="grade">Khối</option><option value="competence">Năng lực</option><option value="quality">Phẩm chất</option></select>
                <button class="btn btn-primary btn-sm" onclick="globalSearch()"><i class="fas fa-search"></i> Tìm</button>
            </div>
            <div id="searchResults"></div>
        </div>
    `;
}
function switchSearchSubject(subject) {
    const availableSubjects =
        APP_STATE.subjectCatalog?.length
            ? APP_STATE.subjectCatalog.map(item => item.name)
            : SUBJECTS;

    if (!availableSubjects.includes(subject)) return;

    APP_STATE.searchSubject = subject;

    console.log('MÔN TÌM KIẾM:', subject);
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
            '<p class="text-muted">Nhập từ khóa để tìm kiếm.</p>';
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
            '<p class="text-muted">Không tìm thấy kết quả.</p>';
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

        <p class="text-muted mt-2">
            Tìm thấy ${results.length} kết quả - Môn: ${searchSubject}
        </p>
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

function renderSettings() {
    const settings = APP_STATE.settings;
    const subjects = APP_STATE.allSubjectCatalog?.length
        ? APP_STATE.allSubjectCatalog
        : SUBJECT_CONFIG.map(subject => ({ ...subject, grades: [1,2,3,4,5], active: true }));
    const subjectRows = subjects.map(subject => {
        const grades = Array.isArray(subject.grades) ? subject.grades.map(String) : [];
        return `
            <tr>
                <td><strong>${subject.name}</strong><div class="text-muted" style="font-size:.75rem">${subject.id}</div></td>
                <td>
                    <div class="subject-grade-list">
                        ${[1,2,3,4,5].map(g => `<label><input type="checkbox" class="subject-grade" data-subject-id="${subject.id}" value="${g}" ${grades.includes(String(g)) ? 'checked' : ''}> ${g}</label>`).join('')}
                    </div>
                </td>
                <td><label class="switch-inline"><input type="checkbox" id="subjectActive_${subject.id}" ${subject.active !== false ? 'checked' : ''}> <span>${subject.active !== false ? 'Đang bật' : 'Đang tắt'}</span></label></td>
                <td><button class="btn btn-primary btn-sm" onclick="saveSubjectConfig('${subject.id}')"><i class="fas fa-save"></i> Lưu</button></td>
            </tr>`;
    }).join('');
    return `
        <div class="card">
            <h3 class="card-title"><i class="fas fa-cog"></i> Cài đặt</h3>
            <div class="form-grid">
                <div class="form-group"><label>Tên trường</label><input type="text" id="setSchoolName" value="${settings.schoolName || ''}"></div>
                <div class="form-group"><label>Năm học</label><input type="text" id="setSchoolYear" value="${settings.schoolYear || ''}"></div>
                <div class="form-group"><label>Giáo viên</label><input type="text" id="setTeacherName" value="${settings.teacherName || ''}"></div>
                <div class="form-group"><label>Giao diện</label><select id="setTheme"><option value="light" ${settings.theme === 'light' ? 'selected' : ''}>Sáng</option><option value="dark" ${settings.theme === 'dark' ? 'selected' : ''}>Tối</option></select></div>
            </div>
            <button class="btn btn-primary" onclick="saveSettings()"><i class="fas fa-save"></i> Lưu cài đặt</button>
            <hr class="my-3">
            <h4><i class="fas fa-book"></i> Quản lý môn học</h4>
            <p class="text-muted">Bật/tắt môn và chọn các khối lớp áp dụng. Môn bị tắt sẽ không xuất hiện trong các màn hình nhập liệu mới nhưng dữ liệu cũ vẫn được giữ.</p>
            <div class="table-wrapper"><table><thead><tr><th>Môn học</th><th>Khối áp dụng</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${subjectRows}</tbody></table></div>
            ${isAdmin() ? `
            <hr class="my-3">
            <div class="settings-public-shortcut">
              <span class="settings-public-icon"><i class="fas fa-globe"></i></span>
              <div><h4>Nội dung website công khai</h4><p>Phần quản trị Tin tức, Tài liệu, Hình ảnh & Video, Thông báo và Liên kết đã được tách thành module riêng để thao tác rõ ràng hơn.</p></div>
              <button class="btn btn-primary" onclick="renderPage('public-content')"><i class="fas fa-arrow-up-right-from-square"></i> Mở module nội dung</button>
            </div>
            ` : ''}
            <hr class="my-3">
            <h4><i class="fas fa-database"></i> Sao lưu & khôi phục</h4>
            ${isAdmin() ? `
            <div class="flex gap-2" style="flex-wrap:wrap">
                <button id="backupJsonBtn" class="btn btn-success" onclick="backupAllData()"><i class="fas fa-download"></i> Sao lưu JSON</button>
                <button class="btn btn-warning" onclick="document.getElementById('mergeBackupInput').click()"><i class="fas fa-code-merge"></i> Hợp nhất JSON</button>
                <button class="btn btn-danger" onclick="document.getElementById('fullRestoreBackupInput').click()"><i class="fas fa-rotate-left"></i> Khôi phục toàn bộ</button>
                <input type="file" id="mergeBackupInput" accept=".json" style="display:none" onchange="mergeBackupData(event)">
                <input type="file" id="fullRestoreBackupInput" accept=".json" style="display:none" onchange="fullRestoreBackupData(event)">
            </div>
            <p class="text-muted mt-2" style="font-size:.8rem"><strong>Hợp nhất JSON:</strong> ghi đè/thêm theo khóa hiện có, không xóa dữ liệu mới. <strong>Khôi phục toàn bộ:</strong> đưa các bảng nghiệp vụ về đúng snapshot trong file; dữ liệu không có trong backup sẽ bị xóa. Full Restore chỉ hoạt động sau khi kích hoạt RPC Supabase ở Bước 109.</p>
            ` : `<p class="text-muted mt-2" style="font-size:.85rem"><i class="fas fa-lock"></i> Chỉ tài khoản Admin được sử dụng Sao lưu, Hợp nhất và Khôi phục toàn bộ dữ liệu.</p>`}
            <hr class="my-3">
            <h4><i class="fas fa-users-cog"></i> Người dùng & phân quyền</h4>
            <div id="userRolePanel"><p class="text-muted">Đang kiểm tra cấu hình phân quyền...</p></div>
            <hr class="my-3">
            <h4>Đổi mật khẩu</h4>
            <div class="form-grid"><div class="form-group"><label>Mật khẩu mới</label><input type="password" id="newPassword" placeholder="••••••••"></div><div class="form-group"><label>Xác nhận</label><input type="password" id="confirmPassword" placeholder="••••••••"></div></div>
            <button class="btn btn-warning" onclick="changePassword()"><i class="fas fa-key"></i> Đổi mật khẩu</button>
        </div>`;
}

function initSettings() { loadUserRolePanel(); }
function initSearch() {}

async function saveSettings() {
    if (!requireEditPermission('lưu cài đặt')) return;
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
        supabase.from('app3_settings').upsert({
            config_id: 1, 
            theme: APP_STATE.settings.theme
        }, { onConflict: 'config_id' }).then(({ error }) => {
            if (error) console.warn('Không thể lưu theme:', error);
        });
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
        return `<article class="public-document-card"><div class="public-document-icon"><i class="fas ${publicDocumentIcon(item)}"></i></div><div class="public-document-copy"><div class="public-document-meta"><span>${cat}</span><small>${publicDocumentType(item)} · ${publicDate(item.created_at)}</small></div><h3>${title}</h3><p>${publicEscape(item.description||'Tài liệu công khai của nhà trường.')}</p></div><div class="public-document-actions">${url?`<a class="public-doc-link" href="${url}" target="_blank" rel="noopener"><i class="fas fa-arrow-up-right-from-square"></i> Mở tài liệu</a><a class="public-doc-download" href="${url}" download target="_blank" rel="noopener" aria-label="Tải ${title}"><i class="fas fa-download"></i></a>`:'<span class="public-doc-unavailable"><i class="fas fa-clock"></i> Đang cập nhật tệp</span>'}</div></article>`;
    }).join('');
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
        const mediaRes = await supabase.from('app3_public_media').select('*').eq('is_published', true).order('sort_order', { ascending:true }).order('created_at', { ascending:false }).limit(30);
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
    const all=Array.isArray(items)?items:[];
    const categories=['Tất cả',...new Set(all.map(x=>String(x.category||'Khác').trim()).filter(Boolean))];
    if(PUBLIC_GALLERY_CATEGORY!=='Tất cả'&&!categories.includes(PUBLIC_GALLERY_CATEGORY)) PUBLIC_GALLERY_CATEGORY='Tất cả';
    const filtered=PUBLIC_GALLERY_CATEGORY==='Tất cả'?all:all.filter(x=>String(x.category||'Khác').trim()===PUBLIC_GALLERY_CATEGORY);
    PUBLIC_GALLERY_VISIBLE=filtered.filter(x=>publicSafeMediaUrl(x.media_url));
    if(toolbar) toolbar.innerHTML=`<div class="public-gallery-filter-label"><i class="fas fa-images"></i><span>Album / chuyên mục</span></div><div class="public-gallery-filter-chips">${categories.map(cat=>`<button type="button" class="${cat===PUBLIC_GALLERY_CATEGORY?'active':''}" onclick="setPublicGalleryCategory('${publicEscape(cat).replace(/'/g,'&#39;')}')">${publicEscape(cat)}</button>`).join('')}</div><span class="public-gallery-count">${filtered.length} ảnh</span>`;
    if(!PUBLIC_GALLERY_VISIBLE.length){
        grid.innerHTML='<div class="public-empty-state"><i class="fas fa-camera-retro"></i><strong>Chưa có hình ảnh trong chuyên mục này</strong><span>Hãy chọn chuyên mục khác hoặc quay lại Tất cả.</span></div>';
        return;
    }
    grid.innerHTML=PUBLIC_GALLERY_VISIBLE.slice(0,24).map((item,idx)=>{
        const url=publicSafeMediaUrl(item.media_url);
        return `<figure class="public-gallery-card ${idx===0?'public-gallery-featured':''}" role="button" tabindex="0" onclick="openPublicMediaModal('${item.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openPublicMediaModal('${item.id}')}" aria-label="Xem ảnh ${publicEscape(item.title||'Hoạt động nhà trường')}"><img src="${url}" alt="${publicEscape(item.title||'Hình ảnh hoạt động')}" loading="lazy"><figcaption><b>${publicEscape(item.title||'Hoạt động nhà trường')}</b>${item.category?`<span><i class="far fa-folder-open"></i> ${publicEscape(item.category)}</span>`:''}</figcaption></figure>`;
    }).join('');
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
function renderPublicLinks(items=[]) {
    const grid=document.getElementById('publicLinksGrid');
    const quick=document.getElementById('publicQuickLinks');
    const list=(items||[]).filter(x=>publicSafeExternalUrl(x.url));
    if(grid){
        if(!list.length) grid.innerHTML='<div class="public-empty-state"><i class="fas fa-link"></i><strong>Chưa có liên kết công khai</strong><span>Admin có thể thêm các website giáo dục hữu ích.</span></div>';
        else grid.innerHTML=list.map(x=>{
            const href=publicSafeExternalUrl(x.url), icon=publicLinkIcon(x.icon);
            return `<a href="${href}" target="_blank" rel="noopener noreferrer"><i class="fas fa-${icon}"></i><div><b>${publicEscape(x.title||'Liên kết')}</b><span>${publicEscape(x.description||'Mở website')}</span></div><i class="fas fa-arrow-up-right-from-square"></i></a>`;
        }).join('');
    }
    if(quick){
        const top=list.slice(0,3);
        quick.innerHTML=top.length?top.map(x=>`<a href="${publicSafeExternalUrl(x.url)}" target="_blank" rel="noopener noreferrer"><i class="fas fa-${publicLinkIcon(x.icon)}"></i><span>${publicEscape(x.title||'Liên kết')}</span></a>`).join(''):'<span class="u-utility-empty">Chưa có liên kết.</span>';
    }
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
    <div class="table-wrapper mt-2"><table><thead><tr><th>Loại</th><th>Tiêu đề</th><th>Nhóm</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${(data||[]).map(x=>`<tr><td>${mediaTypeLabel(x.media_type)}</td><td><strong>${publicEscape(x.title||'')}</strong></td><td>${publicEscape(x.category||'')}</td><td>${x.is_published?'Công khai':'Đang ẩn'}</td><td><button class="btn btn-primary btn-sm" onclick='editPublicMedia(${JSON.stringify(JSON.stringify(x))})'><i class="fas fa-pen"></i></button> <button class="btn btn-danger btn-sm" onclick="deletePublicMedia('${x.id}')"><i class="fas fa-trash"></i></button></td></tr>`).join('')||'<tr><td colspan="5" class="text-muted">Chưa có hình ảnh/video.</td></tr>'}</tbody></table></div>`;
    updatePublicMediaFormByType();
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
}

function initPublicWebsite() {
    updatePublicTodayLabel();
    setupPublicHero([]);
    loadPublicWebsiteContent();
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
    const navLinks = [...document.querySelectorAll('#publicSite .u-side-nav a[href^="#"], #publicSite .public-mobile-menu a[href^="#"]')];
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
    if (!requireEditPermission('thay đổi cấu hình môn học')) return;
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
            console.log(`[BACKUP] ${table}: ${rows.length} dòng (${completed}/${BACKUP_TABLES.length})`);
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
        console.log('FULL RESTORE RESULT:',data);
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
                    </td>
                </tr>
                <tr id="assignmentRow_${r.user_id}" style="display:none">
                    <td colspan="6" style="padding:12px;background:rgba(127,127,127,.06)">${renderAssignmentMatrix(r.user_id, userAssignments)}</td>
                </tr>`;
        }).join('');

        panel.innerHTML = `
            <p>Vai trò hiện tại: <strong>${escapeRoleHtml(APP_STATE.currentUserRole)}</strong></p>
            <p class="text-muted" style="font-size:.84rem">Phạm vi <strong>Tất cả</strong>: được truy cập toàn bộ môn/lớp theo vai trò. <strong>Theo phân công</strong>: chỉ các cặp Môn – Lớp được Admin chọn. Bước này mới quản lý cấu hình; bộ lọc nghiệp vụ sẽ được áp dụng ở bước sau.</p>
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

window.loadCurrentUserAccess = loadCurrentUserAccess;
window.isAdmin = isAdmin;
window.isTeacher = isTeacher;
window.isViewer = isViewer;
window.canManageSystem = canManageSystem;
window.canEditData = canEditData;
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

async function importVnEduStudentWorkbook(event){
 if(!requireEditPermission('nhập danh sách học sinh theo mẫu VNEDU')){ if(event?.target)event.target.value=''; return; }
 const file=event?.target?.files?.[0]; if(!file)return;
 try{
  const wb=XLSX.read(new Uint8Array(await file.arrayBuffer()),{type:'array',cellDates:false}), parsed=[];
  for(const sn of wb.SheetNames){
   if(/bia/i.test(sn))continue;
   const rows=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,defval:'',raw:true});
   let cls=''; for(const row of rows.slice(0,8)){ const m=row.map(normalizeVnEduText).join(' ').match(/Lớp\s*:\s*([1-5][A-Za-z0-9]+)/i); if(m){cls=m[1].toUpperCase();break;} }
   if(!cls&&/^[1-5][A-Za-z0-9]+$/i.test(sn))cls=sn.toUpperCase(); if(!cls)continue;
   const h=rows.findIndex(row=>row.some(v=>/Mã học sinh/i.test(normalizeVnEduText(v)))); if(h<0)continue;
   const header=(rows[h]||[]).map(v=>normalizeVnEduText(v).toLowerCase());
   const col=(patterns,fallback=-1)=>{
       const i=header.findIndex(x=>patterns.some(p=>p.test(x)));
       return i>=0?i:fallback;
   };
   const codeCol=col([/^mã học sinh$/i],1);
   const nameCol=col([/^họ và tên$/i,/^họ tên$/i],2);
   const dobCol=col([/^ngày sinh$/i],4);
   const genderCol=col([/^giới tính$/i],5);
   for(let r=h+1;r<rows.length;r++){
    const row=rows[r],code=normalizeVnEduText(row[codeCol]),name=normalizeVnEduText(row[nameCol]);
    if(!/^\d+$/.test(code)||!name)continue;
    const genderRaw=normalizeVnEduText(row[genderCol]).toLowerCase();
    const gender=genderRaw==='x'||genderRaw==='nữ'||genderRaw==='nu'?'Nữ':'Nam';
    parsed.push({student_code:code,full_name:name,dob:parseVnEduDate(row[dobCol])||null,gender,class_name:cls,grade:cls[0]});
   }
  }
  if(!parsed.length)throw new Error('Không tìm thấy học sinh đúng cấu trúc file mẫu.');
  for(const cls of [...new Set(parsed.map(x=>x.class_name))]){
   if(!APP_STATE.classes.some(c=>c.name===cls)){ const {data,error}=await supabase.from('app3_classes').insert([{name:cls,grade:cls[0],class_code:'L'+cls,teacher:APP_STATE.currentUserDisplayName||'Giáo viên'}]).select().single(); if(error)throw error; APP_STATE.classes.push(data); APP_STATE.classMap[cls]=data.id; }
  }
  let ok=0; for(const st of parsed){ const classId=APP_STATE.classes.find(c=>c.name===st.class_name)?.id;
   const payload={student_code:st.student_code,full_name:st.full_name,dob:st.dob,gender:st.gender,class_id:classId,grade:st.grade,status:'Đang học'};
   const existing=APP_STATE.students.find(s=>s.id===st.student_code);
   const q=existing?supabase.from('app3_students').update(payload).eq('student_code',st.student_code):supabase.from('app3_students').insert([{...payload,avatar_url:DEFAULT_AVATAR}]);
   const {error}=await q;if(error)throw error;ok++;
  }
  await loadAllData();
  renderPage('students');
  showToast(`Đã đồng bộ ${ok} học sinh từ file mẫu VNEDU và tải lại dữ liệu thành công.`,'success');
 }catch(err){console.error(err);showToast('Lỗi nhập danh sách VNEDU: '+err.message,'error');}finally{if(event?.target)event.target.value='';}
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
            mobileBtn.addEventListener('touchstart', toggleMenu, { passive: false });
        }

        if (overlay) {
            overlay.addEventListener('click', closeMenu);
            overlay.addEventListener('touchstart', closeMenu, { passive: false });
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

// BƯỚC 150.3.1: hỗ trợ truy cập hệ thống trên thiết bị di động
window.showPublicSite = showPublicSite;
window.showLoginFromPublic = showLoginFromPublic;
window.showAuthenticatedApp = showAuthenticatedApp;

window.setPublicDocumentCategory=setPublicDocumentCategory;
window.setPublicDocumentSearch=setPublicDocumentSearch;
