import pool from "./db.js";

export const initializeUserProfileMediaColumns = async () => {
  await pool.query(`
    ALTER TABLE flix.users
    ADD COLUMN IF NOT EXISTS profile_image_url TEXT
  `);

  await pool.query(`
    ALTER TABLE flix.users
    ADD COLUMN IF NOT EXISTS banner_image_url TEXT
  `);
};
