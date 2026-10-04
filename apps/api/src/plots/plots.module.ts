import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Plot } from './plot.entity';
import { PlotsService } from './plots.service';
import { PlotsController } from './plots.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Plot])],
  controllers: [PlotsController],
  providers: [PlotsService],
  exports: [PlotsService],
})
export class PlotsModule {}
