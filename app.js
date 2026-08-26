// -------------------------------------------------------------
// 스마트 자리배치 시스템 - 애플리케이션 로직
// -------------------------------------------------------------

// 애플리케이션 상태 관리
const state = {
    students: [], // { id, name, isLocked, seatIndex }
    seats: Array(20).fill(null), // 각 인덱스(0~19)에 배치된 학생의 id 또는 null
};

// DOM 요소 참조
const studentInput = document.getElementById('student-input');
const btnLoadDummy = document.getElementById('btn-load-dummy');
const btnUploadExcel = document.getElementById('btn-upload-excel');
const excelFileInput = document.getElementById('excel-file-input');
const btnRegister = document.getElementById('btn-register');
const btnShuffle = document.getElementById('btn-shuffle');
const btnReset = document.getElementById('btn-reset');
const btnPrint = document.getElementById('btn-print');
const btnPresentation = document.getElementById('btn-presentation');
const btnExitPresentation = document.getElementById('btn-exit-presentation');
const btnSave = document.getElementById('btn-save');
const btnLoad = document.getElementById('btn-load');
const btnExportFile = document.getElementById('btn-export-file');
const btnImportFile = document.getElementById('btn-import-file');
const fileInput = document.getElementById('file-input');
const saveTimeText = document.getElementById('save-time-text');
const toastContainer = document.getElementById('toast-container');

const seatingGrid = document.getElementById('seating-grid');
const waitingList = document.getElementById('waiting-list');
const statTotal = document.getElementById('stat-total');
const statPlaced = document.getElementById('stat-placed');

const LOCAL_STORAGE_KEY = 'smart_seating_saved_data';

// 예시 학생 명단 (20명)
const DUMMY_STUDENTS = [
    "김민준", "이서연", "박도윤", "최아윤", "정예준", 
    "강윤서", "조시우", "윤서준", "장하은", "임주원", 
    "한은지", "오민서", "서준우", "신지아", "권현우", 
    "황다은", "안지훈", "송하윤", "전우진", "홍채원"
];

// 초기화 함수
function init() {
    createGridSlots();
    setupEventListeners();
    checkSavedData();
    // 저장된 데이터가 존재하면 자동 복원 시도
    if (localStorage.getItem(LOCAL_STORAGE_KEY)) {
        loadFromLocalStorage(true);
    } else {
        updateUI();
        loadStudentListFromExcel(); // 저장 데이터가 없을 경우 엑셀 출석부 연동
    }
}

// 4열 5행의 자리 슬롯 생성 (가운데 통로 컬럼(3) 적용)
function createGridSlots() {
    seatingGrid.innerHTML = '';
    
    // 통로 공간 생성 및 삽입 (3번째 열에 5개 행 영역을 차지)
    const aisle = document.createElement('div');
    aisle.className = 'aisle-space';
    const aisleLine = document.createElement('div');
    aisleLine.className = 'aisle-line';
    aisle.appendChild(aisleLine);
    seatingGrid.appendChild(aisle);

    // 20개의 자리 생성 (4열 5행)
    for (let i = 0; i < 20; i++) {
        const slot = document.createElement('div');
        slot.className = 'seat-slot';
        slot.dataset.seatIndex = i;
        
        // 자리 번호 라벨
        const numberLabel = document.createElement('span');
        numberLabel.className = 'seat-number';
        numberLabel.innerText = `${i + 1}번`;
        slot.appendChild(numberLabel);
        
        // CSS Grid 행/열 설정 (2열과 3열 사이에 통로를 둠)
        const row = Math.floor(i / 4) + 1; // 1 ~ 5행
        const colInRow = i % 4; // 0, 1, 2, 3열 (한 행 내부 기준)
        
        let gridCol;
        if (colInRow < 2) {
            gridCol = colInRow + 1; // 1열 -> col 1, 2열 -> col 2
        } else {
            gridCol = colInRow + 2; // 3열 -> col 4, 4열 -> col 5 (col 3은 통로)
        }
        
        slot.style.gridRow = row;
        slot.style.gridColumn = gridCol;

        // 드래그 앤 드롭 이벤트 설정
        slot.addEventListener('dragover', handleDragOver);
        slot.addEventListener('dragleave', handleDragLeave);
        slot.addEventListener('drop', handleDrop);

        seatingGrid.appendChild(slot);
    }
}

