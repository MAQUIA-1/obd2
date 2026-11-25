# OBD Dashboard

2015년식 LF 쏘나타 하이브리드용 3D OBD-II 대시보드입니다. Android Chrome에서 Web Serial API를 통해 Bluetooth Classic SPP 어댑터에 연결하고, 차량 PID 응답을 브라우저에서 처리합니다. Samsung DeX 환경을 고려해 화면을 구성했습니다.

## 주요 기능

- 속도, 기어, 엔진 RPM, 고전압 배터리 충전율·전류 등 차량 정보 표시
- 기어에 따른 3D 카메라 전환과 조향각 기반 후진 가이드
- 속도·기어·RPM·배터리 전류를 이용한 주행, 충전, 에너지 회수 상태 추정

## 차량 연결

1. Android Bluetooth 설정에서 Classic SPP를 지원하는 OBD-II 어댑터를 페어링합니다.
2. Android Chrome에서 [대시보드](https://maquia-1.github.io/obd2/)를 열고 **차량 연결**을 눌러 어댑터를 선택합니다.

스마트폰에서 Web Serial 연결에는 HTTPS가 필요합니다.

## 개발 스택

React 19, TypeScript 6, Vite 8, Tailwind CSS 4, Three.js, React Three Fiber를 사용합니다. GitHub Actions에서 테스트하고 빌드한 정적 파일을 GitHub Pages에 배포합니다.

## 로컬 실행

Node.js 22.13 이상인 22 계열을 사용합니다.

```sh
npm ci
npm run dev
```

`npm run check`로 타입 검사, 린트, 테스트, 빌드를 실행합니다.

[프로젝트 문서](docs/README.md)
