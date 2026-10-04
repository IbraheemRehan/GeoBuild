import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DesignVersion } from './design-version.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DesignVersion])],
  controllers: [],
  providers: [],
  exports: [],
})
export class DesignsModule {}
