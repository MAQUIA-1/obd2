# 디자인 자료 상태

현재 방향: 세로 화면, 흰 배경·미니멀 UI, LF 쏘나타 3D 모델. 주차 시 버드아이뷰에서 조향 점선 가이드를 표시한다. 바퀴는 고정해도 된다.

| 자료 | 상태 |
|---|---|
| models/sonata-lf/sonata15.glb | 사용할 사용자 제공 모델. 정적 구조 확인, 브라우저 렌더링 전 |
| models/sonata-lf/inspection.json | 용량·구조·해시 및 미검증 항목 |
| 차량중심_UI_스토리보드.svg / png | 배치·동작 설명용 과거 개념도. 어두운 스타일과 회전 바퀴는 최종안 아님 |
| vehicle-line-art-concept.svg / png | 자체 제작 스타일 시안, 사용자 미채택 |
| model-candidates/quaternius-comparison.png | 모델 비교용 오프라인 렌더. 사용자 미채택 |
| models/quaternius-normal-car-1/ | 미채택 후보의 출처·검토 이력 |

실제 구현 순서는 쏘나타 모델의 브라우저 로딩·방향·재질 확인 → 흰색 세로 화면 → 버드아이뷰 조향 점선 → 주행 시점·속도 연동 모션이다.
