import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { LabelsService } from './labels.service';
import { CreateLabelDto } from './dto/create-label.dto';
import { UpdateLabelDto } from './dto/update-label.dto';

@Controller('labels')
@UseGuards(JwtAuthGuard)
export class LabelsController {
    constructor(private labelsService: LabelsService) {}

    @Get('board/:boardId')
    async findByBoardId(@Param('boardId') boardId: string, @Request() req) {
        return this.labelsService.findByBoardId(+boardId, req.user.id);
    }

    @Get(':id')
    async findOne(@Param('id') id: string, @Request() req){
        return this.labelsService.findById(+id, req.user.id);
    }

    @Post('board/:boardId')
    @HttpCode(HttpStatus.CREATED)
    async create(
        @Param('boardId') boardId: string,
        @Body() dto: CreateLabelDto,
        @Request() req,
    ){
        return this.labelsService.create(+boardId, req.user.id, dto);
    }


    @Put(':id')
    async update(
        @Param('id') id: string,
        @Body() dto: UpdateLabelDto,
        @Request() req,
    ){
        return this.labelsService.update(+id, req.user.id, dto);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    async delete(@Param('id') id: string, @Request() req) {
        return this.labelsService.delete(+id, req.user.id);
    }

    @Post(':labelId/card/:cardId')
    @HttpCode(HttpStatus.CREATED)
    async addLabelToCard(
        @Param('labelId') labelId: string,
        @Param('cardId') cardId: string,
        @Request() req,
    ){
        return this.labelsService.addLabelToCard(+labelId, +cardId, req.user.id);
    }


    @Delete(':labelId/card/:cardId')
    @HttpCode(HttpStatus.OK)
    async removeLabelFromCard(
        @Param('labelId') labelId: string,
        @Param('cardId') cardId: string,
        @Request() req,
    ){
        return this.labelsService.removeLabelFromCard(+labelId, +cardId, req.user.id)
    }


}
