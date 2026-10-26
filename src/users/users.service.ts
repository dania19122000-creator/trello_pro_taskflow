import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UsersService {
    constructor(private prisma: PrismaService) {}

    async findAll() {
        return this.prisma.user.findMany({
            select: { id: true, name: true, createdAt: true },
        });
    }

    async findById(id: number) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            select: { id: true, email: true, name: true, createdAt: true },
        });
        if(!user) throw new NotFoundException('User not found');
        return user;
    }

    async findByEmail(email: string) {
        return this.prisma.user.findUnique({
            where: { email },
        });
    }

    async update(id: number, requesterId: number, data: { name?: string; email?: string }){
        if (id !== requesterId) {
            throw new ForbiddenException('You can only update your own profile');
        }
        const user = await this.prisma.user.update({
            where: { id },
            data,
            select: { id: true, email: true, name: true },
        });
        return user;
    }


    async remove(id: number, requesterId: number) {
        if (id !== requesterId) {
            throw new ForbiddenException('You can only delete your own account');
        }
        const user = await this.findById(id);
        if(!user) throw new NotFoundException('Can not find user')
        await this.prisma.user.delete({ where: { id } });
        return { message: 'User deleted' };
    }
}
