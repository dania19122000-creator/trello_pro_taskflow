import { Body, Controller, Delete, Get, Param, Put, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
    constructor(private usersService: UsersService){}

    @Get()
    findAll() {
        return this.usersService.findAll();
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.usersService.findById(+id);
    }

    @Put(':id')
    update(@Param('id') id: string, @Body() dto: UpdateUserDto, @Request() req) {
        return this.usersService.update(+id, req.user.id, dto);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @Request() req) {
        return this.usersService.remove(+id, req.user.id);
    }
}
