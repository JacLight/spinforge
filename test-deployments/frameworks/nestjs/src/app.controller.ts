import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getHello(): any {
    return {
      message: 'SpinForge NestJS Test App',
      framework: 'nestjs',
      deploymentMethod: process.env.DEPLOY_METHOD || 'Unknown',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
    };
  }

  @Get('health')
  getHealth(): any {
    return {
      status: 'healthy',
      uptime: process.uptime(),
    };
  }
}