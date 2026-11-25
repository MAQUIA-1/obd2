# 현대·기아 CAN 및 PID 공개 자료 조사

- 조사일: 2026-11-19
- 실제 대상: **LF 쏘나타 하이브리드**. 정확한 연식·트림은 실차 연결 시 확인한다.
- 기본 접근: **Bluetooth Classic SPP → CAN 스니핑 → 공개 정의 적용 → 필요한 미해석 항목만 분석**.
- 검증 상태: 아래 내용은 공개 소스의 실제 파일을 확인한 조사 결과다. 이 차량에서의 수신·해석 성공을 뜻하지 않는다.

## 1. 조사 결과와 우선 적용 순서

첫 적용 자료는 commaai/opendbc의 현대·기아 일반 CAN 정의다. 같은 자료의 현대 차량 상태 해석 코드에는 바퀴 속도, 조향각, 문, 방향지시등, 브레이크, 기어를 읽는 경로가 있다. 하나의 캡처를 여러 정의로 오프라인 해석하고, 실제 조작과 맞는 후보를 남기는 방식으로 진행한다.

LF 일반형만으로 범위를 제한하지 않는다. 공개 코드의 LF 일반형은 TCU 기반 기어 경로를 사용하지만, 옵티마 하이브리드 및 다른 HEV는 ELECT_GEAR 경로를 사용한다. 이는 LF 하이브리드에서도 여러 경로를 비교할 이유이며, 어느 경로가 맞는지는 아직 미확정이다.

| 적용 순서 | 자료군 | 목적 | LF HEV에 대한 판단 |
|---|---|---|---|
| 1 | opendbc 일반 CAN + 현대 2015 C-CAN | 주행·차체·계기판 기본 정보 | 가장 먼저 적용할 후보. 동일 차종 전체 지원 보장은 없음 |
| 2 | 옵티마 HEV, 아이오닉 HEV, 니로 HEV의 해석 분기 | 하이브리드 기어·페달·구동 상태 | 엔진형 LF와 다른 신호 경로를 확인하기 위한 후보 |
| 3 | 현대 2015 M-CAN | 공조·편의 정보 | 버스가 별개일 수 있으므로 현재 OBD 단자에 보이는 경우만 적용 |
| 4 | i30 2014, Santa Fe 2007, OVMS Soul EV | 오래된 현대·기아의 대안 정의 | 1~3으로 풀리지 않는 메시지에 선택 적용 |
| 5 | 신형 Palisade·현대 CAN FD·아이오닉 5 | 신호 이름·구조 참고 | 세대와 CAN 형식이 달라 LF에 직접 적용하는 우선순위는 낮음 |
| 대안 | OBDb 및 JejuSoul PID | 비교 기준 및 부족한 값 보완 | 요청·응답 자료이므로 방송 메시지와 분리 |

자료를 여러 개 시도한다는 것은 기본적으로 **같은 수동 캡처를 여러 해석 정의에 대조**한다는 뜻이다. 차종별 진단 명령을 차량에 무차별 전송하는 방식은 사용하지 않는다.

## 2. 조사·확보한 자료

11개 공개 저장소를 조회하고, 고정 커밋 기준 44개 파일(라이선스 파일 포함)을 내려받았다. 다운로드 원본과 근거는 다음 파일에 남겼다.

- [원본별 URL·커밋·SHA-256](../../research/sources_manifest.json)
- [DBC 전체 메시지·신호 색인](../../research/dbc_inventory.json)
- [첫 적용 대상 메시지 정의](../../research/first_pass_messages.json)
- [방송 메시지 목록](방송_메시지_색인.md)
- [OBDb 요청·응답 명령 색인](../../research/pid_command_inventory.json)

DBC 8개 파일에서 메시지 정의 627개와 신호 정의 5,611개를 색인했다. 같은 ID·신호의 대안 정의와 CAN FD 자료도 포함한 합계이며, 서로 다른 차량에서 전부 받을 수 있다는 뜻이 아니다. 첫 적용 메시지는 59개 대안 정의로 추렸다. 색인은 문법 기반 추출이며 실제 디코더와 차량 검증을 대체하지 않는다.

### A. commaai/opendbc — 스니핑 해석의 첫 선택

