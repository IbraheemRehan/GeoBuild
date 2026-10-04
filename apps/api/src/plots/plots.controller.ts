import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { PlotsService } from './plots.service';
import { CreatePlotDto } from './plot.dto';

@Controller('plots')
export class PlotsController {
  constructor(private readonly plotsService: PlotsService) {}

  @Post()
  create(@Body() dto: CreatePlotDto) {
    return this.plotsService.create(dto);
  }

  @Get()
  findAll(@Query('city') city?: string) {
    return this.plotsService.findAll(city);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.plotsService.findOne(id);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.plotsService.delete(id);
  }
}
