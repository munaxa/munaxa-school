import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { BookLoan, BookLoanStatus, LibraryBook } from '@prisma/client';
import { LibraryRepository, NoCopiesAvailableError } from './library.repository';
import type { CheckoutBookDto, CreateBookDto } from './library.dto';

@Injectable()
export class LibraryService {
  constructor(private readonly repo: LibraryRepository) {}

  createBook(dto: CreateBookDto): Promise<LibraryBook> {
    const copies = dto.copiesTotal ?? 1;
    return this.repo.createBook({
      title: dto.title,
      author: dto.author ?? null,
      isbn: dto.isbn ?? null,
      category: dto.category ?? null,
      copiesTotal: copies,
      copiesAvailable: copies,
    });
  }

  listBooks(): Promise<LibraryBook[]> {
    return this.repo.listBooks();
  }

  async checkout(dto: CheckoutBookDto): Promise<BookLoan> {
    if (!dto.studentId && !dto.borrowerName) {
      throw new BadRequestException('Provide a studentId or borrowerName');
    }
    if (!(await this.repo.bookExists(dto.bookId))) {
      throw new NotFoundException('Book not found');
    }
    try {
      return await this.repo.checkout({
        bookId: dto.bookId,
        studentId: dto.studentId ?? null,
        borrowerName: dto.borrowerName ?? null,
        dueDate: new Date(dto.dueDate),
      });
    } catch (err) {
      if (err instanceof NoCopiesAvailableError) throw new ConflictException(err.message);
      throw err;
    }
  }

  async returnLoan(id: string): Promise<BookLoan> {
    const loan = await this.repo.findLoan(id);
    if (!loan) throw new NotFoundException('Loan not found');
    if (loan.status === 'RETURNED') {
      throw new BadRequestException('Loan already returned');
    }
    return this.repo.returnLoan(id, loan.bookId);
  }

  listLoans(status?: BookLoanStatus): Promise<BookLoan[]> {
    return this.repo.listLoans(status);
  }
}
