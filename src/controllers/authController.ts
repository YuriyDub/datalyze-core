import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User, { IUser } from '../models/User';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';

dotenv.config();

const authController = {
  async signup(req: Request, res: Response): Promise<void> {
    const { username, password, fullName, email, phoneNumber } = req.body;
    try {
      const newUserId = randomUUID();
      const user = await User.create({
        id: newUserId,
        username,
        password,
        fullName,
        email,
        phoneNumber,
        avatar: '',
      });
      const accessToken = jwt.sign(
        {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          avatar: user.avatar,
        },
        process.env.JWT_PRIVATE_KEY!,
        {
          algorithm: 'RS256',
          expiresIn: '15m',
        },
      );

      const refreshToken = jwt.sign(
        {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          avatar: user.avatar,
        },
        process.env.JWT_REFRESH_SECRET!,
        {
          expiresIn: '7d',
        },
      );

      await User.updateRefreshToken(user.id, refreshToken);

      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 15 * 60 * 1000,
      });

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.status(201).json({ message: 'User registered successfully', user });
    } catch (error: any) {
      res.status(500).json({ message: 'Error registering user', error: error.message });
    }
  },

  async login(req: Request, res: Response): Promise<void> {
    const { email, password } = req.body;
    try {
      const user = await User.findByEmail(email);
      if (!user) {
        res.status(400).json({ message: 'Invalid password or email' });
        return;
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        res.status(400).json({ message: 'Invalid password or email' });
        return;
      }

      const accessToken = jwt.sign(
        {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          avatar: user.avatar,
        },
        process.env.JWT_PRIVATE_KEY!,
        {
          algorithm: 'RS256',
          expiresIn: '15m',
        },
      );

      const refreshToken = jwt.sign(
        {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          avatar: user.avatar,
        },
        process.env.JWT_REFRESH_SECRET!,
        {
          expiresIn: '7d',
        },
      );

      await User.updateRefreshToken(user.id, refreshToken);

      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 15 * 60 * 1000,
      });

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.status(200).json({ message: 'Login successful' });
    } catch (error: any) {
      res.status(500).json({ message: 'Error logging in', error: error.message });
    }
  },

  async refreshToken(req: Request, res: Response): Promise<void> {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      res.status(401).json({ message: 'Refresh token is missing' });
      return;
    }

    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as { id: number };
      const userId = decoded.id;

      const accessToken = jwt.sign({ id: userId }, process.env.JWT_PRIVATE_KEY!, {
        algorithm: 'RS256',
        expiresIn: '15m',
      });

      const newRefreshToken = jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET!, {
        expiresIn: '7d',
      });

      await User.updateRefreshToken(userId, newRefreshToken);

      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 15 * 60 * 1000,
      });

      res.cookie('refreshToken', newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.status(200).json({
        message: 'Tokens refreshed successfully',
        accessToken,
        refreshToken: newRefreshToken,
      });
    } catch (error: any) {
      res.status(401).json({ message: 'Invalid refresh token', error: error.message });
    }
  },

  async logout(req: Request, res: Response): Promise<void> {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      res.status(400).json({ message: 'Refresh token is missing' });
      return;
    }

    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as { id: number };
      const userId = decoded.id;

      await User.updateRefreshToken(userId, null);

      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');

      res.status(200).json({ message: 'Logout successful' });
    } catch (error: any) {
      res.status(500).json({ message: 'Error logging out', error: error.message });
    }
  },

  async getProfile(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user.id;
    try {
      const user = await User.getProfile(userId);
      if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
      }
      res.status(200).json(user);
    } catch (error: any) {
      res.status(500).json({ message: 'Error fetching profile', error: error.message });
    }
  },

  async updateProfile(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user.id;
    const userData = { ...(req.body as Omit<IUser, 'password'>), id: userId };
    try {
      const updatedUser = await User.updateProfile(userData);
      res.status(200).json({ message: 'Profile updated successfully', updatedUser });
    } catch (error: any) {
      res.status(500).json({ message: 'Error updating profile', error: error.message });
    }
  },
};

export default authController;
