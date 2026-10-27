import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { ITipoEstudioRepositoryPort } from '../../../../domain/ports/tipo-estudio.repository.port.js';
import { TipoEstudio } from '../../../../domain/entities/tipo-estudio.entity.js';
import { TipoEstudioMongo, type TipoEstudioDocument } from '../schemas/tipo-estudio.schema.js';
import { CategoriaEstudio } from '../../../../domain/enums/categoria-estudio.enum.js';
import { EstadoCatalogo } from '../../../../domain/enums/estado-catalogo.enum.js';

@Injectable()
export class MongoTipoEstudioRepository implements ITipoEstudioRepositoryPort {
  constructor(
    @InjectModel(TipoEstudioMongo.name)
    private readonly model: Model<TipoEstudioDocument>
  ) {}

  async guardar(tipo: TipoEstudio): Promise<TipoEstudio> {
    const raw = {
      _id: tipo.id,
      codigo: tipo.codigo,
      nombre: tipo.nombre,
      categoria: tipo.categoria,
      descripcion: tipo.descripcion,
      estado: tipo.estado,
      creadoEn: tipo.creadoEn,
      actualizadoEn: tipo.actualizadoEn,
    };

    await this.model.updateOne({ _id: tipo.id }, { $set: raw }, { upsert: true }).exec();
    return tipo;
  }

  async buscarPorId(id: string): Promise<TipoEstudio | null> {
    const doc = await this.model.findById(id).lean().exec();
    return doc ? this.toDomain(doc) : null;
  }

  async buscarPorCodigo(codigo: string): Promise<TipoEstudio | null> {
    const doc = await this.model
      .findOne({ codigo: codigo.trim().toUpperCase() })
      .lean()
      .exec();
    return doc ? this.toDomain(doc) : null;
  }

  async buscarPorNombre(nombre: string): Promise<TipoEstudio | null> {
    const doc = await this.model
      .findOne({ nombre: { $regex: new RegExp(`^${this.escapeRegex(nombre.trim())}$`, 'i') } })
      .lean()
      .exec();
    return doc ? this.toDomain(doc) : null;
  }

  async listar(filtros?: { categoria?: CategoriaEstudio; soloActivos?: boolean }): Promise<TipoEstudio[]> {
    const query: any = {};
    if (filtros?.categoria) {
      query.categoria = filtros.categoria;
    }
    if (filtros?.soloActivos) {
      query.estado = EstadoCatalogo.ACTIVO;
    }
    const docs = await this.model.find(query).sort({ categoria: 1, nombre: 1 }).lean().exec();
    return docs.map((d) => this.toDomain(d));
  }

  async existe(id: string): Promise<boolean> {
    const count = await this.model.countDocuments({ _id: id }).exec();
    return count > 0;
  }

  private toDomain(doc: any): TipoEstudio {
    return TipoEstudio.reconstituir({
      id: doc._id,
      codigo: doc.codigo,
      nombre: doc.nombre,
      categoria: doc.categoria as CategoriaEstudio,
      descripcion: doc.descripcion || '',
      estado: doc.estado as EstadoCatalogo,
      creadoEn: new Date(doc.creadoEn),
      actualizadoEn: new Date(doc.actualizadoEn),
    });
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
