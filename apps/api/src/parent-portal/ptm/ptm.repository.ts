import { Injectable } from '@nestjs/common';
import type { Prisma, PtmBooking, PtmSlot } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';

@Injectable()
export class PtmRepository extends TenantRepository {
  // ----- Slots ---------------------------------------------------------------
  createSlot(data: Omit<Prisma.PtmSlotUncheckedCreateInput, 'tenantId'>): Promise<PtmSlot> {
    return this.run((tx, tenantId) => tx.ptmSlot.create({ data: { ...data, tenantId } }));
  }

  findSlot(id: string): Promise<PtmSlot | null> {
    return this.run((tx) => tx.ptmSlot.findFirst({ where: { id } }));
  }

  listSlots(filter: { teacherId?: string; openOnly?: boolean }): Promise<PtmSlot[]> {
    return this.run((tx) =>
      tx.ptmSlot.findMany({
        where: {
          ...(filter.teacherId ? { teacherId: filter.teacherId } : {}),
          ...(filter.openOnly ? { status: 'OPEN' } : {}),
        },
        orderBy: { startsAt: 'asc' },
        take: 500,
      }),
    );
  }

  countBookings(slotId: string): Promise<number> {
    return this.run((tx) => tx.ptmBooking.count({ where: { slotId, status: 'BOOKED' } }));
  }

  teacherExists(teacherId: string): Promise<boolean> {
    return this.run(
      async (tx) =>
        (await tx.teacher.findFirst({ where: { id: teacherId, deletedAt: null } })) !== null,
    );
  }

  // ----- Bookings ------------------------------------------------------------
  /**
   * Book a slot atomically: re-check capacity inside the transaction, create the booking,
   * and flip the slot to BOOKED once it is full.
   */
  book(data: {
    slotId: string;
    studentId: string;
    bookedById: string | null;
    note: string | null;
    capacity: number;
  }): Promise<PtmBooking> {
    return this.run(async (tx, tenantId) => {
      const taken = await tx.ptmBooking.count({
        where: { slotId: data.slotId, status: 'BOOKED' },
      });
      if (taken >= data.capacity) {
        // Sentinel: caller maps this to a 409. Throw a typed error.
        throw new PtmSlotFullError();
      }
      const booking = await tx.ptmBooking.create({
        data: {
          tenantId,
          slotId: data.slotId,
          studentId: data.studentId,
          bookedById: data.bookedById,
          note: data.note,
        },
      });
      if (taken + 1 >= data.capacity) {
        await tx.ptmSlot.update({ where: { id: data.slotId }, data: { status: 'BOOKED' } });
      }
      return booking;
    });
  }

  findBooking(id: string): Promise<PtmBooking | null> {
    return this.run((tx) => tx.ptmBooking.findFirst({ where: { id } }));
  }

  listBookingsForStudents(studentIds: string[]): Promise<PtmBooking[]> {
    return this.run((tx) =>
      tx.ptmBooking.findMany({
        where: { studentId: { in: studentIds } },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  listAllBookings(): Promise<PtmBooking[]> {
    return this.run((tx) => tx.ptmBooking.findMany({ orderBy: { createdAt: 'desc' }, take: 500 }));
  }

  /** Cancel a booking and re-open its slot. */
  cancelBooking(id: string, slotId: string): Promise<PtmBooking> {
    return this.run(async (tx) => {
      const booking = await tx.ptmBooking.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });
      await tx.ptmSlot.update({ where: { id: slotId }, data: { status: 'OPEN' } });
      return booking;
    });
  }
}

/** Thrown when a slot's capacity is exhausted (mapped to HTTP 409 by the service). */
export class PtmSlotFullError extends Error {
  constructor() {
    super('PTM slot is fully booked');
    this.name = 'PtmSlotFullError';
  }
}
