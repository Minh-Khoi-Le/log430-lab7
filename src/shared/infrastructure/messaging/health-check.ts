import { IEventBus } from './event-bus';

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  message: string;
  timestamp: Date;
  details?: any;
}

export class MessagingHealthCheck {
  constructor(private eventBus: IEventBus) {}

  public async check(): Promise<HealthCheckResult> {
    try {
      const isHealthy = this.eventBus.isHealthy();
      
      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        message: isHealthy 
          ? 'Messaging infrastructure is operational' 
          : 'Messaging infrastructure is not available',
        timestamp: new Date(),
        details: {
          eventBusHealthy: isHealthy
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Error checking messaging health',
        timestamp: new Date(),
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  public async checkWithPing(): Promise<HealthCheckResult> {
    try {
      // Try to initialize the event bus if not already done
      await this.eventBus.initialize();
      
      const basicCheck = await this.check();
      
      if (basicCheck.status === 'healthy') {
        return {
          ...basicCheck,
          message: 'Messaging infrastructure is operational and responsive',
          details: {
            ...basicCheck.details,
            pingSuccessful: true
          }
        };
      }
      
      return basicCheck;
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Messaging infrastructure ping failed',
        timestamp: new Date(),
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          pingSuccessful: false
        }
      };
    }
  }
}