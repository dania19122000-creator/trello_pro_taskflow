import { Body, Controller, Delete, Get, Param, Post, Put, Request, UseGuards } from '@nestjs/common';
import { BoardsService } from './boards.service';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { Role } from 'generated/prisma/enums';

@Controller('boards')
@UseGuards(JwtAuthGuard)
export class BoardsController {
    constructor(private boardsService: BoardsService) {}

    @Get()
    findAll(@Request() req) {
        return this.boardsService.findAll(req.user.id);
    }

    @Get(':id')
    findOne(@Param('id') id: string, @Request() req) {
        return this.boardsService.findById(+id, req.user.id);
    }


    @Post()
    create(@Body() dto: CreateBoardDto, @Request() req) {
        return this.boardsService.create(req.user.id, dto);
    }

    @Put(':id')
    update(@Param('id') id: string, @Body() dto: UpdateBoardDto, @Request() req) {
        return this.boardsService.update(+id, req.user.id, dto);
    }

    @Delete(':id')
    delete(@Param('id') id: string, @Request() req) {
        return this.boardsService.delete(+id, req.user.id);
    }

    @Post(':id/members')
    addMember(@Param('id') id: string, @Body('userId') userId: number, @Body('role') role: Role = Role.VIEWER, @Request() req) {
        return this.boardsService.addMember(+id, req.user.id, userId, role);
    }

    @Delete(':id/members/:userId')
        removeMember(@Param('id') id: string, @Param('userId') userId: string, @Request() req) {
        return this.boardsService.removeMember(+id, req.user.id, +userId);
  }
}
