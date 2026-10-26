import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import { Role } from 'generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCardDto } from './dto/create-card.dto';
import { UpdateCardDto } from './dto/update-card.dto';
import { MoveCardDto } from './dto/move-card.dto';
import { EventsGateway } from 'src/events/events.gateway';

@Injectable()
export class CardsService {
    constructor(private prisma: PrismaService,
                private eventsGateway: EventsGateway, 
    ) {}

    private readonly roleHierarchy: Record<Role, number> = {
        [Role.OWNER]: 3,
        [Role.ADMIN]: 2,
        [Role.VIEWER]: 1,
    };



    //===========================

    async findByColumnId(columnId: number, userId: number) {
        await this.checkColumnAccess(columnId, userId);
        return this.prisma.card.findMany({
            where: { columnId },
            orderBy: { order: 'asc' },
            include: {
                assignee: { select: { id: true, name: true, email: true } },
                labels: { include: { label: true } },
                comments: {
                    orderBy: { createdAt: 'asc' },
                    include: { user: { select: { id: true, name: true, email: true} } },
                },
            },
        });
    }

    async findById(id: number, userId: number) {
        return this.checkCardAccess(id, userId);
    }



    async create(columnId: number, userId: number, dto: CreateCardDto) {
        await this.checkColumnAccess(columnId, userId, Role.ADMIN);
        await this.validateOrder(dto.order);


        if(dto.assigneeId) {
            await this.checkBoardMember(dto.assigneeId, columnId);
        }
        if(dto.labelIds?.length) {
            await this.checkLabels(dto.labelIds, columnId);
        }

        const { cardId, boardId } = await this.prisma.$transaction(async (tx) => {
            const existingCards = await tx.card.findMany({
                where: { columnId },
                orderBy: { order: 'asc' },
            });

            let targetOrder = dto.order ?? existingCards.length;
            targetOrder = Math.min(targetOrder, existingCards.length);

            if(targetOrder < existingCards.length) {
                await tx.card.updateMany({
                    where: {
                        columnId,
                        order: { gte: targetOrder },
                    },
                    data: { order: { increment: 1 } },
                });
            }

            const card = await tx.card.create({
                data: {
                    title: dto.title,
                    description: dto.description,
                    columnId,
                    order: targetOrder,
                    assigneeId: dto.assigneeId,
                    dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
                },
                include: {
                    assignee: { select: { id: true, name: true, email: true } },
                    labels: { include: { label: true } },
                },
            });

            if(dto.labelIds?.length) {
                await this.addLabelsToCard(tx, card.id, dto.labelIds);
            }

            const column = await tx.column.findUnique({
                where: { id: columnId },
                select: { boardId: true },
            });

            if (!column) {
                throw new NotFoundException('Column not found');
            }

            return { cardId: card.id, boardId: column.boardId };
        });

        const result = await this.findById(cardId, userId);
        this.eventsGateway.emitCardCreated(boardId, result);
        return result;
    }


    async update(id: number, userId:  number, dto: UpdateCardDto) {
        const card = await this.checkCardAccess(id, userId, Role.ADMIN);

        if(dto.columnId) {
            throw new BadRequestException('Use moveCard endpoint to change column or order');
        }

        if(dto.assigneeId !== undefined && dto.assigneeId !== null) {
            await this.checkBoardMember(dto.assigneeId, card.columnId);
        }

        await this.prisma.$transaction(async (tx) => {
            await tx.card.update({
                where: { id },
                data: {
                    title: dto.title,
                    description: dto.description,
                    assigneeId: dto.assigneeId,
                    dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
                },
            });

            if(dto.labelIds) {
                await tx.cardLabel.deleteMany({ where: { cardId: id } });
                if(dto.labelIds.length > 0) {
                    await this.addLabelsToCard(tx, id, dto.labelIds);
                }
            }
        });

        const result = await this.findById(id, userId);

        this.eventsGateway.emitCardUpdated(result.column.boardId, result);

        return result;
    }



    async moveCard(id: number, userId: number, dto: MoveCardDto) {
        const card = await this.checkCardAccess(id,userId, Role.ADMIN);
        await this.validateOrder(dto.order);

        const targetColumn = await this.checkColumnAccess(
            dto.columnId,
            userId,
            Role.ADMIN,
        );

        if(card.column.boardId !== targetColumn.boardId) {
            throw new BadRequestException('Cannot move card to a different board');
        }



        const isSameColumn = card.columnId === dto.columnId;

        await this.prisma.$transaction(async (tx) => {
            if(!isSameColumn) {
                await tx.card.updateMany({
                    where: {
                        columnId: card.columnId,
                        order: { gt: card.order },
                    },
                    data: { order: { decrement: 1 } },
                });
            }


            const cardsInTarget = await tx.card.findMany({
                where: { columnId: dto.columnId },
                orderBy: { order: 'asc' },
            });

            let targetOrder = dto.order ?? cardsInTarget.length;

            if(isSameColumn) {
                const filtered = cardsInTarget.filter((c) => c.id !== id);
                targetOrder = Math.min(targetOrder, filtered.length);
            } else {
                targetOrder = Math.min(targetOrder, cardsInTarget.length);
            }


            if(!isSameColumn) {
                await tx.card.updateMany({
                    where: {
                        columnId: dto.columnId,
                        order: { gte: targetOrder },
                    },
                    data: { order: { increment: 1 } },
                });
            } else {
                const oldOrder = card.order;

                if(oldOrder < targetOrder) {
                    await tx.card.updateMany({
                        where: {
                            columnId: dto.columnId,
                            order: { gt: oldOrder, lte: targetOrder },
                            id: { not: id },
                        },
                        data: { order: { decrement: 1 } },
                    });
                } else if(oldOrder > targetOrder) {
                    await tx.card.updateMany({
                        where: {
                            columnId: dto.columnId,
                            order: { gte: targetOrder, lt: oldOrder },
                            id: { not: id },
                        },
                        data: { order: { increment: 1 } },
                    });
                }
            }
            await tx.card.update({
                where: { id },
                data: {
                    columnId: dto.columnId,
                    order: targetOrder,
                },
            });
        });

        const result = await this.findById(id, userId);

        this.eventsGateway.emitCardMoved(result.column.boardId, result);

        return result;

    }


