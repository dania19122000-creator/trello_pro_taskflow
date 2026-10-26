import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@Controller('comments')
@UseGuards(JwtAuthGuard)
export class CommentsController {
    constructor(private commentsService: CommentsService) {}

    @Get('card/:cardId')
    async findByCardId(@Param('cardId') cardId: string, @Request() req) {
        return this.commentsService.findByCardId(+cardId, req.user.id);
    }


    @Get(':id')
    async findOne(@Param('id') id: string, @Request() req) {
        return this.commentsService.findById(+id, req.user.id);
    }


    @Post('card/:cardId')
    @HttpCode(HttpStatus.CREATED)
    async create(
        @Param('cardId') cardId: string,
        @Body() dto: CreateCommentDto,
        @Request() req,
    ) {
        return this.commentsService.create(+cardId, req.user.id, dto);
    }

    @Put(':id')
    async update(
        @Param('id') id: string,
        @Body() dto: UpdateCommentDto,
        @Request() req,
    ) {
        return this.commentsService.update(+id, req.user.id, dto)
    }


    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    async delete(@Param('id') id: string, @Request() req) {
        return this.commentsService.delete(+id, req.user.id)
    }
}
