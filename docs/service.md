# Santamonica Boy 서비스 정리

서비스는 세 개이고, Firebase 프로젝트 `santamonica-boy` 하나를 같이 씁니다.

| 구분 | 저장소 | 주소 | 하는 일 |
| --- | --- | --- | --- |
| 대표 홈페이지 | `snjune6/santamonica-boy` | https://santamonica-boy.web.app | 소개, Google 로그인, 설치 파일 받기, 문의 보내기 |
| 관리자 | `snjune6/santamonica-admin` | https://santamonica-admin--santamonica-boy.asia-east1.hosted.app | role이 관리자인 Google 계정만 들어와서 문의 목록 보기 |
| 프로그램 | `snjune6/AutoCation` | 설치 파일 `AutoCation-Setup-0.4.4.exe` | 로그인 후 화면을 캡처해 Gemini, Claude, ChatGPT로 보냄 |

## 공통 데이터

같은 Google 계정이면 홈페이지와 프로그램이 Firestore `users/{같은 아이디}` 문서 하나를 씁니다.

- 홈페이지는 처음 로그인할 때 이메일, 이름, 로그인 시각, `role: 1`, `AutoCaption.autoCaption: 0`을 만듭니다. 문서가 이미 있고 `role`만 없으면 `1`을 채웁니다. 있는 `role`은 바꾸지 않습니다.
- 역할 공통코드는 Firestore `commonCodes/role` 문서 하나입니다. 필드 `10`은 관리자이고, `1`부터 `9`까지는 일반 사용자입니다.
- `users.role`이 그 문서에서 이름이 관리자인 코드와 같으면 관리자입니다. 새 계정은 `1`로 기록됩니다.
- 관리자 화면은 그 코드와 같은 `role`인 계정만 들어갑니다. 이메일 목록으로 관리자를 정하지 않습니다.
- 사용자 문서의 최상위에는 이메일, 이름, `role`, 프로그램 이름 `AutoCaption`이 있습니다. 단축키, 캡처, 사용 허용 값은 `AutoCaption` 아래에 있습니다.
- 프로그램은 `AutoCaption.autoCaption`을 읽고, 값이 `1`일 때만 본 화면으로 들어갑니다. 값이 `0`이거나 없으면 사용할 수 없습니다.
- 로그인 화면에서는 `AutoCaption.autoCaption`과 `role`을 관리자 값으로 바꿀 수 없습니다. 바꿀 값은 Firebase 콘솔의 `users` 문서에서 직접 수정합니다.

문의는 홈페이지에서 Firestore `inquiries`로 들어가고, 관리자 화면에서만 읽습니다. 일반 사용자는 문의 목록을 읽지 못합니다.

프로그램 버전은 Firestore `app/release`의 `latestVersion`과 설치 파일 버전이 같아야 실행됩니다. 현재 기준 버전은 `0.4.4`입니다.

## 직접 수정하는 값

- `AutoCaption.autoCaption`과 `role`은 Firebase 콘솔의 `users` 문서에서 바꿉니다.
- 홈페이지 다운로드는 Storage의 `downloads/AutoCation-Setup.exe`를 최신 설치 파일로 덮어씁니다.
- 관리자는 문의 목록을 봅니다. `commonCodes/role`의 관리자 코드와 `role`이 다른 계정은 들어가지 못합니다.
