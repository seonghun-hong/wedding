# Google Drive 원본 사진·동영상 업로드 연결

이 구성은 하객이 청첩장 안에서 올린 사진과 동영상 원본을 결혼식 전용 Google Drive에 저장합니다.
Supabase에는 이름, 연락처, 파일 주소 같은 작은 목록 정보만 저장합니다.

## 준비물

- 결혼식 사진 전용 Google 계정 1개
- 무료 Cloudflare 계정 1개
- 현재 사용 중인 Supabase 프로젝트

비밀키는 GitHub나 `.env`에 넣지 않습니다. Cloudflare Worker의 Secret으로만 등록합니다.

## 1. Google Drive 폴더 만들기

전용 Google 계정으로 Drive에 접속해 다음 폴더를 만듭니다.

1. `Wedding Photos`
2. 그 안에 `originals`

각 폴더를 열었을 때 주소가 아래와 같다면 마지막 부분이 폴더 ID입니다.

```text
https://drive.google.com/drive/folders/여기가_폴더_ID
```

`originals` 폴더 ID를 메모합니다.

썸네일 파일은 별도로 저장하지 않습니다. 목록을 열 때 Google Drive가 자동 생성한
저화질 썸네일을 Cloudflare Worker가 대신 받아 캐시해서 보여줍니다.

## 2. Google Drive API 켜기

1. [Google Cloud Console](https://console.cloud.google.com/)에 전용 계정으로 로그인합니다.
2. 새 프로젝트 `Wedding Photo Upload`를 만듭니다.
3. `API 및 서비스 > 라이브러리`에서 `Google Drive API`를 찾아 사용 설정합니다.
4. `Google Auth Platform`에서 앱 이름과 이메일을 입력합니다.
5. 대상은 `외부`로 설정하고 전용 Google 계정을 테스트 사용자로 추가합니다.
6. 앱 게시 상태를 `프로덕션`으로 전환합니다. 테스트 상태의 토큰은 만료될 수 있습니다.

이 앱은 전용 계정 한 개에서만 사용하므로 공개 사용자 인증 화면은 청첩장에 나타나지 않습니다.

## 3. OAuth 키와 Refresh Token 만들기

1. `API 및 서비스 > 사용자 인증 정보`에서 OAuth 클라이언트를 만듭니다.
2. 애플리케이션 유형은 `웹 애플리케이션`을 선택합니다.
3. 승인된 리디렉션 URI에 아래 주소를 추가합니다.

```text
https://developers.google.com/oauthplayground
```

4. 생성된 `Client ID`와 `Client Secret`을 메모합니다.
5. [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)를 엽니다.
6. 오른쪽 위 설정에서 `Use your own OAuth credentials`를 켭니다.
7. Client ID와 Client Secret을 입력합니다.
8. 왼쪽 목록에서 아래 권한을 입력해 승인합니다.

```text
https://www.googleapis.com/auth/drive
```

9. `Exchange authorization code for tokens`를 누릅니다.
10. 표시되는 `Refresh token`을 메모합니다.

전용 계정만 사용하는 것이 중요합니다. 이 토큰은 해당 계정의 Drive에 접근할 수 있으므로 누구에게도 전달하지 않습니다.

## 4. Cloudflare Worker 배포

PowerShell에서 프로젝트의 `cloudflare-worker` 폴더로 이동합니다.

```powershell
cd C:\Users\Admin\Documents\Codex\wedding-main\cloudflare-worker
Copy-Item wrangler.toml.example wrangler.toml
npm.cmd install
npx.cmd wrangler login
```

아래 명령을 하나씩 실행하고 안내가 나오면 해당 값을 붙여넣습니다.

```powershell
npx.cmd wrangler secret put GOOGLE_CLIENT_ID
npx.cmd wrangler secret put GOOGLE_CLIENT_SECRET
npx.cmd wrangler secret put GOOGLE_REFRESH_TOKEN
npx.cmd wrangler secret put GOOGLE_DRIVE_ORIGINALS_FOLDER_ID
npx.cmd wrangler secret put SUPABASE_URL
npx.cmd wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

Supabase `service_role` 키는 Supabase Dashboard의 프로젝트 API 설정에서 확인합니다.
이 키는 절대로 GitHub 변수나 프런트엔드 `.env`에 넣지 않습니다.

배포합니다.

```powershell
npx.cmd wrangler deploy
```

배포 결과에 아래와 비슷한 주소가 표시됩니다.

```text
https://wedding-photo-upload.계정명.workers.dev
```

브라우저에서 `/health`를 붙여 열었을 때 `{"ok":true}`가 나오면 연결이 완료된 것입니다.

## 5. 청첩장에 Worker 주소 연결

로컬 `.env`에는 공개 Worker 주소만 추가합니다.

```text
VITE_PHOTO_UPLOAD_API_URL=https://wedding-photo-upload.계정명.workers.dev
```

GitHub에서는 다음 위치에 같은 값을 등록합니다.

```text
Repository Settings
> Secrets and variables
> Actions
> Variables
> VITE_PHOTO_UPLOAD_API_URL
```

이 값은 비밀키가 아니므로 GitHub Actions의 Variable로 등록하면 됩니다.

## 6. 적용되는 안전 제한

- 사진과 MP4·MOV·WebM 동영상 원본 허용
- 사진 1개 최대 30MB, 동영상 1개 최대 100MB
- 한 번에 최대 30개
- Google 전체 사용량 13GB 도달 시 업로드 자동 차단
- Supabase 저장 실패 시 Drive 원본 자동 삭제
- 썸네일 실패 시 원본은 유지
- 원본과 썸네일은 수정 없이 고유한 파일명으로 저장

전용 Google 계정에는 Gmail이나 개인 사진을 저장하지 않는 것을 권장합니다.
