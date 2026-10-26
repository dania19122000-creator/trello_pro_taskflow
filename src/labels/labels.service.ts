import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from 'generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateLabelDto } from './dto/create-label.dto';
import { UpdateLabelDto } from './dto/update-label.dto';
import { EventsGateway } from 'src/events/events.gateway';

@Injectable()
export class LabelsService {
    constructor(private prisma: PrismaService,
                private eventsGateway: EventsGateway
    ) {}

    private readonly roleHierarchy: Record<Role, number> = {
        [Role.OWNER]: 3,
        [Role.ADMIN]: 2,
        [Role.VIEWER]: 1,
    };



    async findByBoardId(boardId: number, userId: number) {
        await this.checkBoardAccess(boardId, userId);

        return this.prisma.label.findMany({
            where: { boardId },
            orderBy: { id: 'asc' },
            include: {
                cards: {
                    include: {
                        card: {
                            select: { id: true, title: true },
                        },
                    },
                },
            },
        });

    }


    async findById(id: number, userId: number) {
        const label = await this.prisma.label.findUnique({
            where: { id },
            include: {
                board: {
                    include: {
                        members: true,
                    },
                },
                cards: {
                    include: {
                        card: {
                            select: { id: true, title: true },
                        },
                    },
                },
            },
        });



        if(!label) {
            throw new NotFoundException('Label not found');
        }

        const member = label.board.members.find((m) => m.userId === userId);
        if(!member) {
            throw new ForbiddenException('You do not have access to this label');
        }
        return label;
    }



    async create(boardId: number, userId: number, dto: CreateLabelDto) {
        await this.checkBoardAccess(boardId, userId, Role.ADMIN);

        const existing = await this.prisma.label.findFirst({
            where: {
                boardId,
                name: dto.name,
            },
        });

        if(existing) {
            throw new ConflictException('Label with this name already exists on this board');
        }

        const label = await this.prisma.label.create({
            data: {
                name: dto.name,
                color: dto.color,
                boardId,
            },
            include: {
                cards: true,
            },
        });

        this.eventsGateway.emitBoardUpdated(boardId, label);
        return label;
    }


    async update(id: number, userId: number, dto: UpdateLabelDto) {
        const label = await this.prisma.label.findUnique({
            where: { id },
            include: {
                board: {
                    include: {
                        members: true,
                    },
                },
            },
        });

        if(!label) {
            throw new NotFoundException('Label not found');
        }

        const member = label.board.members.find((m) => m.userId === userId);
        if(!member) {
            throw new ForbiddenException('You dont have access to this label');
        }

        if(this.roleHierarchy[member.role] < this.roleHierarchy[Role.ADMIN]){
            throw new ForbiddenException('You need ADMIN role to update labels');
        }

        if (dto.name && dto.name !== label.name) {
            const existing = await this.prisma.label.findFirst({
                where: {
                    boardId: label.boardId,
                    name: dto.name,
                    id: { not: id },
                },
            });

            if(existing) {
                throw new ConflictException('Label with this name already exists on this board');
            }

        }

        const updated = await this.prisma.label.update({
            where: { id },
            data: {
                name: dto.name,
                color: dto.color,
            },
            include: { 
                cards: true,
            },
        });

        this.eventsGateway.emitBoardUpdated(label.boardId, updated);

        return updated;
    }





    async delete(id: number, userId: number) {
        const label = await this.prisma.label.findUnique({
            where: { id },
            include: {
                board: {
                    include: {
                        members: true,
                    },
                },
            },
        });

        if(!label) {
            throw new NotFoundException('Label not found');
        }

        const member = label.board.members.find((m) => m.userId === userId)
        if(!member) {
            throw new ForbiddenException('You dont have access to this label');
        }

        if(this.roleHierarchy[member.role] < this.roleHierarchy[Role.ADMIN]) {
            throw new ForbiddenException('You need ADMIN role to delete labels');
        }


        const boardId = label.boardId;
        await this.prisma.$transaction([
            this.prisma.cardLabel.deleteMany({
                where: { labelId: id },
            }),
            this.prisma.label.delete({ where: { id } }),
        ]);

        this.eventsGateway.emitBoardUpdated(boardId, { deleted: true, id });


        return { message: 'Label deleted successfully' };
    }






    async addLabelToCard(labelId: number, cardId: number, userId: number) {
        const label = await this.prisma.label.findUnique({
            where: { id: labelId },
            include: {
                board: {
                    include: {
                        members: true,
                    },
                },
            },
        });

        if(!label) {
            throw new NotFoundException('Label not found');
        }

        const card = await this.prisma.card.findUnique({
            where: { id: cardId },
            include: {
                column: {
                    include: {
                        board: true,
                    },
                },
            },
        });

        if(!card) {
            throw new NotFoundException('Card not found');
        }

        if(card.column.boardId !== label.boardId) {
            throw new BadRequestException('Label and card must belong to the same board');
        }

        const member = label.board.members.find((m) => m.userId === userId);
        if(!member) {
            throw new ForbiddenException('You dont have access to this labels');
        }


        if(this.roleHierarchy[member.role] < this.roleHierarchy[Role.ADMIN]) {
            throw new ForbiddenException('You need ADMIN role to add labels');
        }


        const existing = await this.prisma.cardLabel.findFirst({
            where: { cardId, labelId },
        });

        if(existing) {
            throw new ConflictException('Label already attached to this card');
        }

        const cardLabel = await this.prisma.cardLabel.create({
            data: { cardId, labelId },
            include: {
                label: true,
                card: { select: { id: true, title: true } },
            },
        });

        this.eventsGateway.emitBoardUpdated(label.boardId, cardLabel);
        return cardLabel;
    }


    async removeLabelFromCard(labelId: number, cardId: number, userId: number) {
        const label = await this.prisma.label.findUnique({
            where: { id: labelId },
            include: {
                board: {
                    include: {
                        members: true,
                    },
                },
            },
        });

        if(!label) {
            throw new NotFoundException('Label not found');
        }

        const member = label.board.members.find((m) => m.userId === userId);
        if(!member) {
            throw new ForbiddenException('You dont have access to this label');
        }

        if(this.roleHierarchy[member.role] < this.roleHierarchy[Role.ADMIN]){
            throw new ForbiddenException('You need ADMIN role to remove labels');
        }

        const existing = await this.prisma.cardLabel.findFirst({
            where: { cardId, labelId},
        });

        if(!existing) {
            throw new NotFoundException('Label is not attached to this card');
        }

        await this.prisma.cardLabel.delete({ where: { id: existing.id} });

        this.eventsGateway.emitBoardUpdated(label.boardId, {
            deleted: true,
            labelId,
            cardId,
        })
        return { message: 'Label removed from card succeddfully' };
    }



    private async checkBoardAccess(
        boardId: number,
        userId: number,
        requiredRole?: Role,
    ) {
        const board = await this.prisma.board.findUnique({
            where: { id: boardId },
            include: {
                members: true,
            },
        });

        if(!board) {
            throw new NotFoundException('Board not found');
        }

        const member = board.members.find((m) => m.userId === userId);
        if(!member) {
            throw new ForbiddenException('You dont have access to this board');
        }

        if( 
            requiredRole && 
            this.roleHierarchy[member.role] < this.roleHierarchy[requiredRole]
        ) {
            throw new ForbiddenException(
                `You need ${requiredRole} role to perform this action`,
            );
        }

        return board;
    }

    



}
