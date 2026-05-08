# Taskboard 프로젝트

이 프로젝트는 Task 관리 및 협업을 위한 보드 기반 웹 서비스입니다. 

## 📝 데모 계정 안내 (보안 삭제됨)
초기 테스트 목적으로 로그인 페이지에 하드코딩 되어있던 다음의 샘플 계정 정보들은 보안을 위해 소스 코드에서 모두 삭제되었습니다. 로컬 환경에서 테스트가 필요한 경우 참고해 주세요.
- **관리자 (Admin) 계정**: `admin` / `admin123`
- **일반 사용자 (User) 계정**: `user1` / `user123`

*(위 안내 정보는 실제 로그인 화면 소스에서는 삭제되었으며, 실제 DB에 해당 계정이 구성되어 있어야 로그인이 가능합니다.)*

## 💻 실행 환경 구성 (Prerequisites)
이 프로젝트를 다운로드 받아 정상적으로 실행하기 위해서는 다음과 같은 환경 구성이 필요합니다.

- **Node.js**: `v18.0.0` 이상 권장 (또는 `v20 LTS`)
- **NPM**: Node.js 설치 시 기본 포함
- **React**: `v19.2.0`
- **Vite**: `v7.2.4` 이상
- **Database**: MySQL Server 환경

## 🚀 프로젝트 시작 가이드

소스 코드를 다운로드 받은 후 다음 순서에 따라 실행해 주세요.

### 1. 패키지 의존성 설치
프로젝트 최상위(Root) 디렉토리에서 아래 명령어를 통해 프론트엔드와 백엔드의 모든 의존성 패키지를 설치합니다.
```bash
npm install
cd server
npm install
cd ..
```
*(루트 경로의 프론트엔드 패키지들과 server 디렉토리 내부의 백엔드 패키지들을 모두 설치해야 합니다.)*

### 2. 환경 변수 (.env) 설정
프로젝트 폴더 최상위 경로에 `.env` 파일을 생성하고, 데이터베이스 접속 정보 및 환경 변수를 설정합니다. 
*(기존 소스 코드 상에 하드코딩 되어있던 DB 접속 정보들은 모두 제거되었으므로, 반드시 `.env` 파일 구성이 필요합니다.)*

```env
# 데이터베이스 설정
DB_TYPE=mysql
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=본인의_DB_비밀번호
DB_NAME=taskboard

# 기타 백엔드 서버 포트 (기본: 3000)
PORT=3000
```

### 3. 데이터베이스 초기 세팅
**웹 서비스 기동 전, 반드시 MySQL 서비스가 실행 중이어야 합니다.**

1. 지정한 이름(`taskboard`)으로 데이터베이스를 생성합니다.
2. 프로젝트에 포함된 `taskboard_table_ddl_list.md` 파일 안의 `CREATE TABLE` 스크립트들을 모두 복사하여 데이터베이스에서 실행해 줍니다.
3. 테이블이 모두 생성되었다면, 웹서비스 접속 테스트를 위해 아래의 샘플 `INSERT` 쿼리를 실행하여 계정을 생성해 주세요.

```sql
-- 1. 팀(Team) 기본 데이터 생성
INSERT INTO `teams` (`id`, `name`, `description`) 
VALUES (1, 'Default Team', '기본 팀입니다.');

-- 2. 관리자(Admin) 샘플 계정 생성 (아이디: admin / 비밀번호: admin123)
INSERT INTO `users` (`username`, `password`, `name`, `role`, `status`, `team_id`) 
VALUES ('admin', '$2b$10$/8WJSZOApN6H/XDPkaCiHu12OzSzK/ASoJBXmDvNZkbjhpI7tqHLi', '관리자', 'admin', 'ACTIVE', 1);

-- 3. 일반 사용자(User) 샘플 계정 생성 (아이디: user1 / 비밀번호: user123)
INSERT INTO `users` (`username`, `password`, `name`, `role`, `status`, `team_id`) 
VALUES ('user1', '$2b$10$PURULuw3YYY5emoE6oZ4H.tg1rTn.sUKpvP9X/PcHbZynseJgT.pm', '테스트유저', 'user', 'ACTIVE', 1);
```
*(주의: 위 쿼리에 포함된 비밀번호는 bcrypt로 암호화된 값입니다.)*

### 4. 서비스 기동 (개발 모드)
MySQL DB와 테이블이 모두 세팅되었다면, 터미널에서 최상위 경로로 이동한 뒤 아래 명령어를 실행하여 프론트엔드(Vite)와 백엔드(Node.js) 서버를 동시에 구동합니다.
```bash
npm run dev
```
- **프론트엔드 (UI)**: 기본적으로 `http://localhost:5173` 에서 서비스됩니다.
- **백엔드 (API)**: 포트 `3000` 에서 API 및 Socket.io 통신을 담당합니다.

---
*기타 문의사항이나 버그는 GitHub Issue에 남겨주세요.*
