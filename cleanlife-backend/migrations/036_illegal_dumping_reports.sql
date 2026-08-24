CREATE TABLE illegal_dumping_reports (
    id                  SERIAL PRIMARY KEY,
    client_id           INTEGER NOT NULL REFERENCES clients(id),
    company_id          INTEGER NULL REFERENCES companies(id),
    description         TEXT NOT NULL,
    latitude            DECIMAL(9,6) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude           DECIMAL(9,6) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    status              VARCHAR(20) NOT NULL DEFAULT 'reported' CHECK (status IN ('reported', 'reviewing', 'resolved')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_illegal_dumping_reports_client_id ON illegal_dumping_reports(client_id);
CREATE INDEX idx_illegal_dumping_reports_status ON illegal_dumping_reports(status);

ALTER TABLE illegal_dumping_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_illegal_dumping_reports ON illegal_dumping_reports
    USING (
        (current_tenant() = 'public' AND company_id IS NULL)
        OR (current_tenant() <> 'public' AND company_id = current_tenant()::integer)
    )
    WITH CHECK (
        (current_tenant() = 'public' AND company_id IS NULL)
        OR (current_tenant() <> 'public' AND company_id = current_tenant()::integer)
    );

GRANT SELECT, INSERT ON illegal_dumping_reports TO app_user;
GRANT USAGE, SELECT ON SEQUENCE illegal_dumping_reports_id_seq TO app_user;