// 이벤트 리스너 등록
function setupEventListeners() {
    // 예시 명단 채우기 버튼 (출석부 연동)
    btnLoadDummy.addEventListener('click', () => {
        loadStudentListFromExcel();
    });

    // 엑셀 수동 업로드 버튼 및 인풋 연동
    btnUploadExcel.addEventListener('click', () => {
        excelFileInput.click();
    });
    excelFileInput.addEventListener('change', handleExcelUpload);

    // 명단 등록 버튼
    btnRegister.addEventListener('click', registerStudents);

    // 랜덤 배치 버튼
    btnShuffle.addEventListener('click', shuffleAndPlace);

    // 자리 비우기 버튼
    btnReset.addEventListener('click', resetSeating);

    // 크게 보기 버튼
    btnPresentation.addEventListener('click', enterPresentationMode);

    // 편집 모드로 복귀 버튼
    btnExitPresentation.addEventListener('click', exitPresentationMode);

    // 저장 관련 버튼 리스너
    btnSave.addEventListener('click', saveToLocalStorage);
    btnLoad.addEventListener('click', () => loadFromLocalStorage(false));
    btnExportFile.addEventListener('click', exportToFile);
    btnImportFile.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', importFromFile);

    // 인쇄 버튼
    btnPrint.addEventListener('click', () => {
        window.print();
    });

    // 대기 학생 영역 드래그 앤 드롭 수용
    waitingList.addEventListener('dragover', handleDragOver);
    waitingList.addEventListener('dragleave', handleDragLeave);
    waitingList.addEventListener('drop', handleDropToWaitingList);

    // ESC 키로 크게 보기 탈출
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.body.classList.contains('presentation-mode')) {
            exitPresentationMode();
        }
    });
}

// 학생 명단 등록 로직
function registerStudents() {
    const text = studentInput.value.trim();
    if (!text) {
        alert('학생 이름을 입력해 주세요.');
        return;
    }

    // 줄바꿈으로 분리 후 빈 줄 제거
    const names = text.split('\n')
        .map(name => name.trim())
        .filter(name => name.length > 0);

    // 새로운 학생 배열 구성 (기존의 잠금 상태나 자리 배치를 최대한 유지하려고 시도하지만, 명단이 대폭 바뀌면 재설정)
    const newStudents = names.map((name, index) => {
        // 기존 학생 중 동일한 이름이 있으면 설정(잠금 등)을 보존해 주는 매칭 작업
        const existing = state.students.find(s => s.name === name);
        if (existing) {
            return {
                id: existing.id,
                name: name,
                isLocked: existing.isLocked,
                seatIndex: existing.seatIndex,
                no: index + 1 // 명단 내의 순서 번호 부여
            };
        }
        return {
            id: `student_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 5)}`,
            name: name,
            isLocked: false,
            seatIndex: null,
            no: index + 1 // 명단 내의 순서 번호 부여
        };
    });

    state.students = newStudents;
    
    // 자리에 지정된 ID가 현재 명단에 없으면 해당 자리를 null로 초기화
    const studentIds = new Set(state.students.map(s => s.id));
    state.seats = state.seats.map(id => studentIds.has(id) ? id : null);

    // 학생 객체의 seatIndex 동기화
    state.students.forEach(student => {
        const foundSeatIdx = state.seats.indexOf(student.id);
        student.seatIndex = foundSeatIdx !== -1 ? foundSeatIdx : null;
    });

    // 입력 창 초기화 및 UI 갱신
    updateUI();
    lucide.createIcons();
}

