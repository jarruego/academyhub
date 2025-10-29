import { Controller, Get, UseGuards, Post, Body, Put, Param, Delete } from "@nestjs/common";
import { AuthUserService } from "./auth_user.service";
import { RoleGuard } from "src/guards/role.guard";
import { Role } from "src/guards/role.enum";
import { CreateUserDTO } from "src/dto/auth/create-user.dto";
import { UpdateUserDTO } from "src/dto/auth/update-user.dto";

@Controller('auth/users')
export class AuthUserController {
  constructor(private readonly authUserService: AuthUserService) {}

  @UseGuards(RoleGuard([Role.ADMIN]))
  @Get()
  async findAll() {
    return this.authUserService.findAll();
  }

  @UseGuards(RoleGuard([Role.ADMIN]))
  @Post()
  async create(@Body() createUserDto: CreateUserDTO) {
    return this.authUserService.createUser(createUserDto);
  }

  @UseGuards(RoleGuard([Role.ADMIN]))
  @Put(':id')
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDTO) {
    return this.authUserService.updateUser(Number(id), updateUserDto);
  }

  @UseGuards(RoleGuard([Role.ADMIN]))
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.authUserService.deleteUser(Number(id));
    return { success: true };
  }
}
