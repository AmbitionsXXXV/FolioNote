-- Seed data for PostgreSQL integration tests
-- This file can be loaded with: psql -d test_db -f seed.sql

-- Clean existing data
TRUNCATE TABLE review_events, daily_logs, attachments, entry_sources, entry_tags, entries, tags, sources, verification, session, account, "user" CASCADE;

-- Insert test users
INSERT INTO "user" (id, name, email, email_verified, image, created_at, updated_at) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'Alice Johnson', 'alice@example.com', true, null, '2025-01-01 00:00:00', '2025-01-01 00:00:00'),
('550e8400-e29b-41d4-a716-446655440002', 'Bob Smith', 'bob@example.com', false, null, '2025-01-02 00:00:00', '2025-01-02 00:00:00');

-- Insert test tags
INSERT INTO tags (id, user_id, name, color, created_at, updated_at) VALUES
('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'JavaScript', '#f7df1e', '2025-01-01 00:00:00', '2025-01-01 00:00:00'),
('650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', 'TypeScript', '#3178c6', '2025-01-01 00:00:00', '2025-01-01 00:00:00');

-- Insert test entries
INSERT INTO entries (id, user_id, title, content, is_inbox, is_starred, is_pinned, created_at, updated_at, deleted_at) VALUES
('750e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'Learning React Hooks', 'React hooks provide a way to use state and lifecycle features in functional components.', true, false, false, '2025-01-01 00:00:00', '2025-01-01 00:00:00', null),
('750e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', 'TypeScript Generics', 'Generics allow you to write flexible, reusable code.', false, true, false, '2025-01-02 00:00:00', '2025-01-02 00:00:00', null);

-- Link entries to tags
INSERT INTO entry_tags (id, entry_id, tag_id, created_at) VALUES
('850e8400-e29b-41d4-a716-446655440001', '750e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440001', '2025-01-01 00:00:00'),
('850e8400-e29b-41d4-a716-446655440002', '750e8400-e29b-41d4-a716-446655440002', '650e8400-e29b-41d4-a716-446655440002', '2025-01-02 00:00:00');