// 랜덤 배치 알고리즘 (고정된 학생 자리는 제외)
function shuffleAndPlace() {
    // 1. 고정(Locked)된 학생들과 그들의 자리 위치 파악
    const lockedStudents = state.students.filter(s => s.isLocked && s.seatIndex !== null);
    
    // 2. 배치되어야 하지만 고정되지 않은 학생들 모으기
    //    (고정되지 않은 채 자리에 있던 학생들 + 대기 중인 학생들)
    const flexibleStudents = state.students.filter(s => !s.isLocked || s.seatIndex === null);

    // 3. 고정된 자리를 제외한 빈 자리 인덱스 리스트 추출
    const lockedSeatsSet = new Set(lockedStudents.map(s => s.seatIndex));
    const availableSeats = [];
    for (let i = 0; i < 20; i++) {
        if (!lockedSeatsSet.has(i)) {
            availableSeats.push(i);
        }
    }

    // 4. 움직일 수 있는 학생들 리스트 셔플 (Fisher-Yates Shuffle)
    const shuffledStudents = [...flexibleStudents];
    for (let i = shuffledStudents.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledStudents[i], shuffledStudents[j]] = [shuffledStudents[j], shuffledStudents[i]];
    }

    // 5. 시트 초기화 후 다시 배치
    // 우선 전체 시트에서 잠금되지 않은 칸을 비움
    state.seats = state.seats.map((id, index) => {
        if (lockedSeatsSet.has(index)) {
            return id; // 고정된 자리는 유지
        }
        return null;
    });

    // 셔플된 학생들을 남은 빈 자리에 차례대로 채움
    shuffledStudents.forEach((student, index) => {
        if (index < availableSeats.length) {
            const targetSeatIdx = availableSeats[index];
            state.seats[targetSeatIdx] = student.id;
            student.seatIndex = targetSeatIdx;
        } else {
            // 자리가 모자라 배치되지 못한 학생은 대기실로
            student.seatIndex = null;
        }
    });

    // 고정된 학생들의 seatIndex도 확실히 유지되고 있는지 확인 및 설정
    lockedStudents.forEach(student => {
        state.seats[student.seatIndex] = student.id;
    });

    updateUI();
    lucide.createIcons();
}

// 모든 자리 비우기 (고정 상태는 유지하되 대기 목록으로 보낼 것인가? 혹은 모든 자리를 빈자리로?)
// 여기서는 '자리 비우기' 클릭 시 모든 자리를 비우고 학생들을 대기 목록으로 보냅니다. (자리 고정 상태도 해제 혹은 유지 가능하지만, 리셋 느낌이므로 고정도 해제합니다)
function resetSeating() {
    state.seats = Array(20).fill(null);
    state.students.forEach(student => {
        student.seatIndex = null;
        student.isLocked = false; // 리셋할 때 고정 상태도 함께 해제하여 완전 초기화합니다.
    });

    updateUI();
    lucide.createIcons();
}

