import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlotsModule } from './plots/plots.module';
import { DesignsModule } from './designs/designs.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL || 'postgresql://geo:geo@localhost:5432/geobuild',
      autoLoadEntities: true,
      synchronize: false, // We use init-db.sql for schema
    }),
    PlotsModule,
    DesignsModule,
  ],
})
export class AppModule {}
