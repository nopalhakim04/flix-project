CREATE TABLE IF NOT EXISTS flix.post_views (
  id_view SERIAL PRIMARY KEY,
  id_post INTEGER NOT NULL REFERENCES flix.posts(id_post) ON DELETE CASCADE,
  id_user INTEGER NOT NULL REFERENCES flix.users(id_user) ON DELETE CASCADE,
  viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT post_views_unique_user_post UNIQUE (id_post, id_user)
);

CREATE INDEX IF NOT EXISTS idx_post_views_id_post
  ON flix.post_views (id_post);

CREATE INDEX IF NOT EXISTS idx_post_views_id_user
  ON flix.post_views (id_user);

CREATE UNIQUE INDEX IF NOT EXISTS idx_post_views_unique_post_user
  ON flix.post_views (id_post, id_user);
