import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from 'generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { EventsGateway } from 'src/events/events.gateway';

@Injectable()
export class CommentsService {
    constructor(private prisma: PrismaService,
                private eventsGateway: EventsGateway
    ) {}

    private readonly roleHierarchy: Record<Role, number> = {
        [Role.OWNER]: 3,
        [Role.ADMIN]: 2,
        [Role.VIEWER]: 1,
    };

    //=========================


    async findByCardId(cardId: number, userId: number) {
        await this.checkCardAccess(cardId, userId);

        return this.prisma.comment.findMany({
            where: { cardId },
            orderBy: { createdAt: 'asc' },
            include: {
                user: {
                    select: { id: true, name: true, email: true },
                },
            },
        });
    }



    async findById(id: number, userId: number) {
        const comment = await this.prisma.comment.findUnique({
            where: { id },
            include: {
                card: {
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
                    },
                },
                user: {
                    select: { id: true, name: true, email: true },
                },
            },
        });


        if(!comment) {
            throw new NotFoundException('Comment not found');
        }

        const member = comment.card.column.board.members.find(
            (m) => m.userId === userId,
        );
        if(!member) {
            throw new ForbiddenException('You do not have access to this comment');
        }


        return comment;

    }



    async create(cardId: number, userId: number, dto: CreateCommentDto) {
        await this.checkCardAccess(cardId, userId, Role.VIEWER);

        const comment = await this.prisma.comment.create({
            data: {
                content: dto.content,
                cardId,
                userId,
            },
            include: {
                user: {
                    select: { id: true, name: true, email: true },
                },
            },
        });
        const card = await this.prisma.card.findUnique({
            where: { id: cardId },
            select: { column: { select: { boardId: true } } },
        });
        if(card) {
        this.eventsGateway.emitCommentAdded(card.column.boardId, comment);
        }
        return comment;
    }



    async update(id: number, userId: number, dto: UpdateCommentDto) {
        const comment = await this.prisma.comment.findUnique({
            where: { id },
            include: {
                card: {
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
                    },
                },
            },
        });

        if(!comment) {
            throw new NotFoundException('Comment not found');
        }

        const member = comment.card.column.board.members.find(
            (m) => m.userId === userId,
        );

        if(!member) {
            throw new ForbiddenException('You do not have access to this comment');
        }


        const isAuthor = comment.userId === userId;
        const isPrivileged = this.roleHierarchy[member.role] >= this.roleHierarchy[Role.ADMIN];

        if(!isAuthor && !isPrivileged) {
            throw new ForbiddenException('You can only edit your own comments');
        }

        const updated = await this.prisma.comment.update({
            where: { id },
            data: { content: dto.content },
            include: {
                user: {
                    select: { id: true, name: true, email: true },
                },
            },
        });

        this.eventsGateway.emitCommentAdded(comment.card.column.boardId, {
            ...updated,
            updated: true,
        });

        return updated;
    }



    async delete(id: number, userId: number) {
        const comment = await this.prisma.comment.findUnique({
            where: { id },
            include: {
                card: {
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
                    },
                },
            },
        });

        if(!comment) {
            throw new NotFoundException('Comment not found');

        }

        const member = comment.card.column.board.members.find(
            (m) => m.userId === userId,
        );
        if(!member) {
            throw new ForbiddenException('You do not have access to this comment');
        }

        const isAuthor = comment.userId === userId;
        const isPrivileged = this.roleHierarchy[member.role] >= this.roleHierarchy[Role.ADMIN];


        if(!isAuthor && !isPrivileged) {
            throw new ForbiddenException('You can only delete your own comments');

        }

        const boardId = comment.card.column.boardId;
        await this.prisma.comment.delete({ where: { id } });


        this.eventsGateway.emitCommentAdded(boardId, {
            deleted: true,
            id,
        })
        return { message: 'Comment delete successfully' };
    }



    private async checkCardAccess(
        cardId: number,
        userId: number,
        requiredRole?: Role,
    ) {
        const card = await this.prisma.card.findUnique({
            where: { id: cardId },
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
            },
        });

        if(!card) {
            throw new NotFoundException('Card not found');
        }

        const member = card.column.board.members.find((m) => m.userId === userId);
        if(!member) {
            throw new ForbiddenException('You do not have access to this card');
        }


        if(
            requiredRole && 
            this.roleHierarchy[member.role] < this.roleHierarchy[requiredRole]
        ) {
            throw new ForbiddenException(
                `You need ${requiredRole} role to perform this action`,
            );
        }

        return card;
        
    }

}
