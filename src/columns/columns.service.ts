import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateColumnDto } from './dto/create-column.dto';
import { UpdateColumnDto } from './dto/update-column.dto';
import { EventsGateway } from 'src/events/events.gateway';
import { Role } from 'generated/prisma/enums';

@Injectable()
export class ColumnsService {
    constructor(private prisma: PrismaService,
                private eventsGateway: EventsGateway,
    ) {}

    async findByBoardId(boardId: number, userId: number) {
        await this.checkBoardAccess(boardId, userId);

        return this.prisma.column.findMany({
            where: { boardId },
            orderBy: { order: 'asc' },
            include: {
                cards: {
                    orderBy: { order: 'asc' },
                    include: {
                        assignee: {
                            select: { id: true, name: true, email: true },
                        },
                        labels: {
                            include: {
                                label: true,
                            },
                        },
                    },
                },
            },
        });
    }


    async findById(id: number, userId: number) {
        const column = await this.prisma.column.findFirst({
            where: { id },
            include: {
                board: {
                    include: {
                        members: true,
                    },
                },
                cards: {
                    orderBy: { order: 'asc' },
                    include: {
                        assignee: {
                            select: { id: true, name: true, email: true },
                        },
                        labels: {
                            include: {
                                label: true,
                            },
                        },
                    },
                },
            },
        });

        if(!column){
            throw new NotFoundException('Column not found');
        }

        const isMember = column.board.members.some((m) => m.userId === userId);
        if(!isMember) {
            throw new ForbiddenException('You do not have access to this column');
        }

        return column;
    }


    async create(boardId: number, userId: number, dto: CreateColumnDto) {
        await this.checkBoardAccess(boardId, userId, Role.ADMIN);

        const maxOrder = await this.prisma.column.aggregate({
            where: { boardId },
            _max: { order: true },
        });

        const order = dto.order ?? (maxOrder._max.order ?? -1) + 1;

        const column = await this.prisma.column.create({
            data: {
                title: dto.title,
                boardId,
                order,
            },
            include: {
                cards: {
                    orderBy: { order: 'asc' },
                },
            },
        });

        this.eventsGateway.emitColumnCreated(boardId, column);
        return column;

    }


    async update(id: number, userId: number, dto: UpdateColumnDto) {
        const column = await this.prisma.column.findFirst({
            where: { id },
            include: {
                board: {
                    include: {
                        members: true,
                    },
                },
            },
        });
        if (!column) {
            throw new NotFoundException('Column not found');
        }

        await this.checkBoardAccess(column.boardId, userId, Role.ADMIN);

        const columnUpdate = await this.prisma.column.update({
            where: { id },
            data: dto,
            include: {
                cards: {
                    orderBy: { order: 'asc' },
                },
            },
        });

        this.eventsGateway.emitColumnUpdated(column.boardId, columnUpdate);
        return columnUpdate;
    }
    
    async delete(id: number, userId: number) {
        const column = await this.prisma.column.findFirst({
            where: { id },
            include: {
                board: {
                    include: {
                        members: true,
                    },
                },
                cards: true,
            },
        });


        if(!column) {
            throw new NotFoundException('Column not found');
        }

        await this.checkBoardAccess(column.boardId, userId, Role.ADMIN);

        if (column.cards.length > 0) {
            throw new BadRequestException('Cannot delete column with cards. Move or delete cards first.');
        }
        const boardId = column.boardId;
        await this.prisma.column.delete({ where: { id } });
        this.eventsGateway.emitColumnDeleted(boardId, { deleted: true, id });
        return { message: 'Column deleted successfully' };
    }


    async reorderColumns(boardId: number, userId: number, columnIds: number[]) {
        await this.checkBoardAccess(boardId, userId, Role.ADMIN);

        const columns = await this.prisma.column.findMany({
            where: { boardId },
        });

        const columnMap = new Map(columns.map((c) => [c.id, c]));
        for (const [index, id] of columnIds.entries()) {
            if (!columnMap.has(id)) {
                throw new NotFoundException(`Column with id ${id} not found in this board`);
            }


            await this.prisma.column.update({
                where: { id },
                data: { order: index },
            });
        }

        return { message: 'Columns reordered successfully' };
    }


    private async checkBoardAccess(boardId: number, userId: number, requiredRole: Role = Role.VIEWER) {
        const board = await this.prisma.board.findFirst({
            where: {
                id: boardId,
                members: { some: { userId } },
            },
            include: { members: { where: { userId } } },
        });

        if(!board) {
            throw new NotFoundException('Board not found or you do not have access');
        }

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
