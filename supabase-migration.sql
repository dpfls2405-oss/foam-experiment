-- =============================================
-- foam-experiment: Supabase 마이그레이션
-- 기존 프로젝트 (가공 일지 작업시스템)에서 실행
-- =============================================

-- 1. 보일러 마스터
CREATE TABLE IF NOT EXISTS exp_boilers (
  id BIGSERIAL PRIMARY KEY,
  boiler_no INT NOT NULL UNIQUE,
  name TEXT,
  setting_temp NUMERIC DEFAULT 63,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO exp_boilers (boiler_no, name, setting_temp) VALUES
  (1, '1번 보일러', 63), (2, '2번 보일러', 63),
  (3, '3번 보일러', 63), (4, '4번 보일러', 63),
  (5, '5번 보일러', 63), (6, '6번 보일러', 63),
  (7, '7번 보일러', 63), (8, '8번 보일러', 63);

-- 2. 금형 마스터 (보일러 연계)
CREATE TABLE IF NOT EXISTS exp_molds (
  id BIGSERIAL PRIMARY KEY,
  mold_id TEXT NOT NULL UNIQUE,
  ref_weight NUMERIC NOT NULL DEFAULT 580,
  boiler_id BIGINT REFERENCES exp_boilers(id),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO exp_molds (mold_id, ref_weight, description) VALUES
  ('TC13-A', 580, 'TC13 금형 A'), ('TC13-B', 580, 'TC13 금형 B'),
  ('TC13-C', 580, 'TC13 금형 C'), ('TC13-D', 580, 'TC13 금형 D'),
  ('TC13-E', 580, 'TC13 금형 E');

-- 3. 실험 변수 정의
CREATE TABLE IF NOT EXISTS exp_factors (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO exp_factors (name, unit, sort_order) VALUES
  ('이형제량', '횟수', 1),
  ('배합비율(MDI:POL)', '비율', 2),
  ('압력', 'bar', 3);

-- 4. 실험 Run
CREATE TABLE IF NOT EXISTS exp_runs (
  id BIGSERIAL PRIMARY KEY,
  phase TEXT NOT NULL DEFAULT '1차',
  mold_id BIGINT REFERENCES exp_molds(id),
  mold_name TEXT NOT NULL,
  boiler_id BIGINT REFERENCES exp_boilers(id),
  boiler_no INT,
  ref_weight NUMERIC NOT NULL,
  is_control BOOLEAN DEFAULT false,
  active_factor_id BIGINT REFERENCES exp_factors(id),
  active_factor_name TEXT,
  active_factor_value TEXT,
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Run별 고정 변수값
CREATE TABLE IF NOT EXISTS exp_run_fixed_factors (
  id BIGSERIAL PRIMARY KEY,
  run_id BIGINT NOT NULL REFERENCES exp_runs(id) ON DELETE CASCADE,
  factor_id BIGINT NOT NULL REFERENCES exp_factors(id),
  factor_name TEXT NOT NULL,
  fixed_value TEXT NOT NULL
);

-- 6. 시편 결과
CREATE TABLE IF NOT EXISTS exp_specimens (
  id BIGSERIAL PRIMARY KEY,
  run_id BIGINT NOT NULL REFERENCES exp_runs(id) ON DELETE CASCADE,
  specimen_no INT NOT NULL,
  weight NUMERIC,
  hardness NUMERIC,
  temp_upper NUMERIC,
  temp_lower NUMERIC,
  defect_zones INT[] DEFAULT '{}',
  photo_url TEXT,
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. 품질 기준선
CREATE TABLE IF NOT EXISTS exp_thresholds (
  id BIGSERIAL PRIMARY KEY,
  metric TEXT NOT NULL,
  min_value NUMERIC,
  max_value NUMERIC,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS (내부 도구 — 전체 공개)
DO $$ 
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'exp_boilers','exp_molds','exp_factors','exp_runs',
    'exp_run_fixed_factors','exp_specimens','exp_thresholds'
  ]) LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "public_all" ON %I FOR ALL USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;
