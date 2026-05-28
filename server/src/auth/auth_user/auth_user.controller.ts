import { Controller, Get, UseGuards, Post, Body, Put, Param, Delete } from "@nestjs/common";
import { AuthUserService } from "./auth_user.service";
import { RoleGuard } from "src/guards/role.guard";
import { Role } from "src/guards/role.enum";
import { CreateUserDTO } from "src/dto/auth/create-user.dto";
import { UpdateUserDTO } from "src/dto/auth/update-user.dto";

@Controller('auth/users')
export class AuthUserController {
  constructor(private readonly authUserService: AuthUserService) {}

  // === Vínculos entre auth_user y moodle_user ===
  @UseGuards(RoleGuard([Role.ADMIN]))
  @Get(':id/moodle-links')
  async getMoodleLinks(@Param('id') id: string) {
    return this.authUserService.getMoodleLinksByAuthUser(Number(id));
  }

  @UseGuards(RoleGuard([Role.ADMIN]))
  @Post(':id/moodle-links')
  async addMoodleLink(
    @Param('id') id: string,
    @Body() dto: { id_moodle_user: number; moodle_token: string }
  ) {
    return this.authUserService.addMoodleLink({
      id_auth_user: Number(id),
      id_moodle_user: dto.id_moodle_user,
      moodle_token: dto.moodle_token,
    });
  }

  @UseGuards(RoleGuard([Role.ADMIN]))
  @Put('moodle-links/:linkId')
  async updateMoodleLink(
    @Param('linkId') linkId: string,
    @Body() dto: { moodle_token: string }
  ) {
    return this.authUserService.updateMoodleLink(Number(linkId), dto);
  }

  @UseGuards(RoleGuard([Role.ADMIN]))
  @Delete('moodle-links/:linkId')
  async deleteMoodleLink(@Param('linkId') linkId: string) {
    return this.authUserService.deleteMoodleLink(Number(linkId));
  }

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
