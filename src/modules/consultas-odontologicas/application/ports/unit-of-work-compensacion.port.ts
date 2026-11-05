import type { ClientSession } from 'mongoose';

export const UNIT_OF_WORK_COMPENSACION_PORT = Symbol('UNIT_OF_WORK_COMPENSACION_PORT');

export interface IUnitOfWorkCompensacionPort {
  ejecutarCompensacion<T>(operacion: (session: ClientSession | undefined) => Promise<T>): Promise<T>;
}
