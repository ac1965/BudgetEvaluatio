-- RBAC
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'evaluator', 'pjmo', 'viewer')),
    created_at TIMESTAMP DEFAULT now()
);

-- プロジェクト
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT now()
);

-- レビューログ（バージョン・確定情報付き）
CREATE TABLE IF NOT EXISTS review_logs (
    id SERIAL PRIMARY KEY,
    project_id INT REFERENCES projects(id),
    author TEXT NOT NULL,
    role TEXT NOT NULL,
    comment TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('issue', 'reply', 'review', 'close')),
    version INT NOT NULL DEFAULT 1,
    confirmed_at TIMESTAMP,
    confirmed_by TEXT,
    created_at TIMESTAMP DEFAULT now()
);

-- MCP/Webhook通知ログ
CREATE TABLE IF NOT EXISTS webhook_logs (
    id SERIAL PRIMARY KEY,
    project_id INT REFERENCES projects(id),
    event_type TEXT NOT NULL,
    payload JSONB,
    status TEXT NOT NULL DEFAULT 'pending',
    sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT now()
);

-- 監査ログ
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    project_id INT,
    user_name TEXT,
    action TEXT NOT NULL,
    target_table TEXT,
    target_id INT,
    detail JSONB,
    created_at TIMESTAMP DEFAULT now()
);

-- サンプルデータ
INSERT INTO users (username, display_name, role) VALUES
    ('tanaka', '田中係長', 'evaluator'),
    ('yamada', '山田主任', 'pjmo'),
    ('suzuki', '鈴木部長', 'admin'),
    ('ai_reviewer', 'AIレビュー', 'viewer')
ON CONFLICT DO NOTHING;

INSERT INTO projects (name, description) VALUES
    ('令和7年度 情報システム整備事業', 'DS-110準拠 調達審査対象'),
    ('行政DX基盤構築PJ', 'DS-910準拠 クラウド移行')
ON CONFLICT DO NOTHING;

INSERT INTO review_logs (project_id, author, role, comment, status, version) VALUES
    (1, '田中係長', '評価者', '積算根拠の内訳が不明確です。FP法による規模見積もりの詳細を提示してください。', 'issue', 1),
    (1, '山田主任', 'PJMO', 'FP計算書（別紙3）を追加しました。機能点数142FP、開発工数2.8PY相当です。', 'reply', 1),
    (1, '田中係長', '評価者', '積算根拠を確認しました。ただしクラウド移行コストの根拠が不足しています。', 'review', 1),
    (1, 'LLMレビュー', 'AI', 'DS-110第4.2条に基づく調達仕様書確認：セキュリティ要件（第6条）の記載が不十分です。ISMAP準拠クラウドサービスの選定基準を明示してください。', 'issue', 1);
