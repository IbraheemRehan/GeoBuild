import { IsString, IsOptional, IsNumber, IsArray, Min, Max, IsIn } from 'class-validator';

export class CreatePlotDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsString()
  @IsIn(['lahore', 'islamabad', 'karachi'])
  city!: string;

  @IsArray()
  coordinates!: number[][][]; // GeoJSON polygon coordinates [[lng, lat], ...]

  @IsOptional()
  @IsNumber()
  frontEdgeIndex?: number;
}

export class UpdatePlotDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  frontEdgeIndex?: number;
}
