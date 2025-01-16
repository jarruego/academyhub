import { Controller, Post, Body, Put, Param, Get, Query } from '@nestjs/common';
import { CreateUserDTO } from '../../dto/user/create-user.dto';
import { UpdateUserDTO } from '../../dto/user/update-user.dto';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  async create(@Body() createUserDTO: CreateUserDTO) {
    return this.userService.create(createUserDTO);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateUserDTO: UpdateUserDTO) {
    const numericId = parseInt(id, 10);
    return this.userService.update(numericId, updateUserDTO);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const numericId = parseInt(id, 10);
    return this.userService.findById(numericId);
  }

  @Get()
  async findAll(@Query() query: any) {
    return this.userService.findAll(query);
  }
}
