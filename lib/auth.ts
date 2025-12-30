import jwt from 'jsonwebtoken';
import { VercelRequest, VercelResponse } from '@vercel/node';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-me';

export interface UserPayload {
  userId: string;
  email: string;
}

export const signToken = (payload: UserPayload): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
};

export const verifyToken = (token: string): UserPayload | null => {
  try {
    return jwt.verify(token, JWT_SECRET) as UserPayload;
  } catch (error) {
    return null;
  }
};

export const authenticated = (handler: (req: VercelRequest, res: VercelResponse, user: UserPayload) => Promise<void | VercelResponse | any>) => {
  return async (req: VercelRequest, res: VercelResponse) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    const user = verifyToken(token);

    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    return handler(req, res, user);
  };
};