// UI 업데이트 및 렌더링
function updateUI() {
    const totalStudents = state.students.length;
    
    // 1. 활성화/비활성화 버튼 상태 제어
    btnShuffle.disabled = totalStudents === 0;
    btnReset.disabled = totalStudents === 0;
    btnPresentation.disabled = totalStudents === 0;
    btnSave.disabled = totalStudents === 0;
    btnExportFile.disabled = totalStudents === 0;

    // 2. 통계 업데이트
    const placedCount = state.students.filter(s => s.seatIndex !== null).length;
    statTotal.innerText = `${totalStudents}명`;
    statPlaced.innerText = placedCount;

    // 3. 자리 그리드 렌더링
    for (let i = 0; i < 20; i++) {
        const slot = seatingGrid.querySelector(`[data-seat-index="${i}"]`);
        // 기존 학생 카드 엘리먼트 제거 (자리 번호 라벨 제외)
        const oldCard = slot.querySelector('.student-card');
        if (oldCard) {
            oldCard.remove();
        }

        const studentId = state.seats[i];
        if (studentId) {
            const student = state.students.find(s => s.id === studentId);
            if (student) {
                const card = createStudentCard(student);
                slot.appendChild(card);
            }
        }
    }

    // 4. 대기 학생 목록 렌더링
    waitingList.innerHTML = '';
    // 번호(no) 오름차순으로 대기 학생 목록 정렬
    const waitingStudents = state.students
        .filter(s => s.seatIndex === null)
        .sort((a, b) => (a.no || 0) - (b.no || 0));

    if (waitingStudents.length === 0) {
        const msg = document.createElement('p');
        msg.className = 'empty-waiting-msg';
        msg.innerText = totalStudents > 0 ? '모든 학생이 배치되었습니다.' : '학생 명단을 등록하면 여기에 표시됩니다.';
        waitingList.appendChild(msg);
    } else {
        waitingStudents.forEach(student => {
            const tag = createWaitingStudentTag(student);
            waitingList.appendChild(tag);
        });
    }
}

// 자리용 학생 카드 엘리먼트 생성
function createStudentCard(student) {
    const card = document.createElement('div');
    card.className = `student-card ${student.isLocked ? 'locked' : ''}`;
    card.setAttribute('draggable', 'true');
    card.dataset.studentId = student.id;

    // 학생 이름 표시
    const nameSpan = document.createElement('span');
    nameSpan.className = 'student-name';
    nameSpan.innerText = student.name;
    card.appendChild(nameSpan);

    // 고정 토글 버튼
    const lockBtn = document.createElement('button');
    lockBtn.className = 'lock-toggle';
    lockBtn.setAttribute('title', student.isLocked ? '자리 고정 해제' : '자리 고정');
    
    // 자물쇠 아이콘 설정
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', student.isLocked ? 'lock' : 'unlock');
    lockBtn.appendChild(icon);

    // 고정 버튼 클릭 이벤트
    lockBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // 드래그 이벤트 등으로 전파되는 것 방지
        toggleLock(student.id);
    });

    card.appendChild(lockBtn);

    // 드래그 시작 이벤트
    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragend', handleDragEnd);

    return card;
}

// 대기실용 학생 태그 엘리먼트 생성
function createWaitingStudentTag(student) {
    const tag = document.createElement('div');
    tag.className = 'waiting-student';
    tag.setAttribute('draggable', 'true');
    tag.dataset.studentId = student.id;

    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', 'user');
    tag.appendChild(icon);

    const nameSpan = document.createElement('span');
    nameSpan.innerText = student.name;
    tag.appendChild(nameSpan);

    tag.addEventListener('dragstart', handleDragStart);
    tag.addEventListener('dragend', handleDragEnd);

    return tag;
}

// 고정 상태 토글
function toggleLock(studentId) {
    const student = state.students.find(s => s.id === studentId);
    if (student && student.seatIndex !== null) {
        student.isLocked = !student.isLocked;
        updateUI();
        lucide.createIcons();
    }
}

// -------------------------------------------------------------
// 드래그 앤 드롭 이벤트 핸들러
// -------------------------------------------------------------

let draggedStudentId = null;

