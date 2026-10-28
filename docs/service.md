# Santamonica Boy 서비스 정리

서비스는 세 개이고, Firebase 프로젝트 `santamonica-boy` 하나를 같이 씁니다.

| 구분 | 저장소 | 주소 | 하는 일 |
| --- | --- | --- | --- |
| 대표 홈페이지 | `snjune6/santamonica-boy` | https://santamonica-boy.web.app | 소개, Google 로그인, 설치 파일 받기, 문의 보내기 |
| 관리자 | `snjune6/santamonica-admin` | https://santamonica-admin--santamonica-boy.asia-east1.hosted.app | 허용된 Google 계정만 들어와서 문의 목록 보기 |
| 프로그램 | `snjune6/AutoCation` | 설치 파일 `AutoCation-Setup-0.4.4.exe` | 로그인 후 화면을 캡처해 Gemini, Claude, ChatGPT로 보냄 |

## 공통 데이터

같은 Google 계정이면 홈페이지와 프로그램이 Firestore `users/{같은 아이디}` 문서 하나를 씁니다.

- 홈페이지는 처음 로그인할 때 이메일, 이름, 로그인 시각, `autoCaption: 0`을 만듭니다. 문서가 이미 있으면 수정하지 않습니다.
- 프로그램은 설정과 `autoCaption`을 읽고, 값이 `1`일 때만 본 화면으로 들어갑니다. 값이 `0`이거나 없으면 사용할 수 없습니다.
- 로그인 화면에서는 `autoCaption`을 `1`로 바꿀 수 없습니다. 허용할 계정은 Firebase 콘솔에서 그 값을 `1`로 바꿉니다.
- 기존 `users` 문서는 업데이트된 프로그램으로 다시 로그인할 때 `autoCaption: 0`이 붙습니다. 문서가 아직 없는 계정은 홈페이지나 프로그램으로 다시 로그인하면 문서가 생깁니다.

문의는 홈페이지에서 Firestore `inquiries`로 들어가고, 관리자 화면에서만 읽습니다. 일반 사용자는 문의 목록을 읽지 못합니다.

프로그램 버전은 Firestore `app/release`의 `latestVersion`과 설치 파일 버전이 같아야 실행됩니다. 현재 기준 버전은 `0.4.4`입니다.

## 아직 연결되지 않은 것

- 설치 파일은 프로그램 저장소에서 만든 `AutoCation-Setup-0.4.4.exe`입니다. 홈페이지가 받는 저장소 파일과 프로그램 업데이트 주소는 비어 있습니다.
- `autoCaption`을 `1`로 바꾸는 관리 화면은 없습니다. Firebase 콘솔에서 직접 바꿉니다.
- 관리자는 문의만 봅니다. 사용자 허용 여부는 바꾸지 않습니다.
