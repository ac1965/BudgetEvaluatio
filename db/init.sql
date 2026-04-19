-- ════════════════════════════════════════════════════════
--  予算額妥当性評価システム  init.sql  v2.0
-- ════════════════════════════════════════════════════════

-- ── RBAC ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id           SERIAL PRIMARY KEY,
    username     TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    role         TEXT NOT NULL CHECK (role IN ('admin','evaluator','pjmo','viewer')),
    created_at   TIMESTAMP DEFAULT now()
);

-- ── 評価対象システム ──────────────────────────────────
CREATE TABLE IF NOT EXISTS systems (
    id           SERIAL PRIMARY KEY,
    name         TEXT NOT NULL,
    department   TEXT,
    created_at   TIMESTAMP DEFAULT now()
);

-- ── 事業（id=0 は各システムの「システム全体」用） ─────
CREATE TABLE IF NOT EXISTS projects (
    id                SERIAL PRIMARY KEY,
    system_id         INT REFERENCES systems(id) NOT NULL,
    name              TEXT NOT NULL,
    cost_category     TEXT CHECK (cost_category IN (
                          '整備費（投資的整備）',
                          '整備費（維持的整備）',
                          '整備費（サービス利用料）',
                          '運用費',
                          '保守費'
                      )),
    amount_single     INTEGER DEFAULT 0,   -- 単歳要求額（千円）
    amount_advance    INTEGER DEFAULT 0,   -- 前払金（千円）
    amount_deferred   INTEGER DEFAULT 0,   -- 後年度負担金（千円）
    estimate_text     TEXT,
    estimate_file     TEXT,
    requirements_text TEXT,
    requirements_file TEXT,
    basis_text        TEXT,
    basis_file        TEXT,
    evaluator_name    TEXT,
    is_system_wide    BOOLEAN DEFAULT FALSE, -- TRUE: システム全体スレッド用
    created_at        TIMESTAMP DEFAULT now()
);

-- ── 指摘スレッド ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS review_threads (
    id          SERIAL PRIMARY KEY,
    project_id  INT REFERENCES projects(id) NOT NULL,
    thread_no   INT NOT NULL,
    title       TEXT,
    status      TEXT NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','replied','reviewing','closed')),
    due_date    DATE,
    created_at  TIMESTAMP DEFAULT now(),
    UNIQUE (project_id, thread_no)
);

-- ── スレッド内投稿 ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS review_entries (
    id          SERIAL PRIMARY KEY,
    thread_id   INT REFERENCES review_threads(id) NOT NULL,
    seq         INT NOT NULL,
    entry_type  TEXT NOT NULL CHECK (entry_type IN ('issue','reply','review','close')),
    role        TEXT NOT NULL CHECK (role IN ('evaluator','pjmo','ai')),
    comment     TEXT NOT NULL,
    entry_date  DATE,
    created_at  TIMESTAMP DEFAULT now(),
    UNIQUE (thread_id, seq)
);

-- ── 添付ファイル ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_files (
    id          SERIAL PRIMARY KEY,
    project_id  INT REFERENCES projects(id) NOT NULL,
    file_type   TEXT NOT NULL CHECK (file_type IN ('estimate','requirements','basis')),
    filename    TEXT NOT NULL,
    filepath    TEXT NOT NULL,
    filesize    INT,
    created_at  TIMESTAMP DEFAULT now()
);

-- ── Webhook通知ログ ────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhook_logs (
    id          SERIAL PRIMARY KEY,
    project_id  INT,
    event_type  TEXT NOT NULL,
    payload     JSONB,
    status      TEXT NOT NULL DEFAULT 'pending',
    sent_at     TIMESTAMP,
    created_at  TIMESTAMP DEFAULT now()
);

-- ── 監査ログ ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
    id           SERIAL PRIMARY KEY,
    project_id   INT,
    user_name    TEXT,
    action       TEXT NOT NULL,
    target_table TEXT,
    target_id    INT,
    detail       JSONB,
    created_at   TIMESTAMP DEFAULT now()
);

-- init.sql
CREATE TABLE IF NOT EXISTS systems (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    department TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    system_id INT REFERENCES systems(id),
    is_system_wide BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS review_threads (
    id SERIAL PRIMARY KEY,
    project_id INT REFERENCES projects(id),
    status TEXT NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ════════════════════════════════════════════════════════
--  サンプルデータ
-- ════════════════════════════════════════════════════════
INSERT INTO users (username, display_name, role) VALUES
    ('tanaka',      '田中係長',   'evaluator'),
    ('yamada',      '山田主任',   'pjmo'),
    ('suzuki',      '鈴木部長',   'admin'),
    ('ai_reviewer', 'AIレビュー', 'viewer')
ON CONFLICT DO NOTHING;

INSERT INTO systems (id, name, department) VALUES
    (1, '人事給与システム（次期）', '人事院'),
    (2, '行政DX基盤', 'デジタル庁')
ON CONFLICT DO NOTHING;

-- システム全体スレッド用仮想事業
INSERT INTO projects (id, system_id, name, is_system_wide) VALUES
    (1, 1, 'システム全体', TRUE),
    (3, 2, 'システム全体', TRUE)
ON CONFLICT DO NOTHING;

-- 通常事業
INSERT INTO projects (id, system_id, name, cost_category, amount_single, amount_deferred, evaluator_name) VALUES
    (2, 1, '令和8年度 整備事業', '整備費（投資的整備）', 150000, 80000, '田中係長'),
    (4, 2, '令和8年度 クラウド移行', '整備費（サービス利用料）', 45000, 0, '田中係長')
ON CONFLICT DO NOTHING;

-- シーケンスを正しい値にリセット
SELECT setval('systems_id_seq', (SELECT MAX(id) FROM systems));
SELECT setval('projects_id_seq', (SELECT MAX(id) FROM projects));

-- サンプルスレッドと投稿
INSERT INTO review_threads (id, project_id, thread_no, title, status, due_date) VALUES
    (1, 2, 1, '積算根拠の確認', 'replied', '2025-03-31'),
    (2, 2, 2, 'Cloud by Default 対応確認', 'open', '2025-04-30')
ON CONFLICT DO NOTHING;

INSERT INTO review_entries (thread_id, seq, entry_type, role, comment, entry_date) VALUES
    (1, 1, 'issue',  'evaluator', 'FP法による規模見積もりの詳細を提示してください。積算根拠の内訳が不明確です。', '2025-01-10'),
    (1, 2, 'reply',  'pjmo',      'FP計算書（別紙3）を追加しました。機能点数142FP、開発工数2.8PY相当です。', '2025-01-20'),
    (2, 1, 'issue',  'evaluator', 'DS-110第4.2条に基づきCloud by Default原則との整合性を説明してください。', '2025-01-15')
ON CONFLICT DO NOTHING;

SELECT setval('review_threads_id_seq', (SELECT MAX(id) FROM review_threads));
SELECT setval('review_entries_id_seq', (SELECT MAX(id) FROM review_entries));
