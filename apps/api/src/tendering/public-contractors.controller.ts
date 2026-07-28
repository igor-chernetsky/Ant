import { Controller, Get, Param } from '@nestjs/common';
import { ContractorPortfolioService } from './contractor-portfolio.service';

@Controller('v1/public/contractors')
export class PublicContractorsController {
  constructor(private readonly portfolio: ContractorPortfolioService) {}

  @Get(':contractorId/portfolio')
  listPortfolio(@Param('contractorId') contractorId: string) {
    return this.portfolio.listPublic(contractorId);
  }

  @Get(':contractorId/portfolio/:itemId/download-url')
  getPortfolioImageDownloadUrl(
    @Param('contractorId') contractorId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.portfolio.getPublicImageDownloadUrl(contractorId, itemId);
  }
}
