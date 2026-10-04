import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Plot } from '../plots/plot.entity';

@Entity('design_versions')
export class DesignVersion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'plot_id' })
  plotId!: string;

  @ManyToOne(() => Plot, (p) => p.designVersions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'plot_id' })
  plot!: Plot;

  @Column({ default: 1 })
  version!: number;

  @Column('jsonb')
  spec!: Record<string, unknown>;

  @Column({ nullable: true })
  prompt?: string;

  @Column('text', { array: true, nullable: true })
  assumptions?: string[];

  @Column({ name: 'glb_url', nullable: true })
  glbUrl?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
