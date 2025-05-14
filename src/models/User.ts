import pool from '../config/db';
import bcrypt from 'bcryptjs';

export interface IUser {
  id: string;
  username: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  password: string;
  avatar: string;
}

class User {
  static async create(user: IUser) {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    const { `rows` } = await pool.query(
      `INSERT INTO users (id, username, password, full_name, email, phone)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [user.id, user.username, hashedPassword, user.fullName, user.email, user.phoneNumber],
    );
    return rows[0];
  }

  static async updateRefreshToken(userId: number, refreshToken: string | null) {
    const { rows } = await pool.query(
      'UPDATE users SET refresh_token = $1 WHERE id = $2 RETURNING *',
      [refreshToken, userId],
    );
    return rows[0];
  }

  static async findByUserId(userId: string) {
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    return rows[0];
  }

  static async findByEmail(email: string) {
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    return rows[0];
  }

  static async updateProfile(user: Omit<IUser, 'password'>) {
    const { rows } = await pool.query(
      `UPDATE users 
       SET username = $1, full_name = $2, email = $3, phone = $4, avatar = $5
       WHERE id = $6
       RETURNING *`,
      [user.username, user.fullName, user.email, user.phoneNumber, user.avatar, user.id],
    );
    return rows[0];
  }

  static async getProfile(userId: number) {
    const { rows } = await pool.query(
      'SELECT id, username, full_name, email, avatar, phone FROM users WHERE id = $1',
      [userId],
    );
    return {
      username: rows[0].username,
      fullName: rows[0].full_name,
      email: rows[0].email,
      avatar: rows[0].avatar,
      phoneNumber: rows[0].phone,
    };
  }
}

export default User;