[저장소](https://github.com/commaai/opendbc) / 커밋 `79ddcc7bb72d557fc5b20d038c0fad9c9d423446`

| 파일 | 내용과 활용 |
|---|---|
| [hyundai_can.dbc](https://github.com/commaai/opendbc/blob/79ddcc7bb72d557fc5b20d038c0fad9c9d423446/opendbc/dbc/generator/hyundai/hyundai_can.dbc) | 일반 CAN의 광범위한 현대·기아 메시지 정의. 첫 적용 대상 |
| [hyundai_2015_ccan.dbc](https://github.com/commaai/opendbc/blob/79ddcc7bb72d557fc5b20d038c0fad9c9d423446/opendbc/dbc/hyundai_2015_ccan.dbc) | 2015 세대 C-CAN 대안 정의. 일반 정의와 차이를 비교 |
| [hyundai_2015_mcan.dbc](https://github.com/commaai/opendbc/blob/79ddcc7bb72d557fc5b20d038c0fad9c9d423446/opendbc/dbc/hyundai_2015_mcan.dbc) | M-CAN 자료. 별도 버스 가시성에 의존 |
| [hyundai_i30_2014.dbc](https://github.com/commaai/opendbc/blob/79ddcc7bb72d557fc5b20d038c0fad9c9d423446/opendbc/dbc/hyundai_i30_2014.dbc) | 이전 세대 참고 정의 |
| [hyundai_santafe_2007.dbc](https://github.com/commaai/opendbc/blob/79ddcc7bb72d557fc5b20d038c0fad9c9d423446/opendbc/dbc/hyundai_santafe_2007.dbc) | 오래된 세대 참고 정의 |
| [hyundai_canfd.dbc](https://github.com/commaai/opendbc/blob/79ddcc7bb72d557fc5b20d038c0fad9c9d423446/opendbc/dbc/generator/hyundai/hyundai_canfd.dbc) | 신형 CAN FD 비교 자료 |
| [_hyundai_canfd_common.dbc](https://github.com/commaai/opendbc/blob/79ddcc7bb72d557fc5b20d038c0fad9c9d423446/opendbc/dbc/generator/hyundai/_hyundai_canfd_common.dbc) | CAN FD 공통 정의. 다른 파일의 IMPORT 대상 |
| [hyundai_palisade_2023.dbc](https://github.com/commaai/opendbc/blob/79ddcc7bb72d557fc5b20d038c0fad9c9d423446/opendbc/dbc/generator/hyundai/hyundai_palisade_2023.dbc) | 최신 세대 보조 참고 |
| [carstate.py](https://github.com/commaai/opendbc/blob/79ddcc7bb72d557fc5b20d038c0fad9c9d423446/opendbc/car/hyundai/carstate.py) | 실제 상태 해석, 기어 분기, 단위 및 상태 판정 참고 |
| [values.py](https://github.com/commaai/opendbc/blob/79ddcc7bb72d557fc5b20d038c0fad9c9d423446/opendbc/car/hyundai/values.py) | LF, 옵티마 HEV, 아이오닉·니로 등 차종별 분기 근거 |

현재 원본에서는 `hyundai_can_generated`가 일반 CAN 기본 DBC 이름이다. 과거 자료의 `hyundai_kia_generic`라는 이름만 검색하면 최신 파일 위치를 놓칠 수 있다. 생성 전 원본은 위 `generator/hyundai/hyundai_can.dbc`다. CAN FD 파일의 IMPORT와 생성 규칙은 실제 파서 도입 시 반영한다.

### B. JejuSoul HKMC — HEV/PHEV 배터리 및 구동 PID

[저장소](https://github.com/JejuSoul/OBD-PIDs-for-HKMC-EVs) / 커밋 `493b335a52a2b9d7a2aa3fa747c1d56e94f575ee`

아이오닉 HEV, 니로 HEV, 옵티마 PHEV, 아이오닉 PHEV의 BMS·VMCU·추가 계기 자료 12개 CSV를 확보했다. 이는 **질의·응답 정의**다. `7E4 / 2101` 같은 요청 주소와 명령, 전류·전압·SOC·온도·누적 에너지 계산식이 들어 있다.

- LF와 비슷한 이름이라는 이유보다, 기존 LF 앱에서 사용했던 BMS 패킷과 구조가 겹치는지 우선 비교한다.
- HEV를 먼저, PHEV를 다음 후보로 둔다. 배터리 전압 범위·모듈 수·온도 수를 차종 간에 그대로 옮기지 않는다.
- 전류의 부호와 수식 문자 인덱스는 실제 패킷과 대조한다.
- 저장소 목록에는 Kona/Niro EV, Soul EV 27/30/64kWh, Ray EV 자료도 있다. 이번에는 HEV/PHEV를 우선 내려받았으며 EV 전체 자료를 검토 완료한 것은 아니다.

### C. OBDb — 여러 차종의 요청·응답 자료

모두 `signalsets/v3/default.json`을 확인했다. 아래 숫자는 내려받은 스냅샷에 기재된 정의 수이며 실차 지원 수가 아니다.

| 저장소 | 요청 정의 | 신호 정의 | 활용 |
|---|---:|---:|---|
| [Hyundai-Sonata](https://github.com/OBDb/Hyundai-Sonata) | 120 | 868 | LF 기존 EPS·TCM PID와 대조, 다른 연식 자료 구분 |
| [Kia-Optima](https://github.com/OBDb/Kia-Optima) | 71 | 358 | 세단 및 하이브리드 관련 대안 후보 |
| [Hyundai-IONIQ](https://github.com/OBDb/Hyundai-IONIQ) | 67 | 640 | HEV/PHEV/EV 혼재 여부 확인 후 BMS 비교 |
| [Kia-Niro](https://github.com/OBDb/Kia-Niro) | 117 | 946 | BMS·구동 PID 비교 |
| [Hyundai-Kona](https://github.com/OBDb/Hyundai-Kona) | 36 | 241 | 확장 참고 |
| [Hyundai-Elantra](https://github.com/OBDb/Hyundai-Elantra) | 78 | 478 | 엔진·변속기·차체 대안 참고 |
| [Hyundai-Santa-Fe](https://github.com/OBDb/Hyundai-Santa-Fe) | 82 | 424 | 구동·차체·온도 대안 참고 |
| [Kia-Sorento](https://github.com/OBDb/Kia-Sorento) | 101 | 695 | 구동·BMS 세대 차이 참고 |

주소가 CAN ID처럼 보이더라도 `hdr + cmd`가 있는 이 자료는 스니핑 DBC가 아니다. 예를 들어 Sonata의 문 열림 `770/22BC03` 등에는 2021년 이후 필터가 있고, TCM `7E1/21A0`에는 2011~2023년 정의가 있다. 연식 필터에 맞는다는 사실도 LF HEV에서 검증됐다는 뜻은 아니다. 같은 센서의 대안 정의를 섞거나 21xx와 22xxxx 응답 레이아웃을 동일시하지 않는다.

### D. OVMS — 실제 수신 처리 코드 참고

[저장소](https://github.com/openvehicles/Open-Vehicle-Monitoring-System-3) / 커밋 `7470869a2db574ad1fab962a3cae4f22e6cf1385`

- Soul EV C-CAN 수신 코드에는 `0x018` 문 상태, `0x4F2` 속도, `0x542` SOC 등의 해석이 있다. LF 적용을 보장하지 않는 독립 후보로 보관한다.
- Soul EV M-CAN 코드에는 공조·편의 해석이 있다. 다른 버스에서만 보일 수 있다.
- 니로 EV의 확보한 C-CAN 파일은 동기 요청 응답 전달 처리가 중심이며, 그 파일만으로 포괄적인 방송 신호 해석을 확보했다고 볼 수 없다.
- 아이오닉 5 C-CAN 파일은 신형 EV의 참고 자료로만 둔다.
- 제어·송신 구현은 이번 수동 캡처에 사용하지 않는다.

## 3. 첫 캡처에 적용할 방송 후보

아래 ID와 이름은 확보한 `hyundai_can.dbc` 기준이다. 단위·열거값·길이는 원본을 따라 검증하고, 같은 ID에 다른 레이아웃이 있을 수 있으므로 자료별 결과를 분리한다.

| 우선순위 | CAN ID (hex) | 메시지 / 주요 신호 | 해석 후보 및 비교점 |
|---|---|---|---|
| P1 | `2B0` | SAS11 / SAS_Angle | 조향각. little endian, signed 16bit, 0.1도 단위 후보 |
| P1 | `386` | WHL_SPD11 / WHL_SPD_FL·FR·RL·RR | 바퀴별 속도. 정차 0만으로 배율 확정 불가 |
| P1 | `4F1` | CLU11 / CF_Clu_Vanz, SPEED_UNIT | 계기판 계열 속도·단위와 크루즈 버튼 |
| P1 | `52A` | CLU15 / VehicleSpeed, Gear | 속도·기어 대안 |
| P1 | `316` | EMS11 / N | 엔진 RPM 후보 |
| P1 | `372` | ELECT_GEAR / Elect_Gear_Shifter | 하이브리드·EV 기어 후보. 첫 기어 해석 후보 |
| P1 | `112` | TCU12 / CUR_GR | LF 일반형·옵티마 일반형에서 참고할 기어 대안 |
| P1 | `367` | LVR12 / CF_Lvr_Gear | 셀렉터 기어 대안 |
| P1 | `371` | E_EMS11 | HEV 가속페달 및 구동 상태 관련 후보 |
| P2 | `541` | CGW1 | 앞문·벨트·트렁크·방향지시등·전원 관련 |
| P2 | `553` | CGW2 | 뒷문 등 차체 상태 |
| P2 | `559` | CGW4 | 벨트 표시 등 보조 상태 |
| P2 | `394` | TCS13 | 브레이크·주차브레이크·정차 관련 |
| P2 | `507` | TCS15 / AVH_LAMP | 오토홀드 후보 |
| P2 | `593` | TPMS11 / PRESSURE_FL·FR·RL·RR, UNIT | 단위와 유효성 별도 검증 |
| P2 | `329` | EMS12 / TEMP_ENG | 냉각수 온도 후보 |
| P2 | `383` | FATC11 / OutTemp 계열 | 외기온 대안 |
| P3 | `5B0` | CLU12 / CF_Clu_Odometer | 누적 주행거리 후보 |
| P4 | `040`·`042`·`043`·`044` | DATC14·12·13·11 | 공조·실내외 온도·설정 정보 |

이 목록에서 **LF HV 배터리 전류·전압·SOC와 READY를 확정한 방송 정의는 아직 없다.** Soul EV의 SOC 후보와 HEV 구동 상태 후보를 대조할 수 있지만, 기존 BMS PID가 방송 CAN 레이아웃을 증명하지는 않는다. LF에서 실제 보이는 미해석 메시지를 대상으로 필요한 경우에만 추가 분석한다.

## 4. 실차에서 여러 후보를 시도하는 방식

1. Classic SPP 서비스를 실제 제공하는지 확인한다. 과거 BLE 성공 기록만으로 SPP도 된다고 가정하지 않는다.
2. silent monitoring으로 짧은 기준 로그 하나를 확보한다. 요청 명령을 함께 실행하지 않는다.
3. 원시 CAN ID·길이를 색인과 비교해 알려진 메시지가 보이는지 확인한다.
4. 일반 CAN, 2015 C-CAN, HEV 기어 분기를 같은 로그에 적용한다. ID 및 길이 일치는 후보 진입 조건이며 성공 판정은 아니다.
5. 정차 상태에서 조향·방향지시등·문·브레이크·기어를 하나씩 확인한다. 같은 로그에 여러 해석을 적용하므로 차종 후보마다 조작을 반복하지 않는다.
6. 실제 상태와 맞는 후보를 별도 반복 실험으로 확인하고, 충돌하거나 값이 비슷하기만 한 후보는 보류한다.
7. 부족한 핵심 신호만 추가 분석하고, 스니핑으로 보이지 않는 값은 PID 대안을 별도로 판단한다.

CAN FD 자료가 있다고 해서 현재 ELM 어댑터로 CAN FD가 수신되는 것은 아니다. 다른 버스 정의를 적용한다고 게이트웨이 뒤의 데이터가 새로 나타나지도 않는다. 수신 경로 문제와 해석 문제를 구분한다.

## 5. 이 문서와 도구의 현재 한계

- `tools/can_capture.py`에 Classic SPP 연결부를 추가했다. Classic 기본 선택 및 BLE 명시적 대안으로 구성했고 로컬 테스트 6개가 통과했다. 실제 스캐너의 SPP 지원과 실차 캡처는 미검증이다.
- DBC 원본·색인과 후보 순서는 준비했지만 실제 캡처에 DBC를 적용하는 디코더는 아직 연결하지 않았다.
- 비교용 원본은 고정 커밋으로 보관했다. 업데이트 시 manifest와 결과를 함께 갱신한다.
- opendbc는 MIT, OBDb는 CC-BY-SA-4.0 표기를 확인했다. JejuSoul은 조회한 저장소 메타데이터에 라이선스가 없고, OVMS는 파일별 고지를 함께 확인해야 한다. 외부 원본은 로컬 조사 캐시로 두며 제출 코드에 포함할 때 출처·조건을 반영한다.
