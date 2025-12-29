import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Query,
  Res,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import type { Request, Response } from 'express';
import { Kafka } from 'kafkajs';
import { lastValueFrom } from 'rxjs';
import {
  AuthResponse,
  LoginFormResponse,
  LoginResponse,
  UserInfoResponse,
  SubjectInfoResponse,
  GradeResponse,
} from '@libs/types';
import { AuthGuard } from '@libs/auth';
import { ApiGatewayService } from './api-gateway.service';
import { CreatePostDto, ListPostsDto, ListPostsResponseDto } from '@libs/dto';

@Controller()
export class ApiGatewayController {
  constructor(
    private readonly apiGatewayService: ApiGatewayService,
    @Inject('USER_SERVICE') private readonly userClient: ClientKafka,
    @Inject('MANAGEMENT_SERVICE')
    private readonly managementClient: ClientKafka,
    @Inject('PARSING_SERVICE') private readonly parsingClient: ClientKafka,
    @Inject('BOARD_SERVICE') private readonly boardClient: ClientKafka,
  ) {}

  async onModuleInit() {
    const userTopics = [
      'user.loginForm',
      'user.auth',
      'user.login',
      'user.logout',
      'user.userInfo',
    ];
    const managementTopics = [
      'management.getLoginCount',
      'management.login',
      'management.logout',
      'management.validateSession',
      'management.getShtmYyyy',
      'management.setShtmYyyy',
    ];
    const parsingTopics = ['parsing.subjectInfo', 'parsing.grade'];
    const boardTopics = [
      'board.createPost',
      'board.likePost',
      'board.listPosts',
    ];
    const allTopics = [
      ...userTopics,
      ...managementTopics,
      ...parsingTopics,
      ...boardTopics,
    ];

    // Kafka admin으로 reply 토픽 생성
    const kafka = new Kafka({
      clientId: 'api-gateway-admin',
      brokers: [process.env.KAFKA_BROKER ?? 'localhost:9092'],
    });
    const admin = kafka.admin();
    await admin.connect();

    // reply 토픽들을 개별적으로 생성
    const createdTopics: string[] = [];
    for (const topic of allTopics) {
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
    userTopics.forEach((topic) => this.userClient.subscribeToResponseOf(topic));
    managementTopics.forEach((topic) =>
      this.managementClient.subscribeToResponseOf(topic),
    );
    parsingTopics.forEach((topic) =>
      this.parsingClient.subscribeToResponseOf(topic),
    );
    boardTopics.forEach((topic) =>
      this.boardClient.subscribeToResponseOf(topic),
    );
    await this.userClient.connect();
    await this.managementClient.connect();
    await this.parsingClient.connect();
    await this.boardClient.connect();
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

    res.json({ success: true, accessToken: result.accessToken });
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

  // 5단계: 사용자 정보 조회
  @Get('api/user-info')
  async getUserInfo(@Req() req: Request, @Res() res: Response): Promise<void> {
    const reqCookies = (req.cookies ?? {}) as Record<string, string>;
    const csrf = reqCookies['csrf'] ?? '';
    const cookies = this.extractSchoolCookies(reqCookies);

    const result = await lastValueFrom(
      this.userClient.send<UserInfoResponse>('user.userInfo', {
        csrf,
        cookies,
      }),
    );

    res.json({ success: true, userInfo: result.userInfo });
  }

  // 로그인 카운트 조회
  @Get('api/login-count')
  async getLoginCount(): Promise<{ success: boolean; count: number }> {
    const result = await lastValueFrom(
      this.managementClient.send<{ count: number }>(
        'management.getLoginCount',
        {},
      ),
    );

    return { success: true, count: result.count };
  }

  // 관리자 로그인
  @Post('api/mng/login')
  async mngLogin(
    @Body() loginData: { id: string; password: string },
    @Res() res: Response,
  ): Promise<void> {
    const result = await lastValueFrom(
      this.managementClient.send<{
        success: boolean;
        sessionId?: string;
        message?: string;
      }>('management.login', loginData),
    );

    if (result.success && result.sessionId) {
      res.cookie('mng_session', result.sessionId, { httpOnly: true });
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false, message: result.message });
    }
  }

  // shtm, yyyy 조회 (관리자 전용)
  @Get('api/mng/shtmYyyy')
  async getShtmYyyy(@Req() req: Request, @Res() res: Response): Promise<void> {
    const reqCookies = (req.cookies ?? {}) as Record<string, string>;
    const sessionId = reqCookies['mng_session'] ?? '';

    if (!sessionId) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    const { valid } = await lastValueFrom(
      this.managementClient.send<{ valid: boolean }>(
        'management.validateSession',
        { sessionId },
      ),
    );

    if (!valid) {
      res.status(401).json({ success: false, message: 'Invalid session' });
      return;
    }

    const result = await lastValueFrom(
      this.managementClient.send<{ shtm: string | null; yyyy: string | null }>(
        'management.getShtmYyyy',
        {},
      ),
    );

    res.json({ success: true, ...result });
  }

