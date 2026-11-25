# OBD Dashboard

2015년식 LF 쏘나타 하이브리드의 속도, 기어, 배터리 정보 등을 보여주는 3D 웹 대시보드입니다. 삼성 스마트폰 Chrome과 DeX 세로 화면을 대상으로 합니다.

## 사용하기

[대시보드 열기](https://maquia-1.github.io/obd2/)

1. Android Bluetooth 설정에서 Classic SPP를 지원하는 OBD 어댑터를 페어링합니다. 다른 앱이나 PC가 어댑터에 연결되어 있으면 해제합니다.
2. Android Chrome에서 대시보드를 열고 **차량 연결**을 눌러 어댑터를 선택합니다.

대상 차량의 정차 데이터는 노트북에서 확인했습니다. Android Chrome·DeX에서의 실차 연동과 주행 중 동작은 현장 검증 전입니다.

## 로컬 실행

Node.js 22.13 이상인 22 계열을 사용합니다.

```sh
npm ci
npm run dev
```

개발 서버가 출력한 주소를 브라우저에서 엽니다. 스마트폰에서 실차 연결을 시험하려면 HTTPS 페이지를 사용합니다.

[개발·설계·실차 검증 문서](docs/README.md)
