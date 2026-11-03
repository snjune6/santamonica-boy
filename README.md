# Santamonica Boy

Santamonica Boy 대표 홈페이지입니다. 정적 사이트이고 Firebase Hosting으로 배포합니다.

- 주소: https://santamonica-boy.web.app
- Firebase 프로젝트: `santamonica-boy`

## 폴더 구조

```
.
├── site/              # 공개 파일 (Hosting public 폴더)
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   ├── assets/        # 이미지, 아이콘
│   └── ...
├── docs/service.md    # 서비스 전체 정리
├── firebase.json      # Hosting, Firestore, Storage 설정
├── firestore.rules    # Firestore 보안 규칙
├── storage.rules      # Storage 보안 규칙
└── .firebaserc        # 기본 프로젝트 지정
```

## 로컬 실행

이 저장소 루트에서:

```
firebase emulators:start --only hosting --project santamonica-boy
```

워크스페이스 루트에서는 `npm run dev:home`으로 같은 명령을 실행합니다.

브라우저에서 http://127.0.0.1:5000 을 엽니다.

## 배포

```
firebase deploy --only hosting --project santamonica-boy
```
