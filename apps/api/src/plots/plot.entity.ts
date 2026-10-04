import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { DesignVersion } from '../designs/design-version.entity';

@Entity('plots')
export class Plot {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ nullable: true })
  name?: string;

  @Column({ default: 'lahore' })
  city!: string;

  @Column('geometry', { spatialFeatureType: 'Polygon', srid: 4326 })
  geometry!: object;

  @Column('double precision', { name: 'area_sqm', nullable: true })
  areaSqm?: number;

  @Column('double precision', { name: 'area_marla', nullable: true })
  areaMarla?: number;

  @Column({ name: 'front_edge_index', default: 0 })
  frontEdgeIndex!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => DesignVersion, (dv) => dv.plot)
  designVersions!: DesignVersion[];
}
