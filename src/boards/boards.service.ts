import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';
import { Role } from 'generated/prisma/enums';
import { EventsGateway } from 'src/events/events.gateway';

@Injectable()
export class BoardsService {
    constructor(private prisma: PrismaService,
                private eventsGateway: EventsGateway
    ) {}

    async findAll(userId: number) {
        return this.prisma.board.findMany({
            where: {
                members: { some: { userId } },
            },
            include: {
                columns: {
                    orderBy: { order: 'asc' },
                    include: {
                        cards: {
                            orderBy: { order: 'asc' },
                        },
                    },
                },
                members: {
                    include: { user: true },
                },
            },
        });
    }


    async findById(id: number, userId: number) {
        const board = await this.prisma.board.findFirst({
            where: {
                id, 
                members: { some: { userId } },
            },
            include: {
                columns: {
                    orderBy: { order: 'asc' },
                    include: {
                        cards: {
                            orderBy: { order: 'asc' },
                        },
                    },
                },
                members: {
                    include: { user: true },
                },
            },

        });
        if(!board) throw new NotFoundException('Board not found');
        return board;
    }


    async create(userId: number, dto: CreateBoardDto) {
        const board = await this.prisma.board.create({
            data: {
                title: dto.title,
                description: dto.description,
                ownerId: userId,
                members: {
                    create: { userId, role: 'OWNER' },
                },
            },
            include: {
                columns: true,
                members: true,
            },
        });
        this.eventsGateway.emitBoardUpdated(board.id, board);
        return board;
    }


    async update(id: number, userId: number, dto: UpdateBoardDto) {
        await this.checkAccess(id, userId, Role.ADMIN);
        const board = await this.prisma.board.update({
            where: { id },
            data: dto,
            include: {
                columns: true,
                members: true,
            },
        });
        this.eventsGateway.emitBoardUpdated(id, board);
        return board;
    }


    async delete(id: number, userId: number) {
        await this.checkAccess(id, userId, Role.OWNER);

        await this.prisma.$transaction(async (tx) => {
            const columns = await tx.column.findMany({
                where: { boardId: id },
                select: { id: true },
            });
            const columnIds = columns.map((column) => column.id);
            const cards = await tx.card.findMany({
                where: { columnId: { in: columnIds } },
                select: { id: true },
            });
            const cardIds = cards.map((card) => card.id);
            const labels = await tx.label.findMany({
                where: { boardId: id },
                select: { id: true },
            });
            const labelIds = labels.map((label) => label.id);

            await tx.comment.deleteMany({
                where: { cardId: { in: cardIds } },
            });
            await tx.cardLabel.deleteMany({
                where: {
                    OR: [
                        { cardId: { in: cardIds } },
                        { labelId: { in: labelIds } },
                    ],
                },
            });
            await tx.card.deleteMany({
                where: { id: { in: cardIds } },
            });
            await tx.column.deleteMany({
                where: { id: { in: columnIds } },
            });
            await tx.label.deleteMany({
                where: { id: { in: labelIds } },
            });
            await tx.boardMember.deleteMany({ where: { boardId: id } });
            await tx.board.delete({ where: { id } });
        });

        this.eventsGateway.emitBoardUpdated(id, { deleted: true, id });
        return { message: 'Board deleted' };
    } 
    async addMember(boardId: number, requesterId: number, userId: number, role: Role = Role.VIEWER) {
        await this.checkAccess(boardId, requesterId, Role.ADMIN);
        if (role === Role.OWNER) {
            throw new ForbiddenException('Cannot assign the OWNER role');
        }
        const board = await this.prisma.board.findUnique({
            where: { id: boardId },
        });
        if(!board) {
            throw new NotFoundException('Board not found');

        }

        const member = await this.prisma.boardMember.create({
            data: {
                boardId,
                userId,
                role,
            },
        });
        this.eventsGateway.emitBoardUpdated(boardId, member);
        return member;
    }

    async removeMember(boardId: number, requesterId: number, userId: number) {
        await this.checkAccess(boardId, requesterId, Role.ADMIN);
        const member = await this.prisma.boardMember.findFirst({

            where: { boardId, userId },
        });
        if(!member) throw new NotFoundException('Member not found');
        if(member.role === 'OWNER') {
            throw new ForbiddenException('Cannot remove board owner');
        }
        await this.prisma.boardMember.delete({ where: { id: member.id } });

        this.eventsGateway.emitBoardUpdated(boardId, { deleted: true, userId });
        return { message: 'Member removed' };
    }


    private async checkAccess(boardId: number, userId: number, requiredRole: Role = Role.VIEWER) {
        const board = await this.prisma.board.findFirst({
            where: {
                id: boardId,
                members: { some: { userId } },
            },
            include: { members: { where: { userId } } },
        });
        if(!board) throw new NotFoundException('Board not found');
        const roleHierarchy: Record<Role, number> = {
            [Role.OWNER]: 3,
            [Role.ADMIN]: 2,
            [Role.VIEWER]: 1,
        };
        if (roleHierarchy[board.members[0].role] < roleHierarchy[requiredRole]) {
            throw new ForbiddenException(`You need ${requiredRole} role to perform this action`);
        }
        return board;
    }
}
