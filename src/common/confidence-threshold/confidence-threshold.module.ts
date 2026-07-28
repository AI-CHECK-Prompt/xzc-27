import { Module, Global } from '@nestjs/common';
import { ConfidenceThresholdService } from './confidence-threshold.service';

@Global()
@Module({
  providers: [ConfidenceThresholdService],
  exports: [ConfidenceThresholdService],
})
export class ConfidenceThresholdModule {}
