import { Injectable } from '@nestjs/common';
import { SubjectSearchLogRequest } from '@libs/types';
import * as fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import * as path from 'path';
import dayjs from 'dayjs';

@Injectable()
export class LoggingServiceService {
  private readonly logDir = path.join(process.cwd(), 'logs');

  constructor() {
    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true });
    }
  }

  async logSubjectSearch(data: SubjectSearchLogRequest): Promise<void> {
    const now = dayjs();
    const logFileName = `${now.format('YYYY-MM-DD')}.log`;
    const logFilePath = path.join(this.logDir, logFileName);

    const logEntry = `[${now.format('YYYY-MM-DD HH:mm:ss')}]: [classKrName: ${data.classKrName}] [classId: ${data.classId}] [classNo: ${data.classNo}]\n`;

    await fs.appendFile(logFilePath, logEntry, 'utf-8');
    console.log(
      `Logged subject search: ${data.classKrName} (${data.classId}-${data.classNo})`,
    );
  }
}
