import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PaginationQueryDto } from '../../common/dto';
import { CreateBookDto } from './dto/create-book.dto';
import { CreateBorrowDto } from './dto/create-borrow.dto';
import { LibraryService } from './library.service';
import { UpdateBookDto } from './dto/update-book.dto';

@ApiTags('library')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('library')
export class LibraryController {
  constructor(private readonly library: LibraryService) {}

  @Get('books')
  @Roles(UserRole.ADMIN, UserRole.LIBRARIAN, UserRole.TEACHER, UserRole.STUDENT)
  books(@Query() query: PaginationQueryDto) {
    return this.library.books(query);
  }

  @Get('books/:id')
  @Roles(UserRole.ADMIN, UserRole.LIBRARIAN, UserRole.TEACHER, UserRole.STUDENT)
  book(@Param('id') id: string) {
    return this.library.book(id);
  }

  @Post('books')
  @Roles(UserRole.ADMIN, UserRole.LIBRARIAN)
  createBook(@Body() dto: CreateBookDto) {
    return this.library.createBook(dto);
  }

  @Patch('books/:id')
  @Roles(UserRole.ADMIN, UserRole.LIBRARIAN)
  updateBook(@Param('id') id: string, @Body() dto: UpdateBookDto) {
    return this.library.updateBook(id, dto);
  }

  @Delete('books/:id')
  @Roles(UserRole.ADMIN, UserRole.LIBRARIAN)
  removeBook(@Param('id') id: string) {
    return this.library.removeBook(id);
  }

  @Get('borrows')
  @Roles(UserRole.ADMIN, UserRole.LIBRARIAN)
  borrows(@Query() query: PaginationQueryDto & { studentId?: string; bookId?: string; returned?: boolean }) {
    return this.library.borrows(query);
  }

  @Post('borrows')
  @Roles(UserRole.ADMIN, UserRole.LIBRARIAN)
  createBorrow(@Body() dto: CreateBorrowDto) {
    return this.library.createBorrow(dto);
  }

  @Patch('borrows/:id/return')
  @Roles(UserRole.ADMIN, UserRole.LIBRARIAN)
  returnBook(@Param('id') id: string) {
    return this.library.returnBook(id);
  }
}
