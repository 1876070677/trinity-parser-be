import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';

export interface AuthenticatedRequest extends Request {
  csrf: string;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('토큰이 없습니다.');
    }

    const payload = this.authService.verifyToken(token);
    if (!payload || !payload.csrf) {
      throw new UnauthorizedException('유효하지 않은 토큰입니다.');
    }

    // request에 csrf 추가
    request.csrf = payload.csrf;
    return true;
  }

  private extractToken(request: Request): string | null {
    // Authorization: Bearer <token>
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }
    return null;
  }
}
