import { Injectable } from '@nestjs/common';
import {
  AuthData,
  AuthResponse,
  LoginData,
  LoginFormResponse,
  LoginResponse,
  LogoutData,
  TrinityInfo,
  UserInfoData,
  UserInfoResponse,
} from '@libs/types';

@Injectable()
export class UserServiceService {
  private readonly BASE_PATH = 'https://uportal.catholic.ac.kr';
  private readonly USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:72.0) Gecko/20100101 Firefox/72.0';

  // Set-Cookie 헤더에서 쿠키 이름=값만 추출
  private parseCookies(setCookieHeaders: string[]): string[] {
    return setCookieHeaders.map((cookie) => cookie.split(';')[0]);
  }

  // 쿠키 배열을 Cookie 헤더 문자열로 변환
  private formatCookieHeader(cookies: string[]): string {
    return cookies.join('; ');
  }

  // 쿠키 병합 (중복 시 새 쿠키로 덮어쓰기)
  private mergeCookies(oldCookies: string[], newCookies: string[]): string[] {
    const cookieMap = new Map<string, string>();
    for (const cookie of oldCookies) {
      const [name] = cookie.split('=');
      cookieMap.set(name, cookie);
    }
    for (const cookie of newCookies) {
      const [name] = cookie.split('=');
      cookieMap.set(name, cookie);
    }
    return Array.from(cookieMap.values());
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
      cookies: this.mergeCookies(data.cookies, cookies),
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
      const cookies = this.parseCookies(response.headers.getSetCookie());
      const allCookies = this.mergeCookies(data.cookies, cookies);
      if (!redirectUrl) {
        throw new Error('리다이렉트 URL이 없습니다.');
      }

      const redirectResponse = await fetch(
        'https://uportal.catholic.ac.kr/portal/loginSuccess.do⁠',
        {
          method: 'GET',
          headers: {
            'User-Agent': this.USER_AGENT,
            Cookie: this.formatCookieHeader(allCookies),
          },
        },
      );

      if (!redirectResponse.ok) {
        throw new Error('login 리다이렉트 요청 실패');
      }

      const redirectCookies = this.parseCookies(
        redirectResponse.headers.getSetCookie(),
      );
      const html = await redirectResponse.text();

      const csrfMatch = html.match(/id="_csrf"[^>]*content="([^"]+)"/);
      if (!csrfMatch) {
        throw new Error('csrf 토큰을 찾을 수 없습니다.');
      }

      return {
        csrf: csrfMatch[1],
        cookies: this.mergeCookies(allCookies, redirectCookies),
      };
    }

    throw new Error('login 요청 실패');
  }

  // 4단계: 로그아웃
  async logout(data: LogoutData): Promise<{ success: boolean }> {
    const formBody = new URLSearchParams({
      _csrf: data.csrf,
    });

    const response = await fetch(`${this.BASE_PATH}/portal/login/logout.do`, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': this.USER_AGENT,
        Accept: 'application/json, text/javascript, */*; q=0.01',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        Host: 'uportal.catholic.ac.kr',
        Cookie: this.formatCookieHeader(data.cookies),
      },
      body: formBody.toString(),
    });

    // 302 리다이렉트도 성공으로 처리
    if (!response.ok && response.status !== 302) {
      throw new Error(`logout 요청 실패: ${response.status}`);
    }

    return { success: true };
  }

  // 5단계: 사용자 정보 조회
  async getUserInfo(data: UserInfoData): Promise<UserInfoResponse> {
    const headers = {
      'User-Agent': this.USER_AGENT,
      Accept: 'application/json, text/javascript, */*; q=0.01',
      'Content-Type': 'application/json',
      'x-csrf-token': data.csrf,
      'x-requested-with': 'XMLHttpRequest',
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      Host: 'uportal.catholic.ac.kr',
      Origin: 'https://uportal.catholic.ac.kr',
      Referer: 'https://uportal.catholic.ac.kr/portal/main.do',
      Cookie: this.formatCookieHeader(data.cookies),
    };

    // 개인 정보 조회
    const myInfoResponse = await fetch(
      `${this.BASE_PATH}/portal/menu/myInformation.ajax`,
      {
        method: 'POST',
        headers,
        body: '',
      },
    );

    if (!myInfoResponse.ok) {
      throw new Error('사용자 정보 조회 실패');
    }

    const myInfoCookies = this.parseCookies(
      myInfoResponse.headers.getSetCookie(),
    );
    const myInfoData = (await myInfoResponse.json()) as {
      modelAndView?: { model?: { result?: TrinityInfo[] } };
    };

    const userInfo: TrinityInfo = {};

    // 개인 정보 파싱
    const myInfoResult = myInfoData?.modelAndView?.model?.result;
    if (myInfoResult && myInfoResult.length > 0) {
      const info = myInfoResult[0];
      userInfo.userNm = info.userNm;
      userInfo.userId = info.userId;
      userInfo.userEmail = info.userEmail;
      userInfo.userTel = info.userTel;
      userInfo.deptNm = info.deptNm;
    }

    const mergedCookies = this.mergeCookies(data.cookies, myInfoCookies);

    // 학적 정보 조회
    const schoolInfoResponse = await fetch(
      `${this.BASE_PATH}/portal/portlet/P044/shtmData.ajax`,
      {
        method: 'POST',
        headers: {
          ...headers,
          Cookie: this.formatCookieHeader(mergedCookies),
        },
        body: '',
      },
    );

    if (!schoolInfoResponse.ok) {
      throw new Error('학적 정보 조회 실패');
    }

    const schoolInfoCookies = this.parseCookies(
      schoolInfoResponse.headers.getSetCookie(),
    );
    const schoolInfoData = (await schoolInfoResponse.json()) as {
      modelAndView?: { model?: { result?: TrinityInfo } };
    };

    // 학적 정보 파싱
    const schoolResult = schoolInfoData?.modelAndView?.model?.result;
    if (schoolResult) {
      userInfo.grade = schoolResult.grade;
      userInfo.semester = schoolResult.semester;
      userInfo.status = schoolResult.status;
      userInfo.entrYy = schoolResult.entrYy;
      userInfo.campusNm = schoolResult.campusNm;
      userInfo.collNm = schoolResult.collNm;
      userInfo.majorNm = schoolResult.majorNm;
    }

    return {
      userInfo,
      cookies: this.mergeCookies(mergedCookies, schoolInfoCookies),
    };
  }
}
