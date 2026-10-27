import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { ILaboratorioRepositoryPort } from '../../../../domain/ports/laboratorio.repository.port.js';
import { Laboratorio } from '../../../../domain/entities/laboratorio.entity.js';
import { LaboratorioMongo, type LaboratorioDocument } from '../schemas/laboratorio.schema.js';
import { EstadoCatalogo } from '../../../../domain/enums/estado-catalogo.enum.js';

@Injectable()
export class MongoLaboratorioRepository implements ILaboratorioRepositoryPort {
  constructor(
    @InjectModel(LaboratorioMongo.name)
    private readonly model: Model<LaboratorioDocument>
  ) {}

  async guardar(lab: Laboratorio): Promise<Laboratorio> {
    const raw = {
      _id: lab.id,
      nombre: lab.nombre,
      descripcion: lab.descripcion,
      contacto: lab.contacto,
      estado: lab.estado,
      creadoEn: lab.creadoEn,
      actualizadoEn: lab.actualizadoEn,
    };

    await this.model.updateOne({ _id: lab.id }, { $set: raw }, { upsert: true }).exec();
    return lab;
  }

  async buscarPorId(id: string): Promise<Laboratorio | null> {
    const doc = await this.model.findById(id).lean().exec();
    return doc ? this.toDomain(doc) : null;
  }

  async buscarPorNombre(nombre: string): Promise<Laboratorio | null> {
    const doc = await this.model
      .findOne({ nombre: { $regex: new RegExp(`^${this.escapeRegex(nombre.trim())}$`, 'i') } })
      .lean()
      .exec();
    return doc ? this.toDomain(doc) : null;
  }

  async listar(filtros?: { soloActivos?: boolean }): Promise<Laboratorio[]> {
    const query: any = {};
    if (filtros?.soloActivos) {
      query.estado = EstadoCatalogo.ACTIVO;
    }
    const docs = await this.model.find(query).sort({ nombre: 1 }).lean().exec();
    return docs.map((d) => this.toDomain(d));
  }

  async existe(id: string): Promise<boolean> {
    const count = await this.model.countDocuments({ _id: id }).exec();
    return count > 0;
  }

  private toDomain(doc: any): Laboratorio {
    return Laboratorio.reconstituir({
      id: doc._id,
      nombre: doc.nombre,
      descripcion: doc.descripcion || '',
      contacto: doc.contacto || null,
      estado: doc.estado as EstadoCatalogo,
      creadoEn: new Date(doc.creadoEn),
      actualizadoEn: new Date(doc.actualizadoEn),
    });
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
