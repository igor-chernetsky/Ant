import { Controller, Get } from '@nestjs/common';
import {
  PLATFORM_ACCESS_FEE_USD,
  PLATFORM_FEES_TRIAL_DISCOUNT_PERCENT,
  PLATFORM_SUCCESS_FEE_RATE,
} from './platform-fees';
import { PlatformSettingsService } from './platform-settings.service';

/**
 * Fee configuration for the pre-signing notice shown to contractors.
 *
 * Public on purpose: these are the prices advertised before anyone registers,
 * and the client needs them to render "$0 due during the trial" without asking
 * the visitor to authenticate. The authoritative amounts are still computed and
 * snapshotted server-side when a signature request is created.
 */
@Controller('v1/public/platform-fees')
export class PublicPlatformFeesController {
  constructor(private readonly settings: PlatformSettingsService) {}

  @Get()
  async get() {
    const trial = await this.settings.resolveTrialState();
    return {
      accessFeeUsd: PLATFORM_ACCESS_FEE_USD,
      successFeeRate: PLATFORM_SUCCESS_FEE_RATE,
      trialDiscountPercent: PLATFORM_FEES_TRIAL_DISCOUNT_PERCENT,
      trialActive: trial.trialActive,
      /** Calendar day the trial ends on, or null when no date is configured. */
      trialEndsAt: trial.trialEndsAt
        ? trial.trialEndsAt.toISOString().slice(0, 10)
        : null,
    };
  }
}
