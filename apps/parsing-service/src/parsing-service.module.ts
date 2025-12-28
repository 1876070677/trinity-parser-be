import { Module } from '@nestjs/common';
import { ParsingServiceController } from './parsing-service.controller';
import { ParsingServiceService } from './parsing-service.service';

@Module({
  imports: [],
  controllers: [ParsingServiceController],
  providers: [ParsingServiceService],
})
export class ParsingServiceModule {}