  // shtm, yyyy 설정 (관리자 전용)
  @Post('api/mng/shtmYyyy')
  async setShtmYyyy(
    @Req() req: Request,
    @Body() body: { shtm: string; yyyy: string },
    @Res() res: Response,
  ): Promise<void> {
    const reqCookies = (req.cookies ?? {}) as Record<string, string>;
    const sessionId = reqCookies['mng_session'] ?? '';

    if (!sessionId) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    const { valid } = await lastValueFrom(
      this.managementClient.send<{ valid: boolean }>(
        'management.validateSession',
        { sessionId },
      ),
    );

    if (!valid) {
      res.status(401).json({ success: false, message: 'Invalid session' });
      return;
    }

    const result = await lastValueFrom(
      this.managementClient.send<{ success: boolean }>(
        'management.setShtmYyyy',
        { shtm: body.shtm, yyyy: body.yyyy },
      ),
    );

    res.json(result);
  }

  // 관리자 로그아웃
  @Post('api/mng/logout')
  async mngLogout(@Req() req: Request, @Res() res: Response): Promise<void> {
    const reqCookies = (req.cookies ?? {}) as Record<string, string>;
    const sessionId = reqCookies['mng_session'] ?? '';

    if (sessionId) {
      await lastValueFrom(
        this.managementClient.send<{ success: boolean }>('management.logout', {
          sessionId,
        }),
      );
    }

    res.clearCookie('mng_session');
    res.json({ success: true });
  }

  // 과목 정보 조회
  @Post('api/parsing/subjectInfo')
  async getSubjectInfo(
    @Req() req: Request,
    @Body()
    body: {
      sujtNo: string;
      classNo: string;
      campFg: string;
      shtm: string;
      yyyy: string;
    },
    @Res() res: Response,
  ): Promise<void> {
    const reqCookies = (req.cookies ?? {}) as Record<string, string>;
    const csrf = reqCookies['csrf'] ?? '';
    const cookies = this.extractSchoolCookies(reqCookies);

    const result = await lastValueFrom(
      this.parsingClient.send<SubjectInfoResponse>('parsing.subjectInfo', {
        csrf,
        cookies,
        sujtNo: body.sujtNo,
        classNo: body.classNo,
        campFg: body.campFg,
        shtm: body.shtm,
        yyyy: body.yyyy,
      }),
    );

    res.json({ success: true, subjectInfo: result });
  }

  // 성적 조회
  @Post('api/parsing/grade')
  async getGrades(
    @Req() req: Request,
    @Body()
    body: {
      campFg: string;
      shtmYyyy: string;
      shtmFg: string;
      stdNo: string;
    },
    @Res() res: Response,
  ): Promise<void> {
    const reqCookies = (req.cookies ?? {}) as Record<string, string>;
    const csrf = reqCookies['csrf'] ?? '';
    const cookies = this.extractSchoolCookies(reqCookies);

    const result = await lastValueFrom(
      this.parsingClient.send<GradeResponse>('parsing.grade', {
        csrf,
        cookies,
        campFg: body.campFg,
        shtmYyyy: body.shtmYyyy,
        shtmFg: body.shtmFg,
        stdNo: body.stdNo,
      }),
    );

    res.json({ success: true, grades: result.grades });
  }

  // 게시글 작성
  @UseGuards(AuthGuard)
  @Post('api/vl/post')
  async createPost(
    @Body() body: CreatePostDto,
    @Res() res: Response,
  ): Promise<void> {
    const result = await lastValueFrom(
      this.boardClient.send<{ success: boolean; id?: string }>(
        'board.createPost',
        {
          stdNo: body.stdNo,
          content: body.content,
        },
      ),
    );

    res.json(result);
  }

  // 게시글 좋아요
  @UseGuards(AuthGuard)
  @Post('api/vl/like')
  async likePost(
    @Body() body: { id: string },
    @Res() res: Response,
  ): Promise<void> {
    const result = await lastValueFrom(
      this.boardClient.send<{ success: boolean; likes?: number }>(
        'board.likePost',
        { id: body.id },
      ),
    );

    res.json(result);
  }

  // 게시글 목록 조회
  @UseGuards(AuthGuard)
  @Get('api/vl/post')
  async listPosts(
    @Query() query: ListPostsDto,
    @Res() res: Response,
  ): Promise<void> {
    const result = await lastValueFrom(
      this.boardClient.send<ListPostsResponseDto>('board.listPosts', query),
    );

    res.json(result);
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
