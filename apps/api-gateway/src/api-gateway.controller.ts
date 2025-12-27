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
    const topics = ['user.loginForm', 'user.auth', 'user.login', 'user.logout'];

    // Kafka admin으로 reply 토픽 생성
    const kafka = new Kafka({
      clientId: 'api-gateway-admin',
      brokers: [process.env.KAFKA_BROKER ?? 'localhost:9092'],
    });
    const admin = kafka.admin();
    await admin.connect();

    // reply 토픽들을 개별적으로 생성
    const createdTopics: string[] = [];
    for (const topic of topics) {
      const replyTopic = `${topic}.reply`;
      try {
        const created = await admin.createTopics({
          topics: [
            { topic: replyTopic, numPartitions: 1, replicationFactor: 1 },
          ],
        });
        if (created) {
          createdTopics.push(replyTopic);
        } else {
          console.log(`토픽 이미 존재: ${replyTopic}`);
        }
      } catch (error) {
        console.log(`토픽 생성 실패 ${replyTopic}:`, error);
      }
    }
    if (createdTopics.length > 0) {
      console.log(`Created reply topics: ${createdTopics.join(', ')}`);
    }
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

  // 4단계: 로그아웃
  @Post('api/logout')
  async logout(@Req() req: Request, @Res() res: Response): Promise<void> {
    const reqCookies = (req.cookies ?? {}) as Record<string, string>;
    const csrf = reqCookies['csrf'] ?? '';
    const cookies = this.extractSchoolCookies(reqCookies);

    await lastValueFrom(
      this.userClient.send<{ success: boolean }>('user.logout', {
        csrf,
        cookies,
      }),
    );

    // 모든 쿠키 정리
    Object.keys(reqCookies).forEach((name) => {
      res.clearCookie(name);
    });

    res.json({ success: true });
  }

  // samlRequest, samlResponse, csrf를 제외한 쿠키 추출
  private extractSchoolCookies(cookies: Record<string, string>): string[] {
    const excludeNames = ['samlRequest', 'samlResponse', 'csrf'];
    return Object.entries(cookies)
      .filter(([name]) => !excludeNames.includes(name))
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
