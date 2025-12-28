import { Injectable } from '@nestjs/common';
import { SubjectInfoRequest, SubjectInfoResponse } from '@libs/types';

@Injectable()
export class ParsingServiceService {
  async getSubjectInfo(data: SubjectInfoRequest): Promise<SubjectInfoResponse> {
    const formBody = new URLSearchParams({
      quatFg: 'INQ',
      posiFg: '10',
      openYyyy: data.yyyy,
      openShtm: data.shtm,
      campFg: data.campFg,
      sustCd: '%',
      corsCd: '|',
      danFg: '',
      pobtFgCd: '%',
    });

    const response = await fetch(
      'https://uportal.catholic.ac.kr/stw/scsr/scoo/findOpsbOpenSubjectInq.json',
      {
        method: 'POST',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:72.0) Gecko/20100101 Firefox/72.0',
          Accept: 'application/json, text/javascript, */*; q=0.01',
          'Content-Type': 'application/x-www-form-urlencoded',
          'x-csrf-token': data.csrf,
          'x-requested-with': 'XMLHttpRequest',
          'Accept-Encoding': 'gzip, deflate, br, zstd',
          'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
          Host: 'uportal.catholic.ac.kr',
          Origin: 'https://uportal.catholic.ac.kr',
          Referer:
            'https://uportal.catholic.ac.kr/stw/scsr/scoo/scooOpsbOpenSubjectInq.do',
          Cookie: data.cookies.join('; '),
        },
        body: formBody.toString(),
      },
    );

    if (!response.ok) {
      throw new Error('과목 정보 조회에 실패했습니다.');
    }

    const jsonData = (await response.json()) as {
      DS_CURR_OPSB010?: Array<{
        sbjtNo: string;
        clssNo: string;
        sbjtKorNm: string;
        tlsnAplyRcnt: number;
        tlsnLmtRcnt?: number;
        sustCd: string;
        [key: string]: unknown;
      }>;
      [key: string]: unknown;
    };
    const subjects = jsonData.DS_CURR_OPSB010 || [];

    for (const subject of subjects) {
      if (subject.sbjtNo === data.sujtNo && subject.clssNo === data.classNo) {
        const extraCnt = await this.getRemainNo(
          data,
          subject.sustCd,
          data.sujtNo,
          data.classNo,
        );

        return {
          sbjtKorNm: subject.sbjtKorNm,
          sujtNo: data.sujtNo,
          classNo: data.classNo,
          tlsnAplyRcnt: String(subject.tlsnAplyRcnt),
          tlsnLmtRcnt: subject.tlsnLmtRcnt ? String(subject.tlsnLmtRcnt) : '-',
          sustCd: subject.sustCd,
          extraCnt,
        };
      }
    }

    throw new Error('과목 코드 또는 분반이 유효하지 않습니다.');
  }

  private async getRemainNo(
    data: SubjectInfoRequest,
    sustCd: string,
    sujtNo: string,
    classNo: string,
  ): Promise<string> {
    const formBody = new URLSearchParams({
      posiFg: '10',
      openYyyy: data.yyyy,
      openShtm: data.shtm,
      sustCd: sustCd,
      corsCd: '',
      majCd: '%',
      grade: '%',
    });

    const response = await fetch(
      'https://uportal.catholic.ac.kr/stw/scsr/scoo/findTalaLessonApplicationOpsb.json',
      {
        method: 'POST',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:72.0) Gecko/20100101 Firefox/72.0',
          Accept: 'application/json, text/javascript, */*; q=0.01',
          'Content-Type': 'application/x-www-form-urlencoded',
          'x-csrf-token': data.csrf,
          'x-requested-with': 'XMLHttpRequest',
          'Accept-Encoding': 'gzip, deflate, br, zstd',
          'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
          Host: 'uportal.catholic.ac.kr',
          Origin: 'https://uportal.catholic.ac.kr',
          Referer:
            'https://uportal.catholic.ac.kr/stw/scsr/scoo/scooLessonApplicationStudentReg.do',
          Cookie: data.cookies.join('; '),
        },
        body: formBody.toString(),
      },
    );

    if (!response.ok) {
      throw new Error('여석 정보 조회에 실패했습니다.');
    }

    const jsonData = (await response.json()) as {
      DS_COUR_TALA010?: Array<{
        sbjtNo: string;
        clssNo: string;
        extraCnt: number;
        [key: string]: unknown;
      }>;
      [key: string]: unknown;
    };

    const subjects = jsonData.DS_COUR_TALA010 || [];

    for (const subject of subjects) {
      if (subject.sbjtNo === sujtNo && subject.clssNo === classNo) {
        return String(subject.extraCnt);
      }
    }

    return '-';
  }
}
