import { Test, TestingModule } from '@nestjs/testing';
import { ManagementServiceController } from './management-service.controller';
import { ManagementServiceService } from './management-service.service';

describe('ManagementServiceController', () => {
  let managementServiceController: ManagementServiceController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [ManagementServiceController],
      providers: [ManagementServiceService],
    }).compile();

    managementServiceController = app.get<ManagementServiceController>(ManagementServiceController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(managementServiceController.getHello()).toBe('Hello World!');
    });
  });
});