    async delete(id: number, userId: number) {
        const card = await this.checkCardAccess(id, userId, Role.ADMIN);
        const boardId = card.column.boardId;

        await this.prisma.$transaction(async (tx) => {
            await tx.comment.deleteMany({ where: { cardId: id } });
            await tx.cardLabel.deleteMany({ where: { cardId: id } });
            await tx.card.delete({ where: { id } });

            await tx.card.updateMany({
                where: {
                    columnId: card.columnId,
                    order: { gt: card.order },
                },
                data: { order: { decrement: 1 } },
            });
        });

        this.eventsGateway.emitCardDeleted(boardId, { deleted: true, id });
        return { message: 'Card deleted successfully' };
    }




    async reorderCards(columnId: number, userId: number, cardIds: number[]) {
        await this.checkColumnAccess(columnId, userId, Role.ADMIN);

        const uniqueIds = new Set(cardIds);
        if(uniqueIds.size !== cardIds.length) {
            throw new BadRequestException('Card IDs must be unique');
        }


        const cards = await this.prisma.card.findMany({
            where: { columnId },
            orderBy: { order: 'asc' },
        });

        if (cards.length !== cardIds.length) {
            throw new BadRequestException('All cards must be included in the reorder');
        }

        const cardIdSet = new Set(cards.map((c) => c.id));
        for (const id of cardIds) {
            if(!cardIdSet.has(id)) {
                throw new NotFoundException(`Card with id ${id} not found in this column`);
            }
        }

        await this.prisma.$transaction(
            cardIds.map((id, index) => this.prisma.card.update({
                where: { id },
                data: { order: index },
            },)),
        );



        return { message: 'Cards reordered successfully' };
    }








    //===========================




    private async validateOrder(order?: number) {
        if (order !== undefined && (order < 0 || !Number.isInteger(order))){
            throw new BadRequestException('Order must be a non-negative integer');
        }

    }


    private async checkCardAccess(id: number, userId: number, requiredRole?: Role) {
        const card = await this.prisma.card.findFirst({
            where: { id },
            include: {
                column: {
                    include: {
                        board: {
                            include: {
                                members: true,
                            },
                        },
                    },
                },

                assignee: { select: { id: true, name: true, email: true } },
                labels: { include: { label: true } },
                comments: {
                    orderBy: { createdAt: 'asc' },
                    include: { user: { select: { id: true, name: true, email: true } } },
                },
            },
        });

        if(!card) throw new NotFoundException('Card not found');

        const member = card.column.board.members.find((m) => m.userId === userId);
        if (!member) throw new ForbiddenException('You do not have access to this card');

        if(requiredRole && this.roleHierarchy[member.role] < this.roleHierarchy[requiredRole]) {
            throw new ForbiddenException(`You need ${requiredRole} role to perform this action`);
        }

        return card;
    }



    private async checkColumnAccess(columnId: number, userId: number, requiredRole?: Role) {
        const column = await this.prisma.column.findFirst({
            where: { id: columnId },
            include: {
                board: {
                    include: {
                        members: true,
                    },
                },
            },
        });

        if(!column) {
            throw new NotFoundException('Column not found');
        }

        const member = column.board.members.find((m) => m.userId === userId);
        if(!member) throw new ForbiddenException('You do not have access to this column');

        if(requiredRole && this.roleHierarchy[member.role] < this.roleHierarchy[requiredRole]) {
            throw new ForbiddenException(`Yoe need ${requiredRole} role to perform this action`);
        }
        return column;
    }

    private async checkBoardMember(userId: number, columnId: number) {
        const column = await this.prisma.column.findFirst({
            where: { id: columnId },
            include: {
                board: {
                    include: {
                        members: true,
                    },
                },
            },
        });

        if (!column) throw new NotFoundException('Column not found');

        const isMember = column.board.members.some((m) => m.userId === userId);
        if(!isMember) {
            throw new BadRequestException('User is not a member of this board');
        }
    }


    private async checkLabels(labelIds: number[], columnId: number) {
        const column = await this.prisma.column.findFirst({
            where: { id: columnId },
            include: {
                board: {
                    include: {
                        labels: true,
                    },
                },
            },
        });

        if(!column) throw new NotFoundException('Column not found');

        const boardLabelIds = column.board.labels.map((l) => l.id);
        for (const labelId of labelIds) {
            if(!boardLabelIds.includes(labelId)) {
                throw new BadRequestException(`Label ${labelId} does not belong to this board`);
            }
        }
    }

    private async addLabelsToCard(
        tx: Prisma.TransactionClient,
        cardId: number,
        labelIds: number[],
    ) {
        await tx.cardLabel.createMany({
            data: labelIds.map((labelId) => ({
                cardId,
                labelId,
            })),
            skipDuplicates: true,
        });
    }
}
