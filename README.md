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
├── .github/           # 이슈, PR 템플릿
│   ├── ISSUE_TEMPLATE/
│   └── pull_request_template.md
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

## 작업 방식

모든 작업은 이슈에서 시작해 PR로 합칩니다.

1. 이슈를 만듭니다. 템플릿은 '작업 요청' 또는 '문제 신고'를 고릅니다.
2. 작업 브랜치를 만듭니다.
3. PR을 엽니다. 본문에 `Closes #번호`를 적습니다.
4. 리뷰를 받습니다.
5. main에 합칩니다.
6. 작업 브랜치를 삭제합니다.
7. 화면(`site/`)이나 규칙이 바뀌었으면 배포합니다.

브랜치 이름:

- `feature/...`: 기능
- `fix/...`: 문제 수정
- `docs/...`: 문서
- `chore/...`: 설정, 정리

템플릿 위치:

- 이슈: `.github/ISSUE_TEMPLATE/`
- PR: `.github/pull_request_template.md`

main에 합쳐도 자동으로 배포되지 않습니다. 화면과 규칙은 따로 올립니다.

화면(`site/`):

```
firebase deploy --only hosting --project santamonica-boy
```

규칙(Firestore, Storage):

```
firebase deploy --only firestore:rules,storage --project santamonica-boy
```
