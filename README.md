# foam-experiment — 발포 실험 트래커

> 우레탄 발포라인 OFAT 실험 데이터 관리
> Next.js 14 + Supabase + Tailwind CSS + Chart.js · Vercel 배포

## 프로젝트 구조

```
foam-experiment/
├── app/
│   ├── globals.css
│   ├── layout.jsx
│   └── page.jsx            # 메인 (인증 + 탭 라우팅)
├── components/
│   ├── MoldBoiler.jsx       # 금형·보일러 관리
│   ├── FactorManager.jsx    # OFAT 변수 관리
│   ├── RunList.jsx          # 실험 Run 생성·목록
│   ├── LotInput.jsx         # 로트 일괄 입력 (중량/경도/온도/구역)
│   └── Analysis.jsx         # 히스토리·산포도·구역히트맵·인자비교
├── lib/
│   └── supabase.js
├── supabase-migration.sql   # DB 테이블 생성 SQL
└── .env.local.example
```

## 셋업 순서

### 1. Supabase 테이블 생성

기존 프로젝트 (가공 일지 작업시스템) SQL Editor에서
`supabase-migration.sql` 전체 실행

### 2. Vercel 환경변수

```
NEXT_PUBLIC_SUPABASE_URL=https://icacwoylqfhqnmoaiehv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

### 3. GitHub 레포 생성 + 배포

1. GitHub에서 `dpfls2405-oss/foam-experiment` 레포 생성
2. 파일 업로드 (개별 파일 업로드 방식)
3. Vercel에서 Import → 자동 배포

## 주요 기능

| 탭 | 기능 |
|---|---|
| 금형·보일러 | 금형 CRUD, 보일러 온도 설정, 금형-보일러 매핑 |
| OFAT | 실험 변수 동적 추가/비활성화, OFAT 규칙 안내 |
| 실험목록 | Run 생성 (변수 1개 실험 + 나머지 고정), Run 목록 |
| 로트입력 | 시편 10개+ 일괄 입력 (중량/경도/온도상하/구역맵) |
| 분석 | 히스토리, 온도×충진율 산포도, 구역 히트맵, 인자별 비교 |

## 비밀번호

`6720`
