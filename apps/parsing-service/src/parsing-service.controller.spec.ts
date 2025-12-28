import { Test, TestingModule } from '@nestjs/testing';
import { ParsingServiceController } from './parsing-service.controller';
import { ParsingServiceService } from './parsing-service.service';

describe('ParsingServiceController', () => {
  let parsingServiceController: ParsingServiceController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [ParsingServiceController],
      providers: [ParsingServiceService],
    }).compile();

    parsingServiceController = app.get<ParsingServiceController>(ParsingServiceController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(parsingServiceController.getHello()).toBe('Hello World!');
    });
  });
});
