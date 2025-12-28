import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from './jwt.payload';

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  generateToken(csrf: string): string {
    const payload: JwtPayload = { csrf };
    return this.jwtService.sign(payload);
  }

  verifyToken(token: string): JwtPayload | null {
    try {
      const decoded = this.jwtService.verify(token) as JwtPayload;
      return decoded;
    } catch {
      return null;
    }
  }
}
