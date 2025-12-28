import { Test, TestingModule } from '@nestjs/testing';
import { BoardServiceController } from './board-service.controller';
import { BoardServiceService } from './board-service.service';

describe('BoardServiceController', () => {
  let boardServiceController: BoardServiceController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [BoardServiceController],
      providers: [BoardServiceService],
    }).compile();

    boardServiceController = app.get<BoardServiceController>(BoardServiceController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(boardServiceController.getHello()).toBe('Hello World!');
    });
  });
});
