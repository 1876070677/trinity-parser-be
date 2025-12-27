import { Body, Controller, Get, Inject, Post, Res, Req } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import type { Request, Response } from 'express';
import { Kafka } from 'kafkajs';
import { lastValueFrom } from 'rxjs';
import { ApiGatewayService } from './api-gateway.service';

interface LoginFormResponse {
  samlRequest: string;
  cookies: string[];
}

interface AuthResponse {
  samlResponse: string;
  cookies: string[];
}

interface LoginResponse {
  csrf: string;
  cookies: string[];
}

@Controller()
export class ApiGatewayController {
  constructor(
    private readonly apiGatewayService: ApiGatewayService,
    @Inject('USER_SERVICE') private readonly userClient: ClientKafka,
  ) {}

  async onModuleInit() {
    const topics = ['user.loginForm', 'user.auth', 'user.login'];

    // Kafka admin으로 reply 토픽 생성
    const kafka = new Kafka({
      clientId: 'api-gateway-admin',
      brokers: [process.env.KAFKA_BROKER ?? 'localhost:9092'],
    });
    const admin = kafka.admin();
    await admin.connect();

    // reply 토픽만 생성 (원본 토픽은 해당 서비스가 생성)
    await admin.createTopics({
      topics: topics.map((topic) => ({
        topic: `${topic}.reply`,
        numPartitions: 1,
        replicationFactor: 1,
      })),
    });

    console.log(
      `Created reply topics: ${topics.map((t) => `${t}.reply`).join(', ')}`,
    );
    await admin.disconnect();

    // Gateway가 응답을 받을 토픽들을 구독
    topics.forEach((topic) => this.userClient.subscribeToResponseOf(topic));
    await this.userClient.connect();
  }

  @Get()
  getHello(): string {
    return this.apiGatewayService.getHello();
  }

  // 1단계: samlRequest 획득
  @Post('api/login-form')
  async loginForm(@Res() res: Response): Promise<void> {
    const result = await lastValueFrom(
      this.userClient.send<LoginFormResponse>('user.loginForm', {}),
    );

    // samlRequest를 쿠키로 설정
    res.cookie('samlRequest', result.samlRequest, { httpOnly: true });

    // 학교 서버 쿠키들을 우리 도메인으로 재설정
    this.setSchoolCookies(res, result.cookies);

    res.json({ success: true });
  }

  // 2단계: id/password로 SAMLResponse 획득
  @Post('api/auth')
  async auth(
    @Req() req: Request,
    @Body() authData: { id: string; password: string },
    @Res() res: Response,
  ): Promise<void> {
    // 쿠키에서 samlRequest와 학교 쿠키 추출
    const reqCookies = (req.cookies ?? {}) as Record<string, string>;
    const samlRequest = reqCookies['samlRequest'] ?? '';
    const cookies = this.extractSchoolCookies(reqCookies);

    const result = await lastValueFrom(
      this.userClient.send<AuthResponse>('user.auth', {
        id: authData.id,
        password: authData.password,
        samlRequest,
        cookies,
      }),
    );

    // samlResponse를 쿠키로 설정
    res.cookie('samlResponse', result.samlResponse, { httpOnly: true });

    // 학교 서버 쿠키들을 우리 도메인으로 재설정
    this.setSchoolCookies(res, result.cookies);

    res.json({ success: true });
  }

  // 3단계: csrf 토큰 획득
  @Post('api/login')
  async login(@Req() req: Request, @Res() res: Response): Promise<void> {
    // 쿠키에서 samlResponse와 학교 쿠키 추출
    const reqCookies = (req.cookies ?? {}) as Record<string, string>;
    const samlResponse = reqCookies['samlResponse'] ?? '';
    const cookies = this.extractSchoolCookies(reqCookies);

    const result = await lastValueFrom(
      this.userClient.send<LoginResponse>('user.login', {
        samlResponse,
        cookies,
      }),
    );

    // csrf를 쿠키로 설정
    res.cookie('csrf', result.csrf, { httpOnly: true });

    // 학교 서버 쿠키들을 우리 도메인으로 재설정
    this.setSchoolCookies(res, result.cookies);

    // 이전 단계 쿠키 정리
    res.clearCookie('samlRequest');
    res.clearCookie('samlResponse');

    res.json({ success: true, csrf: result.csrf });
  }

  // 학교 관련 쿠키만 추출
  private extractSchoolCookies(cookies: Record<string, string>): string[] {
    const schoolCookieNames = ['JSESSIONID', 'WMONID'];
    return Object.entries(cookies)
      .filter(([name]) => schoolCookieNames.includes(name))
      .map(([name, value]) => `${name}=${value}`);
  }

  // 학교 쿠키를 우리 도메인으로 재설정
  private setSchoolCookies(res: Response, cookies: string[]): void {
    cookies.forEach((cookieStr) => {
      // "JSESSIONID=abc123; Path=/; HttpOnly" 형태에서 name=value만 추출
      const parts = cookieStr.split(';')[0];
      const [name, value] = parts.split('=');
      if (name && value) {
        res.cookie(name.trim(), value.trim(), { httpOnly: true });
      }
    });
  }
}
