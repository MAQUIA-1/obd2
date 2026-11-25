# 사용자 제공 LF 쏘나타 모델

[원본 ZIP](../../design/models/sonata-lf/2015-hyundai-sonata.zip)의 `source/sonata15.glb`를 수정 없이 추출했다. glTF 2.0 GLB, 3,166,192바이트, 삼각형 46,462개. 텍스처 10개는 GLB 안에 들어 있어 별도 textures 폴더 없이 로딩 가능한 구조다. [GLB](../../design/models/sonata-lf/sonata15.glb)와 [정적 구조·해시 검사 기록](../../design/models/sonata-lf/inspection.json)을 참고한다. 로컬과 Pages에서 동일한 GLB를 사용한다.

앞바퀴 조향과 후방 점선은 [대시보드 구현](대시보드_구현.md)과 [차량 운동 모델](차량_운동_모델.md)을 참고한다.

압축 파일 안에 출처·라이선스 문서는 없었다. 사용자 제공 원본을 보존하며 표시용 재질 보정은 로딩 시 적용한다.
