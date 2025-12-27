import { Injectable } from '@nestjs/common';

export interface AuthData {
  id: string;
  password: string;
  samlRequest: string;
  cookies: string[];
}

export interface LoginData {
  samlResponse: string;
  cookies: string[];
}

export interface LoginFormResponse {
  samlRequest: string;
  cookies: string[];
}

export interface AuthResponse {
  samlResponse: string;
  cookies: string[];
}

export interface LoginResponse {
  csrf: string;
  cookies: string[];
}

@Injectable()
export class UserServiceService {
  private readonly BASE_PATH = 'https://uportal.catholic.ac.kr';
  private readonly USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:72.0) Gecko/20100101 Firefox/72.0';

  // Set-Cookie 헤더에서 쿠키 이름=값만 추출
  private parseCookies(setCookieHeaders: string[]): string[] {
    return setCookieHeaders.map((cookie) => cookie.split(';')[0]);
  }

  // 쿠키 배열을 Cookie 헤더 문자열로 변환 (saml 관련 값 제외)
  private formatCookieHeader(cookies: string[]): string {
    const excludeKeys = ['samlRequest', 'samlResponse'];
    return cookies
      .filter((cookie) => !excludeKeys.includes(cookie.split('=')[0]))
      .join('; ');
  }

  // 1단계: samlRequest 획득
  async loginForm(): Promise<LoginFormResponse> {
    const response = await fetch(
      `${this.BASE_PATH}/sso/jsp/sso/ip/login_form.jsp`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': this.USER_AGENT,
        },
      },
    );

    if (!response.ok) {
      throw new Error('loginForm 요청 실패');
    }

    const cookies = this.parseCookies(response.headers.getSetCookie());
    const html = await response.text();

    // samlRequest 파싱
    const samlRequestMatch = html.match(/name="samlRequest"\s+value="([^"]+)"/);
    if (!samlRequestMatch) {
      throw new Error('samlRequest를 찾을 수 없습니다.');
    }

    return {
      samlRequest: samlRequestMatch[1],
      cookies,
    };
  }

  // 2단계: id/password + samlRequest로 SAMLResponse 획득
  async auth(data: AuthData): Promise<AuthResponse> {
    const formBody = new URLSearchParams({
      userId: data.id,
      password: data.password,
      samlRequest: data.samlRequest,
    });

    const response = await fetch(
      `${this.BASE_PATH}/sso/processAuthnResponse.do`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': this.USER_AGENT,
          Cookie: this.formatCookieHeader(data.cookies),
        },
        body: formBody.toString(),
        redirect: 'manual',
      },
    );

    // 리다이렉트 응답도 처리
    if (!response.ok && response.status !== 302) {
      throw new Error('auth 요청 실패');
    }

    const cookies = this.parseCookies(response.headers.getSetCookie());
    const html = await response.text();

    // SAMLResponse 파싱
    const samlResponseMatch = html.match(
      /name="SAMLResponse"\s+value="([^"]+)"/,
    );
    if (!samlResponseMatch) {
      throw new Error('아이디 또는 비밀번호를 잘못 입력했습니다.');
    }

    return {
      samlResponse: samlResponseMatch[1],
      cookies: [...data.cookies, ...cookies],
    };
  }

  // 3단계: SAMLResponse로 csrf 토큰 획득
  async login(data: LoginData): Promise<LoginResponse> {
    const formBody = new URLSearchParams({
      SAMLResponse: data.samlResponse,
    });

    const response = await fetch(`${this.BASE_PATH}/portal/login/login.ajax`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': this.USER_AGENT,
        Accept: '*/*',
        'Accept-Encoding': 'gzip, deflate, br',
        Host: 'uportal.catholic.ac.kr',
        Cookie: this.formatCookieHeader(data.cookies),
      },
      body: formBody.toString(),
      redirect: 'manual',
    });

    if (response.status === 301 || response.status === 302) {
      const redirectUrl = response.headers.get('location');
      if (!redirectUrl) {
        throw new Error('리다이렉트 URL이 없습니다.');
      }

      const redirectResponse = await fetch(
        'http://uportal.catholic.ac.kr/portal/loginSuccess.do⁠',
        {
          method: 'GET',
          headers: {
            'User-Agent': this.USER_AGENT,
            Cookie: this.formatCookieHeader(data.cookies),
          },
        },
      );

      if (!redirectResponse.ok) {
        throw new Error('login 리다이렉트 요청 실패');
      }

      const cookies = this.parseCookies(
        redirectResponse.headers.getSetCookie(),
      );
      const html = await redirectResponse.text();

      const csrfMatch = html.match(/id="_csrf"[^>]*content="([^"]+)"/);
      if (!csrfMatch) {
        throw new Error('csrf 토큰을 찾을 수 없습니다.');
      }

      return {
        csrf: csrfMatch[1],
        cookies: [...data.cookies, ...cookies],
      };
    }

    throw new Error('login 요청 실패');
  }
}
