# OBD Dashboard

2015년식 LF 쏘나타 하이브리드용 OBD-II 대시보드. Android Chrome의 Web Serial API로 Bluetooth Classic SPP 어댑터에 연결하고, 차량 PID를 조회해 속도·기어·배터리 정보를 표시합니다. React와 Three.js로 구현했으며 DeX 세로 화면에 맞춰 배치했습니다.

## 차량 연결

1. Android Bluetooth 설정에서 Classic SPP를 지원하는 OBD-II 어댑터를 페어링합니다.
2. Android Chrome에서 [대시보드](https://maquia-1.github.io/obd2/)를 열고 **차량 연결**을 눌러 어댑터를 선택합니다.

스마트폰에서 Web Serial 연결에는 HTTPS가 필요합니다.

## 로컬 실행

Node.js 22.13 이상인 22 계열을 사용합니다.

```sh
npm ci
npm run dev
```

[개발 및 설계 문서](docs/README.md)
