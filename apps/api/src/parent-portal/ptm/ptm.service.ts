import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PtmBooking, PtmSlot } from '@prisma/client';
import { Permission } from '@school/domain';
import { TenantContextStore } from '../../prisma/tenant-context';
import { ParentScopeService } from '../common/parent-scope.service';
import { PtmRepository, PtmSlotFullError } from './ptm.repository';
import type { CreatePtmBookingDto, CreatePtmSlotDto } from './ptm.dto';

@Injectable()
export class PtmService {
  constructor(
    private readonly repo: PtmRepository,
    private readonly scope: ParentScopeService,
  ) {}

  // ----- Slots (staff) -------------------------------------------------------
  async createSlot(dto: CreatePtmSlotDto): Promise<PtmSlot> {
    if (new Date(dto.endsAt) <= new Date(dto.startsAt)) {
      throw new BadRequestException('endsAt must be after startsAt');
    }
    if (!(await this.repo.teacherExists(dto.teacherId))) {
      throw new BadRequestException('Teacher not found in this tenant');
    }
    return this.repo.createSlot({
      teacherId: dto.teacherId,
      sectionId: dto.sectionId ?? null,
      startsAt: new Date(dto.startsAt),
      endsAt: new Date(dto.endsAt),
      location: dto.location ?? null,
      capacity: dto.capacity ?? 1,
      notes: dto.notes ?? null,
      createdById: TenantContextStore.get()?.actorUserId ?? null,
    });
  }

  listSlots(teacherId?: string, openOnly?: boolean): Promise<PtmSlot[]> {
    return this.repo.listSlots({ teacherId, openOnly });
  }

  // ----- Bookings (parent) ---------------------------------------------------
  async book(dto: CreatePtmBookingDto): Promise<PtmBooking> {
    await this.scope.assertChildAccess(dto.studentId);
    const slot = await this.repo.findSlot(dto.slotId);
    if (!slot) throw new NotFoundException('PTM slot not found');
    if (slot.status !== 'OPEN') {
      throw new ConflictException('PTM slot is not open for booking');
    }
    try {
      return await this.repo.book({
        slotId: dto.slotId,
        studentId: dto.studentId,
        bookedById: TenantContextStore.get()?.actorUserId ?? null,
        note: dto.note ?? null,
        capacity: slot.capacity,
      });
    } catch (err) {
      if (err instanceof PtmSlotFullError) throw new ConflictException(err.message);
      // Unique [slotId, studentId] violation → already booked for this child.
      if (isUniqueViolation(err)) {
        throw new ConflictException('This child already has a booking for this slot');
      }
      throw err;
    }
  }

  async listBookings(): Promise<PtmBooking[]> {
    if (this.scope.hasPermission(Permission.PTM_MANAGE)) {
      return this.repo.listAllBookings();
    }
    const childIds = await this.scope.childIds();
    if (childIds.length === 0) return [];
    return this.repo.listBookingsForStudents(childIds);
  }

  async cancelBooking(id: string): Promise<PtmBooking> {
    const booking = await this.repo.findBooking(id);
    if (!booking) throw new NotFoundException('Booking not found');
    if (!this.scope.hasPermission(Permission.PTM_MANAGE)) {
      await this.scope.assertChildAccess(booking.studentId);
    }
    if (booking.status !== 'BOOKED') {
      throw new BadRequestException(`Cannot cancel a ${booking.status} booking`);
    }
    return this.repo.cancelBooking(id, booking.slotId);
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === 'P2002'
  );
}
