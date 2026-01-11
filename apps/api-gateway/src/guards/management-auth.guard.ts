import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { Request } from 'express';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class ManagementAuthGuard implements CanActivate {
  constructor(
    @Inject('MANAGEMENT_SERVICE')
    private readonly managementClient: ClientKafka,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const cookies = (request.cookies ?? {}) as Record<string, string>;
    const sessionId = cookies['mng_session'];

    if (!sessionId) {
      throw new UnauthorizedException('Not authenticated');
    }

    const { valid } = await lastValueFrom(
      this.managementClient.send<{ valid: boolean }>(
        'management.validateSession',
        { sessionId },
      ),
    );

    if (!valid) {
      throw new UnauthorizedException('Invalid session');
    }

    return true;
  }
}