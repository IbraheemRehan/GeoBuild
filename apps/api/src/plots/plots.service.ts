import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plot } from './plot.entity';
import { CreatePlotDto } from './plot.dto';

@Injectable()
export class PlotsService {
  constructor(
    @InjectRepository(Plot)
    private readonly plotRepo: Repository<Plot>,
  ) {}

  async create(dto: CreatePlotDto): Promise<Plot> {
    const geojson = {
      type: 'Polygon',
      coordinates: dto.coordinates,
    };

    const plot = this.plotRepo.create({
      name: dto.name,
      city: dto.city,
      geometry: () =>
        `ST_SetSRID(ST_GeomFromGeoJSON('${JSON.stringify(geojson)}'), 4326)`,
      frontEdgeIndex: dto.frontEdgeIndex ?? 0,
    });

    const saved = await this.plotRepo.save(plot);

    // Compute area
    await this.plotRepo.query(
      `UPDATE plots SET 
        area_sqm = ST_Area(geometry::geography),
        area_marla = ST_Area(geometry::geography) / 25.2929
      WHERE id = $1`,
      [saved.id],
    );

    return this.findOne(saved.id);
  }

  async findAll(city?: string): Promise<Plot[]> {
    const qb = this.plotRepo.createQueryBuilder('plot');
    if (city) {
      qb.where('plot.city = :city', { city });
    }
    return qb.orderBy('plot.created_at', 'DESC').getMany();
  }

  async findOne(id: string): Promise<Plot> {
    const plot = await this.plotRepo.findOne({ where: { id } });
    if (!plot) throw new Error(`Plot ${id} not found`);
    return plot;
  }

  async delete(id: string): Promise<void> {
    await this.plotRepo.delete(id);
  }
}
