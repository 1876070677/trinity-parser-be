// 인증 관련 타입
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

export interface LogoutData {
  csrf: string;
  cookies: string[];
}

// 사용자 정보 관련 타입
export interface UserInfoData {
  csrf: string;
  cookies: string[];
}

// 파싱 서비스 관련 타입
export interface SubjectInfoRequest {
  csrf: string;
  cookies: string[];
  sujtNo: string;
  classNo: string;
  campFg: string;
  shtm: string;
  yyyy: string;
}

export interface SubjectInfoResponse {
  sbjtKorNm: string;
  sujtNo: string;
  classNo: string;
  tlsnAplyRcnt: string;
  tlsnLmtRcnt: string;
  sustCd: string;
  extraCnt: string;
}

export interface TrinityInfo {
  userNm?: string;
  userNo?: string;
  deptNm?: string;
  campFg?: string;
  shtmYyyy?: string;
  SHTM_FG?: string;
  shtm?: string;
  yyyy?: string;
}

export interface UserInfoResponse {
  userInfo: TrinityInfo;
}
