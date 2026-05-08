<?php
session_start();

// 로그인하지 않은 사용자는 로그인 페이지로 리다이렉트
if (!isset($_SESSION['user_id'])) {
    header('Location: login.php');
    exit;
}

// 현재 날짜 및 시간 정보
date_default_timezone_set('Asia/Seoul');
$today = new DateTime();
$currentDate = $today->format('Y년 n월 j일');
$currentYear = $today->format('Y');
$currentMonth = $today->format('n');
$currentDay = $today->format('j');
$dayOfYear = $today->format('z') + 1; // 1부터 시작하도록 +1

// 한국어 요일 배열
$koreanDays = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
$koreanShortDays = ['일', '월', '화', '수', '목', '금', '토'];
$currentDayOfWeek = $koreanDays[$today->format('w')];

// 주간 캘린더를 위한 날짜 계산
$weekStart = clone $today;
$weekStart->modify('last sunday');
if ($weekStart > $today) {
    $weekStart->modify('-7 days');
}

$weekDates = [];
for ($i = 0; $i < 7; $i++) {
    $date = clone $weekStart;
    $date->modify("+$i days");
    $weekDates[] = [
        'day' => $date->format('j'),
        'isToday' => $date->format('Y-m-d') === $today->format('Y-m-d'),
        'dayName' => $koreanShortDays[$date->format('w')]
    ];
}
?>
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>To Do List</title>
    <script>
        // Non-Chrome 브라우저에서 가독성 향상을 위해 라이트 대비 모드 적용
        (function() {
            var ua = navigator.userAgent;
            var isChrome = /Chrome\/[0-9]+/.test(ua) && !/Edg\//.test(ua) && !/OPR\//.test(ua);
            if (!isChrome) {
                document.documentElement.classList.add('light-contrast');
            }
        })();
    </script>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <style>
        .glass {
            background: rgba(255, 255, 255, 0.25);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.18);
        }
        .glass-dark {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(15px);
            -webkit-backdrop-filter: blur(15px);
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        .floating-animation {
            animation: float 6s ease-in-out infinite;
        }
        @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-10px); }
        }
        .glow {
            box-shadow: 0 0 20px rgba(59, 130, 246, 0.3);
        }
        .glow-green {
            box-shadow: 0 0 15px rgba(34, 197, 94, 0.3);
        }
        
        .text-gradient {
            background: linear-gradient(45deg, #f59e0b, #ec4899, #8b5cf6);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        
        .title-glow {
            text-shadow: 0 0 30px rgba(255, 255, 255, 0.5),
                         0 0 60px rgba(59, 130, 246, 0.3),
                         0 0 90px rgba(147, 51, 234, 0.2);
        }
        
        .sparkle-animation {
            animation: sparkle 2s ease-in-out infinite alternate;
        }
        
        @keyframes sparkle {
            0% { 
                transform: scale(1) rotate(0deg);
                opacity: 0.7;
            }
            100% { 
                transform: scale(1.2) rotate(10deg);
                opacity: 1;
            }
        }
        
        .range-bar {
            background: linear-gradient(90deg, rgba(59, 130, 246, 0.8) 0%, rgba(59, 130, 246, 0.6) 100%);
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
        }
        
        .range-bar.completed {
            background: linear-gradient(90deg, rgba(34, 197, 94, 0.8) 0%, rgba(34, 197, 94, 0.6) 100%);
        }
        body {
            /* Dark, static neutral background for better contrast */
            background: linear-gradient(160deg, #0f172a 0%, #111827 50%, #0b1220 100%);
            min-height: 100vh;
            position: relative;
        }
        body::before {
            content: '';
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><radialGradient id="g" cx="50%" cy="50%" r="50%"><stop offset="0%" style="stop-color:rgba(255,255,255,0.1);stop-opacity:1" /><stop offset="100%" style="stop-color:rgba(255,255,255,0);stop-opacity:0" /></radialGradient></defs><circle cx="20" cy="20" r="2" fill="url(%23g)"/><circle cx="80" cy="40" r="1.5" fill="url(%23g)"/><circle cx="40" cy="70" r="1" fill="url(%23g)"/><circle cx="90" cy="80" r="1.5" fill="url(%23g)"/><circle cx="60" cy="30" r="1" fill="url(%23g)"/></svg>') repeat;
            opacity: 0.1;
            pointer-events: none;
            z-index: -1;
        }

        /* 라이트 대비 모드: 비크롬 브라우저에서 배경이 밝을 때 글자색을 어둡게 강제 지정 */
        .light-contrast body {
            background: #ffffff !important;
        }
        .light-contrast .text-white { color: #0f172a !important; }
        .light-contrast .text-white\/90 { color: rgba(15, 23, 42, 0.9) !important; }
        .light-contrast .text-white\/80 { color: rgba(15, 23, 42, 0.8) !important; }
        .light-contrast .text-white\/70 { color: rgba(15, 23, 42, 0.7) !important; }
        .light-contrast .text-white\/60 { color: rgba(15, 23, 42, 0.6) !important; }
        .light-contrast .text-white\/50 { color: rgba(15, 23, 42, 0.5) !important; }
        .light-contrast .text-slate-900 { color: #0f172a !important; }
        .light-contrast .text-slate-700 { color: #334155 !important; }
        .light-contrast .text-cyan-300 { color: #0e7490 !important; }
        .light-contrast .text-green-400 { color: #15803d !important; }
        .light-contrast .text-cyan-400 { color: #0ea5b7 !important; }
        .light-contrast .text-purple-300 { color: #6b21a8 !important; }
        .light-contrast .text-red-400 { color: #b91c1c !important; }

        /* 버튼/배지 배경은 유지하되 텍스트만 가독성 있게 */
        .light-contrast .bg-gradient-to-r.text-white,
        .light-contrast .text-white.bg-gradient-to-r,
        .light-contrast button.text-white,
        .light-contrast .text-white .fas,
        .light-contrast .fas.text-white {
            color: #0f172a !important;
        }

        /* 입력 placeholder 등 회색 계열 대비 향상 */
        .light-contrast ::placeholder { color: #475569 !important; }
        .light-contrast input[type="text"],
        .light-contrast input[type="time"],
        .light-contrast input[type="date"] {
            color: #0f172a !important;
        }

        /* 카드 유리효과가 밝은 배경에서 너무 옅지 않도록 소폭 진하게 */
        .light-contrast .glass { background: rgba(255, 255, 255, 0.75) !important; }
        .light-contrast .glass-dark { background: rgba(255, 255, 255, 0.65) !important; }

        /* 폼 컨트롤: 입력 필드/셀렉트/텍스트에어리어 가독성 향상 */
        .light-contrast input[type="text"],
        .light-contrast input[type="time"],
        .light-contrast input[type="date"],
        .light-contrast textarea,
        .light-contrast select {
            background: #ffffff !important;
            border-color: #cbd5e1 !important; /* slate-300 */
            color: #0f172a !important; /* slate-900 */
            box-shadow: inset 0 1px 2px rgba(0,0,0,0.04) !important;
        }
        .light-contrast input[type="text"]:focus,
        .light-contrast input[type="time"]:focus,
        .light-contrast input[type="date"]:focus,
        .light-contrast textarea:focus,
        .light-contrast select:focus {
            outline: none !important;
            border-color: #06b6d4 !important; /* cyan-500 */
            box-shadow: 0 0 0 3px rgba(34, 211, 238, 0.35) !important; /* focus ring */
            background: #ffffff !important;
        }

        /* 체크박스/라디오 명확한 색상 */
        .light-contrast input[type="checkbox"],
        .light-contrast input[type="radio"] {
            accent-color: #06b6d4; /* cyan-500 */
            border-color: #94a3b8 !important; /* slate-400 */
            background: #ffffff !important;
        }

        /* 버튼: 테두리/호버/포커스 시각적 강조 */
        .light-contrast button {
            border-color: #94a3b8 !important; /* slate-400 */
        }
        .light-contrast button:hover {
            box-shadow: 0 6px 18px rgba(2, 132, 199, 0.18) !important;
            filter: brightness(1.02);
        }
        .light-contrast button:focus-visible {
            outline: none !important;
            box-shadow: 0 0 0 3px rgba(34, 211, 238, 0.35) !important;
        }

        /* 할 일 리스트 구분선/토글 버튼 가시성 강화 */
        .light-contrast #task-list > div { border-color: #e2e8f0 !important; } /* divide color */
        .light-contrast button[data-action="toggle"] {
            background: #ffffff !important;
            border-color: #94a3b8 !important;
        }
        .light-contrast button[data-action="toggle"]:hover {
            background: #e0f2fe !important; /* light cyan */
            border-color: #06b6d4 !important;
        }
        .light-contrast button[data-action="delete"] {
            color: #64748b !important; /* slate-500 */
        }
        .light-contrast button[data-action="delete"]:hover {
            color: #b91c1c !important; /* red-700 */
            background: #fee2e2 !important; /* red-100 */
        }

        /* 주간/월간 캘린더 셀 가시성 강화 */
        .light-contrast .grid [data-date] {
            border: 1px solid #e2e8f0; /* slate-200 */
            background: #ffffff;
        }
        .light-contrast .grid [data-date]:hover {
            background: #f8fafc; /* slate-50 */
            border-color: #94a3b8; /* slate-400 */
        }
        .light-contrast .grid [data-date].bg-cyan-500,
        .light-contrast .grid [data-date].bg-green-500,
        .light-contrast .grid [data-date].bg-green-500\/50,
        .light-contrast .grid [data-date].bg-gradient-to-r {
            color: #0f172a !important; /* 날짜 텍스트 가독성 */
        }

        /* 헤더/배지 텍스트 대비 보정 */
        .light-contrast #remaining-badge { color: #0f172a !important; background: #e2e8f0 !important; border-color: #cbd5e1 !important; }
        .light-contrast .bg-white\/20 { background-color: rgba(255,255,255,0.7) !important; }
        .light-contrast .border-white\/20 { border-color: rgba(148,163,184,0.7) !important; }
        .light-contrast .border-white\/30 { border-color: rgba(148,163,184,0.8) !important; }

        /* 주말/공휴일 색상 (월간 캘린더) */
        .calendar-weekend-sun { color: #dc2626; } /* red-600 */
        .calendar-weekend-sat { color: #2563eb; } /* blue-600 */
        .calendar-holiday { color: #dc2626; font-weight: 700; }
        .calendar-holiday-label {
            position: absolute;
            bottom: 4px;
            left: 6px;
            right: 6px;
            font-size: 10px;
            line-height: 1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            color: #b91c1c; /* red-700 */
            font-weight: 600;
        }
        .light-contrast .calendar-holiday-label { color: #b91c1c; }
    </style>
</head>
<body>
    <div class="container mx-auto px-4 py-8 max-w-2xl">
        <!-- 헤더 -->
        <div class="mb-8">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="w-12 h-12 rounded-xl bg-white/70 backdrop-blur border border-white/60 flex items-center justify-center shadow-sm">
                        <i class="fas fa-clipboard-check text-slate-700 text-xl"></i>
                    </div>
                    <div>
                        <h1 class="text-3xl font-extrabold text-white tracking-tight">TaskBoard</h1>
                        <p class="text-slate-500 text-sm">팀과 개인의 업무를 명확하게 정리하세요</p>
                    </div>
                </div>
                <div class="flex items-center gap-4">
                    <div class="hidden sm:flex items-center gap-2 text-slate-500">
                        <i class="fas fa-circle text-[6px]"></i>
                        <span class="text-xs">Focus • Clarity • Delivery</span>
                    </div>
                    <div class="flex items-center gap-3">
                        <?php if ($_SESSION['username'] === 'admin'): ?>
                            <a href="admin.php" class="text-white/60 hover:text-yellow-400 transition-colors duration-300" title="사용자 관리">
                                <i class="fas fa-user-shield"></i>
                            </a>
                        <?php endif; ?>
                        <a href="my_tasks.php" class="text-white/60 hover:text-green-400 transition-colors duration-300" title="내 할일 목록">
                            <i class="fas fa-list"></i>
                        </a>
                        <div class="text-white/80 text-sm">
                            <i class="fas fa-user-circle mr-1"></i>
                            <?= htmlspecialchars($_SESSION['name'] ?? $_SESSION['username']) ?>
                        </div>
                        <a href="logout.php" class="text-white/60 hover:text-red-400 transition-colors duration-300" title="로그아웃">
                            <i class="fas fa-sign-out-alt"></i>
                        </a>
                    </div>
                </div>
            </div>
        </div>

        <!-- 날짜 선택기 -->
        <div class="glass rounded-3xl shadow-2xl p-8 mb-6 hover:shadow-3xl transition-all duration-300">
            <!-- 메인 날짜 네비게이션 -->
            <div class="flex items-center justify-between mb-6">
                <button class="flex items-center justify-center w-14 h-14 rounded-2xl bg-white/20 hover:bg-white/30 border border-white/30 transition-all duration-300 hover:scale-105 group glow">
                    <i class="fas fa-chevron-left text-white text-xl group-hover:text-cyan-300 transition-colors duration-300"></i>
                </button>
                
                <div class="text-center px-4">
                    <div class="text-3xl font-bold text-white mb-2 tracking-wide"><?= $currentDate ?></div>
                    <div class="flex items-center justify-center gap-3">
                        <div class="text-cyan-300 font-semibold text-lg"><?= $currentDayOfWeek ?></div>
                        <div class="w-2 h-2 bg-cyan-400 rounded-full glow"></div>
                        <div class="text-white/70 text-sm bg-white/10 px-3 py-1 rounded-full border border-white/20">
                            <i class="fas fa-calendar-alt mr-1"></i>
                            <?= $dayOfYear ?>일째
                        </div>
                    </div>
                </div>
                
                <button class="flex items-center justify-center w-14 h-14 rounded-2xl bg-white/20 hover:bg-white/30 border border-white/30 transition-all duration-300 hover:scale-105 group glow">
                    <i class="fas fa-chevron-right text-white text-xl group-hover:text-cyan-300 transition-colors duration-300"></i>
                </button>
            </div>
            
            <!-- 주간 미니 캘린더 -->
            <div class="flex justify-center gap-2 mb-6">
                <div class="flex bg-white/10 rounded-2xl p-2 border border-white/20">
                    <?php foreach ($weekDates as $date): ?>
                        <div class="flex flex-col items-center justify-center w-12 h-12 rounded-xl <?= $date['isToday'] ? 'bg-cyan-500 text-white font-bold glow' : 'text-white/60 font-medium hover:bg-white/10' ?> transition-all duration-300">
                            <div class="text-xs mb-1"><?= $date['dayName'] ?></div>
                            <div class="text-sm"><?= $date['day'] ?></div>
                        </div>
                    <?php endforeach; ?>
                </div>
            </div>
            
            <!-- 액션 버튼들 -->
            <div class="flex gap-3 justify-center">
                <button class="bg-gradient-to-r from-cyan-500/20 to-blue-600/20 hover:from-cyan-500/30 hover:to-blue-600/30 text-white px-6 py-3 rounded-2xl font-semibold transition-all duration-300 border border-white/20 hover:border-cyan-400/50 hover:shadow-xl hover:scale-105 flex items-center gap-2">
                    <i class="fas fa-calendar-day"></i>
                    오늘로 이동
                </button>
                <button id="calendar-toggle-btn" class="bg-gradient-to-r from-purple-500/20 to-pink-600/20 hover:from-purple-500/30 hover:to-pink-600/30 text-white px-6 py-3 rounded-2xl font-semibold transition-all duration-300 border border-white/20 hover:border-purple-400/50 hover:shadow-xl hover:scale-105 flex items-center gap-2">
                    <i class="fas fa-calendar-plus"></i>
                    달력 보기
                </button>
            </div>
        </div>

        <!-- 월간 캘린더 -->
        <div id="monthly-calendar" class="glass rounded-3xl shadow-2xl p-6 mb-6 hover:shadow-3xl transition-all duration-300">
            <div class="text-center mb-4">
                <h3 class="text-xl font-bold text-white mb-2">월간 캘린더</h3>
                <div class="flex items-center justify-center gap-4">
                    <button id="prev-month" class="flex items-center justify-center w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 border border-white/30 transition-all duration-300 hover:scale-105">
                        <i class="fas fa-chevron-left text-white"></i>
                    </button>
                    <span id="current-month" class="text-lg font-semibold text-white px-4 py-2 bg-white/10 rounded-xl border border-white/20">
                        <?= $currentYear ?>년 <?= $currentMonth ?>월
                    </span>
                    <button id="next-month" class="flex items-center justify-center w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 border border-white/30 transition-all duration-300 hover:scale-105">
                        <i class="fas fa-chevron-right text-white"></i>
                    </button>
                </div>
            </div>
            
            <!-- 요일 헤더 -->
            <div class="grid grid-cols-7 gap-1 mb-3">
                <?php foreach (['일', '월', '화', '수', '목', '금', '토'] as $dayName): ?>
                    <div class="text-center py-2 text-white/70 font-medium text-sm">
                        <?= $dayName ?>
                    </div>
                <?php endforeach; ?>
            </div>
            
            <!-- 날짜 그리드 -->
            <div id="calendar-grid" class="grid grid-cols-7 gap-1">
                <!-- JavaScript로 동적 생성 -->
            </div>
        </div>

        <!-- 입력 폼 -->
        <div class="glass rounded-3xl shadow-2xl p-8 mb-8 hover:shadow-3xl transition-all duration-300">
            <form id="task-form" class="space-y-4">
                <!-- 할 일 입력 -->
                <div class="flex gap-4">
                    <div class="flex-1">
                        <input id="task-input"
                            type="text" 
                            placeholder="할 일을 입력하세요..." 
                            class="w-full px-6 py-4 bg-white/50 backdrop-blur-sm border border-white/30 rounded-2xl focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 focus:bg-white/70 transition-all duration-300 text-gray-800 placeholder-gray-600 text-lg"
                        >
                    </div>
                    <button 
                        type="submit" 
                        class="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white px-8 py-4 rounded-2xl font-semibold transition-all duration-300 hover:shadow-xl hover:scale-105 flex items-center gap-3 glow"
                    >
                        <i class="fas fa-plus text-lg"></i>
                        추가
                    </button>
                </div>

                <!-- 함께할 사용자 검색/선택 -->
                <div class="space-y-3">
                    <label class="text-white/80 text-sm font-medium">함께할 사용자 추가</label>
                    <div class="relative">
                        <input id="participant-search" type="text" class="w-full px-4 py-3 bg-white/50 backdrop-blur-sm border border-white/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 focus:bg-white/70 transition-all duration-300 text-gray-800 placeholder-gray-600" placeholder="아이디 또는 이름으로 검색" autocomplete="off">
                        <div id="participant-results" class="absolute z-20 mt-1 w-full bg-white/90 border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-auto hidden"></div>
                    </div>
                    <div id="selected-participants" class="flex flex-wrap gap-2"></div>
                </div>
                
                <!-- 시간 및 기간 설정 -->
                <div class="flex flex-col gap-3">
                    <div class="flex items-center gap-4">
                        <div class="flex items-center gap-2">
                            <input type="checkbox" id="use-time" class="w-4 h-4 text-cyan-500 bg-white/50 border-white/30 rounded focus:ring-cyan-400">
                            <label for="use-time" class="text-white font-medium">시간 설정</label>
                        </div>
                        <div class="flex items-center gap-2">
                            <input type="checkbox" id="use-date-range" class="w-4 h-4 text-cyan-500 bg-white/50 border-white/30 rounded focus:ring-cyan-400">
                            <label for="use-date-range" class="text-white font-medium">기간 설정</label>
                        </div>
                        <div class="flex items-center gap-2">
                            <input type="checkbox" id="use-dday" class="w-4 h-4 text-cyan-500 bg-white/50 border-white/30 rounded focus:ring-cyan-400">
                            <label for="use-dday" class="text-white font-medium">D-Day</label>
                        </div>
                    </div>
                    
                    <!-- 시간 설정 -->
                    <div id="time-inputs" class="grid grid-cols-2 gap-4 opacity-50 pointer-events-none transition-all duration-300">
                        <div class="flex flex-col gap-1">
                            <label class="text-white/80 text-sm font-medium">시작 시간</label>
                            <input type="time" id="start-time" class="px-3 py-2 bg-white/50 backdrop-blur-sm border border-white/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 text-gray-800 text-sm">
                        </div>
                        <div class="flex flex-col gap-1">
                            <label class="text-white/80 text-sm font-medium">종료 시간</label>
                            <input type="time" id="end-time" class="px-3 py-2 bg-white/50 backdrop-blur-sm border border-white/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 text-gray-800 text-sm">
                        </div>
                    </div>
                    
                    <!-- 기간 설정 -->
                    <div id="date-range-inputs" class="grid grid-cols-3 gap-4 opacity-50 pointer-events-none transition-all duration-300">
                        <div class="flex flex-col gap-1">
                            <label class="text-white/80 text-sm font-medium">시작일</label>
                            <input type="date" id="start-date" class="px-3 py-2 bg-white/50 backdrop-blur-sm border border-white/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 text-gray-800 text-sm">
                        </div>
                        <div class="flex flex-col gap-1">
                            <label class="text-white/80 text-sm font-medium">종료일</label>
                            <input type="date" id="end-date" class="px-3 py-2 bg-white/50 backdrop-blur-sm border border-white/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 text-gray-800 text-sm">
                        </div>
                        <div class="flex flex-col gap-1">
                            <label class="text-white/80 text-sm font-medium">기간</label>
                            <div class="px-3 py-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl text-white/80 text-sm flex items-center">
                                <span id="date-range-info">1일</span>
                            </div>
                        </div>
                    </div>
                </div>
            </form>
        </div>

        <!-- 할 일 목록 -->
        <div class="glass-dark rounded-3xl shadow-2xl overflow-hidden backdrop-blur-lg">
            <!-- 목록 헤더 -->
            <div class="bg-gradient-to-r from-cyan-500/80 to-blue-600/80 backdrop-blur-sm px-8 py-6 border-b border-white/20">
                <div class="flex items-center justify-between text-white">
                    <h2 class="text-xl font-bold flex items-center gap-3">
                        <i class="fas fa-list text-cyan-300"></i>
                        할 일 목록
                    </h2>
                    <span id="remaining-badge" class="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-semibold border border-white/30 glow">
                        0개 남음
                    </span>
                </div>
            </div>

            <!-- 할 일 아이템들 (동적 렌더링 영역) -->
            <div id="task-list" class="divide-y divide-white/10"></div>

            <!-- 빈 상태 (숨김) -->
            <div class="hidden p-12 text-center">
                <div class="text-white/30 mb-6">
                    <i class="fas fa-clipboard-list text-8xl"></i>
                </div>
                <h3 class="text-xl font-medium text-white/80 mb-3">할 일이 없습니다</h3>
                <p class="text-white/60">새로운 할 일을 추가해보세요!</p>
            </div>
        </div>

        <!-- 통계 -->
        <div class="mt-8 grid grid-cols-2 gap-6">
            <div class="glass rounded-3xl shadow-2xl p-6 text-center hover:shadow-3xl transition-all duration-300 group">
                <div class="text-4xl font-bold text-cyan-300 mb-2 group-hover:scale-110 transition-transform duration-300">3</div>
                <div class="text-white/80 font-medium">남은 할 일</div>
                <div class="w-full bg-white/20 rounded-full h-2 mt-3">
                    <div class="bg-gradient-to-r from-cyan-400 to-blue-500 h-2 rounded-full w-3/5"></div>
                </div>
            </div>
            <div class="glass rounded-3xl shadow-2xl p-6 text-center hover:shadow-3xl transition-all duration-300 group">
                <div class="text-4xl font-bold text-green-400 mb-2 group-hover:scale-110 transition-transform duration-300">2</div>
                <div class="text-white/80 font-medium">완료된 할 일</div>
                <div class="w-full bg-white/20 rounded-full h-2 mt-3">
                    <div class="bg-gradient-to-r from-green-400 to-emerald-500 h-2 rounded-full w-2/5"></div>
                </div>
            </div>
        </div>
    </div>

    <!-- 좌측 요약/할일 패널 -->
    <div class="fixed left-4 top-20 w-96 space-y-3 z-40">
        <div class="glass rounded-2xl p-4 border border-white/20">
            <div class="text-white/80 font-semibold mb-3">오늘 요약</div>
            <div class="grid grid-cols-2 gap-3">
                <div class="text-center bg-white/10 rounded-xl p-3 border border-white/20">
                    <div class="text-white/60 text-xs">남은 할 일</div>
                    <div id="left-remaining" class="text-cyan-300 text-2xl font-bold">0</div>
                </div>
                <div class="text-center bg-white/10 rounded-xl p-3 border border-white/20">
                    <div class="text-white/60 text-xs">완료된 할 일</div>
                    <div id="left-done" class="text-green-400 text-2xl font-bold">0</div>
                </div>
            </div>
        </div>
        <div class="glass rounded-2xl p-4 border border-white/20">
            <div class="flex items-center justify-between mb-2">
                <div class="text-white/80 font-semibold">할 일 목록</div>
                <span class="text-white/50 text-xs">오늘</span>
            </div>
            <div id="left-task-list" class="space-y-2 max-h-80 overflow-auto"></div>
        </div>
    </div>

    <!-- 우측 D-Day 패널 -->
    <div class="fixed right-4 top-20 w-96 space-y-3 z-40">
        <div class="glass rounded-2xl p-4 border border-white/20">
            <div class="flex items-center justify-between mb-2">
                <div class="text-white/80 font-semibold">임박한 D-Day</div>
                <span class="text-white/50 text-xs">Top 5</span>
            </div>
            <div id="dday-panel" class="space-y-2"></div>
        </div>
    </div>

    <script>
        // 한국어 요일 배열
        const koreanDays = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
        const koreanShortDays = ['일', '월', '화', '수', '목', '금', '토'];
        
        // 현재 선택된 날짜 (기본값: 오늘)
        let currentSelectedDate = new Date();
        currentSelectedDate.setHours(0, 0, 0, 0);
        let currentMonth = new Date(currentSelectedDate.getFullYear(), currentSelectedDate.getMonth(), 1);

        // 로컬 스토리지 키 생성 (YYYY-MM-DD)
        function dateKey(date) {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }

        // MySQL 데이터베이스 연동 함수들
        async function loadTasksByDate(date) {
            try {
                const response = await fetch(`api.php?action=get_tasks&date=${dateKey(date)}`);
                const data = await response.json();
                if (data.success) {
                    return data.tasks;
                } else {
                    console.error('Failed to load tasks:', data.error);
                    return [];
                }
            } catch (error) {
                console.error('Error loading tasks:', error);
                return [];
            }
        }

        async function saveTasksByDate(date, tasks) {
            // 이 함수는 더 이상 사용되지 않음 - 개별 작업 저장은 saveTask 함수 사용
            console.warn('saveTasksByDate is deprecated. Use saveTask instead.');
        }
        
        // 기간별 할 일 저장 (MySQL API 사용)
        async function saveTaskToDateRange(taskText, startDate, endDate) {
            try {
                const response = await fetch('api.php?action=save_task', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        text: taskText,
                        isRangeTask: true,
                        startDate: startDate,
                        endDate: endDate
                    })
                });
                
                const data = await response.json();
                if (data.success) {
                    return true;
                } else {
                    console.error('Failed to save range task:', data.error);
                    return false;
                }
            } catch (error) {
                console.error('Error saving range task:', error);
                return false;
            }
        }

        // 렌더링 (MySQL API 사용)
        async function renderTasks(date) {
            const container = document.getElementById('task-list');
            const tasks = await loadTasksByDate(date);
            container.innerHTML = '';

            if (!tasks.length) {
                container.innerHTML = `
                    <div class="p-8 text-center">
                        <div class="text-white/30 mb-4">
                            <i class="fas fa-clipboard-list text-5xl"></i>
                        </div>
                        <div class="text-white/70">할 일을 추가해보세요.</div>
                    </div>
                `;
            } else {
                tasks.forEach((task, idx) => {
                    const isDone = !!task.done;
                    const isRangeTask = !!task.isRangeTask;
                    const item = document.createElement('div');
                    item.className = `p-6 transition-all duration-300 group ${isDone ? 'bg-green-500/10' : 'hover:bg-white/10'}`;
                    
                    let taskText = task.text;
                    let rangeInfo = '';
                    let timeInfo = '';
                    let ddayInfo = '';
                    
                    if (isRangeTask) {
                        const startDate = new Date(task.startDate);
                        const endDate = new Date(task.endDate);
                        const startStr = `${startDate.getMonth() + 1}/${startDate.getDate()}`;
                        const endStr = `${endDate.getMonth() + 1}/${endDate.getDate()}`;
                        rangeInfo = `<div class="text-xs text-cyan-300 mt-1">${startStr} ~ ${endStr}</div>`;
                    }
                    
                    if (task.hasTime && task.startTime && task.endTime) {
                        timeInfo = `<div class="text-xs text-purple-300 mt-1">🕐 ${task.startTime} ~ ${task.endTime}</div>`;
                    }
                    
                    // D-Day 표시
                    if (task.isDday) {
                        const today = new Date();
                        today.setHours(0,0,0,0);
                        const baseDate = isRangeTask && task.endDate ? new Date(task.endDate) : new Date(date);
                        baseDate.setHours(0,0,0,0);
                        const diffDays = Math.ceil((baseDate - today) / (1000*60*60*24));
                        const label = diffDays === 0 ? 'D-Day' : (diffDays > 0 ? `D-${diffDays}` : `D+${Math.abs(diffDays)}`);
                        ddayInfo = `<span class="ml-2 px-2 py-1 bg-red-500/20 text-red-300 text-xs rounded-full">${label}</span>`;
                    }

                    item.innerHTML = `
                        <div class="flex items-center gap-4">
                            <button data-action="toggle" data-id="${task.id}" class="w-8 h-8 ${isDone ? 'bg-green-500 border-green-400' : 'border-white/30 hover:border-cyan-400 hover:bg-cyan-400/20'} border-2 rounded-full flex items-center justify-center transition-all duration-300 group-hover:scale-110">
                                <i class="fas fa-check text-white text-sm ${isDone ? '' : 'opacity-0 group-hover:opacity-50'}"></i>
                            </button>
                            <div class="flex-1">
                                <span class="${isDone ? 'text-white/70 line-through' : 'text-white'} font-medium text-lg">${taskText}</span>${ddayInfo}
                                ${rangeInfo}
                                ${timeInfo}
                            </div>
                            <button data-action="delete" data-id="${task.id}" class="text-white/50 hover:text-red-400 transition-all duration-300 hover:scale-110 p-2 rounded-lg hover:bg-red-500/20">
                                <i class="fas fa-trash text-lg"></i>
                            </button>
                        </div>
                    `;
                    container.appendChild(item);
                });
            }

            await updateCounts(date);
            renderLeftTaskList(tasks);
        }

        async function updateCounts(date) {
            const badge = document.getElementById('remaining-badge');
            const tasks = await loadTasksByDate(date);
            const remaining = tasks.filter(t => !t.done).length;
            badge.textContent = `${remaining}개 남음`;

            // 통계 카드도 업데이트 (예: 남은/완료)
            const leftEl = document.querySelector('.text-4xl.font-bold.text-cyan-300');
            const doneEl = document.querySelector('.text-4xl.font-bold.text-green-400');
            if (leftEl) leftEl.textContent = String(remaining);
            if (doneEl) doneEl.textContent = String(tasks.length - remaining);
            // 좌측 패널 요약 업데이트
            const leftRemain = document.getElementById('left-remaining');
            const leftDone = document.getElementById('left-done');
            if (leftRemain) leftRemain.textContent = String(remaining);
            if (leftDone) leftDone.textContent = String(tasks.length - remaining);
        }

        // 좌측 패널 간단 목록 렌더링
        function renderLeftTaskList(tasks) {
            const list = document.getElementById('left-task-list');
            if (!list) return;
            if (!tasks || tasks.length === 0) {
                list.innerHTML = '<div class="text-white/60 text-sm">등록된 할 일이 없습니다.</div>';
                return;
            }
            list.innerHTML = tasks.map(task => {
                const isDone = !!task.done;
                const isRangeTask = !!task.isRangeTask;
                let badges = '';
                if (isRangeTask) badges += '<span class="ml-2 px-2 py-0.5 bg-purple-500/20 text-purple-300 text-[10px] rounded-full">기간</span>';
                if (task.isDday) {
                    const today = new Date(); today.setHours(0,0,0,0);
                    const baseDate = isRangeTask && task.endDate ? new Date(task.endDate) : new Date(dateKey(currentSelectedDate));
                    baseDate.setHours(0,0,0,0);
                    const diff = Math.ceil((baseDate - today)/(1000*60*60*24));
                    const label = diff === 0 ? 'D-Day' : (diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`);
                    badges += `<span class=\"ml-2 px-2 py-0.5 bg-red-500/20 text-red-300 text-[10px] rounded-full\">${label}</span>`;
                }
                return `
                    <div class=\"flex items-center gap-2 p-2 bg-white/10 rounded-lg border border-white/10\">
                        <span class=\"w-2 h-2 rounded-full ${isDone ? 'bg-green-400' : 'bg-cyan-400'}\"></span>
                        <div class=\"text-white/90 text-sm truncate\">${task.text}</div>
                        <div class=\"flex-1\"></div>
                        ${badges}
                    </div>
                `;
            }).join('');
        }

        // 이벤트 위임 (완료 토글/삭제) - MySQL API 사용
        document.addEventListener('click', async function(e) {
            const toggleBtn = e.target.closest('button[data-action="toggle"]');
            const deleteBtn = e.target.closest('button[data-action="delete"]');
            if (!toggleBtn && !deleteBtn) return;
            
            const taskId = (toggleBtn || deleteBtn).dataset.id;
            if (!taskId) return;
            
            if (toggleBtn) {
                try {
                    const response = await fetch('api.php?action=toggle_task', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ id: taskId })
                    });
                    
                    const data = await response.json();
                    if (data.success) {
                        await renderTasks(currentSelectedDate);
                        invalidateCalendarCache();
                        await renderMonthlyCalendar();
                        await updateWeekCalendar(currentSelectedDate);
                    } else {
                        console.error('Failed to toggle task:', data.error);
                        alert('작업 상태 변경에 실패했습니다.');
                    }
                } catch (error) {
                    console.error('Error toggling task:', error);
                    alert('작업 상태 변경 중 오류가 발생했습니다.');
                }
            } else if (deleteBtn) {
                if (confirm('정말로 이 할 일을 삭제하시겠습니까?')) {
                    try {
                        console.log('Deleting task with ID:', taskId);
                        const response = await fetch('api.php?action=delete_task', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ id: taskId })
                        });
                        
                        console.log('Delete response:', response);
                        const data = await response.json();
                        console.log('Delete response data:', data);
                        
                        if (data.success) {
                            await renderTasks(currentSelectedDate);
                            invalidateCalendarCache();
                            await renderMonthlyCalendar();
                            await updateWeekCalendar(currentSelectedDate);
                        } else {
                            console.error('Failed to delete task:', data.error);
                            alert('할 일 삭제에 실패했습니다.');
                        }
                    } catch (error) {
                        console.error('Error deleting task:', error);
                        console.error('Task ID:', taskId);
                        alert('할 일 삭제 중 오류가 발생했습니다: ' + error.message);
                    }
                }
            }
        });
        
        // 날짜 포맷팅 함수
        function formatKoreanDate(date) {
            const year = date.getFullYear();
            const month = date.getMonth() + 1;
            const day = date.getDate();
            return `${year}년 ${month}월 ${day}일`;
        }
        
        // 연중 날짜 계산 함수
        function getDayOfYear(date) {
            const start = new Date(date.getFullYear(), 0, 0);
            const diff = date - start;
            const oneDay = 1000 * 60 * 60 * 24;
            return Math.floor(diff / oneDay);
        }
        
        // 주간 캘린더 업데이트 함수 (MySQL API 사용)
        async function updateWeekCalendar(selectedDate) {
            const weekContainer = document.querySelector('.flex.bg-white\\/10.rounded-2xl.p-2');
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            // 해당 주의 일요일 찾기
            const weekStart = new Date(selectedDate);
            weekStart.setDate(selectedDate.getDate() - selectedDate.getDay());
            weekStart.setHours(0, 0, 0, 0);
            
            let weekHTML = '';
            for (let i = 0; i < 7; i++) {
                const date = new Date(weekStart);
                date.setDate(weekStart.getDate() + i);
                date.setHours(0, 0, 0, 0);
                
                const isToday = date.getTime() === today.getTime();
                const isSelected = date.getTime() === selectedDate.getTime();
                
                // 해당 날짜의 할 일 개수 확인 (성능 최적화)
                const tasks = await loadTasksByDate(date);
                const taskCount = tasks.length;
                const completedCount = tasks.filter(task => task.done).length;
                
                let classes = 'flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all duration-300 relative cursor-pointer hover:scale-105';
                if (isSelected) {
                    classes += ' bg-cyan-500 text-white font-bold glow';
                } else if (isToday && !isSelected) {
                    classes += ' bg-green-500/50 text-white font-medium';
                } else {
                    classes += ' text-white/60 font-medium hover:bg-white/10';
                }
                
                let dayContent = `
                    <div class="text-xs mb-1">${koreanShortDays[i]}</div>
                    <div class="text-sm">${date.getDate()}</div>
                `;
                
                // 할 일이 있는 경우 작은 배지 표시
                if (taskCount > 0) {
                    const badgeColor = completedCount === taskCount ? 'bg-green-400' : 'bg-cyan-400';
                    const badgeText = completedCount === taskCount ? '✓' : taskCount;
                    dayContent += `
                        <div class="absolute -top-1 -right-1 w-4 h-4 ${badgeColor} text-white text-xs rounded-full flex items-center justify-center font-bold">
                            ${badgeText}
                        </div>
                    `;
                }
                
                // 날짜를 YYYY-MM-DD 형식으로 저장
                const dateString = date.getFullYear() + '-' + 
                                 String(date.getMonth() + 1).padStart(2, '0') + '-' + 
                                 String(date.getDate()).padStart(2, '0');
                
                weekHTML += `<div class="${classes}" data-date="${dateString}">${dayContent}</div>`;
            }
            
            weekContainer.innerHTML = weekHTML;
            
            // 주간 캘린더에 클릭 이벤트 추가
            setupWeekCalendarClickHandler();
            refreshTopDdayPanel();
        }
        
        // 주간 캘린더 클릭 이벤트 설정
        function setupWeekCalendarClickHandler() {
            const weekContainer = document.querySelector('.flex.bg-white\\/10.rounded-2xl.p-2');
            if (weekContainer) {
                // 기존 이벤트 리스너 제거
                weekContainer.removeEventListener('click', handleCalendarClick);
                // 새로운 이벤트 리스너 추가
                weekContainer.addEventListener('click', handleCalendarClick);
            }
        }
        
        // 메인 날짜 표시 업데이트 함수
        function updateMainDate(date) {
            const dateElement = document.querySelector('.text-3xl.font-bold.text-white');
            const dayElement = document.querySelector('.text-cyan-300.font-semibold.text-lg');
            const dayCountElement = document.querySelector('.text-white\\/70.text-sm i').parentElement;
            
            dateElement.textContent = formatKoreanDate(date);
            dayElement.textContent = koreanDays[date.getDay()];
            dayCountElement.innerHTML = `<i class="fas fa-calendar-alt mr-1"></i>${getDayOfYear(date)}일째`;
        }
        
        // 날짜 네비게이션 이벤트 리스너
        document.addEventListener('DOMContentLoaded', function() {
            const prevButton = document.querySelector('.fas.fa-chevron-left').parentElement;
            const nextButton = document.querySelector('.fas.fa-chevron-right').parentElement;
            const todayButton = document.querySelector('.fas.fa-calendar-day').parentElement;
            const form = document.getElementById('task-form');
            const input = document.getElementById('task-input');
            
            // 이전 날짜로 이동
            prevButton.addEventListener('click', async function() {
                currentSelectedDate.setDate(currentSelectedDate.getDate() - 1);
                currentSelectedDate.setHours(0, 0, 0, 0);
                updateMainDate(currentSelectedDate);
                await updateWeekCalendar(currentSelectedDate);
                await renderTasks(currentSelectedDate);
                await renderMonthlyCalendar();
            });
            
            // 다음 날짜로 이동
            nextButton.addEventListener('click', async function() {
                currentSelectedDate.setDate(currentSelectedDate.getDate() + 1);
                currentSelectedDate.setHours(0, 0, 0, 0);
                updateMainDate(currentSelectedDate);
                await updateWeekCalendar(currentSelectedDate);
                await renderTasks(currentSelectedDate);
                await renderMonthlyCalendar();
            });
            
            // 오늘로 이동
            todayButton.addEventListener('click', async function() {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                currentSelectedDate = today;
                updateMainDate(currentSelectedDate);
                await updateWeekCalendar(currentSelectedDate);
                await renderTasks(currentSelectedDate);
                await renderMonthlyCalendar();
            });
            
            // 시간 및 기간 설정 체크박스 이벤트
            const useTime = document.getElementById('use-time');
            const timeInputs = document.getElementById('time-inputs');
            const startTimeInput = document.getElementById('start-time');
            const endTimeInput = document.getElementById('end-time');
            
            const useDateRange = document.getElementById('use-date-range');
            const dateRangeInputs = document.getElementById('date-range-inputs');
            const startDateInput = document.getElementById('start-date');
            const endDateInput = document.getElementById('end-date');
            const dateRangeInfo = document.getElementById('date-range-info');
            
            // 시간 설정 체크박스 이벤트
            useTime.addEventListener('change', function() {
                if (this.checked) {
                    timeInputs.classList.remove('opacity-50', 'pointer-events-none');
                    // 기본값 설정 - 현재 시간부터 1시간 후까지
                    const now = new Date();
                    const startTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                    const endTime = `${String((now.getHours() + 1) % 24).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                    
                    startTimeInput.value = startTime;
                    endTimeInput.value = endTime;
                } else {
                    timeInputs.classList.add('opacity-50', 'pointer-events-none');
                }
            });
            
            // 기간 설정 체크박스 이벤트
            useDateRange.addEventListener('change', function() {
                if (this.checked) {
                    dateRangeInputs.classList.remove('opacity-50', 'pointer-events-none');
                    // 기본값 설정 - 오늘 날짜로 정확히 설정
                    const today = new Date();
                    const year = today.getFullYear();
                    const month = String(today.getMonth() + 1).padStart(2, '0');
                    const day = String(today.getDate()).padStart(2, '0');
                    const todayString = `${year}-${month}-${day}`;
                    
                    startDateInput.value = todayString;
                    endDateInput.value = todayString; // 종료일도 오늘로 설정
                    updateDateRangeInfo();
                } else {
                    dateRangeInputs.classList.add('opacity-50', 'pointer-events-none');
                }
                // 기간 설정 시 D-Day는 비활성화 (기간의 양 끝을 따로 처리할 수 있으나 단일 목표일만 D-Day로 가정)
                const dday = document.getElementById('use-dday');
                if (dday) {
                    dday.checked = false;
                    dday.disabled = this.checked;
                }
            });
            
            // 날짜 변경 시 정보 업데이트
            startDateInput.addEventListener('change', updateDateRangeInfo);
            endDateInput.addEventListener('change', updateDateRangeInfo);
            
            function updateDateRangeInfo() {
                const start = new Date(startDateInput.value);
                const end = new Date(endDateInput.value);
                const diffTime = Math.abs(end - start);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                dateRangeInfo.textContent = `선택된 날짜: ${diffDays}일`;
            }
            
            // 참가자 검색 상태
            const participantSearch = document.getElementById('participant-search');
            const participantResults = document.getElementById('participant-results');
            const selectedParticipants = document.getElementById('selected-participants');
            let selectedParticipantIds = new Set();

            let searchTimeout;
            if (participantSearch) {
                participantSearch.addEventListener('input', function() {
                    const q = this.value.trim();
                    clearTimeout(searchTimeout);
                    if (q.length === 0) {
                        participantResults.classList.add('hidden');
                        participantResults.innerHTML = '';
                        return;
                    }
                    searchTimeout = setTimeout(async () => {
                        try {
                            const resp = await fetch('api.php?action=search_users&q=' + encodeURIComponent(q));
                            const data = await resp.json();
                            if (!data.success) return;
                            const users = data.users;
                            if (users.length === 0) {
                                participantResults.innerHTML = '<div class="px-4 py-2 text-sm text-gray-600">검색 결과 없음</div>';
                                participantResults.classList.remove('hidden');
                                return;
                            }
                            participantResults.innerHTML = users.map(u => `
                                <button type="button" data-id="${u.id}" data-name="${u.name || ''}" data-username="${u.username}"
                                        class="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2">
                                    <span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-cyan-500 text-white text-xs">${(u.name || u.username).charAt(0).toUpperCase()}</span>
                                    <span class="font-medium">${u.name || u.username}</span>
                                    ${u.name ? `<span class=\"text-gray-500 text-xs\">@${u.username}</span>` : ''}
                                </button>
                            `).join('');
                            participantResults.classList.remove('hidden');
                        } catch (e) {
                            console.error('search error', e);
                        }
                    }, 250);
                });

                participantResults.addEventListener('click', function(e) {
                    const btn = e.target.closest('button[data-id]');
                    if (!btn) return;
                    const id = parseInt(btn.dataset.id);
                    const name = btn.dataset.name;
                    const username = btn.dataset.username;
                    if (selectedParticipantIds.has(id)) return;
                    selectedParticipantIds.add(id);
                    const chip = document.createElement('span');
                    chip.className = 'inline-flex items-center gap-1 px-2 py-1 rounded-full bg-cyan-500/20 text-cyan-300 text-sm border border-cyan-400/40';
                    chip.innerHTML = `
                        <i class="fas fa-user"></i>
                        ${(name || username)}
                        <button type="button" class="ml-1 text-cyan-200 hover:text-white" data-remove-id="${id}"><i class="fas fa-times"></i></button>
                    `;
                    selectedParticipants.appendChild(chip);
                    participantResults.classList.add('hidden');
                    participantSearch.value = '';
                });

                selectedParticipants.addEventListener('click', function(e) {
                    const removeBtn = e.target.closest('button[data-remove-id]');
                    if (!removeBtn) return;
                    const id = parseInt(removeBtn.dataset.removeId);
                    selectedParticipantIds.delete(id);
                    removeBtn.parentElement.remove();
                });
            }

            // 폼 제출 → MySQL 저장
            form.addEventListener('submit', async function(ev) {
                ev.preventDefault();
                const text = (input.value || '').trim();
                if (!text) return;
                
                if (useDateRange.checked) {
                    // 기간별 할 일 저장
                    const startDate = startDateInput.value;
                    const endDate = endDateInput.value;
                    
                    if (!startDate || !endDate) {
                        alert('시작일과 종료일을 모두 선택해주세요.');
                        return;
                    }
                    
                    if (new Date(startDate) > new Date(endDate)) {
                        alert('시작일은 종료일보다 이전이어야 합니다.');
                        return;
                    }
                    
                    const success = await (async () => {
                        const resp = await fetch('api.php?action=save_task', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                text: text,
                                isRangeTask: true,
                                startDate: startDate,
                                endDate: endDate,
                                participants: Array.from(selectedParticipantIds),
                                isDday: document.getElementById('use-dday')?.checked || false
                            })
                        });
                        const d = await resp.json();
                        return d.success;
                    })();
                    if (success) {
                        // 폼 초기화
                        input.value = '';
                        useDateRange.checked = false;
                        dateRangeInputs.classList.add('opacity-50', 'pointer-events-none');
                        // D-Day 체크박스 초기화
                        const dday = document.getElementById('use-dday');
                        if (dday) { dday.checked = false; dday.disabled = false; }
                        // 참가자 선택 초기화
                        selectedParticipantIds = new Set();
                        if (selectedParticipants) selectedParticipants.innerHTML = '';
                        if (participantResults) { participantResults.classList.add('hidden'); participantResults.innerHTML = ''; }
                        
                        // 현재 선택된 날짜의 할 일 목록 업데이트
                        await renderTasks(currentSelectedDate);
                        invalidateCalendarCache();
                        await renderMonthlyCalendar();
                        await updateWeekCalendar(currentSelectedDate);
                    } else {
                        alert('할 일 저장에 실패했습니다.');
                    }
                } else {
                    // 단일 날짜 할 일 저장 (시간 정보 포함)
                    const taskDate = dateKey(currentSelectedDate);
                    console.log('Current selected date:', currentSelectedDate);
                    console.log('Task date:', taskDate);
                    let taskData = { 
                        text: text,
                        date: taskDate,
                        participants: Array.from(selectedParticipantIds),
                        isDday: document.getElementById('use-dday')?.checked || false
                    };
                    
                    // 시간 정보 추가
                    if (useTime.checked) {
                        const startTime = startTimeInput.value;
                        const endTime = endTimeInput.value;
                        
                        if (!startTime || !endTime) {
                            alert('시작 시간과 종료 시간을 모두 선택해주세요.');
                            return;
                        }
                        
                        if (startTime >= endTime) {
                            alert('시작 시간은 종료 시간보다 이전이어야 합니다.');
                            return;
                        }
                        
                        taskData.startTime = startTime;
                        taskData.endTime = endTime;
                    }
                    
                    try {
                        const response = await fetch('api.php?action=save_task', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify(taskData)
                        });
                        
                        const data = await response.json();
                        if (data.success) {
                            input.value = '';
                            
                            // 폼 초기화
                            if (useTime.checked) {
                                useTime.checked = false;
                                timeInputs.classList.add('opacity-50', 'pointer-events-none');
                            }
                            // D-Day 체크박스 초기화
                            const dday = document.getElementById('use-dday');
                            if (dday) { dday.checked = false; dday.disabled = false; }
                            // 참가자 선택 초기화
                            selectedParticipantIds = new Set();
                            if (selectedParticipants) selectedParticipants.innerHTML = '';
                            if (participantResults) { participantResults.classList.add('hidden'); participantResults.innerHTML = ''; }
                            
                            await renderTasks(currentSelectedDate);
                            invalidateCalendarCache();
                            await renderMonthlyCalendar();
                            await updateWeekCalendar(currentSelectedDate);
                        } else {
                            alert('할 일 저장에 실패했습니다: ' + data.error);
                        }
                    } catch (error) {
                        console.error('Error saving task:', error);
                        console.error('Task data:', taskData);
                        alert('할 일 저장 중 오류가 발생했습니다: ' + error.message);
                    }
                }
            });

            // 월간 캘린더 네비게이션
            document.getElementById('prev-month').addEventListener('click', async () => await changeMonth(-1));
            document.getElementById('next-month').addEventListener('click', async () => await changeMonth(1));
            
            // 월간 캘린더 토글 버튼
            document.getElementById('calendar-toggle-btn').addEventListener('click', toggleMonthlyCalendar);
            
            // 페이지 로드 시 초기화
            updateMainDate(currentSelectedDate);
            updateWeekCalendar(currentSelectedDate);
            renderTasks(currentSelectedDate);
            renderMonthlyCalendar();
            setupCalendarClickHandler();
            setupWeekCalendarClickHandler();
            
            // 초기 상태 설정 (캘린더 숨김)
            const calendar = document.getElementById('monthly-calendar');
            const toggleBtn = document.getElementById('calendar-toggle-btn');
            calendar.style.display = 'none';
            isCalendarExpanded = false;
            
            // 초기 버튼 스타일 (파란색)
            toggleBtn.className = 'bg-gradient-to-r from-blue-500/20 to-cyan-600/20 hover:from-blue-500/30 hover:to-cyan-600/30 text-white px-6 py-3 rounded-2xl font-semibold transition-all duration-300 border border-white/20 hover:border-blue-400/50 hover:shadow-xl hover:scale-105 flex items-center gap-2';
            toggleBtn.innerHTML = '<i class="fas fa-calendar-plus"></i>달력 보기';
        });
        
        // 범위 할 일 캐시 (전역 변수)
        let rangeTasksCache = new Map();
        
        // 캐시 무효화 함수
        function invalidateCalendarCache() {
            rangeTasksCache.clear();
        }
        
        // 월간 캘린더 토글 상태
        let isCalendarExpanded = false;
        
        // 월간 캘린더 토글 함수
        function toggleMonthlyCalendar() {
            const calendar = document.getElementById('monthly-calendar');
            const toggleBtn = document.getElementById('calendar-toggle-btn');
            const btnIcon = toggleBtn.querySelector('i');
            
            if (isCalendarExpanded) {
                // 캘린더 접기
                calendar.style.display = 'none';
                isCalendarExpanded = false;
                
                // 버튼 스타일 변경 (파란색)
                toggleBtn.className = 'bg-gradient-to-r from-blue-500/20 to-cyan-600/20 hover:from-blue-500/30 hover:to-cyan-600/30 text-white px-6 py-3 rounded-2xl font-semibold transition-all duration-300 border border-white/20 hover:border-blue-400/50 hover:shadow-xl hover:scale-105 flex items-center gap-2';
                btnIcon.className = 'fas fa-calendar-plus';
                toggleBtn.innerHTML = '<i class="fas fa-calendar-plus"></i>달력 보기';
            } else {
                // 캘린더 펼치기
                calendar.style.display = 'block';
                isCalendarExpanded = true;
                
                // 버튼 스타일 변경 (보라색)
                toggleBtn.className = 'bg-gradient-to-r from-purple-500/20 to-pink-600/20 hover:from-purple-500/30 hover:to-pink-600/30 text-white px-6 py-3 rounded-2xl font-semibold transition-all duration-300 border border-white/20 hover:border-purple-400/50 hover:shadow-xl hover:scale-105 flex items-center gap-2';
                btnIcon.className = 'fas fa-calendar-minus';
                toggleBtn.innerHTML = '<i class="fas fa-calendar-minus"></i>달력 숨기기';
            }
        }
        
        // 월간 캘린더 렌더링 (MySQL API 사용)
        async function renderMonthlyCalendar() {
            const grid = document.getElementById('calendar-grid');
            const monthDisplay = document.getElementById('current-month');
            
            // 월 표시 업데이트
            const year = currentMonth.getFullYear();
            const month = currentMonth.getMonth() + 1;
            monthDisplay.textContent = `${year}년 ${month}월`;
            
            // 해당 월의 첫째 날과 마지막 날 계산
            const firstDay = new Date(year, month - 1, 1);
            const lastDay = new Date(year, month, 0);
            const startDate = new Date(firstDay);
            startDate.setDate(startDate.getDate() - firstDay.getDay()); // 일요일부터 시작
            
            // 범위 할 일 정보 수집 (성능 최적화 - 캐시 사용)
            const currentMonthKey = `${year}-${month}`;
            
            // 캐시된 범위 정보가 있으면 사용, 없으면 새로 계산
            if (!rangeTasksCache.has(currentMonthKey)) {
                const monthRangeTasks = new Map();
                if (currentMonth.getMonth() === month - 1) {
                    // 월의 첫날과 마지막날만 확인하여 범위 정보 수집
                    const monthStart = new Date(year, month - 1, 1);
                    const monthEnd = new Date(year, month, 0);
                    
                    for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
                        const tasks = await loadTasksByDate(d);
                        const rangeTask = tasks.find(task => task.isRangeTask);
                        if (rangeTask) {
                            const rangeId = rangeTask.rangeId;
                            if (!monthRangeTasks.has(rangeId)) {
                                monthRangeTasks.set(rangeId, {
                                    startDate: new Date(rangeTask.startDate),
                                    endDate: new Date(rangeTask.endDate),
                                    text: rangeTask.text,
                                    done: rangeTask.done
                                });
                            }
                        }
                    }
                }
                rangeTasksCache.set(currentMonthKey, monthRangeTasks);
            }
            
            const rangeTasks = rangeTasksCache.get(currentMonthKey);
            
            let html = '';
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            // 한국 공휴일 맵 (양력 기준, 일부 대체공휴일 포함)
            const holidays = new Map([
                // 고정 공휴일
                [`${year}-1-1`, '신정'],
                [`${year}-3-1`, '삼일절'],
                [`${year}-5-5`, '어린이날'],
                [`${year}-6-6`, '현충일'],
                [`${year}-8-15`, '광복절'],
                [`${year}-10-3`, '개천절'],
                [`${year}-10-9`, '한글날'],
                [`${year}-12-25`, '성탄절'],
            ]);

            // 음력 공휴일 (연도별 양력 변환)
            const lunarHolidays = {
                2025: { 설날: ['1-28', '1-29', '1-30'], 추석: ['10-5', '10-6', '10-7'] },
                2026: { 설날: ['2-16', '2-17', '2-18'], 추석: ['9-24', '9-25', '9-26'] },
                2027: { 설날: ['2-6', '2-7', '2-8'], 추석: ['9-14', '9-15', '9-16'] },
                2028: { 설날: ['1-26', '1-27', '1-28'], 추석: ['10-2', '10-3', '10-4'] },
                2029: { 설날: ['2-12', '2-13', '2-14'], 추석: ['9-21', '9-22', '9-23'] },
                2030: { 설날: ['2-2', '2-3', '2-4'], 추석: ['9-11', '9-12', '9-13'] }
            };

            // 현재 연도의 음력 공휴일 추가
            if (lunarHolidays[year]) {
                const yearHolidays = lunarHolidays[year];
                if (yearHolidays.설날) {
                    yearHolidays.설날.forEach(date => {
                        holidays.set(`${year}-${date}`, '설날');
                    });
                }
                if (yearHolidays.추석) {
                    yearHolidays.추석.forEach(date => {
                        holidays.set(`${year}-${date}`, '추석');
                    });
                }
            }


            // 6주 × 7일 = 42개 셀 생성
            for (let week = 0; week < 6; week++) {
                for (let day = 0; day < 7; day++) {
                    const currentDate = new Date(startDate);
                    currentDate.setDate(startDate.getDate() + (week * 7) + day);
                    currentDate.setHours(0, 0, 0, 0);
                    
                    const isCurrentMonth = currentDate.getMonth() === month - 1;
                    const isToday = currentDate.getTime() === today.getTime();
                    const isSelected = currentDate.getTime() === currentSelectedDate.getTime();
                    const isWeekend = day === 0 || day === 6; // 일요일 또는 토요일
                    const holidayKey = `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}-${currentDate.getDate()}`;
                    const holidayName = holidays.get(holidayKey) || null;
                    
                    // 해당 날짜의 할 일 개수 확인 (성능 최적화)
                    let taskCount = 0;
                    let completedCount = 0;
                    let regularTaskCount = 0;
                    let regularCompletedCount = 0;
                    let rangeInfo = null;
                    
                    if (isCurrentMonth) {
                        const tasks = await loadTasksByDate(currentDate);
                        taskCount = tasks.length;
                        completedCount = tasks.filter(task => task.done).length;
                        
                        // 일반 할 일과 범위 할 일 분리
                        const regularTasks = tasks.filter(task => !task.isRangeTask);
                        const rangeTasks = tasks.filter(task => task.isRangeTask);
                        
                        regularTaskCount = regularTasks.length;
                        regularCompletedCount = regularTasks.filter(task => task.done).length;
                        
                        // 범위 할 일 확인 (캐시된 정보 사용)
                        if (rangeTasks.length > 0) {
                            const rangeTask = rangeTasks[0]; // 첫 번째 범위 할 일 사용
                            const rangeStart = new Date(rangeTask.startDate);
                            const rangeEnd = new Date(rangeTask.endDate);
                            rangeStart.setHours(0, 0, 0, 0);
                            rangeEnd.setHours(0, 0, 0, 0);
                            currentDate.setHours(0, 0, 0, 0);
                            
                            const isRangeStart = currentDate.getTime() === rangeStart.getTime();
                            const isRangeEnd = currentDate.getTime() === rangeEnd.getTime();
                            
                            // 범위 내의 모든 날짜에 막대 표시
                            if (currentDate >= rangeStart && currentDate <= rangeEnd) {
                                rangeInfo = {
                                    text: rangeTask.text,
                                    done: rangeTask.done,
                                    isStart: isRangeStart,
                                    isEnd: isRangeEnd
                                };
                            }
                        }
                    }
                    
                    let classes = 'aspect-square flex flex-col items-center justify-center rounded-lg text-sm font-medium transition-all duration-300 cursor-pointer hover:scale-105 relative';
                    
                    if (!isCurrentMonth) {
                        classes += ' text-white/30';
                    } else if (isToday && isSelected) {
                        classes += ' bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-bold shadow-lg';
                    } else if (isToday) {
                        classes += ' bg-green-500 text-white font-bold';
                    } else if (isSelected) {
                        classes += ' bg-cyan-500 text-white font-bold';
                    } else if (isWeekend) {
                        // 주말 색상: 토요일 파랑, 일요일 빨강
                        if (day === 0) {
                            classes += ' calendar-weekend-sun';
                        } else {
                            classes += ' calendar-weekend-sat';
                        }
                    } else {
                        classes += ' text-white hover:bg-white/20';
                    }
                    
                    // 날짜를 YYYY-MM-DD 형식으로 저장 (로컬 시간대 기준)
                    const dateString = currentDate.getFullYear() + '-' + 
                                     String(currentDate.getMonth() + 1).padStart(2, '0') + '-' + 
                                     String(currentDate.getDate()).padStart(2, '0');
                    
                    let cellContent = `<div class="text-lg font-bold ${holidayName ? 'calendar-holiday' : ''}">${currentDate.getDate()}</div>`;
                    
                    // 할 일 배지 표시 (범위 할 일과 일반 할 일 모두 포함)
                    if (isCurrentMonth && taskCount > 0) {
                        const badgeColor = completedCount === taskCount ? 'bg-green-500' : 'bg-cyan-500';
                        const badgeText = completedCount === taskCount ? '✓' : taskCount;
                        cellContent += `
                            <div class="absolute -top-1 -right-1 w-5 h-5 ${badgeColor} text-white text-xs rounded-full flex items-center justify-center font-bold shadow-sm">
                                ${badgeText}
                            </div>
                        `;
                    }

                    // 공휴일 라벨 표시
                    if (isCurrentMonth && holidayName) {
                        cellContent += `<div class="calendar-holiday-label">${holidayName}</div>`;
                    }
                    
                    html += `<div class="${classes}" data-date="${dateString}">${cellContent}</div>`;
                }
            }
            
            grid.innerHTML = html;
        }
        
        // 날짜 클릭 이벤트 (한 번만 등록)
        function setupCalendarClickHandler() {
            const grid = document.getElementById('calendar-grid');
            
            // 기존 이벤트 리스너 제거
            grid.removeEventListener('click', handleCalendarClick);
            
            // 새로운 이벤트 리스너 추가
            grid.addEventListener('click', handleCalendarClick);
        }
        
        async function handleCalendarClick(e) {
            // 월간 캘린더 또는 주간 캘린더에서 날짜 클릭 처리
            const dateElement = e.target.closest('[data-date]');
            if (dateElement && dateElement.dataset.date) {
                const [year, month, day] = dateElement.dataset.date.split('-').map(Number);
                // 로컬 시간대로 정확한 날짜 생성
                const clickedDate = new Date(year, month - 1, day, 0, 0, 0, 0);
                
                // 같은 날짜 클릭 시 무시 (성능 최적화)
                if (clickedDate.getTime() === currentSelectedDate.getTime()) {
                    return;
                }
                
                currentSelectedDate = clickedDate;
                updateMainDate(currentSelectedDate);
                await updateWeekCalendar(currentSelectedDate);
                await renderTasks(currentSelectedDate);
                await renderMonthlyCalendar(); // 선택된 날짜 하이라이트 업데이트
            }
        }
        
        // 월 네비게이션
        async function changeMonth(direction) {
            currentMonth.setMonth(currentMonth.getMonth() + direction);
            await renderMonthlyCalendar();
            setupCalendarClickHandler();
        }
        
        // 실시간 시간 업데이트 (자정이 지나면 날짜 자동 업데이트)
        setInterval(async function() {
            const now = new Date();
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            // 자정이 지났는지 확인
            if (currentSelectedDate.toDateString() === new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString()) {
                currentSelectedDate = new Date();
                updateMainDate(currentSelectedDate);
                await updateWeekCalendar(currentSelectedDate);
                await renderTasks(currentSelectedDate);
                await renderMonthlyCalendar();
            }
        }, 60000); // 1분마다 체크
        // 우측 D-Day 패널
        async function refreshTopDdayPanel() {
            try {
                const resp = await fetch('api.php?action=get_top_dday&limit=5');
                const data = await resp.json();
                const panel = document.getElementById('dday-panel');
                if (!panel) return;
                if (!data.success || data.tasks.length === 0) {
                    panel.innerHTML = `
                        <div class="text-white/60 text-sm">등록된 D-Day가 없습니다.</div>
                    `;
                    return;
                }
                panel.innerHTML = data.tasks.map(t => {
                    const due = new Date(t.due_date);
                    const today = new Date();
                    today.setHours(0,0,0,0);
                    due.setHours(0,0,0,0);
                    const diff = Math.ceil((due - today)/(1000*60*60*24));
                    const label = diff === 0 ? 'D-Day' : (diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`);
                    const dateStr = `${due.getFullYear()}-${String(due.getMonth()+1).padStart(2,'0')}-${String(due.getDate()).padStart(2,'0')}`;
                    return `
                        <div class=\"flex items-center justify-between p-3 bg-white/10 rounded-xl border border-white/20 cursor-pointer hover:bg-white/20 transition-colors\" data-dday-date=\"${dateStr}\">
                            <div class=\"min-w-0 pr-3\">
                                <div class=\"text-white truncate\">${t.task_text}</div>
                                <div class=\"text-white/60 text-xs mt-1\">마감: ${dateStr}</div>
                            </div>
                            <span class=\"px-2 py-1 bg-red-500/20 text-red-300 text-xs rounded-full whitespace-nowrap\">${label}</span>
                        </div>
                    `;
                }).join('');
            } catch (e) {
                console.error('Failed to load top dday', e);
            }
        }

        // 저장/토글/삭제 후 패널 갱신
        const _origFetch = window.fetch;
        window.fetch = async function(url, opts) {
            const res = await _origFetch(url, opts);
            try {
                if (typeof url === 'string' && url.includes('api.php?action=')) {
                    const act = new URL(url, window.location.origin).searchParams.get('action');
                    if (['save_task','toggle_task','delete_task'].includes(act)) {
                        setTimeout(refreshTopDdayPanel, 0);
                    }
                }
            } catch {}
            return res;
        }

        // D-Day 패널 클릭으로 해당 날짜로 이동
        document.addEventListener('click', async function(e) {
            const item = e.target.closest('[data-dday-date]');
            if (!item) return;
            const dateStr = item.getAttribute('data-dday-date');
            if (!dateStr) return;
            const [y,m,d] = dateStr.split('-').map(Number);
            const target = new Date(y, m - 1, d, 0, 0, 0, 0);
            currentSelectedDate = target;
            updateMainDate(currentSelectedDate);
            await updateWeekCalendar(currentSelectedDate);
            await renderTasks(currentSelectedDate);
            await renderMonthlyCalendar();
            // 월간 캘린더 열려 있을 경우 선택 상태가 반영됨
        });
    </script>
    
    <!-- Footer -->
    <footer class="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-30">
        <div class="text-center text-white/40 text-sm light-contrast:text-slate-600/60">
            <div>꿈꾸는개발자 | Dreaming Developer</div>
            <div class="text-xs mt-1">© 2025 TodoList Service</div>
        </div>
    </footer>
</body>
</html>
