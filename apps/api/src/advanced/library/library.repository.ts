import { Injectable } from '@nestjs/common';
import type { BookLoan, LibraryBook, Prisma } from '@prisma/client';
import { TenantRepository } from '../../common/tenant.repository';

/** Thrown when a checkout is attempted with no available copies (mapped to 409). */
export class NoCopiesAvailableError extends Error {
  constructor() {
    super('No copies available');
    this.name = 'NoCopiesAvailableError';
  }
}

@Injectable()
export class LibraryRepository extends TenantRepository {
  createBook(data: Omit<Prisma.LibraryBookUncheckedCreateInput, 'tenantId'>): Promise<LibraryBook> {
    return this.run((tx, tenantId) => tx.libraryBook.create({ data: { ...data, tenantId } }));
  }

  listBooks(): Promise<LibraryBook[]> {
    return this.run((tx) =>
      tx.libraryBook.findMany({ where: { deletedAt: null }, orderBy: { title: 'asc' }, take: 500 }),
    );
  }

  /** Atomically check a copy out: decrement availability (guarded) and create the loan. */
  checkout(data: {
    bookId: string;
    studentId: string | null;
    borrowerName: string | null;
    dueDate: Date;
  }): Promise<BookLoan> {
    return this.run(async (tx, tenantId) => {
      const book = await tx.libraryBook.findFirst({
        where: { id: data.bookId, deletedAt: null },
      });
      if (!book) throw new NoCopiesAvailableError(); // surfaced as 404 by the service guard first
      if (book.copiesAvailable <= 0) throw new NoCopiesAvailableError();
      await tx.libraryBook.update({
        where: { id: data.bookId },
        data: { copiesAvailable: { decrement: 1 } },
      });
      return tx.bookLoan.create({
        data: {
          tenantId,
          bookId: data.bookId,
          studentId: data.studentId,
          borrowerName: data.borrowerName,
          dueDate: data.dueDate,
        },
      });
    });
  }

  findLoan(id: string): Promise<BookLoan | null> {
    return this.run((tx) => tx.bookLoan.findFirst({ where: { id } }));
  }

  /** Return a loan: mark RETURNED and restore one available copy. */
  returnLoan(id: string, bookId: string): Promise<BookLoan> {
    return this.run(async (tx) => {
      const loan = await tx.bookLoan.update({
        where: { id },
        data: { status: 'RETURNED', returnedAt: new Date() },
      });
      await tx.libraryBook.update({
        where: { id: bookId },
        data: { copiesAvailable: { increment: 1 } },
      });
      return loan;
    });
  }

  listLoans(status?: 'ACTIVE' | 'RETURNED' | 'OVERDUE'): Promise<BookLoan[]> {
    return this.run((tx) =>
      tx.bookLoan.findMany({
        where: { ...(status ? { status } : {}) },
        orderBy: { borrowedAt: 'desc' },
        take: 500,
      }),
    );
  }

  bookExists(bookId: string): Promise<boolean> {
    return this.run(
      async (tx) =>
        (await tx.libraryBook.findFirst({ where: { id: bookId, deletedAt: null } })) !== null,
    );
  }
}
