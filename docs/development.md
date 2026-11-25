# 개발과 배포

[로컬 실행과 어댑터 연결](../README.md)을 먼저 확인한다. Node.js 지원 범위와 구체적인 의존성은 [package.json](../package.json) 및 잠금 파일을 기준으로 한다. `.nvmrc`와 GitHub Actions는 Node 22 계열을 사용한다.

## 개발 명령

| 명령 | 용도 |
| --- | --- |
| `npm run dev` | Vite 개발 서버 |
| `npm run typecheck` | TypeScript 검사 |
| `npm run lint` | ESLint 검사 |
| `npm test` | Vitest 감시 모드 |
| `npm run test:run` | Vitest 1회 실행 |
| `npm run build` | 타입 검사 및 `dist/` 정적 빌드 |
| `npm run preview` | 빌드 결과를 로컬에서 확인 |
| `npm run check` | 타입·린트·테스트·빌드 실행 |
| `python3 -m unittest discover -s tests` | Python 수집·분석 도구 테스트 |

## 코드와 자료

- [화면 진입점](../src/app/App.tsx), [스타일](../src/styles/index.css), [3D 장면](../src/features/vehicle-scene/)은 React, TypeScript, Tailwind CSS, React Three Fiber와 Drei를 사용한다.
- [OBD 모듈](../src/features/obd/)은 Web Serial 연결, 읽기 전용 PID 폴링, ISO-TP 응답 해석을 담당한다.
- [Python 도구](../tools/)는 노트북 실차 데이터 수집·분석용이다. [연구 데이터](../research/)에는 응답 테스트 예제와 공개 자료의 색인이 있다. 실차 원시 로그는 `captures/`, 내려받은 원본 정의는 `research/sources/`에 로컬 보관한다.

## 로컬 화면 미리보기

`npm run dev`로 연 화면에서 **화면 미리보기**를 누르면 차량 없이 화면을 확인할 수 있다. 디버그 버튼으로 기어·속도·조향과 샘플 입력을 바꾸고 **미리보기 종료**로 연결 화면으로 돌아온다. 미리보기 코드는 프로덕션 빌드에서 제외된다.

## GitHub Pages

[배포 워크플로](../.github/workflows/pages.yml)는 `main`에 푸시할 때 검사와 빌드를 수행해 `dist/`를 [GitHub Pages](https://maquia-1.github.io/obd2/)에 올린다. 차량 데이터는 브라우저 메모리에서 처리한다.

Vite 개발 서버는 기본적으로 HTTP다. 스마트폰에서 노트북의 LAN IP로 접속하는 HTTP 주소는 Web Serial에 필요한 보안 컨텍스트 조건을 충족하지 않는다. 실차 시험에는 Pages의 HTTPS 주소를 사용한다.
