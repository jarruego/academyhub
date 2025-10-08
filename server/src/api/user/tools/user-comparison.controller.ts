import { Controller, Get, Post, Delete, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { UserComparisonService, UserComparison } from './user-comparison.service';
import { RoleGuard } from '../../../guards/role.guard';
import { Role } from '../../../guards/role.enum';

export interface LinkUsersDto {
  bdUserId: number;
  moodleUserId: number;
}

export interface UnlinkUsersDto {
  bdUserId: number;
  moodleUserId: number;
}

@Controller('user-comparison')
@UseGuards(RoleGuard([Role.ADMIN]))
export class UserComparisonController {
  constructor(private readonly userComparisonService: UserComparisonService) {}

  @Get('compare')
  async compareUsers(): Promise<UserComparison> {
    return this.userComparisonService.compareUsers();
  }

  @Post('link')
  async linkUsers(@Body() linkUsersDto: LinkUsersDto) {
    const { bdUserId, moodleUserId } = linkUsersDto;
    return this.userComparisonService.linkUsers(bdUserId, moodleUserId);
  }

  @Post('unlink')
  async unlinkUsers(@Body() unlinkUsersDto: UnlinkUsersDto) {
    const { bdUserId, moodleUserId } = unlinkUsersDto;
    try {
      const result = await this.userComparisonService.unlinkUsers(bdUserId, moodleUserId);
      return result;
    } catch (error) {
      console.error('🔧 Error in unlink controller:', error);
      throw error;
    }
  }
}