function handleDragStart(e) {
    draggedStudentId = e.currentTarget.dataset.studentId;
    e.currentTarget.classList.add('dragging');
    // 드래그 데이터 전달 (브라우저 기본 동작 보장용)
    e.dataTransfer.setData('text/plain', draggedStudentId);
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd(e) {
    e.currentTarget.classList.remove('dragging');
    draggedStudentId = null;
    
    // 드래그 종료 시 모든 자리 슬롯에서 drag-over 클래스 제거
    document.querySelectorAll('.seat-slot').forEach(slot => {
        slot.classList.remove('drag-over');
    });
    waitingList.classList.remove('drag-over');
}

function handleDragOver(e) {
    e.preventDefault(); // 드롭을 허용하기 위해 필수
    e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
}

// 자리 슬롯에 드롭했을 때
function handleDrop(e) {
    e.preventDefault();
    const slot = e.currentTarget;
    slot.classList.remove('drag-over');
    
    const targetSeatIndex = parseInt(slot.dataset.seatIndex, 10);
    if (isNaN(targetSeatIndex)) return;

    const student = state.students.find(s => s.id === draggedStudentId);
    if (!student) return;

    const originalSeatIndex = student.seatIndex;
    const residentStudentId = state.seats[targetSeatIndex];

    // 드래그 앤 드롭 이동 시에는 이동이 우선이므로 이동하려는 학생의 잠금은 해제해 줍니다.
    student.isLocked = false;

    if (residentStudentId) {
        // 케이스 1: 대상 자리에 이미 다른 학생이 있는 경우 (Swap 또는 대기 복귀)
        const residentStudent = state.students.find(s => s.id === residentStudentId);
        
        // 대상 학생의 잠금도 해제하여 사용자가 편하게 수동 배치할 수 있게 합니다.
        residentStudent.isLocked = false;

        if (originalSeatIndex !== null) {
            // 1) 둘 다 자리에 배치되어 있던 상태 -> 자리를 교체(Swap)
            state.seats[originalSeatIndex] = residentStudentId;
            residentStudent.seatIndex = originalSeatIndex;
        } else {
            // 2) 드래그된 학생은 대기실, 대상 자리에만 학생이 있던 상태 -> 대상 학생을 대기실로 보내고 드래그 학생이 차지
            residentStudent.seatIndex = null;
        }
        
        state.seats[targetSeatIndex] = draggedStudentId;
        student.seatIndex = targetSeatIndex;
    } else {
        // 케이스 2: 대상 자리가 비어 있는 경우
        if (originalSeatIndex !== null) {
            // 1) 자리에 있던 학생이 빈자리로 이동 -> 원래 자리는 비움
            state.seats[originalSeatIndex] = null;
        }
        
        state.seats[targetSeatIndex] = draggedStudentId;
        student.seatIndex = targetSeatIndex;
    }

    updateUI();
    lucide.createIcons();
}

// 대기실 목록에 드롭했을 때 (자리에 있던 학생을 대기실로 보냄)
function handleDropToWaitingList(e) {
    e.preventDefault();
    waitingList.classList.remove('drag-over');

    const student = state.students.find(s => s.id === draggedStudentId);
    if (!student) return;

    const originalSeatIndex = student.seatIndex;

    // 자리에 배치되어 있던 경우에만 처리 (이미 대기실에 있는 경우 변화 없음)
    if (originalSeatIndex !== null) {
        state.seats[originalSeatIndex] = null;
        student.seatIndex = null;
        student.isLocked = false; // 대기실로 오면서 고정 상태 해제
        
        updateUI();
        lucide.createIcons();
    }
}

// -------------------------------------------------------------
// 크게 보기 (프리젠테이션) 모드 핸들러
// -------------------------------------------------------------

function enterPresentationMode() {
    document.body.classList.add('presentation-mode');
}

function exitPresentationMode() {
    document.body.classList.remove('presentation-mode');
}

// -------------------------------------------------------------
// 저장 & 불러오기 기능 (LocalStorage 및 JSON 파일)
// -------------------------------------------------------------

// 브라우저 LocalStorage에 현재 상태 저장
function saveToLocalStorage() {
    if (state.students.length === 0) {
        showToast('저장할 자리배치 명단이 없습니다.', 'warning');
        return;
    }

    const now = new Date();
    const timeStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const saveData = {
        students: state.students,
        seats: state.seats,
        savedAt: timeStr
    };

    try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(saveData));
        showToast('자리배치가 성공적으로 저장되었습니다!', 'success');
        checkSavedData();
    } catch (err) {
        console.error(err);
        showToast('저장 처리 중 오류가 발생했습니다.', 'error');
    }
}

