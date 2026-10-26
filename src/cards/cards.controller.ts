import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CardsService } from './cards.service';
import { CreateCardDto } from './dto/create-card.dto';
import { UpdateCardDto } from './dto/update-card.dto';
import { MoveCardDto } from './dto/move-card.dto';

@Controller('cards')
@UseGuards(JwtAuthGuard)
export class CardsController {
    constructor(private cardsService: CardsService) {}

    @Get('column/:columnId')
    async findByColumnId(@Param('columnId') columnId: string, @Request() req) {

        return this.cardsService.findByColumnId(+columnId, req.user.id);
    }


    @Get(':id')
    async findOne(@Param('id') id: string, @Request() req) {
        return this.cardsService.findById(+id, req.user.id);
    }

    @Post('column/:columnId')
    @HttpCode(HttpStatus.CREATED)
    async create(
        @Param('columnId') columnId: string,
        @Body() dto: CreateCardDto,
        @Request() req,
    ){
        return this.cardsService.create(+columnId, req.user.id, dto);
    }


    @Put(':id')
    async update(
        @Param('id') id: string,
        @Body() dto: UpdateCardDto,
        @Request() req,
    ) {
        return this.cardsService.update(+id, req.user.id, dto);
    }


    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    async delete(@Param('id') id: string, @Request() req){
        return this.cardsService.delete(+id, req.user.id);
    }

    @Patch(':id/move')
    @HttpCode(HttpStatus.OK)
    async moveCard(
        @Param('id') id: string,
        @Body() dto: MoveCardDto,
        @Request() req,
    ) {
        return this.cardsService.moveCard(+id, req.user.id, dto);
    }


    @Patch('column/:columnId/reorder')
    @HttpCode(HttpStatus.OK)
    async reorderCards(
        @Param('columnId') columnId: string,
        @Body('cardIds') cardIds: number[],
        @Request() req,
    ) {
        return this.cardsService.reorderCards(+columnId, req.user.id, cardIds);
    }
}
