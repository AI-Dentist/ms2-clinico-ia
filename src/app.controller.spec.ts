import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const mockAppService = {
      getHealth: () => ({
        service: 'ms2-expediente',
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString(),
      }),
      getHello: () => 'Hello World!',
    };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: mockAppService,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('should return health status with ok and service name', () => {
      const result = appController.health();
      expect(result.status).toBe('ok');
      expect(result.service).toBe('ms2-expediente');
      expect(result.database).toBe('connected');
    });
  });
});