// 브라우저 LocalStorage에서 데이터 불러오기
function loadFromLocalStorage(isAutoLoad = false) {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
        if (!isAutoLoad) showToast('저장된 자리배치 데이터가 없습니다.', 'warning');
        return;
    }

    try {
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.students) || !Array.isArray(parsed.seats)) {
            throw new Error('유효하지 않은 데이터 구조');
        }

        state.students = parsed.students;
        // 기존에 no 속성이 없는 저장 데이터와의 하위 호환성을 위해 no 부여
        state.students.forEach((s, idx) => {
            if (s.no === undefined) {
                s.no = idx + 1;
            }
        });
        state.seats = parsed.seats;

        // 텍스트 입력 창 동기화
        studentInput.value = state.students.map(s => s.name).join('\n');

        updateUI();
        lucide.createIcons();
        checkSavedData();

        if (!isAutoLoad) {
            showToast(`저장된 자리배치를 불러왔습니다. (${parsed.savedAt || ''})`, 'info');
        }
    } catch (err) {
        console.error(err);
        if (!isAutoLoad) showToast('저장 데이터를 불러오는데 실패했습니다.', 'error');
    }
}

// 파일(.json)로 내보내기 다운로드
function exportToFile() {
    if (state.students.length === 0) {
        showToast('저장할 자리배치 명단이 없습니다.', 'warning');
        return;
    }

    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const timeStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const exportData = {
        students: state.students,
        seats: state.seats,
        savedAt: timeStr,
        version: '1.0'
    };

    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `자리배치_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('자리배치가 파일(.json)로 다운로드되었습니다!', 'success');
}

// 파일(.json) 불러오기
function importFromFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const parsed = JSON.parse(e.target.result);
            if (!parsed || !Array.isArray(parsed.students) || !Array.isArray(parsed.seats)) {
                throw new Error('유효하지 않은 데이터 구조입니다.');
            }

            state.students = parsed.students;
            state.seats = parsed.seats;
            studentInput.value = state.students.map(s => s.name).join('\n');

            updateUI();
            lucide.createIcons();
            showToast('파일에서 자리배치를 성공적으로 불러왔습니다!', 'success');
        } catch (err) {
            console.error(err);
            showToast('올바르지 않은 파일 형식이거나 파일이 손상되었습니다.', 'error');
        }
        event.target.value = ''; // 파일 선택 입력 초기화
    };
    reader.readAsText(file);
}

// 저장 데이터 존재 여부 체크 및 UI 변경
function checkSavedData() {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
        try {
            const parsed = JSON.parse(raw);
            btnLoad.disabled = false;
            if (parsed.savedAt) {
                saveTimeText.innerText = `최근 저장: ${parsed.savedAt}`;
            } else {
                saveTimeText.innerText = '저장된 데이터 있음';
            }
        } catch (e) {
            btnLoad.disabled = true;
            saveTimeText.innerText = '저장 기록 없음';
        }
    } else {
        btnLoad.disabled = true;
        saveTimeText.innerText = '저장 기록 없음';
    }
}

// 엑셀 파일로부터 학생 명단 자동 로드
async function loadStudentListFromExcel() {
    try {
        showToast('출석부 파일에서 명단을 불러오는 중...', 'info');
        
        const response = await fetch('/공동실습소 출석부.xlsx');
        if (!response.ok) {
            throw new Error('출석부 파일을 찾을 수 없거나 불러올 수 없습니다.');
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        
        const sheetNames = workbook.SheetNames;
        if (!sheetNames || sheetNames.length === 0) {
            throw new Error('엑셀 파일에 시트가 존재하지 않습니다.');
        }
        
        // 맨 마지막 시트 선택
        const lastSheetName = sheetNames[sheetNames.length - 1];
        const worksheet = workbook.Sheets[lastSheetName];
        
        // 2차원 배열로 변환
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        // 학생 이름 추출
        const extractedNames = [];
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length < 2) continue;
            
            const numberVal = row[0];
            const nameVal = row[1];
            
            // 첫 번째 셀이 숫자(번호)이고 두 번째 셀이 유효한 문자열(이름)인 행
            const isNumber = typeof numberVal === 'number' && Number.isInteger(numberVal) && numberVal > 0;
            const isNameValid = typeof nameVal === 'string' && nameVal.trim().length > 0;
            
            if (isNumber && isNameValid) {
                extractedNames.push(nameVal.trim());
            }
        }
        
        if (extractedNames.length === 0) {
            throw new Error(`마지막 시트('${lastSheetName}')에서 학생 명단을 찾을 수 없습니다.`);
        }
        
        // 학생 명단 입력창에 채우고 자동 등록
        studentInput.value = extractedNames.join('\n');
        registerStudents();
        
        showToast(`'${lastSheetName}' 시트에서 학생 ${extractedNames.length}명의 명단을 불러왔습니다.`, 'success');
    } catch (error) {
        console.error('Excel load error:', error);
        showToast(`출석부 자동 로드 실패: ${error.message}. 예시 명단을 로드합니다.`, 'error');
        // 실패 시 예시 명단 채우기
        studentInput.value = DUMMY_STUDENTS.join('\n');
        registerStudents();
    }
}

// 업로드한 엑셀 파일로부터 학생 명단 파싱 및 등록
async function handleExcelUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        showToast('엑셀 파일을 파싱하는 중...', 'info');

        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });

        const sheetNames = workbook.SheetNames;
        if (!sheetNames || sheetNames.length === 0) {
            throw new Error('엑셀 파일에 시트가 존재하지 않습니다.');
        }

        // 맨 마지막 시트 선택
        const lastSheetName = sheetNames[sheetNames.length - 1];
        const worksheet = workbook.Sheets[lastSheetName];

        // 2차원 배열로 변환
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        // 학생 이름 추출
        const extractedNames = [];
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length < 2) continue;

            const numberVal = row[0];
            const nameVal = row[1];

            // 첫 번째 셀이 숫자(번호)이고 두 번째 셀이 유효한 문자열(이름)인 행
            const isNumber = typeof numberVal === 'number' && Number.isInteger(numberVal) && numberVal > 0;
            const isNameValid = typeof nameVal === 'string' && nameVal.trim().length > 0;

            if (isNumber && isNameValid) {
                extractedNames.push(nameVal.trim());
            }
        }

        if (extractedNames.length === 0) {
            throw new Error(`마지막 시트('${lastSheetName}')에서 학생 명단을 찾을 수 없습니다.`);
        }

        // 학생 명단 입력창에 채우고 자동 등록
        studentInput.value = extractedNames.join('\n');
        registerStudents();

        showToast(`'${lastSheetName}' 시트에서 학생 ${extractedNames.length}명의 명단을 불러왔습니다.`, 'success');
    } catch (error) {
        console.error('Excel upload error:', error);
        showToast(`엑셀 파싱 실패: ${error.message}`, 'error');
    } finally {
        event.target.value = ''; // 파일 선택 입력 초기화
    }
}

// 토스트 알림 표시
function showToast(message, type = 'info') {
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle';
    if (type === 'warning') iconName = 'alert-triangle';
    if (type === 'error') iconName = 'alert-circle';

    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', iconName);

    const text = document.createElement('span');
    text.innerText = message;

    toast.appendChild(icon);
    toast.appendChild(text);
    toastContainer.appendChild(toast);
    lucide.createIcons();

    setTimeout(() => {
        toast.style.animation = 'toastOut 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}

// 앱 실행
init();
