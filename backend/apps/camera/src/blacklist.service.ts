import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@app/common';
import {
  BlacklistEntry,
  BlacklistPersonView,
  CreateBlacklistDto,
} from '@app/contracts';

@Injectable()
export class BlacklistService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateBlacklistDto): Promise<BlacklistPersonView> {
    await this.assertStoreOwner(dto.storeId, dto.ownerId);
    const person = await this.prisma.blacklistPerson.create({
      data: {
        storeId: dto.storeId,
        name: dto.name,
        photoKey: dto.photoKey,
      },
    });
    return this.view(person);
  }

  async list(ownerId: string, storeId: string): Promise<BlacklistPersonView[]> {
    await this.assertStoreOwner(storeId, ownerId);
    const persons = await this.prisma.blacklistPerson.findMany({
      where: { storeId },
      orderBy: { createdAt: 'asc' },
    });
    return persons.map((p) => this.view(p));
  }

  async remove(ownerId: string, id: string): Promise<{ id: string }> {
    const person = await this.prisma.blacklistPerson.findUnique({
      where: { id },
      include: { store: true },
    });
    if (!person) throw new NotFoundException('Запись не найдена');
    if (person.store.ownerId !== ownerId) {
      throw new ForbiddenException('Нет доступа к записи');
    }
    await this.prisma.blacklistPerson.delete({ where: { id } });
    return { id };
  }

  /** Записи с фото для ai-detection (эмбеддинги считаются там, в памяти). */
  async config(): Promise<BlacklistEntry[]> {
    const persons = await this.prisma.blacklistPerson.findMany({
      where: { photoKey: { not: null } },
    });
    return persons.map((p) => ({
      storeId: p.storeId,
      name: p.name,
      photoKey: p.photoKey as string,
    }));
  }

  private async assertStoreOwner(storeId: string, ownerId: string) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
    });
    if (!store) throw new NotFoundException('Магазин не найден');
    if (store.ownerId !== ownerId) {
      throw new ForbiddenException('Нет доступа к магазину');
    }
  }

  private view(p: {
    id: string;
    storeId: string;
    name: string;
    photoKey: string | null;
    createdAt: Date;
  }): BlacklistPersonView {
    return {
      id: p.id,
      storeId: p.storeId,
      name: p.name,
      photoKey: p.photoKey,
      createdAt: p.createdAt.toISOString(),
    };
  }
}
