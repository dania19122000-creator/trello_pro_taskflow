import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { ColumnsService } from './columns.service';
import { UpdateColumnDto } from './dto/update-column.dto';
import { CreateColumnDto } from './dto/create-column.dto';

@Controller('columns')
@UseGuards(JwtAuthGuard)
export class ColumnsController {
    constructor(private columnsService: ColumnsService) {}


    @Get('board/:boardId')
    async findByBoardId(@Param('boardId') boardId: string, @Request() req) {
        return this.columnsService.findByBoardId(+boardId, req.user.id);
    }


    @Get(':id')
    async findOne(@Param('id') id: string, @Request() req) {
        return this.columnsService.findById(+id, req.user.id);
    }

    @Post('board/:boardId')
    @HttpCode(HttpStatus.CREATED)
    async create(
        @Param('boardId') boardId: string,
        @Body() dto: CreateColumnDto,
        @Request() req,
    ) {
        return this.columnsService.create(+boardId, req.user.id, dto);
    }

    @Put(':id')
    async update(
        @Param('id') id: string,
        @Body() dto: UpdateColumnDto,
        @Request() req,
    ) {
        return this.columnsService.update(+id, req.user.id, dto);
    }


    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    async delete(@Param('id') id: string, @Request() req) {
        return this.columnsService.delete(+id, req.user.id);
    }


    @Patch('board/:boardId/reorder')
    @HttpCode(HttpStatus.OK)
    async reorderColuns(
        @Param('boardId') boardId: string,
        @Body('columnIds') columnIds: number[],
        @Request() req,
    ) {
        return this.columnsService.reorderColumns(+boardId, req.user.id, columnIds);
    }
}
